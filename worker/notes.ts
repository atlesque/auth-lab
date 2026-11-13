// The one protected resource: notes that belong to a workspace. Reading needs membership; writing is decided by the
// member's role (shared/permissions.ts). An API key may only list notes.
import { env } from 'cloudflare:workers';
import { can } from '../shared/permissions.ts';
import { auth } from './auth.ts';
import { json, readJson } from './http.ts';

interface Caller { userId: string; organizationId: string; role: string; viaKey: boolean }

async function memberRole(userId: string, organizationId: string): Promise<string | null> {
  return env.DB.prepare('SELECT role FROM member WHERE userId = ? AND organizationId = ?').bind(userId, organizationId).first<string>('role');
}

async function identify(request: Request, url: URL): Promise<Caller | Response> {
  const key = request.headers.get('x-api-key');
  let userId: string;
  let organizationId: string | null = url.searchParams.get('organizationId');
  if (key) {
    const checked = await auth.api.verifyApiKey({ body: { key } });
    if (!checked.valid || !checked.key) return json({ error: checked.error?.message ?? 'Invalid API key' }, 401);
    userId = checked.key.referenceId;
    organizationId ??= await env.DB.prepare('SELECT organizationId FROM member WHERE userId = ? ORDER BY createdAt LIMIT 1').bind(userId).first<string>('organizationId');
  } else {
    const current = await auth.api.getSession({ headers: request.headers });
    if (!current) return json({ error: 'Sign in first' }, 401);
    userId = current.user.id;
    organizationId = current.session.activeOrganizationId ?? null;
  }
  if (!organizationId) return json({ error: 'Pick a team first' }, 409);
  const role = await memberRole(userId, organizationId);
  if (!role) return json({ error: 'You are not in this team' }, 403);
  return { userId, organizationId, role, viaKey: !!key };
}

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function handleNotes(request: Request, url: URL): Promise<Response> {
  const caller = await identify(request, url);
  if (caller instanceof Response) return caller;
  const id = url.pathname.split('/')[3];
  const { method } = request;

  if (method === 'GET' && !id) {
    const { results } = await env.DB.prepare(
      'SELECT note.id, note.title, note.body, note.authorId, user.name AS authorName, note.createdAt, note.updatedAt FROM note LEFT JOIN user ON user.id = note.authorId WHERE note.organizationId = ? ORDER BY note.updatedAt DESC',
    ).bind(caller.organizationId).all();
    return json({ organizationId: caller.organizationId, role: caller.role, notes: results });
  }

  if (caller.viaKey) return json({ error: 'API keys are read-only' }, 403);

  if (method === 'POST' && !id) {
    if (!can(caller.role, 'create')) return json({ error: 'You cannot add notes here' }, 403);
    const body = await readJson(request);
    const title = clean(body.title, 120);
    if (!title) return json({ error: 'A note needs a title' }, 400);
    const now = new Date().toISOString();
    const note = { id: crypto.randomUUID(), title, body: clean(body.body, 5000), authorId: caller.userId, createdAt: now, updatedAt: now };
    await env.DB.prepare('INSERT INTO note (id, organizationId, authorId, title, body, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(note.id, caller.organizationId, note.authorId, note.title, note.body, now, now)
      .run();
    return json({ note }, 201);
  }

  if (id && (method === 'PATCH' || method === 'DELETE')) {
    const note = await env.DB.prepare('SELECT authorId FROM note WHERE id = ? AND organizationId = ?').bind(id, caller.organizationId).first<{ authorId: string }>();
    if (!note) return json({ error: 'Note not found' }, 404);
    const own = note.authorId === caller.userId && can(caller.role, 'create');
    if (method === 'DELETE') {
      if (!own && !can(caller.role, 'delete')) return json({ error: 'You cannot delete this note' }, 403);
      await env.DB.prepare('DELETE FROM note WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
    if (!own && !can(caller.role, 'update')) return json({ error: 'You cannot change this note' }, 403);
    const body = await readJson(request);
    const title = clean(body.title, 120);
    if (!title) return json({ error: 'A note needs a title' }, 400);
    await env.DB.prepare('UPDATE note SET title = ?, body = ?, updatedAt = ? WHERE id = ?').bind(title, clean(body.body, 5000), new Date().toISOString(), id).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
