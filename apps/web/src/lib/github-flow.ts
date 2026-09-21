import {
  GitHubAuthError,
  GitHubPublisher,
  RepoMissingError,
  type UploadFile,
} from '@mailmotion/storage';
import type { RenderedAsset } from '@mailmotion/renderer';
import { uniqueFiles } from '@mailmotion/renderer';
import { env, githubConfigured, pagesBaseUrl } from './env';

export { GitHubAuthError, RepoMissingError };

/* ------------------------------------------------------------------ in-memory token */

interface TokenState {
  token: string | null;
  expiresAt: number;
}
/**
 * The GitHub user token is held in this module variable only. It is never written to
 * localStorage, sessionStorage, IndexedDB or a cookie, is dropped when the tab closes, and
 * expires after 8 hours (GitHub's default).
 */
const state: TokenState = { token: null, expiresAt: 0 };

export function setToken(token: string, expiresInSec: number, now = Date.now()): void {
  state.token = token;
  state.expiresAt = now + Math.max(60, expiresInSec) * 1000;
}
export function getToken(now = Date.now()): string | null {
  if (state.token && now >= state.expiresAt) state.token = null;
  return state.token;
}
export function clearToken(): void {
  state.token = null;
  state.expiresAt = 0;
}

/* ------------------------------------------------------------------ PKCE sign-in */

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export function randomString(byteLen: number): string {
  const b = new Uint8Array(byteLen);
  crypto.getRandomValues(b);
  return b64url(b);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

const PENDING_KEY = 'mm:oauth:pending';

/** The URL the user must be sent to, plus the values to keep for the callback (state + PKCE verifier). */
export async function buildAuthorizeUrl(
  origin: string,
): Promise<{ url: string; pending: { state: string; verifier: string; redirectUri: string } }> {
  const verifier = randomString(48); // 64 chars, within RFC 7636's 43-128
  const state = randomString(16);
  const redirectUri = `${origin}/publish/callback/`;
  const q = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
  });
  return {
    url: `${env.oauthBase}/login/oauth/authorize?${q.toString()}`,
    pending: { state, verifier, redirectUri },
  };
}

/** Save what the callback needs. This is not a secret token: it only lets us finish one sign-in. */
export function rememberPending(p: { state: string; verifier: string; redirectUri: string }): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: the callback will report a clear error */
  }
}

export async function startSignIn(): Promise<void> {
  if (!githubConfigured) throw new Error('GitHub publishing is not configured on this deployment.');
  const { url, pending } = await buildAuthorizeUrl(window.location.origin);
  rememberPending(pending);
  window.location.assign(url);
}

export type CallbackResult = { ok: true } | { ok: false; message: string };

/** Finish sign-in on the callback page: check `state`, exchange the code (with PKCE) via the function. */
export async function completeSignIn(
  search: string,
  fetchFn: typeof fetch = fetch,
): Promise<CallbackResult> {
  const q = new URLSearchParams(search);
  if (q.get('error'))
    return { ok: false, message: q.get('error_description') ?? 'GitHub sign-in was cancelled.' };
  const code = q.get('code');
  const stateParam = q.get('state');
  let pending: { state: string; verifier: string; redirectUri: string } | null = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    pending = null;
  }
  if (!code || !stateParam)
    return { ok: false, message: 'The GitHub response was incomplete. Please try again.' };
  if (!pending || pending.state !== stateParam)
    return {
      ok: false,
      message: 'The sign-in could not be verified (state mismatch). Please start again.',
    };

  let res: Response;
  try {
    res = await fetchFn(`${env.publishFnUrl}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.verifier,
      }),
    });
  } catch {
    return {
      ok: false,
      message: 'Could not reach the sign-in service. Check your connection and try again.',
    };
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    reason?: string;
  };
  if (!res.ok || !body.access_token) {
    return {
      ok: false,
      message: `GitHub sign-in failed${body.reason ? ` (${body.reason})` : body.error ? ` (${body.error})` : ''}. Please try again.`,
    };
  }
  setToken(body.access_token, body.expires_in ?? 28_800);
  return { ok: true };
}

/* ------------------------------------------------------------------ publishing */

const MIME = { gif: 'image/gif', png: 'image/png' } as const;

export function toUploadFiles(rendered: RenderedAsset[]): UploadFile[] {
  return [...uniqueFiles(rendered).values()].map((r) => ({
    name: r.fileName,
    bytes: r.bytes,
    contentType: MIME[r.format],
  }));
}

export type PublishStep = 'checking' | 'committing' | 'pages' | 'waiting' | 'done';

export interface GitHubPublishResult {
  baseUrl: string;
  owner: string;
  repo: string;
  fileUrls: Record<string, string>;
  uploaded: number;
  skipped: number;
}

export function makePublisher(token: string, fetchFn?: typeof fetch): GitHubPublisher {
  return new GitHubPublisher({
    token,
    apiBase: env.apiBase,
    repo: env.repoName,
    fetch: fetchFn,
    pagesBaseUrl,
  });
}

/** Commit the images to the user's Pages repo and wait until each URL really loads. */
export async function publishToGitHub(
  rendered: RenderedAsset[],
  onStep: (s: PublishStep, detail?: string) => void,
  publisher?: GitHubPublisher,
): Promise<GitHubPublishResult> {
  const token = getToken();
  if (!token && !publisher) throw new GitHubAuthError('Connect GitHub first.');
  const pub = publisher ?? makePublisher(token!);
  onStep('committing');
  const files = toUploadFiles(rendered);
  const r = await pub.publish(files);
  onStep('pages');
  const fileUrls: Record<string, string> = {};
  for (const f of files) fileUrls[f.name] = `${r.baseUrl}/${f.name}`;
  onStep('waiting');
  const live = await pub.waitForLive(Object.values(fileUrls), {
    onTick: (pending) =>
      onStep('waiting', `${pending} image${pending === 1 ? '' : 's'} still loading`),
  });
  if (!live.ok) {
    const bad = live.checks.filter((c) => !c.ok).length;
    throw new Error(
      `GitHub Pages is still building (${bad} image${bad === 1 ? '' : 's'} not live yet). It usually takes about a minute. Wait a bit and press Publish again.`,
    );
  }
  onStep('done');
  return {
    baseUrl: r.baseUrl,
    owner: r.owner,
    repo: r.repo,
    fileUrls,
    uploaded: r.uploaded.length,
    skipped: r.skipped.length,
  };
}
