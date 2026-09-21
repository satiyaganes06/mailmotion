import { describe, expect, it } from 'vitest';
import { GitHubPublisher } from '../src';

/** A fetch that, like the browser's, throws when called with any `this` other than the global. */
function browserLikeFetch() {
  const calls: string[] = [];
  const f = function (this: unknown, input: RequestInfo | URL): Promise<Response> {
    if (this !== undefined && this !== globalThis)
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    calls.push(String(input));
    return Promise.resolve(new Response(JSON.stringify({ login: 'octocat' }), { status: 200 }));
  };
  return { f: f as unknown as typeof fetch, calls };
}

describe('GitHubPublisher and the global fetch', () => {
  it('works with a browser-style fetch that rejects being called as a method (regression)', async () => {
    const { f, calls } = browserLikeFetch();
    const pub = new GitHubPublisher({ token: 't', fetch: f });
    expect(await pub.getUser()).toEqual({ login: 'octocat' });
    expect(calls).toEqual(['https://api.github.com/user']);
  });

  it('falls back to the real global fetch without binding problems', async () => {
    const original = globalThis.fetch;
    const { f, calls } = browserLikeFetch();
    globalThis.fetch = f;
    try {
      const pub = new GitHubPublisher({ token: 't' }); // no fetch injected: uses the global
      expect(await pub.getUser()).toEqual({ login: 'octocat' });
      expect(calls).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
