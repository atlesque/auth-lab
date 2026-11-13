# Auth Lab

A proof of concept for [better-auth](https://better-auth.com) on our usual stack: a Nuxt 4 single-page app (Nuxt UI, with its own playful theme in the `ui/` layer) and a Cloudflare Worker with D1 and Cloudflare Email Service. Live at https://auth-lab.atlesque.dev.

The app is a small team-notes tool, so each auth feature has a real job: people sign up, create or join a team, and write notes that only members can see. The pages call it a "team"; better-auth calls it an organization and the code a workspace.

## What it covers

| Feature | Where to try it | Covered by `pnpm test:flows` |
|---|---|---|
| Email and password, email verification | "Join" | yes |
| Password reset | "Forgot?" on the sign-in page | yes |
| Magic link | "Magic link" on the sign-in page | yes |
| Sessions: list, revoke, sign out elsewhere | Me → Devices | yes |
| Two-factor (TOTP) with backup codes | Me → 2-step code | yes |
| Teams, invitations, roles (owner, admin, member, viewer) | Team, Notes | yes |
| API keys (read-only) | Me → API keys | yes |
| Admin: list, promote, ban, impersonate | Admin (admin role only) | yes |
| Reopening the last-used team at sign-in | Switch team, sign out and in | yes |
| Rate limiting (counters in D1) | Sign in wrongly six times | yes |
| Delete account | Me → Delete account | yes |
| Sign-up allow-list through a database hook | Join with another address | yes |
| Passkeys | Me → Passkeys, then "Passkey" on the sign-in page | no, needs a browser |
| GitHub sign-in and account linking | Sign-in page, Me → Ways to sign in | no, needs a browser |

## How it is put together

- `worker/options.ts` is the whole better-auth configuration. `worker/auth.ts` gives it the D1 binding, the secrets and the email sender; `worker/index.ts` mounts it on `/api/auth/*`.
- `worker/notes.ts` is the protected resource. It reads the session (or an API key), looks up the member's role and asks `shared/permissions.ts` what that role may do. The same file drives which buttons the pages show.
- `app/utils/auth-client.ts` is the better-auth Vue client; `app/middleware/auth.global.ts` guards the routes.
- `ui/` is the theme layer: a playful look for demos (round fonts, candy colors, thick outlines with hard shadows, a padlock mascot, confetti). `ui/app/app.config.ts` puts marker classes on Nuxt UI's components and `ui/app/assets/css/main.css` styles them, so the pages keep using plain `UButton`, `UCard` and `UInput`. Everything is self-hosted, so the strict CSP still holds.
- `migrations/0001_auth.sql` holds better-auth's tables. `pnpm auth:schema` regenerates the difference after a change to the options: `auth migrate` cannot reach D1, so the script loads the options against an in-memory SQLite database with the existing migrations applied and writes the missing SQL as the next migration.

## Run it locally

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then set BETTER_AUTH_SECRET to `openssl rand -base64 32`
pnpm db:migrate:local
pnpm build && pnpm dev:api       # the app and the API on http://localhost:8890
pnpm dev                         # optional: the pages with hot reload on http://localhost:3390
pnpm test:flows                  # runs every flow in the table against :8890
```

Locally no email leaves the machine: each message is kept in the `dev_outbox` table and shown at `/dev/mailbox`, where the links can be opened. Sign-up is limited to `@example.com` addresses and invited people, and `admin@example.com` becomes an admin.

## Simulated users

`scripts/sim/` lets several pretend people use the local app at the same time, each in their own headless browser with their own cookies, inbox, authenticator app and passkeys. It was built so sub-agents can play users and report bugs, and works just as well by hand:

```bash
node scripts/sim/act.ts olivia '[{"goto":"/sign-up"},{"fill":"Name","value":"Olivia"},{"click":"Create account"}]'
node scripts/sim/mail.ts olivia@example.com
```

`scripts/sim/GUIDE.md` is the briefing a simulated user gets: the steps, the rules and the report format. State and screenshots live in `.sim/` (not in git). On a local run each persona gets their own IP address through the `x-sim-ip` header, so rate limits apply per person. It needs Playwright's Chromium (`pnpm exec playwright install chromium`).

## Deployment

Pushing to `main` builds and deploys through Workers Builds (`pnpm run build`, then `pnpm run deploy`, which applies the D1 migrations first).

The repository holds no account details; Cloudflare is configured through the environment:

- **Account**: `CLOUDFLARE_ACCOUNT_ID` (Workers Builds sets it; export it yourself to run Wrangler against the account by hand).
- **D1**: the binding names the database (`auth-lab`) but has no id. Wrangler looks it up by name on the first deploy, and later deploys inherit the binding.
- **Worker secrets**, set once with `printf %s "<value>" | npx wrangler secret put <NAME>`:
  - `BETTER_AUTH_SECRET`: a long random string (`openssl rand -base64 32`).
  - `SIGNUP_ALLOW`: comma-separated domains and addresses that may create an account. Anyone with a pending team invitation may too. Not set means anyone.
  - `ADMIN_EMAILS`: comma-separated addresses that get the admin role at their first sign-in after verifying.
  - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: optional, they turn on GitHub sign-in.

To run your own copy, change the Worker name, the custom domain, `BETTER_AUTH_URL` and `MAIL_FROM` in `wrangler.jsonc`, create a D1 database with the name used there, and onboard your sending domain in Cloudflare Email Service.

GitHub sign-in uses a GitHub OAuth app with callback URL `https://auth-lab.atlesque.dev/api/auth/callback/github`. The button only shows when both GitHub secrets exist, so it is absent on a local run unless you add them to `.dev.vars` and add `http://localhost:8890/api/auth/callback/github` as a second redirect URI on the app.

## What we learned

- **D1 works out of the box.** better-auth 1.7 accepts the D1 binding as `database`; no community dialect or ORM is needed. D1 has no interactive transactions and better-auth copes with that.
- **The auth instance can live at module scope** by importing `env` from `cloudflare:workers`.
- **Schema changes need the small script above**, because the CLI's `migrate` wants a direct database connection.
- **Rate limiting must use `storage: 'database'`** (or another shared store) on Workers, and `cf-connecting-ip` must be named as the IP header.
- **Sign-up never reveals a refusal.** With email verification required, a sign-up that a hook rejects (or that uses an existing address) still answers 200 with a made-up user. The allow-list therefore cannot show "not allowed" on the form; the page says up front who may join.
- **`sendOnSignIn` re-sends the verification email with a link to the home page**, whatever the person was doing. It is off here; the sign-in page requests a new link itself with the right destination.
- **Reset links do not cancel each other.** Each link is single-use, but an older one keeps working after the password was reset with another. `onPasswordReset` in `worker/options.ts` removes the rest.
- **An impersonation session is a full session.** Out of the box an admin acting as someone can create API keys and passkeys for them and delete the account. A `hooks.before` refuses those routes while `impersonatedBy` is set.
- **`delete-user` accepts a fresh session instead of the password.** The same hook insists on the password for accounts that have one.
- **Two-factor only guards password sign-in.** Passkeys, sign-in links and GitHub do not ask for the code; the "Me" page says so.
- **Linking GitHub needs the same email unless you say otherwise.** "Link GitHub" on a signed-in account fails with `email_does_not_match` when the GitHub address differs; `account.accountLinking.allowDifferentEmails` lifts that. A GitHub account can still belong to only one Auth Lab account.
- **Failed redirect flows land on better-auth's own error page** (`/api/auth/error`) unless the call names an `errorCallbackURL`. `onAPIError.errorURL` points the rest at `/auth-error`, in the app's look.
- **API keys outlive a deleted account** unless you remove them yourself: the `apikey` table has no foreign key to `user`. `user.deleteUser.afterDelete` in `worker/options.ts` does it here.
- **Email sending is awaited, not backgrounded**, and failures are only logged, so a failed send cannot reveal whether an address exists.
- **The first emails landed in Gmail's spam folder** (11 Nov 2026), although SPF, DKIM and DMARC for atlesque.dev all check out. A new sender address has no reputation yet; check spam when testing. Each send logs its message id in the Worker's logs.

## License

[MIT](LICENSE). The fonts in `public/fonts/` (Nunito, Fredoka) are under the SIL Open Font License; their licence files sit next to them.
