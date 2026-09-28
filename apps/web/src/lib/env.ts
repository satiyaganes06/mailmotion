/** Build-time public configuration. Everything here is safe to ship to the browser. */
export const env = {
  /**
   * A storage server this deployment always uploads to, baked in at build time so every visitor
   * gets a one-click "Upload images" button with nothing to configure.
   *
   * SECURITY NOTE: because these are `NEXT_PUBLIC_*`, both values ship in the JS bundle and are
   * readable by anyone who loads the page (view-source, devtools). Only set these for a
   * single-tenant deployment (you run the builder AND the storage server for your own team) where
   * everyone who can reach the site is meant to be able to upload to that bucket. Do not set them
   * on a public multi-tenant deployment — leave them unset there and let people use "Download ZIP"
   * or self-host their own storage server.
   */
  uploadEndpoint: (process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT ?? '').replace(/\/+$/, ''),
  uploadToken: process.env.NEXT_PUBLIC_UPLOAD_TOKEN ?? '',
} as const;

export const autoUploadConfigured = env.uploadEndpoint.length > 0 && env.uploadToken.length > 0;
