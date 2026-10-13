// Batch comment counts for a set of entries on one tracker, so a view can show
// a badge next to each row without an N+1 of GET /api/comments.
//
//   GET /api/comments/counts?tracker=<slug>&entries=<key1>|<key2>|...
//     → { counts: { [entry_key]: number } }
//
// Entry keys are joined with "|" (a char our keys never contain). Reads are
// public, matching GET /api/comments.
import { json, options } from '../_auth';
import { ensureCommentTables, normTracker, commentGroup } from './_schema';

export const onRequestOptions = options;

const MAX_ENTRIES = 200;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await ensureCommentTables(env.DB);
  const url = new URL(request.url);
  const tracker = normTracker(url.searchParams.get('tracker') || '');
  const raw = url.searchParams.get('entries') || '';
  if (!tracker || !raw) return json({ counts: {} });

  const entries = Array.from(new Set(
    raw.split('|').map((e) => e.trim()).filter(Boolean)
  )).slice(0, MAX_ENTRIES);
  if (entries.length === 0) return json({ counts: {} });

  const placeholders = entries.map(() => '?').join(',');
  const group = commentGroup(tracker);
  const { results } = await env.DB.prepare(
    `SELECT entry_key, COUNT(*) AS n
       FROM entry_comments
      WHERE tracker_id IN (${group.map(() => '?').join(',')}) AND deleted = 0 AND entry_key IN (${placeholders})
      GROUP BY entry_key`
  ).bind(...group, ...entries).all<{ entry_key: string; n: number }>();

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.entry_key] = r.n;
  return json({ counts });
};
