/** A file to publish. `name` is content-hashed: `<sha256>.<gif|png>`. */
export interface UploadFile {
  name: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface StoredFile {
  name: string;
  /** Public https URL the file is served from. */
  url: string;
  bytes: number;
}

/** Where signature images live. Cloud CDN, disk, S3 and GitHub Pages are all just adapters. */
export interface StorageAdapter {
  readonly kind: string;
  put(file: UploadFile): Promise<StoredFile>;
  exists(name: string): Promise<boolean>;
}

/** The only file names ever accepted or served. */
export const FILE_NAME = /^[a-f0-9]{64}\.(gif|png)$/;

export function contentTypeForName(name: string): string {
  return name.endsWith('.gif') ? 'image/gif' : 'image/png';
}

export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
