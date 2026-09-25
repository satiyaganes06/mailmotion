/**
 * Build-time public configuration. Everything here is safe to ship to the browser: secrets
 * (the GitHub client secret) live only in `apps/publish-fn`.
 */
export const env = {
  githubClientId: process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID ?? '',
  githubAppSlug: process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? '',
  publishFnUrl: (process.env.NEXT_PUBLIC_PUBLISH_FN_URL ?? 'http://localhost:8788').replace(
    /\/+$/,
    '',
  ),
  /** Overridden in local development to point at apps/mock-github. */
  oauthBase: (process.env.NEXT_PUBLIC_GITHUB_OAUTH_BASE ?? 'https://github.com').replace(
    /\/+$/,
    '',
  ),
  apiBase: (process.env.NEXT_PUBLIC_GITHUB_API_BASE ?? 'https://api.github.com').replace(
    /\/+$/,
    '',
  ),
  /** Where GitHub Pages serves a repo. `{owner}` and `{repo}` are substituted. */
  pagesTemplate:
    process.env.NEXT_PUBLIC_GITHUB_PAGES_TEMPLATE ?? 'https://{owner}.github.io/{repo}',
  repoName: process.env.NEXT_PUBLIC_GITHUB_REPO ?? 'mailmotion-signatures',
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

export const githubConfigured = env.githubClientId.length > 0;
export const autoUploadConfigured = env.uploadEndpoint.length > 0 && env.uploadToken.length > 0;

export function pagesBaseUrl(owner: string, repo: string): string {
  return env.pagesTemplate.replace('{owner}', owner).replace('{repo}', repo);
}
