// Drives one simulated person's browser against the local app, a few steps per call, and prints what they now see.
// Each persona keeps their own cookies, storage, passkeys and authenticator app in .sim/<persona>/, so several
// people can use the app at once.
//
//   node scripts/sim/act.ts <persona> '<JSON array of steps>'
//
// Steps:
//   {"goto": "/sign-up"}                      open a path or a full URL
//   {"fill": "Email", "value": "a@b.c"}       type into the field with this label (or placeholder)
//   {"click": "Create account"}               click a button, link, menu item, tab, checkbox or text
//   fill, click and select also take "in": "Two-factor authentication" to look only inside the card or dialog with
//   that heading, and "nth": 1 for the second match. The output lists each field and button with its [section].
//   {"select": "Role", "value": "Viewer"}     choose an option in a drop-down
//   {"press": "Enter"}                        press a key
//   {"otp": "123456"}                         type a code into the 6-box code field
//   {"authenticator": "scan"}                 the persona's authenticator app scans the QR code shown on the page
//   {"authenticator": "code"}                 type the authenticator app's current code into the code field
//   {"back": true} {"reload": true} {"wait": 1500}
//
// A call starts on the page the previous call ended on (reloaded), so anything shown once (a new API key, backup
// codes) must be read from the output of the call that produced it. A persona whose name contains "mobile" uses a
// phone-sized touch screen. Passkeys work: every persona has a built-in authenticator that approves automatically.
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Locator, type Page } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:8890';
const [persona, stepsJson] = process.argv.slice(2);
if (!persona || !stepsJson || !/^[a-z0-9-]+$/.test(persona)) {
  console.error("Usage: node scripts/sim/act.ts <persona> '<JSON array of steps>'  (persona: lowercase letters, digits, dashes)");
  process.exit(2);
}
type Step = Record<string, string | number | boolean>;
let steps: Step[];
try {
  steps = JSON.parse(stepsJson);
  if (!Array.isArray(steps)) throw new Error('not an array');
} catch (error) {
  console.error(`The steps must be a JSON array: ${(error as Error).message}`);
  process.exit(2);
}

const dir = new URL(`../../.sim/${persona}/`, import.meta.url);
mkdirSync(new URL('shots/', dir), { recursive: true });
const stateFile = new URL('state.json', dir);
interface State { url?: string; storage?: any; credentials: any[]; totp?: string; shot: number }
const state: State = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { credentials: [], shot: 0 };

// A stable private address per persona, so each has their own rate-limit bucket like people on different networks.
const hash = [...persona].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
const ip = `10.${(hash >> 16) & 255}.${(hash >> 8) & 255}.${(hash & 253) + 1}`;
const mobile = persona.includes('mobile');

function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: BASE,
  storageState: state.storage,
  viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  isMobile: mobile,
  hasTouch: mobile,
  permissions: ['clipboard-read', 'clipboard-write'],
});
await context.route(`${BASE}/**`, (route) => route.continue({ headers: { ...route.request().headers(), 'x-sim-ip': ip } }));
const page = await context.newPage();
page.setDefaultTimeout(6000);

const problems: string[] = [];
page.on('console', (message) => { if (message.type() === 'error') problems.push(`console error: ${message.text().slice(0, 300)}`); });
page.on('pageerror', (error) => problems.push(`page error: ${error.message.slice(0, 300)}`));
page.on('response', (response) => {
  if (response.status() >= 400 && response.url().startsWith(BASE)) {
    problems.push(`HTTP ${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
  }
});

// The persona's passkey authenticator: approves by itself and remembers its passkeys between calls.
const cdp = await context.newCDPSession(page);
await cdp.send('WebAuthn.enable');
const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
  options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
});
for (const credential of state.credentials) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });

const settle = async () => {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(350);
};

type Scope = Page | Locator;

// "in": the smallest block of the page that holds both that text (a card's heading, say) and the thing looked for.
async function within(section: unknown, has: (scope: Scope) => Locator): Promise<Scope> {
  if (!section) return page;
  const blocks = page.locator('div, section, form, li').filter({ hasText: String(section) }).filter({ has: has(page).filter({ visible: true }) });
  if (!(await blocks.count())) throw new Error(`no part of the page with the text "${section}" contains it`);
  return blocks.last();
}

// An exact name wins over a partial one, so "Password" does not pick "Current password".
async function find(name: string, roles: string[], nth = 0, section?: unknown): Promise<Locator> {
  for (const exact of [true, false]) {
    for (const role of roles) {
      const pick = (scope: Scope) => scope.getByRole(role as Parameters<Page['getByRole']>[0], { name, exact });
      const visible = pick(await within(section, pick).catch(() => page.locator('__none__'))).filter({ visible: true });
      if ((await visible.count()) > nth) return visible.nth(nth);
    }
    const pick = (scope: Scope) => scope.getByText(name, { exact });
    const text = pick(await within(section, pick).catch(() => page.locator('__none__'))).filter({ visible: true });
    if ((await text.count()) > nth) return text.nth(nth);
  }
  throw new Error(`nothing visible ${section ? `in "${section}" ` : 'on the page '}matches "${name}"`);
}

async function field(name: string, nth = 0, section?: unknown): Promise<Locator> {
  for (const exact of [true, false]) {
    for (const pick of [(scope: Scope) => scope.getByLabel(name, { exact }), (scope: Scope) => scope.getByPlaceholder(name, { exact }), (scope: Scope) => scope.getByRole('textbox', { name, exact })]) {
      const visible = pick(await within(section, pick).catch(() => page.locator('__none__'))).filter({ visible: true });
      if ((await visible.count()) > nth) return visible.nth(nth);
    }
  }
  throw new Error(`no visible field ${section ? `in "${section}" ` : ''}is labelled "${name}"`);
}

async function typeCode(code: string) {
  await page.locator('input[autocomplete="one-time-code"]').filter({ visible: true }).first().click();
  await page.keyboard.type(code, { delay: 40 });
}

if (state.url && !('goto' in (steps[0] ?? {}))) {
  await page.goto(state.url).catch((error) => problems.push(`could not reopen ${state.url}: ${(error as Error).message}`));
  await settle();
}

const log: string[] = [];
for (const [index, step] of steps.entries()) {
  const label = JSON.stringify('value' in step && /password/i.test(String(step.fill ?? '')) ? { ...step, value: '•••' } : step);
  try {
    if ('goto' in step) await page.goto(String(step.goto));
    else if ('fill' in step) await (await field(String(step.fill), Number(step.nth ?? 0), step.in)).fill(String(step.value ?? ''));
    else if ('click' in step) await (await find(String(step.click), ['button', 'link', 'menuitem', 'menuitemcheckbox', 'tab', 'checkbox', 'radio', 'option', 'switch'], Number(step.nth ?? 0), step.in)).click();
    else if ('select' in step) {
      await (await find(String(step.select), ['combobox'], Number(step.nth ?? 0), step.in)).click();
      await page.getByRole('option', { name: String(step.value) }).first().click();
    } else if ('press' in step) await page.keyboard.press(String(step.press));
    else if ('otp' in step) await typeCode(String(step.otp));
    else if (step.authenticator === 'scan') {
      const secret = (await page.locator('[data-totp-secret]').first().textContent())?.trim();
      if (!secret) throw new Error('there is no QR code on the page to scan');
      state.totp = secret;
    } else if (step.authenticator === 'code') {
      if (!state.totp) throw new Error("this persona's authenticator app has not scanned a QR code yet");
      await typeCode(totp(state.totp));
    } else if ('back' in step) await page.goBack();
    else if ('reload' in step) await page.reload();
    else if ('wait' in step) await page.waitForTimeout(Math.min(Number(step.wait), 15_000));
    else throw new Error('unknown step');
    await settle();
    log.push(`${index + 1}. ok      ${label}`);
  } catch (error) {
    log.push(`${index + 1}. FAILED  ${label}\n   ${(error as Error).message.split('\n')[0]}`);
    log.push('   (the remaining steps were not run)');
    break;
  }
}

const seen = await page.evaluate(() => {
  const visible = (element: Element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const clean = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 90);
  const sectionOf = (element: Element) => {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const heading = node.querySelector('h2, h1');
      if (heading && visible(heading)) return `[${clean((heading as HTMLElement).innerText)}] `;
    }
    return '';
  };
  const nameOf = (element: Element) => clean(element.getAttribute('aria-label') || (element as HTMLElement).innerText || element.getAttribute('title'));
  const controls = [...document.querySelectorAll('button, a[href], [role=menuitem], [role=menuitemcheckbox], [role=option], [role=tab], [role=checkbox], [role=radio], [role=combobox], [role=switch]')]
    .filter(visible)
    .map((element) => {
      const kind = element.getAttribute('role') ?? (element.tagName === 'A' ? 'link' : 'button');
      const flags = [
        (element as HTMLButtonElement).disabled || element.getAttribute('aria-disabled') === 'true' ? 'disabled' : '',
        element.getAttribute('aria-checked') === 'true' || element.getAttribute('data-state') === 'checked' ? 'checked' : '',
        element.getAttribute('aria-current') ? 'current page' : '',
      ].filter(Boolean);
      return `${sectionOf(element)}${kind} "${nameOf(element)}"${flags.length ? ` (${flags.join(', ')})` : ''}`;
    })
    .filter((line) => !line.endsWith('""'));
  const fields = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]), textarea')]
    .filter(visible)
    .map((input) => {
      const label = clean(input.labels?.[0]?.innerText || input.getAttribute('aria-label') || input.getAttribute('placeholder') || input.name);
      const value = input.type === 'password' ? (input.value ? '•••' : '') : clean(input.value);
      return `${sectionOf(input)}${input.type || 'text'} "${label}"${value ? ` = "${value}"` : ''}${input.required ? ' (required)' : ''}${input.disabled ? ' (disabled)' : ''}`;
    });
  const notices = [...document.querySelectorAll('[role=alert], [role=status], [role=dialog], [role=alertdialog]')].filter(visible).map((element) => clean((element as HTMLElement).innerText)).filter(Boolean);
  const text = document.body.innerText.replace(/\n{3,}/g, '\n\n').trim();
  return { title: document.title, controls, fields, notices, text, scroll: document.documentElement.scrollWidth > window.innerWidth + 2 };
});

state.shot += 1;
const shot = new URL(`shots/${String(state.shot).padStart(3, '0')}.png`, dir);
await page.screenshot({ path: shot.pathname });
state.url = page.url();
state.storage = await context.storageState();
state.credentials = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials;
writeFileSync(stateFile, JSON.stringify(state));
await browser.close();

const text = seen.text.length > 6000 ? `${seen.text.slice(0, 6000)}\n… (${seen.text.length - 6000} more characters)` : seen.text;
console.log(
  [
    `STEPS\n${log.join('\n')}`,
    `NOW ON  ${state.url}  (${seen.title})${seen.scroll ? '\nNOTE    the page is wider than the screen and scrolls sideways' : ''}`,
    seen.notices.length ? `MESSAGES AND DIALOGS\n${[...new Set(seen.notices)].map((line) => `- ${line}`).join('\n')}` : '',
    `PAGE TEXT\n${text}`,
    seen.fields.length ? `FIELDS\n${seen.fields.map((line) => `- ${line}`).join('\n')}` : '',
    `BUTTONS AND LINKS\n${[...new Set(seen.controls)].map((line) => `- ${line}`).join('\n')}`,
    problems.length ? `BROWSER PROBLEMS DURING THIS CALL\n${[...new Set(problems)].map((line) => `- ${line}`).join('\n')}` : '',
    `SCREENSHOT  ${shot.pathname}`,
  ]
    .filter(Boolean)
    .join('\n\n'),
);
