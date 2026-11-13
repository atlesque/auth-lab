// A simulated person's inbox: the emails the local app sent to one address, newest first.
//
//   node scripts/sim/mail.ts <address>                       show the inbox
//   node scripts/sim/mail.ts <address> --wait invitation     wait (up to 4 minutes) until an email of that kind arrives
//
// Kinds: verify-email, reset-password, magic-link, invitation. Open an email's link with a {"goto": "<link>"} step.
const BASE = process.env.BASE ?? 'http://localhost:8890';
const [address, flag, kind] = process.argv.slice(2);
if (!address) {
  console.error('Usage: node scripts/sim/mail.ts <address> [--wait <kind>]');
  process.exit(2);
}

interface Message { id: number; subject: string; kind: string; url: string; createdAt: string }
const inbox = async (): Promise<Message[]> => {
  const response = await fetch(`${BASE}/api/dev/outbox?to=${encodeURIComponent(address)}`);
  return ((await response.json()) as { messages: Message[] }).messages;
};

let messages = await inbox();
if (flag === '--wait') {
  const deadline = Date.now() + 240_000;
  while (!messages.some((message) => message.kind === kind) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    messages = await inbox();
  }
  if (!messages.some((message) => message.kind === kind)) console.log(`No "${kind}" email arrived for ${address} within 4 minutes.\n`);
}

console.log(messages.length ? `Inbox of ${address}, newest first:\n` : `The inbox of ${address} is empty.`);
for (const message of messages) {
  console.log(`[${message.createdAt.slice(11, 19)} UTC] ${message.subject}\n  kind: ${message.kind}\n  link: ${message.url}\n`);
}
