import type { UploadFile } from './types';
import { verifyPublicUrls, type UrlCheck } from './verify';

/** The user must (re)connect GitHub. */
export class GitHubAuthError extends Error {
  override name = 'GitHubAuthError';
}
/** The `mailmotion-signatures` repo does not exist (or the app cannot see it) and cannot be created via the API. */
export class RepoMissingError extends Error {
  override name = 'RepoMissingError';
  constructor(
    public readonly owner: string,
    public readonly repo: string,
    public readonly createUrl: string,
  ) {
    super(
      `Repository ${owner}/${repo} was not found. Create it, then install the MailMotion app on it.`,
    );
  }
}
export class GitHubApiError extends Error {
  override name = 'GitHubApiError';
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export interface GitHubOptions {
  /** User access token. Keep it in memory only. */
  token: string;
  apiBase?: string;
  fetch?: typeof fetch;
  /** Repository to publish to. */
  repo?: string;
  /** Override the GitHub Pages base URL (tests / local mock). */
  pagesBaseUrl?: (owner: string, repo: string) => string;
}

export interface PublishResult {
  owner: string;
  repo: string;
  branch: string;
  /** Base URL images are served from (no trailing slash). */
  baseUrl: string;
  commit: string | null;
  uploaded: string[];
  skipped: string[];
}

export const DEFAULT_REPO = 'mailmotion-signatures';

export function newRepoUrl(repo = DEFAULT_REPO): string {
  const q = new URLSearchParams({
    name: repo,
    visibility: 'public',
    description: 'Images for my MailMotion email signature',
  });
  return `https://github.com/new?${q.toString()}`;
}

interface Repo {
  default_branch: string;
  private: boolean;
}

/**
 * Publishes signature images to a GitHub Pages site in the user's own account.
 * All files go up in one commit via the Git Data API; existing files are never rewritten.
 */
export class GitHubPublisher {
  private readonly api: string;
  private readonly f: typeof fetch;
  private readonly repoName: string;

  constructor(private readonly opts: GitHubOptions) {
    this.api = (opts.apiBase ?? 'https://api.github.com').replace(/\/+$/, '');
    this.f = opts.fetch ?? fetch;
    this.repoName = opts.repo ?? DEFAULT_REPO;
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    ok: number[] = [200, 201],
  ): Promise<{ status: number; data: T }> {
    const res = await this.f(`${this.api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.opts.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401)
      throw new GitHubAuthError('GitHub sign-in expired. Please connect again.');
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    if (!ok.includes(res.status)) {
      const msg = (data as { message?: string } | null)?.message ?? text.slice(0, 200);
      if (res.status === 403 && /rate limit/i.test(msg))
        throw new GitHubApiError('GitHub rate limit reached. Try again in a few minutes.', 403);
      throw new GitHubApiError(`GitHub: ${msg || res.statusText} (${res.status})`, res.status);
    }
    return { status: res.status, data: data as T };
  }

  async getUser(): Promise<{ login: string }> {
    return (await this.req<{ login: string }>('GET', '/user')).data;
  }

  /** Repos the app can see (the user's installation), for the "pick a repo" step. */
  async listInstalledRepos(): Promise<string[]> {
    const inst = await this.req<{ installations: { id: number }[] }>('GET', '/user/installations');
    const out: string[] = [];
    for (const i of inst.data.installations) {
      const r = await this.req<{ repositories: { full_name: string }[] }>(
        'GET',
        `/user/installations/${i.id}/repositories`,
      );
      out.push(...r.data.repositories.map((x) => x.full_name));
    }
    return out;
  }

  async getRepo(owner: string, repo: string): Promise<Repo | null> {
    const r = await this.req<Repo>('GET', `/repos/${owner}/${repo}`, undefined, [200, 404]);
    return r.status === 404 ? null : r.data;
  }

  /** Use the repo if it exists; try to create it; otherwise explain how to (GitHub Apps cannot create user repos). */
  async ensureRepo(owner: string): Promise<{ repo: Repo; created: boolean }> {
    const existing = await this.getRepo(owner, this.repoName);
    if (existing) return { repo: existing, created: false };
    try {
      const c = await this.req<Repo>(
        'POST',
        '/user/repos',
        {
          name: this.repoName,
          private: false,
          auto_init: false,
          description: 'Images for my MailMotion email signature',
        },
        [201],
      );
      return { repo: c.data, created: true };
    } catch (e) {
      if (e instanceof GitHubApiError && [403, 404, 422].includes(e.status)) {
        throw new RepoMissingError(owner, this.repoName, newRepoUrl(this.repoName));
      }
      throw e;
    }
  }

  private pagesBase(owner: string): string {
    return (
      this.opts.pagesBaseUrl?.(owner, this.repoName) ??
      `https://${owner}.github.io/${this.repoName}`
    ).replace(/\/+$/, '');
  }

  async enablePages(owner: string, branch: string): Promise<void> {
    const cur = await this.req(
      'GET',
      `/repos/${owner}/${this.repoName}/pages`,
      undefined,
      [200, 404],
    );
    if (cur.status === 200) return;
    await this.req(
      'POST',
      `/repos/${owner}/${this.repoName}/pages`,
      { source: { branch, path: '/' } },
      [201, 409],
    );
  }

  /**
   * Upload `files` (content-hashed image names) in a single commit and make sure Pages is on.
   * Files that already exist in the repo are skipped, so previously sent emails keep working.
   */
  async publish(files: UploadFile[], opts: { message?: string } = {}): Promise<PublishResult> {
    const { login: owner } = await this.getUser();
    const { repo } = await this.ensureRepo(owner);
    const branch = repo.default_branch || 'main';
    const base = `/repos/${owner}/${this.repoName}`;

    // Current head (an empty repo has no ref yet).
    let headSha: string | null = null;
    let baseTree: string | null = null;
    const ref = await this.req<{ object: { sha: string } }>(
      'GET',
      `${base}/git/ref/heads/${branch}`,
      undefined,
      [200, 404, 409],
    );
    if (ref.status === 200) {
      headSha = ref.data.object.sha;
      const commit = await this.req<{ tree: { sha: string } }>(
        'GET',
        `${base}/git/commits/${headSha}`,
      );
      baseTree = commit.data.tree.sha;
    }

    const existing = new Set<string>();
    if (baseTree) {
      const tree = await this.req<{ tree: { path: string; type: string }[] }>(
        'GET',
        `${base}/git/trees/${baseTree}`,
      );
      for (const t of tree.data.tree) if (t.type === 'blob') existing.add(t.path);
    }

    const wanted = [...files];
    if (!existing.has('.nojekyll'))
      wanted.push({ name: '.nojekyll', bytes: new Uint8Array(0), contentType: 'text/plain' });
    const fresh = wanted.filter((f) => !existing.has(f.name));
    const skipped = files.filter((f) => existing.has(f.name)).map((f) => f.name);

    let commitSha: string | null = null;
    if (fresh.length) {
      const entries: { path: string; mode: string; type: string; sha: string }[] = [];
      const queue = [...fresh];
      const workers = Array.from({ length: 4 }, async () => {
        for (let f = queue.shift(); f; f = queue.shift()) {
          const blob = await this.req<{ sha: string }>(
            'POST',
            `${base}/git/blobs`,
            { content: toBase64(f.bytes), encoding: 'base64' },
            [201],
          );
          entries.push({ path: f.name, mode: '100644', type: 'blob', sha: blob.data.sha });
        }
      });
      await Promise.all(workers);
      entries.sort((a, b) => a.path.localeCompare(b.path));

      const tree = await this.req<{ sha: string }>(
        'POST',
        `${base}/git/trees`,
        { ...(baseTree ? { base_tree: baseTree } : {}), tree: entries },
        [201],
      );
      const commit = await this.req<{ sha: string }>(
        'POST',
        `${base}/git/commits`,
        {
          message:
            opts.message ??
            `Add ${fresh.filter((f) => f.name !== '.nojekyll').length} signature image(s)`,
          tree: tree.data.sha,
          parents: headSha ? [headSha] : [],
        },
        [201],
      );
      commitSha = commit.data.sha;
      if (headSha)
        await this.req('PATCH', `${base}/git/refs/heads/${branch}`, { sha: commitSha }, [200]);
      else
        await this.req(
          'POST',
          `${base}/git/refs`,
          { ref: `refs/heads/${branch}`, sha: commitSha },
          [201],
        );
    }

    await this.enablePages(owner, branch);
    return {
      owner,
      repo: this.repoName,
      branch,
      baseUrl: this.pagesBase(owner),
      commit: commitSha,
      uploaded: fresh.filter((f) => f.name !== '.nojekyll').map((f) => f.name),
      skipped,
    };
  }

  /** Poll until every image URL really loads with the right Content-Type (Pages takes ~1 minute). */
  async waitForLive(
    urls: string[],
    opts: { timeoutMs?: number; intervalMs?: number; onTick?: (pending: number) => void } = {},
  ): Promise<{ ok: boolean; checks: UrlCheck[] }> {
    const deadline = Date.now() + (opts.timeoutMs ?? 180_000);
    const interval = opts.intervalMs ?? 4_000;
    let checks: UrlCheck[] = [];
    for (;;) {
      checks = await verifyPublicUrls(urls, { fetch: this.f });
      const pending = checks.filter((c) => !c.ok).length;
      opts.onTick?.(pending);
      if (pending === 0) return { ok: true, checks };
      if (Date.now() + interval > deadline) return { ok: false, checks };
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
