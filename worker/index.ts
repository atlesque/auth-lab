// The Worker answers /api/*; every other path is the single-page app (assets in wrangler.jsonc).
//   /api/auth/*   better-auth (worker/options.ts)
//   /api/config   what the sign-in page may offer
//   /api/notes    the protected resource (worker/notes.ts)
//   /api/dev/*    local-only helpers, off unless DEV_MAILBOX=1
import { env } from 'cloudflare:workers';
import { auth, githubEnabled, isDev } from './auth.ts';
import { json } from './http.ts';
import { handleNotes } from './notes.ts';

const origins = new Set([env.BETTER_AUTH_URL, ...(env.EXTRA_ORIGINS ?? '').split(',').map((item) => item.trim()).filter(Boolean)]);

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/auth/')) return await auth.handler(request);

      // better-auth checks the origin of its own routes; this covers ours. A cookie-less API key call has no Origin.
      const origin = request.headers.get('origin');
      if (request.method !== 'GET' && origin && !origins.has(origin)) return json({ error: 'Cross-site request refused' }, 403);

      if (path === '/api/config') return json({ github: githubEnabled, dev: isDev, signupOpen: !(env.SIGNUP_ALLOW ?? '').trim() });
      if (path === '/api/notes' || path.startsWith('/api/notes/')) return await handleNotes(request, url);

      if (isDev && path === '/api/dev/outbox') {
        if (request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM dev_outbox').run();
          return json({ ok: true });
        }
        const to = url.searchParams.get('to')?.toLowerCase();
        const query = to
          ? env.DB.prepare('SELECT * FROM dev_outbox WHERE recipient = ? ORDER BY id DESC LIMIT 50').bind(to)
          : env.DB.prepare('SELECT * FROM dev_outbox ORDER BY id DESC LIMIT 50');
        return json({ messages: (await query.all()).results });
      }
      // Lets scripts/flows.ts start each run with empty rate-limit counters.
      if (isDev && path === '/api/dev/reset-limits' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM rateLimit').run();
        return json({ ok: true });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error(request.method, path, error);
      return json({ error: 'Something went wrong' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
