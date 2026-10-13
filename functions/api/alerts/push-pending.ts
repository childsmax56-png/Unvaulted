// POST /api/alerts/push-pending { endpoint }
//
// Called by the service worker when a payload-less push arrives. The worker
// can't see the page's auth token, so its own push subscription endpoint (an
// unguessable capability URL we stored at subscribe time) identifies the user.
import { json, options } from '../_auth';
import { ensureChangeTables } from '../changes/_core';
import { describeChange } from '../changes/_notify';

export const onRequestOptions = options;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { endpoint } = await request.json().catch(() => ({})) as { endpoint?: unknown };
  if (typeof endpoint !== 'string') return json({ items: [], unread: 0 });
  await ensureChangeTables(env.DB);
  const sub = await env.DB.prepare('SELECT user_id FROM alert_push_subs WHERE endpoint = ?')
    .bind(endpoint).first<{ user_id: string }>();
  if (!sub) return json({ items: [], unread: 0 });
  const [rows, unread] = await Promise.all([
    env.DB.prepare(
      `SELECT c.id, c.slug, c.era, c.name, c.kind, c.old_value, c.new_value
         FROM alert_notifications n JOIN tracker_changes c ON c.id = n.change_id
        WHERE n.user_id = ? AND n.read_at IS NULL
        ORDER BY c.detected_at DESC LIMIT 5`
    ).bind(sub.user_id).all<any>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM alert_notifications WHERE user_id = ? AND read_at IS NULL')
      .bind(sub.user_id).first<{ n: number }>(),
  ]);
  return json({
    unread: unread?.n ?? 0,
    items: rows.results.map((r) => ({ id: r.id, slug: r.slug, era: r.era, name: r.name, text: describeChange(r) })),
  });
};
