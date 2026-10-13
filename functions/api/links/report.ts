import { json, options, generateId, getSession } from '../_auth';
import {
  ensureLinkTables, normTracker, normalizeLinkUrl, isCheckableLink, checkLink, upsertLinkStatus,
} from './_links';
import { ARTIST_REGISTRY } from '../../../src/artists/registry';

// POST /api/links/report — "this link is broken", from a user click
// (reason 'user') or automatically when the player fails to load a song's
// audio (reason 'playback'). Signed-in is optional.
//
// A report is recorded for the moderator queue, and — if the link hasn't been
// checked in the last hour — triggers an immediate server-side re-check, so a
// confirmed-dead link is badged right away. A report alone never marks a link
// dead (see _links.ts).
const RECHECK_AFTER_MS = 60 * 60 * 1000;
const MAX_REPORTS_PER_HOUR = 30;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const onRequestOptions: PagesFunction = async () => options();

async function reporterId(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`link-report:${ip}`));
  return Array.from(new Uint8Array(digest).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost: PagesFunction<Env & { PIXELDRAIN_PROXY_URL?: string }> = async ({ request, env }) => {
  const body = await request.json().catch(() => null) as
    { tracker?: string; url?: string; label?: string; era?: string; reason?: string } | null;
  if (!body) return json({ error: 'Invalid body' }, 400);

  const tracker = normTracker(body.tracker || '');
  const url = normalizeLinkUrl(body.url || '');
  const reason = body.reason === 'playback' ? 'playback' : 'user';
  if (!tracker || !url || url.length > 1000) return json({ error: 'tracker and url required' }, 400);
  // Community trackers are moderated separately; only official trackers here.
  if (!ARTIST_REGISTRY[tracker]) return json({ error: 'Unknown tracker' }, 400);

  await ensureLinkTables(env.DB);
  const now = Date.now();
  const reporter = await reporterId(request);

  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM link_reports WHERE reporter = ? AND created_at > ?`
  ).bind(reporter, now - RECHECK_AFTER_MS).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_REPORTS_PER_HOUR) return json({ error: 'Too many reports — try again later' }, 429);

  const dupe = await env.DB.prepare(
    `SELECT id FROM link_reports WHERE reporter = ? AND tracker = ? AND url = ? AND created_at > ?`
  ).bind(reporter, tracker, url, now - DEDUPE_WINDOW_MS).first();

  const session = await getSession(request, env.DB).catch(() => null);
  const label = (body.label || '').slice(0, 200) || null;
  const era = (body.era || '').slice(0, 200) || null;

  if (!dupe) {
    await env.DB.prepare(
      `INSERT INTO link_reports (id, tracker, url, entry_label, reason, user_id, reporter, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(generateId(), tracker, url, label, reason, session?.user_id ?? null, reporter, now).run();
  }

  if (!isCheckableLink(url)) return json({ ok: true, status: 'unchecked' });

  const existing = await env.DB.prepare(
    `SELECT status, checked_at FROM link_status WHERE tracker = ? AND url = ?`
  ).bind(tracker, url).first<{ status: string; checked_at: number }>();
  if (existing && now - existing.checked_at < RECHECK_AFTER_MS) {
    return json({ ok: true, status: existing.status });
  }

  const result = await checkLink(url, env);
  await upsertLinkStatus(env.DB, { tracker, url, era, name: label }, result, now).run();
  return json({ ok: true, status: result.status });
};
