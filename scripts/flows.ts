// Runs the better-auth flows end to end over HTTP against the local Worker (`pnpm dev:api`, port 8890), reading the
// emails from the dev outbox. Passkeys and GitHub sign-in need a browser and are not covered.
//   pnpm test:flows            all sections
//   pnpm test:flows 2fa admin  only the named sections
import { createHmac } from 'node:crypto';

const BASE = process.env.BASE ?? 'http://localhost:8890';
const run = Date.now().toString(36);
const only = process.argv.slice(2);
let failed = 0;

function check(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failed += 1;
  console.log(`  ${pass ? '✓' : '✗'} ${label}${pass || detail === undefined ? '' : `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

interface Reply { status: number; data: any; location: string | null }

class Browser {
  cookies = new Map<string, string>();
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Reply> {
    const response = await fetch(path.startsWith('http') ? path : BASE + path, {
      method,
      redirect: 'manual',
      headers: {
        origin: BASE,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.cookies.size ? { cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const at = pair.indexOf('=');
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      if (!value || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: response.status, data, location: response.headers.get('location') };
  }
  get = (path: string, headers?: Record<string, string>) => this.call('GET', path, undefined, headers);
  post = (path: string, body: unknown = {}, headers?: Record<string, string>) => this.call('POST', path, body, headers);
  session = async () => (await this.get('/api/auth/get-session')).data;
}

const anonymous = new Browser();
const resetLimits = () => anonymous.post('/api/dev/reset-limits');
const address = (name: string, domain = 'example.com') => `${name}-${run}@${domain}`;

async function mail(to: string, kind: string): Promise<{ url: string } | undefined> {
  const { data } = await anonymous.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`);
  return data.messages.find((message: { kind: string }) => message.kind === kind);
}

// RFC 6238, the same code an authenticator app shows.
function totp(uri: string, at = Date.now()): string {
  const secret = new URL(uri).searchParams.get('secret') ?? '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

const PASSWORD = 'correct-horse-battery';
const NEW_PASSWORD = 'staple-battery-horse-9';

/** Signs up, follows the verification link and returns a signed-in browser. */
async function register(name: string, email: string, password = PASSWORD): Promise<Browser> {
  const browser = new Browser();
  await browser.post('/api/auth/sign-up/email', { name, email, password, callbackURL: '/notes' });
  const message = await mail(email, 'verify-email');
  if (message) await browser.get(message.url);
  return browser;
}

const ada = { email: address('ada'), password: PASSWORD, browser: new Browser(), userId: '' };
const bob = { email: address('bob', 'elsewhere.org'), browser: new Browser(), userId: '' };
let workspaceId = '';
let adaNoteId = '';

const sections: Record<string, () => Promise<void>> = {
  async signup() {
    const browser = ada.browser;
    const signUp = await browser.post('/api/auth/sign-up/email', { name: 'Ada Lovelace', email: ada.email, password: PASSWORD, callbackURL: '/notes' });
    check('sign-up accepted, no session yet', signUp.status === 200 && !signUp.data.token && !(await browser.session()), signUp);
    const message = await mail(ada.email, 'verify-email');
    check('verification email sent', !!message);
    const early = await browser.post('/api/auth/sign-in/email', { email: ada.email, password: PASSWORD });
    check('sign-in refused until the email is verified', early.status === 403, early);
    const verify = await browser.get(message!.url);
    check('verification link redirects to /notes', verify.status === 302 && verify.location === '/notes', verify);
    const session = await browser.session();
    check('verified and signed in', session?.user.emailVerified === true, session);
    ada.userId = session?.user.id;

    const blocked = address('mallory', 'elsewhere.org');
    await new Browser().post('/api/auth/sign-up/email', { name: 'Mallory', email: blocked, password: PASSWORD });
    check('address outside the allow-list gets no account and no email', !(await mail(blocked, 'verify-email')));
  },

  async signin() {
    const browser = ada.browser;
    const out = await browser.post('/api/auth/sign-out');
    check('sign-out clears the session', out.status === 200 && !(await browser.session()), out);
    const wrong = await browser.post('/api/auth/sign-in/email', { email: ada.email, password: 'not-the-password' });
    check('wrong password refused', wrong.status === 401, wrong);
    const right = await browser.post('/api/auth/sign-in/email', { email: ada.email, password: ada.password });
    check('email and password sign-in', right.status === 200 && !!(await browser.session()), right);
    const foreign = await new Browser().call('POST', '/api/auth/sign-in/email', { email: ada.email, password: ada.password }, { origin: 'https://evil.example' });
    check('request from another origin refused', foreign.status === 403, foreign);
  },

  async reset() {
    const browser = new Browser();
    const asked = await browser.post('/api/auth/request-password-reset', { email: ada.email, redirectTo: '/reset-password' });
    check('reset requested', asked.status === 200, asked);
    const unknown = await browser.post('/api/auth/request-password-reset', { email: address('nobody'), redirectTo: '/reset-password' });
    check('unknown address gets the same answer', unknown.status === 200 && JSON.stringify(unknown.data) === JSON.stringify(asked.data), unknown);
    const message = await mail(ada.email, 'reset-password');
    check('reset email sent', !!message);
    const link = await browser.get(message!.url);
    const token = new URL(link.location ?? '', BASE).searchParams.get('token');
    check('reset link redirects to /reset-password with a token', link.status === 302 && !!token, link);
    const changed = await browser.post('/api/auth/reset-password', { newPassword: NEW_PASSWORD, token });
    check('new password saved', changed.status === 200, changed);
    check('existing sessions revoked by the reset', !(await ada.browser.session()));
    const old = await browser.post('/api/auth/sign-in/email', { email: ada.email, password: PASSWORD });
    check('old password refused', old.status === 401, old);
    ada.password = NEW_PASSWORD;
    const fresh = await ada.browser.post('/api/auth/sign-in/email', { email: ada.email, password: NEW_PASSWORD });
    check('new password signs in', fresh.status === 200, fresh);

    // Two links requested; using one must cancel the other.
    await resetLimits(); // request-password-reset allows three a minute
    const other = new Browser();
    await other.post('/api/auth/request-password-reset', { email: ada.email, redirectTo: '/reset-password' });
    await other.post('/api/auth/request-password-reset', { email: ada.email, redirectTo: '/reset-password' });
    const { data } = await anonymous.get(`/api/dev/outbox?to=${encodeURIComponent(ada.email)}`);
    const links = data.messages.filter((m: { kind: string }) => m.kind === 'reset-password').slice(0, 2);
    const tokens: string[] = [];
    for (const link of links) tokens.push(new URL((await other.get(link.url)).location ?? '', BASE).searchParams.get('token') ?? '');
    check('two reset links outstanding', links.length === 2 && tokens.every(Boolean), links);
    const first = await other.post('/api/auth/reset-password', { newPassword: PASSWORD, token: tokens[0] });
    check('first link works', first.status === 200, first);
    const second = await other.post('/api/auth/reset-password', { newPassword: 'another-password-123', token: tokens[1] });
    check('the other link stops working once the password is reset', second.status === 400, second);
    ada.password = PASSWORD;

    // Changing the password from the Account page cancels outstanding links as well.
    await resetLimits();
    await other.post('/api/auth/request-password-reset', { email: ada.email, redirectTo: '/reset-password' });
    const latest = (await anonymous.get(`/api/dev/outbox?to=${encodeURIComponent(ada.email)}`)).data.messages.find((m: { kind: string }) => m.kind === 'reset-password');
    const pending = new URL((await other.get(latest.url)).location ?? '', BASE).searchParams.get('token');
    await ada.browser.post('/api/auth/sign-in/email', { email: ada.email, password: ada.password });
    const change = await ada.browser.post('/api/auth/change-password', { currentPassword: ada.password, newPassword: NEW_PASSWORD });
    check('password changed from the account page', change.status === 200, change);
    ada.password = NEW_PASSWORD;
    const stale = await other.post('/api/auth/reset-password', { newPassword: 'another-password-123', token: pending });
    check('outstanding reset link stops working after that change too', stale.status === 400, stale);
    await ada.browser.post('/api/auth/sign-in/email', { email: ada.email, password: ada.password });
  },

  async magic() {
    const browser = new Browser();
    const asked = await browser.post('/api/auth/sign-in/magic-link', { email: ada.email, callbackURL: '/notes' });
    check('magic link requested', asked.status === 200, asked);
    const message = await mail(ada.email, 'magic-link');
    check('magic link email sent', !!message);
    const link = await browser.get(message!.url);
    const session = await browser.session();
    check('magic link signs in', link.status === 302 && session?.user.email === ada.email, link);
    const again = await new Browser().get(message!.url);
    check('magic link works only once', !again.location?.startsWith('/notes') || /error/.test(again.location), again);
  },

  async sessions() {
    const second = new Browser();
    await second.post('/api/auth/sign-in/email', { email: ada.email, password: ada.password });
    const list = await ada.browser.get('/api/auth/list-sessions');
    check('both sessions listed', list.status === 200 && list.data.length >= 2, list);
    const other = (await second.session())?.session.token;
    const revoked = await ada.browser.post('/api/auth/revoke-session', { token: other });
    check('other session revoked', revoked.status === 200 && !(await second.session()), revoked);
    check('own session still valid', !!(await ada.browser.session()));
  },

  async '2fa'() {
    const browser = ada.browser;
    const enable = await browser.post('/api/auth/two-factor/enable', { password: ada.password });
    check('2FA setup returns a TOTP secret and backup codes', enable.status === 200 && !!enable.data.totpURI && enable.data.backupCodes?.length > 0, enable);
    const confirm = await browser.post('/api/auth/two-factor/verify-totp', { code: totp(enable.data.totpURI) });
    check('first code turns 2FA on', confirm.status === 200 && (await browser.session())?.user.twoFactorEnabled === true, confirm);

    const fresh = new Browser();
    const first = await fresh.post('/api/auth/sign-in/email', { email: ada.email, password: ada.password });
    check('password alone no longer signs in', first.data?.twoFactorRedirect === true && !(await fresh.session()), first);
    const bad = await fresh.post('/api/auth/two-factor/verify-totp', { code: '000000' });
    check('wrong code refused', bad.status === 401 || bad.status === 400, bad);
    const good = await fresh.post('/api/auth/two-factor/verify-totp', { code: totp(enable.data.totpURI) });
    check('TOTP code completes the sign-in', good.status === 200 && !!(await fresh.session()), good);

    const backup = new Browser();
    await backup.post('/api/auth/sign-in/email', { email: ada.email, password: ada.password });
    const used = await backup.post('/api/auth/two-factor/verify-backup-code', { code: enable.data.backupCodes[0] });
    check('backup code completes the sign-in', used.status === 200 && !!(await backup.session()), used);

    const off = await browser.post('/api/auth/two-factor/disable', { password: ada.password });
    check('2FA turned off again', off.status === 200, off);
  },

  async workspace() {
    const created = await ada.browser.post('/api/auth/organization/create', { name: 'Analytical Engines', slug: `engines-${run}` });
    workspaceId = created.data?.id;
    check('workspace created', created.status === 200 && !!workspaceId, created);
    const active = await ada.browser.post('/api/auth/organization/set-active', { organizationId: workspaceId });
    check('workspace set active on the session', active.status === 200 && (await ada.browser.session())?.session.activeOrganizationId === workspaceId, active);
    const note = await ada.browser.post('/api/notes', { title: 'Note G', body: 'Bernoulli numbers.' });
    adaNoteId = note.data?.note?.id;
    check('owner adds a note', note.status === 201, note);

    const invite = await ada.browser.post('/api/auth/organization/invite-member', { email: bob.email, role: 'member' });
    check('invitation created', invite.status === 200, invite);
    const message = await mail(bob.email, 'invitation');
    check('invitation email sent', !!message);
    const invitationId = message!.url.split('/').pop();

    bob.browser = await register('Bob Invited', bob.email);
    const session = await bob.browser.session();
    bob.userId = session?.user.id;
    check('invited address outside the allow-list can sign up', !!session, session);
    const outside = await bob.browser.get(`/api/notes?organizationId=${workspaceId}`);
    check('no access before accepting', outside.status === 409 || outside.status === 403, outside);
    const accepted = await bob.browser.post('/api/auth/organization/accept-invitation', { invitationId });
    check('invitation accepted', accepted.status === 200, accepted);
    await bob.browser.post('/api/auth/organization/set-active', { organizationId: workspaceId });

    const list = await bob.browser.get('/api/notes');
    check('member reads the notes', list.status === 200 && list.data.notes.length === 1 && list.data.role === 'member', list);
    const own = await bob.browser.post('/api/notes', { title: 'From Bob' });
    check('member adds a note', own.status === 201, own);
    const foreign = await bob.browser.call('DELETE', `/api/notes/${adaNoteId}`);
    check("member cannot delete someone else's note", foreign.status === 403, foreign);
    const mine = await bob.browser.call('PATCH', `/api/notes/${own.data.note.id}`, { title: 'From Bob, edited' });
    check('member edits their own note', mine.status === 200, mine);
    const cannotInvite = await bob.browser.post('/api/auth/organization/invite-member', { email: address('carol'), role: 'member' });
    check('member cannot invite people', cannotInvite.status === 403, cannotInvite);

    const members = await ada.browser.get(`/api/auth/organization/list-members?organizationId=${workspaceId}`);
    const bobMember = members.data?.members?.find((member: { userId: string }) => member.userId === bob.userId);
    const demoted = await ada.browser.post('/api/auth/organization/update-member-role', { memberId: bobMember?.id, role: 'viewer', organizationId: workspaceId });
    check('owner changes the member to the custom viewer role', demoted.status === 200, demoted);
    const refused = await bob.browser.post('/api/notes', { title: 'Should fail' });
    check('viewer cannot add notes', refused.status === 403, refused);
    check('viewer still reads', (await bob.browser.get('/api/notes')).status === 200);
    const removed = await ada.browser.call('DELETE', `/api/notes/${own.data.note.id}`);
    check("owner deletes a member's note", removed.status === 200, removed);
  },

  async apikey() {
    const created = await ada.browser.post('/api/auth/api-key/create', { name: 'flows script' });
    const key = created.data?.key;
    check('API key created', created.status === 200 && typeof key === 'string' && key.startsWith('lab_'), created);
    const keyOnly = new Browser();
    const list = await keyOnly.call('GET', '/api/notes', undefined, { 'x-api-key': key, origin: '' });
    check('key reads notes without a cookie', list.status === 200 && Array.isArray(list.data.notes), list);
    const write = await keyOnly.call('POST', '/api/notes', { title: 'Via key' }, { 'x-api-key': key });
    check('key cannot write', write.status === 403, write);
    const bad = await keyOnly.call('GET', '/api/notes', undefined, { 'x-api-key': 'lab_not-a-real-key' });
    check('unknown key refused', bad.status === 401, bad);
    const listed = await ada.browser.get('/api/auth/api-key/list');
    const id = (listed.data?.apiKeys ?? listed.data)?.[0]?.id;
    const deleted = await ada.browser.post('/api/auth/api-key/delete', { keyId: id });
    check('key deleted and no longer accepted', deleted.status === 200 && (await keyOnly.call('GET', '/api/notes', undefined, { 'x-api-key': key })).status === 401, deleted);
  },

  async admin() {
    const adminEmail = 'admin@example.com';
    const admin = new Browser();
    const existing = await admin.post('/api/auth/sign-in/email', { email: adminEmail, password: PASSWORD });
    if (existing.status !== 200) {
      Object.assign(admin, await register('Site Admin', adminEmail));
      if (!(await admin.session())) {
        // The account exists from an earlier run with another password: reset it, as its owner would.
        await admin.post('/api/auth/request-password-reset', { email: adminEmail, redirectTo: '/reset-password' });
        const link = await mail(adminEmail, 'reset-password');
        const token = new URL((await admin.get(link!.url)).location ?? '', BASE).searchParams.get('token');
        await admin.post('/api/auth/reset-password', { newPassword: PASSWORD, token });
        await admin.post('/api/auth/sign-in/email', { email: adminEmail, password: PASSWORD });
      }
    }
    const session = await admin.session();
    check('address in ADMIN_EMAILS has the admin role once verified', session?.user.role === 'admin', session?.user);
    const users = await admin.get('/api/auth/admin/list-users?limit=100');
    check('admin lists users', users.status === 200 && users.data.users.length >= 2, users);
    const denied = await ada.browser.get('/api/auth/admin/list-users?limit=10');
    check('ordinary user cannot list users', denied.status === 403, denied);

    const banned = await admin.post('/api/auth/admin/ban-user', { userId: bob.userId, banReason: 'flows script' });
    check('admin bans a user', banned.status === 200, banned);
    check("the banned user's session is gone", !(await bob.browser.session()));
    const refused = await new Browser().post('/api/auth/sign-in/email', { email: bob.email, password: PASSWORD });
    check('banned user cannot sign in', refused.status === 403, refused);
    const unbanned = await admin.post('/api/auth/admin/unban-user', { userId: bob.userId });
    check('admin lifts the ban', unbanned.status === 200, unbanned);

    const impersonate = await admin.post('/api/auth/admin/impersonate-user', { userId: ada.userId });
    const as = await admin.session();
    check('admin impersonates a user', impersonate.status === 200 && as?.user.id === ada.userId && !!as?.session.impersonatedBy, impersonate);
    const refusedCalls: [string, string, unknown][] = [
      ['POST', '/api/auth/api-key/create', { name: 'sneaky' }],
      ['POST', '/api/auth/passkey/update-passkey', { id: 'x', name: 'y' }],
      ['POST', '/api/auth/passkey/delete-passkey', { id: 'x' }],
      ['GET', '/api/auth/passkey/generate-register-options', undefined],
      ['POST', '/api/auth/delete-user', {}],
      ['POST', '/api/auth/change-email', { newEmail: address('elsewhere') }],
      ['POST', '/api/auth/change-password', { currentPassword: ada.password, newPassword: 'another-password-123' }],
      ['POST', '/api/auth/unlink-account', { providerId: 'github', accountId: 'x' }],
      ['POST', '/api/auth/two-factor/enable', { password: ada.password }],
    ];
    for (const [method, path, body] of refusedCalls) {
      const reply = await admin.call(method, path, body);
      check(`${path} refused while impersonating`, reply.status === 403 && reply.data?.code === 'IMPERSONATION_NOT_ALLOWED', reply);
    }
    check('listing keys and sessions still allowed while impersonating', (await admin.get('/api/auth/api-key/list')).status === 200 && (await admin.get('/api/auth/list-sessions')).status === 200);
    const stop = await admin.post('/api/auth/admin/stop-impersonating');
    check('and returns to the admin session', stop.status === 200 && (await admin.session())?.user.email === adminEmail, stop);
  },

  async lastworkspace() {
    const email = address('lastws');
    const browser = await register('Last Workspace', email);
    const home = (await browser.session())?.session.activeOrganizationId ?? null;
    const first = (await browser.post('/api/auth/organization/create', { name: 'First', slug: `first-${run}` })).data?.id;
    const second = (await browser.post('/api/auth/organization/create', { name: 'Second', slug: `second-${run}` })).data?.id;
    check('workspace create activates the new workspace', (await browser.session())?.session.activeOrganizationId === second, home);
    await browser.post('/api/auth/organization/set-active', { organizationId: first });
    await browser.post('/api/auth/sign-out');
    await browser.post('/api/auth/sign-in/email', { email, password: PASSWORD });
    check('sign-in reopens the last used workspace', (await browser.session())?.session.activeOrganizationId === first, await browser.session());
    await browser.post('/api/auth/organization/set-active', { organizationId: second });
    await browser.post('/api/auth/sign-out');
    await browser.post('/api/auth/sign-in/email', { email, password: PASSWORD });
    check('and follows a later switch', (await browser.session())?.session.activeOrganizationId === second);
    const removed = await browser.post('/api/auth/organization/delete', { organizationId: second });
    check('workspace deleted', removed.status === 200, removed);
    await browser.post('/api/auth/sign-out');
    await browser.post('/api/auth/sign-in/email', { email, password: PASSWORD });
    const after = (await browser.session())?.session.activeOrganizationId ?? null;
    check('falls back to another membership when the remembered one is gone', after === first, after);
  },

  async deleteaccount() {
    const email = address('temp');
    const browser = await register('Temporary Person', email);
    const key = (await browser.post('/api/auth/api-key/create', { name: 'left behind?' })).data?.key;
    const noPassword = await browser.post('/api/auth/delete-user', {});
    check('deleting without the password is refused for a fresh session', noPassword.status === 400 && !!(await browser.session()), noPassword);
    const deleted = await browser.post('/api/auth/delete-user', { password: PASSWORD });
    check('account deleted', deleted.status === 200 && !(await browser.session()), deleted);
    const after = await new Browser().call('GET', '/api/notes', undefined, { 'x-api-key': key });
    check("the deleted account's API key is gone too", after.status === 401, after);
    const again = await new Browser().post('/api/auth/sign-in/email', { email, password: PASSWORD });
    check('deleted account cannot sign in', again.status === 401, again);
  },

  async ratelimit() {
    const browser = new Browser();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      statuses.push((await browser.post('/api/auth/sign-in/email', { email: ada.email, password: 'guess-number-' + attempt })).status);
    }
    check('repeated sign-in attempts are cut off with 429', statuses.slice(0, 5).every((status) => status === 401) && statuses.at(-1) === 429, statuses);
  },
};

for (const [name, section] of Object.entries(sections)) {
  // signup creates the people every later section uses.
  if (only.length && !only.includes(name) && name !== 'signup') continue;
  console.log(`\n${name}`);
  await resetLimits();
  try {
    await section();
  } catch (error) {
    check(`section "${name}" ran to the end`, false, (error as Error).message);
  }
}
await resetLimits();
console.log(failed ? `\n${failed} check${failed === 1 ? '' : 's'} failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
