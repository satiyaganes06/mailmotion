import type { RenderedAsset } from '@mailmotion/renderer';
import type { SignatureAssets } from '@mailmotion/layouts';
import type { SignatureConfig } from '@mailmotion/schema';
import type { WorkerRequest, WorkerResponse } from './render.worker';

interface Job {
  config: SignatureConfig;
  resolve: (a: RenderedAsset[] | null) => void;
  reject: (e: Error) => void;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Renders in a Web Worker so editing stays smooth. Requests are coalesced: while a render is
 * running, only the most recent request is kept (older ones resolve to `null` = superseded).
 */
export class RenderClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private running: { id: number; job: Job } | null = null;
  private queued: Job | null = null;

  constructor(private readonly fontBaseUrl = '/fonts') {}

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data);
      this.worker.onerror = (e) => this.fail(new Error(e.message || 'Render worker failed'));
    }
    return this.worker;
  }

  render(config: SignatureConfig, onProgress?: Job['onProgress']): Promise<RenderedAsset[] | null> {
    return new Promise((resolve, reject) => {
      const job: Job = { config, resolve, reject, onProgress };
      if (this.running) {
        this.queued?.resolve(null); // superseded
        this.queued = job;
      } else {
        this.start(job);
      }
    });
  }

  private start(job: Job): void {
    const id = this.nextId++;
    this.running = { id, job };
    const req: WorkerRequest = { id, config: job.config, fontBaseUrl: this.fontBaseUrl };
    this.ensureWorker().postMessage(req);
  }

  private onMessage(msg: WorkerResponse): void {
    const run = this.running;
    if (!run || run.id !== msg.id) return;
    if (msg.type === 'progress') {
      run.job.onProgress?.(msg.done, msg.total);
      return;
    }
    this.running = null;
    if (msg.type === 'done') run.job.resolve(msg.assets);
    else run.job.reject(new Error(msg.message));
    this.drain();
  }

  private fail(err: Error): void {
    const run = this.running;
    this.running = null;
    this.worker?.terminate();
    this.worker = null;
    run?.job.reject(err);
    this.drain();
  }

  private drain(): void {
    const next = this.queued;
    this.queued = null;
    if (next) this.start(next);
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.queued?.resolve(null);
    this.queued = null;
  }
}

const MIME = { gif: 'image/gif', png: 'image/png' } as const;

/** Blob URLs for the rendered files (live preview only; never exported). */
export function previewAssets(rendered: RenderedAsset[]): {
  assets: SignatureAssets;
  urls: string[];
} {
  const byFile = new Map<string, string>();
  const slots: SignatureAssets['slots'] = {};
  for (const r of rendered) {
    let url = byFile.get(r.fileName);
    if (!url) {
      url = URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: MIME[r.format] }));
      byFile.set(r.fileName, url);
    }
    slots[r.slotId] = { url, width: r.width, height: r.height };
  }
  return { assets: { slots }, urls: [...byFile.values()] };
}

/**
 * First frame of each animated GIF as a PNG blob URL, for the "classic Outlook shows frame 1 only"
 * preview. Browsers decode the first frame of a GIF when asked for an image bitmap.
 */
export async function firstFrameAssets(
  rendered: RenderedAsset[],
): Promise<{ assets: SignatureAssets; urls: string[] }> {
  const byFile = new Map<string, string>();
  const slots: SignatureAssets['slots'] = {};
  for (const r of rendered) {
    let url = byFile.get(r.fileName);
    if (!url) {
      if (r.format === 'gif') {
        try {
          const bmp = await createImageBitmap(
            new Blob([r.bytes as BlobPart], { type: 'image/gif' }),
          );
          const c = document.createElement('canvas');
          c.width = bmp.width;
          c.height = bmp.height;
          c.getContext('2d')!.drawImage(bmp, 0, 0);
          const blob = await new Promise<Blob>((res, rej) =>
            c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'),
          );
          url = URL.createObjectURL(blob);
        } catch {
          url = URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: 'image/gif' }));
        }
      } else {
        url = URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: 'image/png' }));
      }
      byFile.set(r.fileName, url);
    }
    slots[r.slotId] = { url, width: r.width, height: r.height };
  }
  return { assets: { slots }, urls: [...byFile.values()] };
}

export function revokeAll(urls: string[]): void {
  for (const u of urls) URL.revokeObjectURL(u);
}
