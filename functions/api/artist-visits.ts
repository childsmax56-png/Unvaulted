// Global artist-visit counter powering the landing page's "Most visited" sort.
// GET  -> { counts: { [slug]: number } } aggregated across all users.
// POST { slug } -> increments that artist's counter (anonymous, no auth).
// The table is created lazily on first use, matching the inline-DDL pattern
// used elsewhere (e.g. listening_history, yeditsgold_claims).
import { json, options } from './_auth';

export const onRequestOptions = options;

let ensured = false;
async function ensureTable(db: D1Database): Promise<void> {
  if (ensured) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS artist_visits (
        slug TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      )`
    )
    .run();
  ensured = true;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  await ensureTable(env.DB);
  const { results } = await env.DB.prepare(
    'SELECT slug, count FROM artist_visits'
  ).all<{ slug: string; count: number }>();
  const counts: Record<string, number> = {};
  for (const r of results ?? []) counts[r.slug] = r.count;
  return json({ counts });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const slug = (body.slug ?? '').trim().toLowerCase();
  // Guard against junk/injection: slugs are short lowercase kebab identifiers.
  if (!slug || slug.length > 64 || !/^[a-z0-9_-]+$/.test(slug)) {
    return json({ error: 'invalid slug' }, 400);
  }

  await ensureTable(env.DB);
  await env.DB.prepare(
    `INSERT INTO artist_visits (slug, count) VALUES (?, 1)
     ON CONFLICT(slug) DO UPDATE SET count = count + 1`
  )
    .bind(slug)
    .run();

  return json({ ok: true });
};
