// The better-auth instance for the Worker: options.ts wired to the D1 binding, the secrets and Cloudflare Email Service.
import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { type Mail, renderHtml, renderText } from './mail.ts';
import { buildOptions } from './options.ts';

const list = (value: string | undefined) => (value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

export const isDev = env.DEV_MAILBOX === '1';
const adminEmails = list(env.ADMIN_EMAILS);

async function sendEmail(mail: Mail): Promise<void> {
  const text = renderText(mail);
  if (isDev) {
    // Local runs keep every message in D1 so scripts/flows.ts and /dev/mailbox can follow the links.
    await env.DB.prepare('INSERT INTO dev_outbox (recipient, subject, kind, url, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(mail.to.toLowerCase(), mail.subject, mail.kind, mail.action.url, text, new Date().toISOString())
      .run();
  }
  try {
    const sent = await env.EMAIL.send({ from: { email: env.MAIL_FROM, name: 'Auth Lab' }, to: mail.to, subject: mail.subject, text, html: renderHtml(mail) });
    // The id finds the message in Cloudflare's Email Sending activity log; the recipient is left out of the logs.
    console.log(`email ${mail.kind} sent`, sent.messageId);
  } catch (error) {
    // Not rethrown: a failed send must not tell the visitor whether an address exists. Read it in the Worker's logs.
    console.error(`email ${mail.kind} failed`, (error as { code?: string }).code ?? '', (error as Error).message);
  }
}

export const githubEnabled = !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);

export const auth = betterAuth(
  buildOptions({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    extraOrigins: list(env.EXTRA_ORIGINS),
    github: githubEnabled ? { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! } : undefined,
    signupAllow: list(env.SIGNUP_ALLOW),
    // Local runs let scripts/sim give each simulated person their own address (and so their own rate limits).
    ipHeaders: isDev ? ['x-sim-ip', 'cf-connecting-ip'] : ['cf-connecting-ip'],
    sendEmail,
    isInvited: async (email) =>
      !!(await env.DB.prepare("SELECT 1 FROM invitation WHERE lower(email) = ? AND status = 'pending' LIMIT 1").bind(email).first()),
    // The remembered workspace only counts while the person is still a member of it.
    initialOrganizationId: async (userId) =>
      (await env.DB.prepare(
        `SELECT organizationId FROM (
           SELECT w.organizationId, 0 AS rank FROM user_workspace w JOIN member m ON m.organizationId = w.organizationId AND m.userId = w.userId WHERE w.userId = ?1
           UNION ALL
           SELECT organizationId, 1 AS rank FROM (SELECT organizationId FROM member WHERE userId = ?1 ORDER BY createdAt LIMIT 1)
         ) ORDER BY rank LIMIT 1`,
      ).bind(userId).first<string>('organizationId')) ?? null,
    rememberOrganization: async (userId, organizationId) => {
      await env.DB.prepare(
        'INSERT INTO user_workspace (userId, organizationId, updatedAt) VALUES (?1, ?2, ?3) ON CONFLICT (userId) DO UPDATE SET organizationId = ?2, updatedAt = ?3',
      ).bind(userId, organizationId, new Date().toISOString()).run();
    },
    removeResetTokens: async (userId) => {
      // better-auth stores each link as a verification row: identifier "reset-password:<token>", value = the user id.
      await env.DB.prepare("DELETE FROM verification WHERE identifier LIKE 'reset-password:%' AND value = ?").bind(userId).run();
    },
    hasPassword: async (userId) =>
      !!(await env.DB.prepare("SELECT 1 FROM account WHERE userId = ? AND providerId = 'credential' AND password IS NOT NULL LIMIT 1").bind(userId).first()),
    removeApiKeys: async (userId) => { await env.DB.prepare('DELETE FROM apikey WHERE referenceId = ?').bind(userId).run(); },
    promoteAdmin: async (userId) => {
      if (!adminEmails.length) return;
      const marks = adminEmails.map(() => '?').join(', ');
      await env.DB.prepare(`UPDATE user SET role = 'admin' WHERE id = ? AND emailVerified = 1 AND (role IS NULL OR role = 'user') AND lower(email) IN (${marks})`)
        .bind(userId, ...adminEmails)
        .run();
    },
  }),
);
