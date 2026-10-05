import type { Note } from './lib';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

// JSON calls to the FastAPI backend (same origin, so the session cookie rides along).
// Any 401 outside the login form means the session is gone: the app shows the login page.
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    keepalive: opts.keepalive,
  });
  if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('logged-out'));
  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`;
    try {
      const { detail } = await res.json();
      message = typeof detail === 'string' ? detail : 'Please check the form and try again.';
    } catch { /* not JSON */ }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Note bodies are fetched once per page load (the quiz and the notes page share them).
const notes = new Map<string, Promise<Note>>();
export function getNote(id: string) {
  if (!notes.has(id)) notes.set(id, api<Note>(`/notes/${encodeURIComponent(id)}`).catch(e => { notes.delete(id); throw e; }));
  return notes.get(id)!;
}
export const cacheNote = (n: Note) => notes.set(n.id, Promise.resolve(n));
