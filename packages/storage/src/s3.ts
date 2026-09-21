import {
  FILE_NAME,
  IMMUTABLE_CACHE,
  type StorageAdapter,
  type StoredFile,
  type UploadFile,
} from './types';

export interface S3Options {
  /** Custom endpoint for R2 / MinIO. Omit for AWS S3. */
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Required for MinIO. */
  forcePathStyle?: boolean;
  /** Public base URL the bucket is served from (CDN or custom domain). */
  publicBaseUrl: string;
  /** Inject a client (tests). */
  client?: { send(cmd: unknown): Promise<unknown> };
}

/** S3-compatible storage: AWS S3, Cloudflare R2, MinIO. */
export function createS3Adapter(opts: S3Options): StorageAdapter {
  const base = opts.publicBaseUrl.replace(/\/+$/, '');
  let sdk: typeof import('@aws-sdk/client-s3') | null = null;
  let client: { send(cmd: unknown): Promise<unknown> } | null = opts.client ?? null;
  const load = async () => {
    sdk ??= await import('@aws-sdk/client-s3');
    client ??= new sdk.S3Client({
      region: opts.region ?? 'auto',
      endpoint: opts.endpoint,
      forcePathStyle: opts.forcePathStyle ?? false,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
    return { sdk, client };
  };
  return {
    kind: 's3',
    async exists(name) {
      if (!FILE_NAME.test(name)) return false;
      const { sdk, client } = await load();
      try {
        await client.send(new sdk.HeadObjectCommand({ Bucket: opts.bucket, Key: name }));
        return true;
      } catch (e) {
        const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404 || (e as Error).name === 'NotFound') return false;
        throw e;
      }
    },
    async put(file: UploadFile): Promise<StoredFile> {
      if (!FILE_NAME.test(file.name)) throw new Error('Invalid file name');
      const { sdk, client } = await load();
      await client.send(
        new sdk.PutObjectCommand({
          Bucket: opts.bucket,
          Key: file.name,
          Body: file.bytes,
          ContentType: file.contentType,
          CacheControl: IMMUTABLE_CACHE,
        }),
      );
      return { name: file.name, url: `${base}/${file.name}`, bytes: file.bytes.length };
    },
  };
}
