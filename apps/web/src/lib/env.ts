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
} as const;

export const githubConfigured = env.githubClientId.length > 0;

export function pagesBaseUrl(owner: string, repo: string): string {
  return env.pagesTemplate.replace('{owner}', owner).replace('{repo}', repo);
}
