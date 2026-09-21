import { createApp, type Env } from './app';

// One app per Worker isolate so the in-memory rate limiter persists between requests.
const cache = new WeakMap<object, ReturnType<typeof createApp>>();

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    let app = cache.get(env);
    if (!app) {
      app = createApp(env);
      cache.set(env, app);
    }
    return app.fetch(request);
  },
};
