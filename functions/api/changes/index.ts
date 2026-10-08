// GET /api/changes?slug=&kinds=added,link_added&before=<ts>&limit=
//
// The tracker changelog feed: newest first, optionally one tracker / some
// change kinds, cursor-paginated by detected_at. Also kicks off a background
// scan of the stalest shard when it's overdue, so the changelog keeps moving
// even if the cron Worker isn't deployed.
import { json, options } from '../_auth';
import { ensureChangeTables, stalestShard, SCAN_INTERVAL_MS, SCAN_SLUGS } from './_core';
import { runShard } from './_run';

export const onRequestOptions = options;

const KINDS = new Set(['added', 'removed', 'renamed', 'moved', 'link_added', 'link_removed', 'link_changed', 'availability', 'quality', 'resync']);

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  await ensureChangeTables(env.DB);
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || '';
  const kinds = (url.searchParams.get('kinds') || '').split(',').filter((k) => KINDS.has(k));
  const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);

  const where = ['detected_at < ?'];
  const binds: unknown[] = [before];
  if (slug) { where.push('slug = ?'); binds.push(slug); }
  if (kinds.length) { where.push(`kind IN (${kinds.map(() => '?').join(',')})`); binds.push(...kinds); }
  const rows = await env.DB.prepare(
    `SELECT id, slug, era, name, kind, old_value, new_value, url, detected_at
       FROM tracker_changes WHERE ${where.join(' AND ')}
      ORDER BY detected_at DESC LIMIT ?`
  ).bind(...binds, limit + 1).all();

  const stale = await stalestShard(env.DB);
  if (Date.now() - stale.lastScanAt > SCAN_INTERVAL_MS) {
    waitUntil(runShard(env, url.origin, stale.shard, false).catch(() => {}));
  }

  const items = rows.results.slice(0, limit);
  return json({
    items,
    nextBefore: rows.results.length > limit ? (items[items.length - 1] as any).detected_at : null,
    trackers: SCAN_SLUGS.length,
    lastScanAt: stale.lastScanAt > 0 && stale.lastScanAt !== Infinity ? stale.lastScanAt : null,
  });
};
