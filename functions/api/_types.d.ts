interface Env {
  DB: D1Database;
  LASTFM_API_KEY: string;
  LASTFM_SHARED_SECRET: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  YEDITS_BUCKET: R2Bucket;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  // Leak alerts (functions/api/changes, functions/api/alerts)
  CHANGES_CRON_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
