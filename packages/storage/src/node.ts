import { createDiskAdapter, type DiskAdapter } from './disk';
import { createS3Adapter } from './s3';
import type { StorageAdapter } from './types';

export * from './disk';
export * from './s3';

export type StorageMode = 'disk' | 's3' | 'r2' | 'minio';

/** Build an adapter from the `MM_*` environment variables documented in `.env.example`. */
export function createAdapterFromEnv(
  env: Record<string, string | undefined>,
): StorageAdapter & Partial<DiskAdapter> {
  const mode = (env.MM_STORAGE ?? 'disk') as StorageMode;
  const publicBaseUrl = env.MM_PUBLIC_BASE_URL;
  if (!publicBaseUrl) throw new Error('MM_PUBLIC_BASE_URL is required');
  if (mode === 'disk')
    return createDiskAdapter({ dir: env.MM_DATA_DIR ?? './.data/files', publicBaseUrl });
  if (mode === 's3' || mode === 'r2' || mode === 'minio') {
    for (const k of ['MM_S3_BUCKET', 'MM_S3_ACCESS_KEY_ID', 'MM_S3_SECRET_ACCESS_KEY']) {
      if (!env[k]) throw new Error(`${k} is required when MM_STORAGE=${mode}`);
    }
    if ((mode === 'r2' || mode === 'minio') && !env.MM_S3_ENDPOINT)
      throw new Error(`MM_S3_ENDPOINT is required when MM_STORAGE=${mode}`);
    return createS3Adapter({
      endpoint: env.MM_S3_ENDPOINT || undefined,
      region: env.MM_S3_REGION || (mode === 'r2' ? 'auto' : 'us-east-1'),
      bucket: env.MM_S3_BUCKET!,
      accessKeyId: env.MM_S3_ACCESS_KEY_ID!,
      secretAccessKey: env.MM_S3_SECRET_ACCESS_KEY!,
      forcePathStyle: mode === 'minio',
      publicBaseUrl,
    });
  }
  throw new Error(`Unknown MM_STORAGE: ${mode} (use disk | s3 | r2 | minio)`);
}
