import { json, options } from '../_auth';
import { ensureLinkTables, normTracker } from './_links';

// GET /api/links/dead?tracker=<slug> — the tracker's confirmed-dead links, so
// song rows can show a "Dead link" badge. Public and edge-cacheable; links a
// moderator manually marked OK are excluded.
export const onRequestOptions: PagesFunction = async () => options();

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const tracker = normTracker(new URL(request.url).searchParams.get('tracker') || '');
  if (!tracker) return json({ error: 'tracker required' }, 400);

  await ensureLinkTables(env.DB);
  const rows = (await env.DB.prepare(
    `SELECT url FROM link_status
      WHERE tracker = ? AND status = 'dead' AND (override IS NULL OR override != 'ok')`
  ).bind(tracker).all<{ url: string }>()).results ?? [];

  const res = json({ dead: rows.map(r => r.url) });
  res.headers.set('Cache-Control', 'public, max-age=300');
  return res;
};
