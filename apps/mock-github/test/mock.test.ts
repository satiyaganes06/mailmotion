import { describe, expect, it } from 'vitest';
import { createMockGitHub } from '../src/app';

const mk = () => createMockGitHub({ baseUrl: 'http://mock.local' });

describe('mock GitHub', () => {
  it('answers CORS preflights for browser calls', async () => {
    const r = await mk().app.request('/user', { method: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });
  it('requires a bearer token for the API but not for Pages or state', async () => {
    const m = mk();
    expect((await m.app.request('/user')).status).toBe(401);
    expect((await m.app.request('/repos/octocat/x')).status).toBe(401);
    expect((await m.app.request('/mock/state')).status).toBe(200);
    expect((await m.app.request('/pages/octocat/x/a.gif')).status).toBe(404);
  });
  it('rejects bad client credentials, unknown codes and replays', async () => {
    const m = mk();
    const post = (body: object) =>
      m.app.request('/login/oauth/access_token', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    expect(
      await (await post({ client_id: 'nope', client_secret: 'x', code: 'c' })).json(),
    ).toMatchObject({ error: 'incorrect_client_credentials' });
    expect(
      await (
        await post({ client_id: 'mock-client-id', client_secret: 'mock-secret', code: 'unknown' })
      ).json(),
    ).toMatchObject({ error: 'bad_verification_code' });
    const auth = await m.app.request(
      '/login/oauth/authorize?client_id=mock-client-id&redirect_uri=http://localhost:3000/cb&state=s',
    );
    const code = new URL(auth.headers.get('location')!).searchParams.get('code');
    const ok = {
      client_id: 'mock-client-id',
      client_secret: 'mock-secret',
      code,
      redirect_uri: 'http://localhost:3000/cb',
    };
    expect(
      ((await (await post(ok)).json()) as { access_token?: string }).access_token,
    ).toBeTruthy();
    expect(await (await post(ok)).json()).toMatchObject({ error: 'bad_verification_code' }); // single use
  });
});
