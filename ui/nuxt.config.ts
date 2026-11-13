import { fileURLToPath } from 'node:url';

// Shared theme layer: Auth Lab's playful design system on Nuxt UI (structure from Junk Desk): fonts, candy colors,
// light/dark, component looks (app/app.config.ts) and a few shared components.
const css = fileURLToPath(new URL('./app/assets/css/main.css', import.meta.url));

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui'],
  css: [css],
  devtools: { enabled: false },
  telemetry: false,
  // Self-hosted fonts, bundled icons and our own color variables: no Google Fonts, no icon API, no color-mode inline script.
  ui: { fonts: false, colorMode: false, experimental: { componentDetection: true }, theme: { colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error'] } },
  icon: { mode: 'svg', provider: 'none', serverBundle: false, clientBundle: { scan: true, sizeLimitKb: 0 }, fallbackToApi: false },
  components: [{ path: fileURLToPath(new URL('./app/components', import.meta.url)), pathPrefix: false }],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'theme-color', content: '#fff6e3', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#15102f', media: '(prefers-color-scheme: dark)' },
      ],
      link: [
        { rel: 'preload', href: '/fonts/nunito-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
        { rel: 'preload', href: '/fonts/fredoka-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
      ],
      // A classic script that applies the saved theme before first paint.
      script: [{ src: '/boot.js', tagPosition: 'head', tagPriority: 'critical' }],
    },
  },
  // An import map is an inline script, which the CSP blocks.
  experimental: { payloadExtraction: false, entryImportMap: false },
  hooks: {
    // Nuxt UI's color plugin injects an inline <style> at runtime; main.css defines the same variables.
    'app:resolve'(app) {
      app.plugins = app.plugins.filter((plugin) => !/@nuxt[/\\]ui[/\\].*plugins[/\\]colors/u.test(plugin.src));
    },
  },
});
