// The better-auth client: one plugin per server plugin in worker/options.ts. It talks to /api/auth on this origin.
import { apiKeyClient } from '@better-auth/api-key/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { adminClient, magicLinkClient, organizationClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';
import { ac, roles } from '~~/shared/permissions';

export const authClient = createAuthClient({
  plugins: [twoFactorClient(), passkeyClient(), magicLinkClient(), organizationClient({ ac, roles }), adminClient(), apiKeyClient()],
});

export type SessionData = typeof authClient.$Infer.Session;

// better-auth error codes (result.error.code) in the app's own words. Anything not listed falls back to the server's message.
const friendly: Record<string, string> = {
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: 'They are already in this team.',
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: 'They already have an invite.',
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: 'You are the only owner. Make someone else an owner first.',
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: 'A team needs an owner. Make someone else an owner first.',
  INVITATION_NOT_FOUND: 'This invite is closed.',
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: 'This invite is for another email.',
  ORGANIZATION_ALREADY_EXISTS: 'That team name is taken. Pick another.',
  ORGANIZATION_SLUG_ALREADY_TAKEN: 'That team name is taken. Pick another.',
  INVALID_TOKEN: 'This link is too old or was used. Ask for a new one.',
  TOKEN_EXPIRED: 'This link is too old or was used. Ask for a new one.',
  INVALID_EMAIL_OR_PASSWORD: 'Wrong email or password.',
  INVALID_PASSWORD: 'Wrong password.',
  INVALID_EMAIL: 'That email looks wrong.',
  PASSWORD_TOO_SHORT: 'Use 10 or more letters.',
  PASSWORD_TOO_LONG: 'That password is too long.',
  SESSION_NOT_FRESH: 'Sign in again first.',
  SESSION_EXPIRED: 'Sign in again first.',
  BANNED_USER: 'This account is blocked.',
  IMPERSONATION_NOT_ALLOWED: 'Not while you are acting as someone else.',
};

type ErrorLike = { message?: string; statusText?: string; status?: number; code?: string };

/** better-auth calls resolve to { data, error }; this is the error in the app's words, or null. */
export const problem = (result: { error?: ErrorLike | null }, fallback = 'That did not work. Try again.'): string | null => {
  const error = result.error;
  if (!error) return null;
  if (error.status === 429) return 'Too many tries. Wait a minute.';
  const known = error.code ? friendly[error.code] : undefined;
  if (known) return known;
  // Schema validation: the message is "[body.name] Too small: …", which is for developers.
  if (error.code === 'VALIDATION_ERROR' || error.message?.startsWith('[body.')) {
    return /^\[body\.name\]/.test(error.message ?? '') ? 'Type a name.' : 'Check what you typed.';
  }
  return error.message || error.statusText || fallback;
};

/**
 * The ?error= codes better-auth puts in redirect addresses (magic link, email confirmation, OAuth) as a sentence.
 * They arrive in upper or lower case depending on the route, so compare them lower-cased.
 */
export const redirectProblem = (code: unknown, opts: { confirmation?: boolean } = {}) => {
  const key = String(code ?? '').toLowerCase();
  if (['invalid_token', 'expired_token', 'token_expired'].includes(key)) {
    return opts.confirmation
      ? 'This link is too old. Sign in and we send a new one.'
      : 'This link is too old or was used. Ask for a new one.';
  }
  switch (key) {
    case 'state_mismatch':
    case 'please_restart_the_process':
      return 'That took too long. Try again.';
    case 'email_not_found':
      return 'GitHub did not share your email, so that did not work.';
    case 'email_not_verified':
      return 'Confirm your email at GitHub first.';
    case 'signup_disabled':
    case 'new_user_signup_disabled':
      return 'Invite-only for now.';
    case 'unable_to_create_user':
    case 'failed_to_create_user':
      return 'We could not make your account. Try another way.';
    case 'account_already_linked_to_different_user':
      return 'That GitHub account belongs to another Auth Lab account.';
    case 'email_does_not_match':
      return 'That GitHub account uses another email.';
    case 'unable_to_link_account':
      return 'We could not link GitHub. Try again.';
    case 'account_not_linked':
      return 'You already have an account. Sign in like before, then link GitHub under Me.';
    case 'banned':
    case 'banned_user':
      return 'This account is blocked.';
    case 'user_not_found':
      return 'We could not find that account. Sign in to get a new link.';
    case 'access_denied':
      return 'Sign-in was cancelled.';
    default:
      return 'That did not work. Try another way.';
  }
};

/**
 * Add the "arrived from a confirmation link" marker to a path, keeping its own query and hash.
 * The route guard turns the marker into a toast and removes it from the address.
 */
export const confirmedPath = (path: string) => {
  const url = new URL(path, 'http://local');
  url.searchParams.set('confirmed', '1');
  return `${url.pathname}${url.search}${url.hash}`;
};

/** Only same-site paths may be used as a post-sign-in destination. */
export const safePath = (value: unknown, fallback = '/notes') =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;

export const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
