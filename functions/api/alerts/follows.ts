// /api/alerts/follows — what the signed-in user gets leak alerts for.
//   GET                         → { follows: [{ slug, scope, target, label, createdAt }] }
//   POST   { slug, scope, target?, label? }  follow (scope: artist | era | song)
//   DELETE { slug, scope, target? }          unfollow
import { json, options, getSession } from '../_auth';
import { ensureChangeTables, norm } from '../changes/_core';

export const onRequestOptions = options;

const MAX_FOLLOWS = 500;

function parseTarget(body: any): { slug: string; scope: string; target: string } | null {
  const slug = String(body?.slug ?? '').trim().toLowerCase();
  const scope = String(body?.scope ?? '');
  if (!/^[a-z0-9-]{2,40}$/.test(slug) || !['artist', 'era', 'song'].includes(scope)) return null;
  const target = scope === 'artist' ? '' : norm(String(body?.target ?? '')).slice(0, 200);
  if (scope !== 'artist' && !target) return null;
  return { slug, scope, target };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);
  const rows = await env.DB.prepare(
    'SELECT slug, scope, target, label, created_at FROM alert_follows WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(session.user_id).all<{ slug: string; scope: string; target: string; label: string | null; created_at: number }>();
  return json({
    follows: rows.results.map((r) => ({ slug: r.slug, scope: r.scope, target: r.target, label: r.label, createdAt: r.created_at })),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json().catch(() => null);
  const t = parseTarget(body);
  if (!t) return json({ error: 'Invalid follow' }, 400);
  await ensureChangeTables(env.DB);
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM alert_follows WHERE user_id = ?')
    .bind(session.user_id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_FOLLOWS) return json({ error: `You can follow up to ${MAX_FOLLOWS} things` }, 400);
  const label = String((body as any)?.label ?? '').trim().slice(0, 200) || null;
  await env.DB.prepare(
    'INSERT OR IGNORE INTO alert_follows (user_id, slug, scope, target, label, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(session.user_id, t.slug, t.scope, t.target, label, Date.now()).run();
  return json({ ok: true, ...t });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  const t = parseTarget(await request.json().catch(() => null));
  if (!t) return json({ error: 'Invalid follow' }, 400);
  await ensureChangeTables(env.DB);
  await env.DB.prepare('DELETE FROM alert_follows WHERE user_id = ? AND slug = ? AND scope = ? AND target = ?')
    .bind(session.user_id, t.slug, t.scope, t.target).run();
  return json({ ok: true });
};
