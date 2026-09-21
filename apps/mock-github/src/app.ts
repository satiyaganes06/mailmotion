import { createHash, randomBytes } from 'node:crypto';
import { Hono, type MiddlewareHandler } from 'hono';

export interface MockOptions {
  /** Public base URL of this mock (used in redirects and Pages URLs). */
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  login?: string;
  /** Real GitHub Apps cannot create user repos via the API; keep false to exercise the guided flow. */
  allowRepoCreate?: boolean;
  /** Simulated Pages build time. */
  pagesDelayMs?: number;
  now?: () => number;
}

interface Commit {
  tree: string;
  parents: string[];
  message: string;
}
interface RepoState {
  owner: string;
  name: string;
  defaultBranch: string;
  blobs: Map<string, Buffer>;
  trees: Map<string, { path: string; mode: string; type: string; sha: string }[]>;
  commits: Map<string, Commit>;
  refs: Map<string, string>;
  pages: { branch: string } | null;
  /** Head sha at last change, and when that build completes. */
  builtSha: string | null;
  buildReadyAt: number;
}

const sha1 = (...parts: (string | Buffer)[]) => {
  const h = createHash('sha1');
  for (const p of parts) h.update(p);
  return h.digest('hex');
};

/**
 * A small in-memory GitHub. It implements just what MailMotion uses and behaves like the real API
 * where it matters (bearer auth, PKCE, GitHub-App repo-creation limits, empty repos, Pages delay).
 */
export function createMockGitHub(opts: MockOptions) {
  const cfg = {
    clientId: 'mock-client-id',
    clientSecret: 'mock-secret',
    login: 'octocat',
    allowRepoCreate: false,
    pagesDelayMs: 0,
    now: Date.now,
    ...opts,
  };
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const tokens = new Map<string, number>();
  const codes = new Map<
    string,
    { challenge?: string; redirect: string; clientId: string; used: boolean }
  >();
  const repos = new Map<string, RepoState>();
  const app = new Hono();

  const newRepo = (owner: string, name: string): RepoState => {
    const r: RepoState = {
      owner,
      name,
      defaultBranch: 'main',
      blobs: new Map(),
      trees: new Map(),
      commits: new Map(),
      refs: new Map(),
      pages: null,
      builtSha: null,
      buildReadyAt: 0,
    };
    repos.set(`${owner}/${name}`, r);
    return r;
  };
  const getRepo = (o: string, n: string) => repos.get(`${o}/${n}`);

  app.use('*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    return next();
  });

  /* ------------------------------------------------------------- OAuth */

  app.get('/login/oauth/authorize', (c) => {
    const q = c.req.query();
    if (q.client_id !== cfg.clientId) return c.text('Unknown client_id', 400);
    if (!q.redirect_uri) return c.text('redirect_uri required', 400);
    const code = randomBytes(10).toString('hex');
    codes.set(code, {
      challenge: q.code_challenge,
      redirect: q.redirect_uri,
      clientId: q.client_id,
      used: false,
    });
    const url = new URL(q.redirect_uri);
    url.searchParams.set('code', code);
    if (q.state) url.searchParams.set('state', q.state);
    return c.redirect(url.toString(), 302); // auto-approve
  });

  app.post('/login/oauth/access_token', async (c) => {
    const ct = c.req.header('content-type') ?? '';
    const body: Record<string, string> = ct.includes('json')
      ? ((await c.req.json()) as Record<string, string>)
      : Object.fromEntries(new URLSearchParams(await c.req.text()));
    const err = (error: string) => c.json({ error, error_description: error });
    if (body.client_id !== cfg.clientId || body.client_secret !== cfg.clientSecret)
      return err('incorrect_client_credentials');
    const entry = codes.get(body.code ?? '');
    if (!entry || entry.used) return err('bad_verification_code');
    entry.used = true;
    if (body.redirect_uri && body.redirect_uri !== entry.redirect)
      return err('redirect_uri_mismatch');
    if (entry.challenge) {
      const expected = createHash('sha256')
        .update(body.code_verifier ?? '')
        .digest('base64url');
      if (expected !== entry.challenge) return err('bad_verification_code');
    }
    const token = `ghu_mock${randomBytes(12).toString('hex')}`;
    tokens.set(token, cfg.now() + 8 * 3600_000);
    return c.json({ access_token: token, expires_in: 28800, token_type: 'bearer', scope: '' });
  });

  /* ------------------------------------------------------------- guided repo creation */

  app.get('/new', (c) => {
    const name = c.req.query('name') ?? 'mailmotion-signatures';
    if (!getRepo(cfg.login, name)) newRepo(cfg.login, name);
    return c.html(
      `<!doctype html><title>Mock GitHub</title><body style="font-family:sans-serif"><h1>Created ${cfg.login}/${name}</h1><p>(mock) You can close this tab and return to MailMotion.</p>`,
    );
  });

  /* ------------------------------------------------------------- REST API (bearer) */

  const requireToken: MiddlewareHandler = async (c, next) => {
    const m = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '');
    const exp = m ? tokens.get(m[1]!) : undefined;
    if (!exp || exp < cfg.now()) return c.json({ message: 'Bad credentials' }, 401);
    return next();
  };
  for (const path of ['/user', '/user/*', '/repos/*']) app.use(path, requireToken);

  app.get('/user', (c) => c.json({ login: cfg.login, id: 1 }));
  app.get('/user/installations', (c) =>
    c.json({
      total_count: 1,
      installations: [{ id: 1, account: { login: cfg.login }, repository_selection: 'selected' }],
    }),
  );
  app.get('/user/installations/:id/repositories', (c) =>
    c.json({
      repositories: [...repos.values()]
        .filter((r) => r.owner === cfg.login)
        .map((r) => ({ full_name: `${r.owner}/${r.name}` })),
    }),
  );

  app.post('/user/repos', async (c) => {
    if (!cfg.allowRepoCreate)
      return c.json({ message: 'Resource not accessible by integration' }, 403);
    const b = (await c.req.json()) as { name: string };
    if (getRepo(cfg.login, b.name))
      return c.json({ message: 'name already exists on this account' }, 422);
    const r = newRepo(cfg.login, b.name);
    return c.json({ name: r.name, default_branch: r.defaultBranch, private: false }, 201);
  });

  app.get('/repos/:o/:r', (c) => {
    const r = getRepo(c.req.param('o'), c.req.param('r'));
    if (!r) return c.json({ message: 'Not Found' }, 404);
    return c.json({
      name: r.name,
      full_name: `${r.owner}/${r.name}`,
      default_branch: r.defaultBranch,
      private: false,
      permissions: { push: true },
    });
  });

  const withRepo = (c: { req: { param(n: string): string } }) =>
    getRepo(c.req.param('o'), c.req.param('r'));

  app.get('/repos/:o/:r/git/ref/heads/:branch', (c) => {
    const r = withRepo(c);
    if (!r) return c.json({ message: 'Not Found' }, 404);
    const sha = r.refs.get(c.req.param('branch'));
    // real GitHub answers 409 "Git Repository is empty." for a repo with no commits
    if (!sha)
      return c.json(
        { message: r.commits.size === 0 ? 'Git Repository is empty.' : 'Not Found' },
        r.commits.size === 0 ? 409 : 404,
      );
    return c.json({ ref: `refs/heads/${c.req.param('branch')}`, object: { sha, type: 'commit' } });
  });

  app.get('/repos/:o/:r/git/commits/:sha', (c) => {
    const commit = withRepo(c)?.commits.get(c.req.param('sha'));
    return commit
      ? c.json({
          sha: c.req.param('sha'),
          tree: { sha: commit.tree },
          parents: commit.parents.map((sha) => ({ sha })),
        })
      : c.json({ message: 'Not Found' }, 404);
  });

  app.get('/repos/:o/:r/git/trees/:sha', (c) => {
    const tree = withRepo(c)?.trees.get(c.req.param('sha'));
    return tree
      ? c.json({ sha: c.req.param('sha'), tree, truncated: false })
      : c.json({ message: 'Not Found' }, 404);
  });

  app.post('/repos/:o/:r/git/blobs', async (c) => {
    const r = withRepo(c);
    if (!r) return c.json({ message: 'Not Found' }, 404);
    const b = (await c.req.json()) as { content: string; encoding: string };
    const data =
      b.encoding === 'base64' ? Buffer.from(b.content, 'base64') : Buffer.from(b.content, 'utf8');
    const sha = sha1(`blob ${data.length}\0`, data);
    r.blobs.set(sha, data);
    return c.json({ sha }, 201);
  });

  app.post('/repos/:o/:r/git/trees', async (c) => {
    const r = withRepo(c);
    if (!r) return c.json({ message: 'Not Found' }, 404);
    const b = (await c.req.json()) as {
      base_tree?: string;
      tree: { path: string; mode: string; type: string; sha: string }[];
    };
    const merged = new Map<string, { path: string; mode: string; type: string; sha: string }>();
    if (b.base_tree) {
      const baseEntries = r.trees.get(b.base_tree);
      if (!baseEntries) return c.json({ message: 'base_tree not found' }, 422);
      for (const e of baseEntries) merged.set(e.path, e);
    }
    for (const e of b.tree) {
      if (!r.blobs.has(e.sha)) return c.json({ message: `blob ${e.sha} does not exist` }, 422);
      if (/(^|\/)\.\.(\/|$)/.test(e.path)) return c.json({ message: 'invalid path' }, 422);
      merged.set(e.path, e);
    }
    const entries = [...merged.values()].sort((a, z) => a.path.localeCompare(z.path));
    const sha = sha1('tree', JSON.stringify(entries));
    r.trees.set(sha, entries);
    return c.json({ sha }, 201);
  });

  app.post('/repos/:o/:r/git/commits', async (c) => {
    const r = withRepo(c);
    if (!r) return c.json({ message: 'Not Found' }, 404);
    const b = (await c.req.json()) as { message: string; tree: string; parents: string[] };
    if (!r.trees.has(b.tree)) return c.json({ message: 'tree not found' }, 422);
    const sha = sha1('commit', JSON.stringify(b), String(cfg.now()), randomBytes(4));
    r.commits.set(sha, { tree: b.tree, parents: b.parents, message: b.message });
    return c.json({ sha }, 201);
  });

  const moved = (r: RepoState, branch: string, sha: string) => {
    r.refs.set(branch, sha);
    if (r.pages && branch === r.pages.branch) {
      r.builtSha = sha;
      r.buildReadyAt = cfg.now() + cfg.pagesDelayMs;
    }
  };

  app.post('/repos/:o/:r/git/refs', async (c) => {
    const r = withRepo(c);
    if (!r) return c.json({ message: 'Not Found' }, 404);
    const b = (await c.req.json()) as { ref: string; sha: string };
    const branch = b.ref.replace(/^refs\/heads\//, '');
    if (r.refs.has(branch)) return c.json({ message: 'Reference already exists' }, 422);
    if (!r.commits.has(b.sha)) return c.json({ message: 'Object does not exist' }, 422);
    moved(r, branch, b.sha);
    return c.json({ ref: b.ref, object: { sha: b.sha } }, 201);
  });

  app.patch('/repos/:o/:r/git/refs/heads/:branch', async (c) => {
    const r = withRepo(c);
    if (!r) return c.json({ message: 'Not Found' }, 404);
    const b = (await c.req.json()) as { sha: string };
    const branch = c.req.param('branch');
    if (!r.refs.has(branch)) return c.json({ message: 'Reference does not exist' }, 422);
    if (!r.commits.has(b.sha)) return c.json({ message: 'Object does not exist' }, 422);
    moved(r, branch, b.sha);
    return c.json({ ref: `refs/heads/${branch}`, object: { sha: b.sha } });
  });

  app.get('/repos/:o/:r/pages', (c) => {
    const r = withRepo(c);
    if (!r?.pages) return c.json({ message: 'Not Found' }, 404);
    return c.json({
      source: { branch: r.pages.branch, path: '/' },
      html_url: `${base}/pages/${r.owner}/${r.name}/`,
    });
  });
  app.post('/repos/:o/:r/pages', async (c) => {
    const r = withRepo(c);
    if (!r) return c.json({ message: 'Not Found' }, 404);
    if (r.pages) return c.json({ message: 'GitHub Pages is already enabled.' }, 409);
    const b = (await c.req.json()) as { source: { branch: string } };
    r.pages = { branch: b.source.branch };
    const head = r.refs.get(b.source.branch);
    if (head) {
      r.builtSha = head;
      r.buildReadyAt = cfg.now() + cfg.pagesDelayMs;
    }
    return c.json({ source: b.source, html_url: `${base}/pages/${r.owner}/${r.name}/` }, 201);
  });
  app.get('/repos/:o/:r/pages/builds/latest', (c) => {
    const r = withRepo(c);
    if (!r?.pages) return c.json({ message: 'Not Found' }, 404);
    return c.json({ status: r.builtSha && cfg.now() >= r.buildReadyAt ? 'built' : 'building' });
  });

  /* ------------------------------------------------------------- Pages hosting */

  app.on(['GET', 'HEAD'], '/pages/:o/:r/:file', (c) => {
    const r = getRepo(c.req.param('o'), c.req.param('r'));
    const file = c.req.param('file');
    if (!r?.pages || !r.builtSha || cfg.now() < r.buildReadyAt) return c.text('Not found', 404);
    const commit = r.commits.get(r.builtSha);
    const entry = commit && r.trees.get(commit.tree)?.find((e) => e.path === file);
    const data = entry && r.blobs.get(entry.sha);
    if (!data) return c.text('Not found', 404);
    c.header(
      'Content-Type',
      file.endsWith('.gif') ? 'image/gif' : file.endsWith('.png') ? 'image/png' : 'text/plain',
    );
    c.header('Cache-Control', 'max-age=600');
    return c.body(c.req.method === 'HEAD' ? null : (new Uint8Array(data) as never));
  });

  app.get('/mock/state', (c) =>
    c.json({
      tokens: tokens.size,
      repos: [...repos.values()].map((r) => ({
        repo: `${r.owner}/${r.name}`,
        commits: r.commits.size,
        refs: Object.fromEntries(r.refs),
        pages: r.pages,
        files: r.builtSha
          ? (r.trees.get(r.commits.get(r.builtSha)!.tree) ?? []).map((e) => e.path)
          : [],
      })),
    }),
  );

  return {
    app,
    cfg: { ...cfg, baseUrl: base },
    seedRepo: (name = 'mailmotion-signatures') => newRepo(cfg.login, name),
  };
}
