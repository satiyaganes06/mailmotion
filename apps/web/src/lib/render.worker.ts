/// <reference lib="webworker" />
import { renderSignatureAssets, type RenderedAsset } from '@mailmotion/renderer';
import { createBrowserEnv } from '@mailmotion/renderer/browser';
import type { SignatureConfig } from '@mailmotion/schema';

export interface WorkerRequest {
  id: number;
  config: SignatureConfig;
  fontBaseUrl: string;
}
export type WorkerResponse =
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'done'; assets: RenderedAsset[] }
  | { id: number; type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, config, fontBaseUrl } = e.data;
  try {
    const env = createBrowserEnv({ fontBaseUrl });
    const assets = await renderSignatureAssets(config, env, {
      onProgress: (done, total) =>
        ctx.postMessage({ id, type: 'progress', done, total } satisfies WorkerResponse),
    });
    ctx.postMessage(
      { id, type: 'done', assets } satisfies WorkerResponse,
      assets.map((a) => a.bytes.buffer as ArrayBuffer),
    );
  } catch (err) {
    ctx.postMessage({
      id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
