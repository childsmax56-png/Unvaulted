import { json, options } from '../_auth';
import { requireModerator } from './_admin';
import { ensureCommentTables, normTracker } from '../comments/_schema';

// GET /api/admin/comments?limit=N&tracker=X&q=text
//   → { comments: [...] } — newest-first feed of every entry comment across all
//   trackers, for the /admin live comments view. The dashboard polls this every
//   few seconds (Pages Functions can't hold a socket open without a Durable
//   Object), and refetching the whole window means deletions from anywhere
//   drop out on the next poll. Deleting goes through DELETE /api/comments,
//   which already lets moderators remove any comment.
export const onRequestOptions: PagesFunction = async () => options();

const MAX_LIMIT = 300;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const gate = await requireModerator(request, env);
  if ('error' in gate) return gate.error;
  await ensureCommentTables(env.DB);

  const params = new URL(request.url).searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || 100));
  const tracker = normTracker(params.get('tracker') || '');
  const q = (params.get('q') || '').trim().slice(0, 100);

  const where = ['deleted = 0'];
  const binds: (string | number)[] = [];
  if (tracker) { where.push('tracker_id = ?'); binds.push(tracker); }
  if (q) {
    where.push('(body LIKE ? OR username LIKE ? OR entry_label LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    binds.push(like, like, like);
  }
  binds.push(limit);

  const { results } = await env.DB.prepare(
    `SELECT id, tracker_id, entry_key, entry_label, entry_type, parent_id, user_id, username, body, created_at
       FROM entry_comments
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?`
  ).bind(...binds).all();

  return json({ comments: results ?? [] });
};
