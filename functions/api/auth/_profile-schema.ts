// Lazy schema bootstrap for user-profile fields.
//
// The `users` / `linked_services` / `sessions` tables live in a pre-existing D1
// database (vaultgold-accounts) that this repo does not create, so new profile
// columns are added with `ALTER TABLE … ADD COLUMN` guarded by try/catch —
// SQLite throws "duplicate column name" once the column exists, which we treat
// as success. A module-level flag keeps this to one no-op batch per isolate.
let ensured = false;

export async function ensureProfileColumns(db: D1Database): Promise<void> {
  if (ensured) return;
  // users.avatar_url — the resolved profile picture (uploaded avatar wins, else
  // a linked service's avatar; resolution happens at read time).
  await addColumn(db, 'ALTER TABLE users ADD COLUMN avatar_url TEXT');
  // Per-service visibility on the public profile — lets a user show Discord but
  // hide Last.fm, etc. Defaults to visible.
  await addColumn(db, 'ALTER TABLE linked_services ADD COLUMN public INTEGER NOT NULL DEFAULT 1');
  // Service avatar captured at link time (e.g. Discord/Reddit CDN URL).
  await addColumn(db, 'ALTER TABLE linked_services ADD COLUMN avatar_url TEXT');
  // Public profile (/u/{username}). The profile itself (avatar, bio, comments —
  // which are already public) is visible by default; sections that expose
  // otherwise-private data are opt-in and default OFF.
  await addColumn(db, 'ALTER TABLE users ADD COLUMN bio TEXT');
  await addColumn(db, 'ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 1');
  await addColumn(db, 'ALTER TABLE users ADD COLUMN show_listening INTEGER NOT NULL DEFAULT 0');
  await addColumn(db, 'ALTER TABLE users ADD COLUMN show_playlists INTEGER NOT NULL DEFAULT 0');
  // Master switch for linked accounts; each service's own linked_services.public
  // still applies on top of it.
  await addColumn(db, 'ALTER TABLE users ADD COLUMN show_linked INTEGER NOT NULL DEFAULT 0');
  ensured = true;
}

async function addColumn(db: D1Database, sql: string): Promise<void> {
  try {
    await db.prepare(sql).run();
  } catch (e) {
    // "duplicate column name" — column already present, nothing to do.
    if (!String((e as Error)?.message ?? '').toLowerCase().includes('duplicate column')) {
      // Re-throw anything that isn't the expected idempotency error.
      throw e;
    }
  }
}

export interface ProfileSettings {
  bio: string;
  profilePublic: boolean;
  showListening: boolean;
  showPlaylists: boolean;
  showLinked: boolean;
}

export async function readProfileSettings(db: D1Database, userId: string): Promise<ProfileSettings> {
  await ensureProfileColumns(db);
  const row = await db.prepare(
    'SELECT bio, profile_public, show_listening, show_playlists, show_linked FROM users WHERE id = ?'
  ).bind(userId).first<{ bio: string | null; profile_public: number; show_listening: number; show_playlists: number; show_linked: number }>();
  return {
    bio: row?.bio ?? '',
    profilePublic: (row?.profile_public ?? 1) === 1,
    showListening: row?.show_listening === 1,
    showPlaylists: row?.show_playlists === 1,
    showLinked: row?.show_linked === 1,
  };
}
