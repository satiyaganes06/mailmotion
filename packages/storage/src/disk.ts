import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { FILE_NAME, type StorageAdapter, type StoredFile, type UploadFile } from './types';

export interface DiskAdapter extends StorageAdapter {
  read(name: string): Promise<Buffer | null>;
}

/** Local-disk storage. Files are written atomically and never overwritten. */
export function createDiskAdapter(opts: { dir: string; publicBaseUrl: string }): DiskAdapter {
  const base = opts.publicBaseUrl.replace(/\/+$/, '');
  const pathFor = (name: string) => {
    if (!FILE_NAME.test(name)) throw new Error('Invalid file name');
    return join(opts.dir, name);
  };
  const exists = async (name: string) => {
    try {
      return (await stat(pathFor(name))).isFile();
    } catch {
      return false;
    }
  };
  return {
    kind: 'disk',
    exists,
    async put(file: UploadFile): Promise<StoredFile> {
      const target = pathFor(file.name);
      await mkdir(opts.dir, { recursive: true });
      if (!(await exists(file.name))) {
        const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
        await writeFile(tmp, file.bytes, { mode: 0o644 });
        await rename(tmp, target);
      }
      return { name: file.name, url: `${base}/${file.name}`, bytes: file.bytes.length };
    },
    async read(name: string) {
      if (!FILE_NAME.test(name)) return null;
      try {
        return await readFile(join(opts.dir, name));
      } catch {
        return null;
      }
    },
  };
}
