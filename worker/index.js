// Cloudflare Worker entry point. Everything is a static file served from the
// repo, except /tools/api/proxy, which runs the allowlisted proxy in proxy.js.
import { onRequest as proxy } from './proxy.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/tools/api/proxy') return proxy({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
    return env.ASSETS.fetch(request);
  },
};
