import { json, options, getSession } from '../_auth';
import { ensureProfileColumns, readProfileSettings } from './_profile-schema';

// GET   /api/auth/profile — the signed-in user's public-profile settings,
//                           plus each linked service's visibility.
// PATCH /api/auth/profile — update any subset of:
//   { bio, profilePublic, showListening, showPlaylists, showLinked,
//     services: { discord?: bool, reddit?: bool, lastfm?: bool, spotify?: bool } }
// The profile itself is served by functions/api/users/[username].ts.
export const onRequestOptions = options;

const MAX_BIO = 300;
const SERVICES = ['discord', 'reddit', 'lastfm', 'spotify'];

async function serviceVisibility(db: D1Database, userId: string) {
  const { results } = await db.prepare('SELECT service, public FROM linked_services WHERE user_id = ?')
    .bind(userId).all<{ service: string; public: number }>();
  return Object.fromEntries(results.filter(r => SERVICES.includes(r.service)).map(r => [r.service, r.public === 1]));
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  const settings = await readProfileSettings(env.DB, session.user_id);
  return json({ username: session.username, ...settings, services: await serviceVisibility(env.DB, session.user_id) });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureProfileColumns(env.DB);

  const body = await request.json().catch(() => null) as {
    bio?: string; profilePublic?: boolean; showListening?: boolean; showPlaylists?: boolean; showLinked?: boolean;
    services?: Record<string, boolean>;
  } | null;
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (typeof body.bio === 'string') {
    const bio = body.bio.replace(/\r\n/g, '\n').trim();
    if (bio.length > MAX_BIO) return json({ error: `Bio must be ${MAX_BIO} characters or fewer` }, 400);
    sets.push('bio = ?'); args.push(bio);
  }
  const flags: [keyof typeof body, string][] = [
    ['profilePublic', 'profile_public'], ['showListening', 'show_listening'],
    ['showPlaylists', 'show_playlists'], ['showLinked', 'show_linked'],
  ];
  for (const [key, col] of flags) {
    if (typeof body[key] === 'boolean') { sets.push(`${col} = ?`); args.push(body[key] ? 1 : 0); }
  }

  const stmts: D1PreparedStatement[] = [];
  if (sets.length) {
    stmts.push(env.DB.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`)
      .bind(...args, Date.now(), session.user_id));
  }
  for (const [service, visible] of Object.entries(body.services ?? {})) {
    if (!SERVICES.includes(service) || typeof visible !== 'boolean') continue;
    stmts.push(env.DB.prepare('UPDATE linked_services SET public = ? WHERE user_id = ? AND service = ?')
      .bind(visible ? 1 : 0, session.user_id, service));
  }
  if (stmts.length) await env.DB.batch(stmts);

  const settings = await readProfileSettings(env.DB, session.user_id);
  return json({ ok: true, username: session.username, ...settings, services: await serviceVisibility(env.DB, session.user_id) });
};
