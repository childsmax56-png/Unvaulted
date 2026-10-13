// Per-entry comment threads: list, post, and delete.
//
//   GET    /api/comments?tracker=<slug>&entry=<entry_key>
//            → { comments: CommentNode[] }  (top-level, each with .replies[])
//   POST   /api/comments
//            body { tracker, entry, entryLabel?, entryType?, parentId?, body }
//            → { comment }
//   DELETE /api/comments?id=<comment_id>
//            → { ok: true }
//
// Reading is public. Posting/deleting requires a signed-in unvaulted account
// (Bearer vg_token). A comment can be deleted by its author or a moderator.
import { json, options, getSession, generateId } from './_auth';
import { isYeditsAdmin } from './_yedits-auth';
import { ensureCommentTables, normTracker, commentGroup } from './comments/_schema';
import { ensureProfileColumns } from './auth/_profile-schema';

export const onRequestOptions = options;

const MAX_BODY = 2000;
const MAX_KEY = 400;

interface Row {
  id: string;
  parent_id: string | null;
  user_id: string;
  username: string;
  body: string;
  created_at: number;
  avatar_url: string | null;
}

interface CommentNode {
  id: string;
  username: string;
  userId: string;
  avatarUrl: string | null;
  body: string;
  createdAt: number;
  replies: CommentNode[];
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await ensureCommentTables(env.DB);
  await ensureProfileColumns(env.DB);
  const url = new URL(request.url);
  const tracker = normTracker(url.searchParams.get('tracker') || '');
  const entry = (url.searchParams.get('entry') || '').slice(0, MAX_KEY);
  if (!tracker || !entry) return json({ error: 'Missing tracker or entry' }, 400);

  const group = commentGroup(tracker);
  const groupIn = group.map(() => '?').join(',');

  // avatar_url is joined live from users so an updated profile picture shows on
  // every past comment, rather than the value at post time.
  const { results } = await env.DB.prepare(
    `SELECT ec.id, ec.parent_id, ec.user_id, ec.username, ec.body, ec.created_at,
            u.avatar_url
       FROM entry_comments ec
       LEFT JOIN users u ON u.id = ec.user_id
      WHERE ec.tracker_id IN (${groupIn}) AND ec.entry_key = ? AND ec.deleted = 0
      ORDER BY ec.created_at ASC`
  ).bind(...group, entry).all<Row>();

  // Build a one-level thread: top-level comments in post order, replies nested.
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const r of results) {
    byId.set(r.id, {
      id: r.id, username: r.username, userId: r.user_id,
      avatarUrl: r.avatar_url ?? null,
      body: r.body, createdAt: r.created_at, replies: [],
    });
  }
  for (const r of results) {
    const node = byId.get(r.id)!;
    const parent = r.parent_id ? byId.get(r.parent_id) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return json({ comments: roots });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await ensureCommentTables(env.DB);
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Sign in to comment' }, 401);

  let payload: {
    tracker?: string; entry?: string; entryLabel?: string;
    entryType?: string; parentId?: string; body?: string;
  };
  try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const tracker = normTracker(payload.tracker || '');
  const entry = (payload.entry || '').slice(0, MAX_KEY);
  const body = (payload.body || '').trim().slice(0, MAX_BODY);
  if (!tracker || !entry) return json({ error: 'Missing tracker or entry' }, 400);
  if (!body) return json({ error: 'Comment cannot be empty' }, 400);

  // Replies can only hang off a top-level comment on the same entry; collapse
  // any deeper nesting to the reply's own root so the thread stays one level.
  let parentId: string | null = null;
  if (payload.parentId) {
    const group = commentGroup(tracker);
    const parent = await env.DB.prepare(
      `SELECT id, parent_id FROM entry_comments
        WHERE id = ? AND tracker_id IN (${group.map(() => '?').join(',')}) AND entry_key = ? AND deleted = 0`
    ).bind(payload.parentId, ...group, entry).first<{ id: string; parent_id: string | null }>();
    if (!parent) return json({ error: 'Parent comment not found' }, 400);
    parentId = parent.parent_id || parent.id;
  }

  const id = generateId();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO entry_comments
       (id, tracker_id, entry_key, entry_label, entry_type, parent_id, user_id, username, body, created_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).bind(
    id, tracker, entry,
    (payload.entryLabel || '').slice(0, 300) || null,
    (payload.entryType || '').slice(0, 60) || null,
    parentId, session.user_id, session.username, body, now
  ).run();

  return json({
    comment: {
      id, username: session.username, userId: session.user_id, avatarUrl: null,
      body, createdAt: now, parentId, replies: [],
    },
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  await ensureCommentTables(env.DB);
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Sign in required' }, 401);

  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return json({ error: 'Missing id' }, 400);

  const row = await env.DB.prepare(
    `SELECT user_id FROM entry_comments WHERE id = ? AND deleted = 0`
  ).bind(id).first<{ user_id: string }>();
  if (!row) return json({ error: 'Comment not found' }, 404);

  const isOwner = row.user_id === session.user_id;
  const isMod = isOwner ? false : await isYeditsAdmin(env.DB, session.user_id, session.email);
  if (!isOwner && !isMod) return json({ error: 'Not allowed' }, 403);

  // Soft-delete so any nested replies keep their parent reference intact.
  await env.DB.prepare(
    `UPDATE entry_comments SET deleted = 1, body = '' WHERE id = ?`
  ).bind(id).run();

  return json({ ok: true });
};
