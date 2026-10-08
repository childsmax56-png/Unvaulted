// /api/alerts/push — register / remove this browser's web push subscription.
//   POST   { endpoint }   (signed in)
//   DELETE { endpoint }
import { json, options, getSession } from '../_auth';
import { ensureChangeTables } from '../changes/_core';

export const onRequestOptions = options;

function validEndpoint(e: unknown): e is string {
  if (typeof e !== 'string' || e.length > 1000) return false;
  try { return new URL(e).protocol === 'https:'; } catch { return false; }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  const { endpoint } = await request.json().catch(() => ({})) as { endpoint?: unknown };
  if (!validEndpoint(endpoint)) return json({ error: 'Invalid subscription' }, 400);
  await ensureChangeTables(env.DB);
  await env.DB.prepare(
    `INSERT INTO alert_push_subs (endpoint, user_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id`
  ).bind(endpoint, session.user_id, Date.now()).run();
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const { endpoint } = await request.json().catch(() => ({})) as { endpoint?: unknown };
  if (!validEndpoint(endpoint)) return json({ error: 'Invalid subscription' }, 400);
  await ensureChangeTables(env.DB);
  // The endpoint itself is the capability — anyone holding it may drop it.
  await env.DB.prepare('DELETE FROM alert_push_subs WHERE endpoint = ?').bind(endpoint).run();
  return json({ ok: true });
};
