import { json, options } from '../_auth';
import { requireModerator } from './_admin';
import {
  ensureLinkTables, normTracker, normalizeLinkUrl, isCheckableLink, checkLink, upsertLinkStatus,
  type LinkCheckResult,
} from '../links/_links';

// POST /api/admin/link-check — check one batch of a tracker's links.
// Body: { tracker, links: [{ url, era?, name? }] } (max BATCH_MAX).
//
// Cloudflare Pages has no cron, so a full-tracker scan is driven by the admin
// dashboard: it loads the tracker's songs, skips links checked recently, and
// posts them here in small batches (each link is one subrequest, so batches
// stay well under the per-invocation subrequest limit).
const BATCH_MAX = 25;
const CONCURRENCY = 6;

export const onRequestOptions: PagesFunction = async () => options();

export const onRequestPost: PagesFunction<Env & { PIXELDRAIN_PROXY_URL?: string }> = async ({ request, env }) => {
  const gate = await requireModerator(request, env);
  if ('error' in gate) return gate.error;

  const body = await request.json().catch(() => null) as
    { tracker?: string; links?: { url?: string; era?: string; name?: string }[] } | null;
  const tracker = normTracker(body?.tracker || '');
  if (!tracker || !Array.isArray(body?.links)) return json({ error: 'tracker and links required' }, 400);

  const seen = new Set<string>();
  const links = body!.links
    .map(l => ({ url: normalizeLinkUrl(l.url || ''), era: l.era?.slice(0, 200) ?? null, name: l.name?.slice(0, 200) ?? null }))
    .filter(l => l.url && isCheckableLink(l.url) && !seen.has(l.url) && seen.add(l.url))
    .slice(0, BATCH_MAX);

  await ensureLinkTables(env.DB);
  const now = Date.now();
  const results: (LinkCheckResult & { url: string })[] = [];

  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, links.length) }, async () => {
    while (next < links.length) {
      const link = links[next++];
      const r = await checkLink(link.url, env);
      results.push({ url: link.url, ...r });
    }
  }));

  if (results.length) {
    const byUrl = new Map(links.map(l => [l.url, l]));
    await env.DB.batch(results.map(r =>
      upsertLinkStatus(env.DB, { tracker, ...byUrl.get(r.url)! }, r, now)
    ));
  }

  return json({ checked: results.length, results });
};
