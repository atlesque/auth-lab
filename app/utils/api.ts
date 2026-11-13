// Calls the Worker's own routes (/api/notes, /api/config). The thrown message is the API's explanation.
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const sendsBody = method !== 'GET' && method !== 'DELETE';
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: sendsBody ? { 'content-type': 'application/json' } : {},
      body: sendsBody ? JSON.stringify(options.body ?? {}) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('Could not reach Auth Lab. Check your internet.');
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
