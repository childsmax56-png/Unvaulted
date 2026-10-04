import { json, options } from '../_auth';
import { requireModerator } from './_admin';
import {
  ensureLinkTables, normTracker, normalizeLinkUrl, checkLink, upsertLinkStatus,
} from '../links/_links';

// GET  /api/admin/links                       — dead links, open reports, per-tracker totals
// GET  /api/admin/links?tracker=X&mode=status — every stored status for one tracker
//                                               (the dashboard scan uses it to skip fresh links)
// POST /api/admin/links { action, tracker, url } — moderator actions:
//   'recheck'        re-run the check now
//   'mark-ok'        override: never show this link as dead (false positive)
//   'clear-override' undo 'mark-ok'
//   'resolve'        close the open reports for this link
export const onRequestOptions: PagesFunction = async () => options();

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const gate = await requireModerator(request, env);
  if ('error' in gate) return gate.error;
  await ensureLinkTables(env.DB);

  const params = new URL(request.url).searchParams;
  const tracker = normTracker(params.get('tracker') || '');

  if (tracker && params.get('mode') === 'status') {
    const rows = (await env.DB.prepare(
      `SELECT url, status, checked_at FROM link_status WHERE tracker = ?`
    ).bind(tracker).all()).results ?? [];
    return json({ statuses: rows });
  }

  const where = tracker ? 'AND s.tracker = ?1' : '';
  const bindIf = (stmt: D1PreparedStatement) => (tracker ? stmt.bind(tracker) : stmt);

  const [dead, reports, totals] = await env.DB.batch([
    bindIf(env.DB.prepare(
      `SELECT s.tracker, s.url, s.era, s.name, s.http_status, s.detail, s.checked_at, s.dead_since, s.override,
              (SELECT COUNT(*) FROM link_reports r WHERE r.tracker = s.tracker AND r.url = s.url AND r.resolved = 0) AS open_reports
         FROM link_status s
        WHERE s.status = 'dead' ${where}
        ORDER BY s.dead_since DESC LIMIT 500`
    )),
    bindIf(env.DB.prepare(
      `SELECT r.tracker, r.url, MAX(r.entry_label) AS label, COUNT(*) AS count,
              SUM(r.reason = 'playback') AS playback, SUM(r.reason = 'user') AS user_reports,
              MAX(r.created_at) AS last_at, s.status, s.checked_at, s.detail
         FROM link_reports r
         LEFT JOIN link_status s ON s.tracker = r.tracker AND s.url = r.url
        WHERE r.resolved = 0 ${tracker ? 'AND r.tracker = ?1' : ''}
        GROUP BY r.tracker, r.url
        ORDER BY count DESC, last_at DESC LIMIT 300`
    )),
    env.DB.prepare(
      `SELECT tracker, COUNT(*) AS checked,
              SUM(status = 'dead' AND (override IS NULL OR override != 'ok')) AS dead,
              SUM(status = 'unknown') AS unknown,
              MAX(checked_at) AS last_checked
         FROM link_status GROUP BY tracker`
    ),
  ]);

  return json({ dead: dead.results ?? [], reports: reports.results ?? [], totals: totals.results ?? [] });
};

export const onRequestPost: PagesFunction<Env & { PIXELDRAIN_PROXY_URL?: string }> = async ({ request, env }) => {
  const gate = await requireModerator(request, env);
  if ('error' in gate) return gate.error;
  await ensureLinkTables(env.DB);

  const body = await request.json().catch(() => null) as { action?: string; tracker?: string; url?: string } | null;
  const tracker = normTracker(body?.tracker || '');
  const url = normalizeLinkUrl(body?.url || '');
  if (!tracker || !url) return json({ error: 'tracker and url required' }, 400);

  switch (body?.action) {
    case 'recheck': {
      const result = await checkLink(url, env);
      await upsertLinkStatus(env.DB, { tracker, url }, result).run();
      return json({ ok: true, ...result });
    }
    case 'mark-ok':
    case 'clear-override':
      await env.DB.prepare(`UPDATE link_status SET override = ? WHERE tracker = ? AND url = ?`)
        .bind(body.action === 'mark-ok' ? 'ok' : null, tracker, url).run();
      // A false positive's reports are settled too.
      if (body.action === 'mark-ok') {
        await env.DB.prepare(`UPDATE link_reports SET resolved = 1 WHERE tracker = ? AND url = ?`).bind(tracker, url).run();
      }
      return json({ ok: true });
    case 'resolve':
      await env.DB.prepare(`UPDATE link_reports SET resolved = 1 WHERE tracker = ? AND url = ?`).bind(tracker, url).run();
      return json({ ok: true });
    default:
      return json({ error: 'Unknown action' }, 400);
  }
};
