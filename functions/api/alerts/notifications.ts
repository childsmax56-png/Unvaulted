// /api/alerts/notifications — the signed-in user's alert inbox.
//   GET  ?limit=&before=   → { items, unread, nextBefore }
//   POST { all: true } | { ids: [changeId…] }   mark read
import { json, options, getSession } from '../_auth';
import { ensureChangeTables } from '../changes/_core';

export const onRequestOptions = options;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
  const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
  const [rows, unread] = await Promise.all([
    env.DB.prepare(
      `SELECT c.id, c.slug, c.era, c.name, c.kind, c.old_value, c.new_value, c.url, c.detected_at, n.read_at
         FROM alert_notifications n JOIN tracker_changes c ON c.id = n.change_id
        WHERE n.user_id = ? AND c.detected_at < ?
        ORDER BY c.detected_at DESC LIMIT ?`
    ).bind(session.user_id, before, limit + 1).all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM alert_notifications WHERE user_id = ? AND read_at IS NULL')
      .bind(session.user_id).first<{ n: number }>(),
  ]);
  const items = rows.results.slice(0, limit);
  return json({
    items,
    unread: unread?.n ?? 0,
    nextBefore: rows.results.length > limit ? (items[items.length - 1] as any).detected_at : null,
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);
  const body = await request.json().catch(() => ({})) as { all?: boolean; ids?: unknown };
  const now = Date.now();
  if (body.all) {
    await env.DB.prepare('UPDATE alert_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
      .bind(now, session.user_id).run();
  } else if (Array.isArray(body.ids) && body.ids.length) {
    const ids = body.ids.filter((x): x is string => typeof x === 'string').slice(0, 100);
    await env.DB.prepare(
      `UPDATE alert_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND change_id IN (${ids.map(() => '?').join(',')})`
    ).bind(now, session.user_id, ...ids).run();
  }
  return json({ ok: true });
};
