// The better-auth configuration, kept free of Workers-only imports so `pnpm auth:schema` can load it in Node to
// generate the SQL for migrations/. worker/auth.ts supplies the real database, secrets and email sender.
import { apiKey } from '@better-auth/api-key';
import { passkey } from '@better-auth/passkey';
import type { BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { admin, magicLink, organization, twoFactor } from 'better-auth/plugins';
import { ac, roles } from '../shared/permissions.ts';
import type { Mail } from './mail.ts';

export interface AuthDeps {
  /** The D1 binding in the Worker; a node:sqlite database when generating the schema. */
  database: unknown;
  baseURL: string;
  secret: string;
  /** Extra origins allowed to call the API (the Nuxt dev server). */
  extraOrigins: string[];
  github?: { clientId: string; clientSecret: string };
  /** Domains ("atlesque.dev") and full addresses that may create an account. Empty = anyone. */
  signupAllow: string[];
  sendEmail(mail: Mail): Promise<void>;
  /** True when the address has a pending workspace invitation: invited people may sign up too. */
  isInvited(email: string): Promise<boolean>;
  /** The workspace a new session should open: the last one the person used, else their oldest membership. */
  initialOrganizationId(userId: string): Promise<string | null>;
  /** Remembers the workspace a person switched to, for their next sign-in. */
  rememberOrganization(userId: string, organizationId: string): Promise<void>;
  /** Deletes the password-reset links still outstanding for this account. */
  removeResetTokens(userId: string): Promise<void>;
  /** True when the account has a password of its own (not only GitHub or magic link). */
  hasPassword(userId: string): Promise<boolean>;
  /** Gives the admin role to a verified address listed in ADMIN_EMAILS. */
  promoteAdmin(userId: string): Promise<void>;
  removeApiKeys(userId: string): Promise<void>;
  /** Request headers that carry the visitor's address, most trusted first. */
  ipHeaders: string[];
}

export const APP_NAME = 'Auth Lab';

// Acting as someone else is for looking at the app as they see it: it must not leave lasting access behind or
// change how they sign in. Reading these (listing keys, passkeys, sessions) stays allowed.
const BLOCKED_WHILE_IMPERSONATING = new Set([
  '/api-key/create', '/api-key/update', '/api-key/delete',
  '/passkey/generate-register-options', '/passkey/verify-registration', '/passkey/update-passkey', '/passkey/delete-passkey',
  '/delete-user', '/change-email', '/change-password', '/set-password', '/link-social', '/unlink-account',
]);

export function buildOptions(deps: AuthDeps) {
  const host = new URL(deps.baseURL).hostname;
  const mayJoin = async (email: string) => {
    if (!deps.signupAllow.length) return true;
    const address = email.toLowerCase();
    const domain = address.slice(address.lastIndexOf('@') + 1);
    return deps.signupAllow.includes(address) || deps.signupAllow.includes(domain) || deps.isInvited(address);
  };

  return {
    appName: APP_NAME,
    baseURL: deps.baseURL,
    secret: deps.secret,
    database: deps.database as BetterAuthOptions['database'],
    trustedOrigins: [deps.baseURL, ...deps.extraOrigins],

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      // better-auth only consumes the link that was used; the others would still work until they expire.
      onPasswordReset: async ({ user }) => { await deps.removeResetTokens(user.id); },
      sendResetPassword: async ({ user, url }) => {
        await deps.sendEmail({
          kind: 'reset-password',
          to: user.email,
          subject: 'Your new Auth Lab password',
          heading: 'Forgot your password?',
          body: 'Tap the button to pick a new one. The link works for one hour. Not you? Just ignore this.',
          action: { label: 'Pick a new password', url },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // The sign-in page asks for a new link itself, so it can say where the link should lead.
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await deps.sendEmail({
          kind: 'verify-email',
          to: user.email,
          subject: 'Say hi to Auth Lab',
          heading: 'Almost there!',
          body: 'Tap the button to confirm your email and finish joining.',
          action: { label: 'Confirm my email', url },
        });
      },
    },

    socialProviders: deps.github ? { github: deps.github } : {},
    account: {
      // Signing in with GitHub joins the existing account when GitHub vouches for the same verified address.
      // "Link GitHub" on the Me page is a signed-in person's own choice, so there the GitHub address may differ.
      accountLinking: { enabled: true, trustedProviders: ['github'], allowDifferentEmails: true },
    },
    // Where a failed redirect flow (OAuth callback, /api/auth/error) lands when the flow named no page of its own:
    // the app's error page instead of better-auth's built-in one.
    onAPIError: { errorURL: `${deps.baseURL}/auth-error` },
    user: {
      deleteUser: {
        enabled: true,
        // API keys point at their owner without a foreign key, so they would outlive the account.
        afterDelete: async (user) => { await deps.removeApiKeys(user.id); },
      },
    },

    // Counters live in D1: a Worker's memory is per isolate and would not hold a limit.
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/sign-in/magic-link': { window: 60, max: 3 },
        '/two-factor/*': { window: 60, max: 5 },
      },
    },
    advanced: {
      // Behind Cloudflare the visitor's address is in this header; without it every visitor shares one bucket.
      ipAddress: { ipAddressHeaders: deps.ipHeaders },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const guarded = BLOCKED_WHILE_IMPERSONATING.has(ctx.path) || ctx.path.startsWith('/two-factor/');
        if (!guarded && ctx.path !== '/delete-user') return;
        const current = await getSessionFromCtx(ctx);
        if (!current) return;
        if (guarded && current.session.impersonatedBy) {
          throw new APIError('FORBIDDEN', { message: 'This is not available while acting as someone else.', code: 'IMPERSONATION_NOT_ALLOWED' });
        }
        // better-auth also accepts a fresh session instead of the password; for accounts that have a password, insist on it.
        if (ctx.path === '/delete-user' && !ctx.body?.password && (await deps.hasPassword(current.user.id))) {
          throw new APIError('BAD_REQUEST', { message: 'Enter your password to delete your account.', code: 'PASSWORD_REQUIRED' });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        // Changing the password from the Account page also cancels reset links sent earlier.
        if (ctx.path !== '/change-password' && ctx.path !== '/set-password') return;
        const current = await getSessionFromCtx(ctx);
        if (current && !(ctx.context.returned instanceof Error)) await deps.removeResetTokens(current.user.id);
      }),
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!(await mayJoin(user.email))) {
              throw new APIError('FORBIDDEN', { message: 'This lab only accepts invited people and allow-listed addresses.' });
            }
            return { data: user };
          },
        },
      },
      session: {
        create: {
          // A new session opens on the person's last-used workspace, and a verified admin address gets its role.
          before: async (session) => {
            await deps.promoteAdmin(session.userId);
            return { data: { ...session, activeOrganizationId: await deps.initialOrganizationId(session.userId) } };
          },
        },
        update: {
          // Fires for set-active and for create (which activates the new workspace). Impersonation must not rewrite
          // the impersonated person's preference.
          after: async (session) => {
            const row = session as { userId: string; activeOrganizationId?: string | null; impersonatedBy?: string | null } | null;
            if (row?.activeOrganizationId && !row.impersonatedBy) await deps.rememberOrganization(row.userId, row.activeOrganizationId);
          },
        },
      },
    },

    plugins: [
      twoFactor({ issuer: APP_NAME }),
      passkey({ rpID: host, rpName: APP_NAME, origin: [deps.baseURL, ...deps.extraOrigins] }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await deps.sendEmail({
            kind: 'magic-link',
            to: email,
            subject: 'Your magic link for Auth Lab',
            heading: 'Here is your magic link',
            body: 'Tap the button to sign in. It works once, for five minutes.',
            action: { label: 'Sign in', url },
          });
        },
      }),
      organization({
        ac,
        roles,
        sendInvitationEmail: async ({ id, email, inviter, organization: workspace, role }) => {
          await deps.sendEmail({
            kind: 'invitation',
            to: email,
            subject: `${inviter.user.name} invited you to ${workspace.name} on Auth Lab`,
            heading: `Join ${workspace.name}!`,
            body: `${inviter.user.name} (${inviter.user.email}) wants you in the team "${workspace.name}" as ${role}. Sign in or join with this email to say yes.`,
            action: { label: 'See the invite', url: `${deps.baseURL}/accept-invitation/${id}` },
          });
        },
      }),
      admin(),
      // Keys are read-only in this app: the notes API only lets a key list notes.
      apiKey({ defaultPrefix: 'lab_', requireName: true, rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 30 } }),
    ],
  } satisfies BetterAuthOptions;
}
