import { json, options, getSession } from '../_auth';
import { ensureProfileColumns, readProfileSettings } from '../auth/_profile-schema';
import { ensureCommentTables } from '../comments/_schema';
import { ensureListeningTables } from '../listens/_schema';

// GET /api/users/{username} — a user's public profile (rendered at /u/{username}).
//
// Always public: username, avatar, bio, join date, and their comments (which are
// already public on the entries they were posted to). Opt-in, default OFF:
// listening stats, playlists, linked accounts — each gated by a users.show_*
// flag the owner sets on the account page (PATCH /api/auth/profile). A private
// profile returns only the name + avatar. The owner always sees everything,
// with `isSelf` so the page can label what others can't see.
export const onRequestOptions = options;

const GLOBAL_PLAYLISTS = '__global__';
const LISTENING_NOW_MS = 10 * 60 * 1000;
const STATS_DAYS = 30;

interface UserRow {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const raw = decodeURIComponent(String(params.username || '')).trim();
  if (!raw || raw.length > 64) return json({ error: 'Not found' }, 404);
  await ensureProfileColumns(env.DB);

  const user = await env.DB.prepare(
    'SELECT id, username, avatar_url, created_at FROM users WHERE LOWER(username) = ?'
  ).bind(raw.toLowerCase()).first<UserRow>();
  if (!user) return json({ error: 'Not found' }, 404);

  const settings = await readProfileSettings(env.DB, user.id);
  const viewer = await getSession(request, env.DB).catch(() => null);
  const isSelf = viewer?.user_id === user.id;

  const base = {
    username: user.username,
    avatarUrl: user.avatar_url ?? null,
    isSelf,
  };

  if (!settings.profilePublic && !isSelf) {
    return json({ ...base, private: true });
  }

  const db = env.DB;
  await Promise.all([ensureCommentTables(db), ensureListeningTables(db)]);

  // --- Comments (public) ---
  const [commentCount, recentComments] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM entry_comments WHERE user_id = ? AND deleted = 0')
      .bind(user.id).first<{ n: number }>(),
    db.prepare(
      `SELECT id, tracker_id AS tracker, entry_label AS entryLabel, entry_type AS entryType,
              SUBSTR(body, 1, 300) AS body, created_at AS createdAt, parent_id IS NOT NULL AS isReply
         FROM entry_comments WHERE user_id = ? AND deleted = 0
        ORDER BY created_at DESC LIMIT 15`
    ).bind(user.id).all(),
  ]);

  // --- Listening (opt-in) ---
  let listening: unknown = null;
  if (settings.showListening || isSelf) {
    const since = Date.now() - STATS_DAYS * 86_400_000;
    const [summary, topTrackers, topSongs, recent] = await db.batch([
      db.prepare(
        `SELECT COUNT(*) AS plays, COALESCE(SUM(duration_sec), 0) AS totalSec, MAX(played_at) AS lastPlay
           FROM listening_history WHERE user_id = ?1 AND played_at >= ?2`
      ).bind(user.id, since),
      db.prepare(
        `SELECT artist_slug AS artistSlug, COUNT(*) AS plays FROM listening_history
          WHERE user_id = ?1 AND played_at >= ?2 AND artist_slug IS NOT NULL AND artist_slug != ''
          GROUP BY artist_slug ORDER BY plays DESC LIMIT 6`
      ).bind(user.id, since),
      db.prepare(
        `SELECT track, COALESCE(artist,'') AS artist, COALESCE(era_name,'') AS eraName,
                COALESCE(artist_slug,'') AS artistSlug, COUNT(*) AS plays
           FROM listening_history WHERE user_id = ?1 AND played_at >= ?2
          GROUP BY track, artist ORDER BY plays DESC LIMIT 8`
      ).bind(user.id, since),
      db.prepare(
        `SELECT track, COALESCE(artist,'') AS artist, COALESCE(era_name,'') AS eraName,
                COALESCE(artist_slug,'') AS artistSlug, played_at AS playedAt
           FROM listening_history WHERE user_id = ?1 AND source IS NOT 'lastfm'
          ORDER BY played_at DESC LIMIT 8`
      ).bind(user.id),
    ]);
    const s = (summary.results?.[0] ?? {}) as { plays?: number; totalSec?: number };
    const recentRows = (recent.results ?? []) as { playedAt: number }[];
    listening = {
      days: STATS_DAYS,
      plays: s.plays ?? 0,
      minutes: Math.round((s.totalSec ?? 0) / 60),
      topTrackers: topTrackers.results ?? [],
      topSongs: topSongs.results ?? [],
      recent: recentRows,
      listeningNow: recentRows[0] && Date.now() - recentRows[0].playedAt < LISTENING_NOW_MS ? recentRows[0] : null,
      hidden: !settings.showListening,
    };
  }

  // --- Playlists (opt-in) ---
  let playlists: unknown = null;
  if (settings.showPlaylists || isSelf) {
    const pls = (await db.prepare(
      `SELECT id, name, cover FROM playlists WHERE user_id = ? AND tracker_id = ? ORDER BY created_at ASC LIMIT 24`
    ).bind(user.id, GLOBAL_PLAYLISTS).all<{ id: string; name: string; cover: string | null }>().catch(() => ({ results: [] }))).results;
    const songsBy = new Map<string, unknown[]>();
    if (pls.length) {
      const marks = pls.map(() => '?').join(',');
      const songs = (await db.prepare(
        `SELECT playlist_id, song_name AS songName, era_name AS eraName, url, tracker, image, artist
           FROM playlist_songs WHERE playlist_id IN (${marks}) ORDER BY playlist_id, position ASC`
      ).bind(...pls.map(p => p.id)).all<{ playlist_id: string }>()).results;
      for (const { playlist_id, ...song } of songs) {
        if (!songsBy.has(playlist_id)) songsBy.set(playlist_id, []);
        songsBy.get(playlist_id)!.push(song);
      }
    }
    playlists = {
      hidden: !settings.showPlaylists,
      items: pls.map(p => ({
        id: p.id, name: p.name,
        // Uploaded covers are ~512px data URLs; skip anything unreasonably large.
        cover: p.cover && p.cover.length < 400_000 ? p.cover : null,
        songCount: songsBy.get(p.id)?.length ?? 0,
        songs: (songsBy.get(p.id) ?? []).slice(0, 100),
      })),
    };
  }

  // --- Linked accounts (opt-in, per service) ---
  let linked: unknown = null;
  if (settings.showLinked || isSelf) {
    const { results } = await db.prepare(
      `SELECT service, service_username AS username, avatar_url AS avatarUrl, public
         FROM linked_services WHERE user_id = ? AND service IN ('discord','reddit','lastfm','spotify')`
    ).bind(user.id).all<{ service: string; username: string | null; avatarUrl: string | null; public: number }>();
    linked = {
      hidden: !settings.showLinked,
      items: results
        .filter(r => r.username && (isSelf || r.public === 1))
        .map(r => ({ service: r.service, username: r.username, avatarUrl: r.avatarUrl, hidden: r.public !== 1 })),
    };
  }

  return json({
    ...base,
    private: false,
    privateToOthers: !settings.profilePublic,
    bio: settings.bio,
    joinedAt: user.created_at ?? null,
    comments: { count: commentCount?.n ?? 0, recent: recentComments.results ?? [] },
    listening,
    playlists,
    linked,
  });
};
