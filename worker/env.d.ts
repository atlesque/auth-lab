// Secrets that are optional and so absent from .dev.vars; `pnpm types` generates the rest.
declare namespace Cloudflare {
  interface Env {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
  }
}
