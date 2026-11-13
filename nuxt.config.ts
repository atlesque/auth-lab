export default defineNuxtConfig({
  extends: ['./ui'],
  compatibilityDate: '2026-10-01',
  // One client-rendered app; every route is answered by index.html (assets.not_found_handling in wrangler.jsonc).
  // The Worker (worker/index.ts) answers /api/*, where better-auth lives.
  ssr: false,
  app: {
    // Each page pops in (the .page-* rules in the theme layer's main.css).
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Auth Lab',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [
        { name: 'robots', content: 'noindex' },
        { name: 'description', content: 'A better-auth proof of concept on Cloudflare Workers and D1.' },
      ],
      // The shared opt-in analytics banner for the public tools.
      script: [{ src: 'https://tools.atlesque.dev/consent.js', defer: true }],
    },
  },
  // Icons named in script blocks and data aren't always found by the bundle scan.
  icon: {
    clientBundle: {
      icons: [
        'lucide:sticky-note', 'lucide:users', 'lucide:user-round', 'lucide:shield', 'lucide:mail', 'lucide:log-out', 'lucide:sun', 'lucide:moon',
        'lucide:monitor', 'lucide:plus', 'lucide:pencil', 'lucide:trash-2', 'lucide:check', 'lucide:circle-check', 'lucide:triangle-alert',
        'lucide:info', 'lucide:loader-circle', 'lucide:x', 'lucide:ellipsis', 'lucide:key-round', 'lucide:github',
        'lucide:smartphone', 'lucide:copy', 'lucide:ban', 'lucide:user-check', 'lucide:venetian-mask', 'lucide:shield-check', 'lucide:shield-off',
        'lucide:chevrons-up-down', 'lucide:external-link', 'lucide:refresh-cw', 'lucide:link', 'lucide:unlink', 'lucide:lock', 'lucide:wand-sparkles',
        'lucide:arrow-right', 'lucide:panel-left-close', 'lucide:panel-left-open', 'lucide:menu', 'lucide:search', 'lucide:chevron-down',
        'lucide:chevron-right', 'lucide:chevron-left', 'lucide:chevron-up', 'lucide:minus', 'lucide:user-x', 'lucide:log-in', 'lucide:inbox',
        'lucide:send', 'lucide:eye', 'lucide:crown', 'lucide:star', 'lucide:hand', 'lucide:party-popper',
      ],
    },
  },
  // Static output only; without this, Nitro switches to its Cloudflare preset inside Workers Builds.
  // In dev, /api goes to `pnpm dev:api` (wrangler dev on port 8890), which runs worker/index.ts.
  nitro: {
    preset: 'static',
    devProxy: { '/api': { target: 'http://localhost:8890/api' } },
  },
});
