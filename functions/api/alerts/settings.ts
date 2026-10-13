// /api/alerts/settings — delivery settings for leak alerts.
//   GET  → { discordWebhook, pushDevices, vapidPublicKey }
//   POST { discordWebhook: string | null, test?: boolean }
import { json, options, getSession } from '../_auth';
import { ensureChangeTables, type ChangeRow } from '../changes/_core';
import { DISCORD_WEBHOOK_RE, sendDiscord } from '../changes/_notify';

export const onRequestOptions = options;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);
  const [settings, devices] = await Promise.all([
    env.DB.prepare('SELECT discord_webhook FROM alert_settings WHERE user_id = ?').bind(session.user_id).first<{ discord_webhook: string | null }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM alert_push_subs WHERE user_id = ?').bind(session.user_id).first<{ n: number }>(),
  ]);
  return json({
    discordWebhook: settings?.discord_webhook ?? null,
    pushDevices: devices?.n ?? 0,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);
  const body = await request.json().catch(() => ({})) as { discordWebhook?: string | null; test?: boolean };
  const hook = typeof body.discordWebhook === 'string' ? body.discordWebhook.trim() : '';
  if (hook && !DISCORD_WEBHOOK_RE.test(hook)) return json({ error: 'That doesn’t look like a Discord webhook URL' }, 400);

  if (hook && body.test) {
    const sample: ChangeRow = {
      id: 'test', slug: 'unvaulted', era: 'Test', name: 'Alerts are connected', norm_name: '',
      kind: 'link_added', old_value: null, new_value: null, url: null, detected_at: Date.now(),
    };
    const ok = await sendDiscord(hook, [sample]).catch(() => false);
    if (!ok) return json({ error: 'Discord rejected the test message — check the webhook URL' }, 400);
  }
  await env.DB.prepare(
    `INSERT INTO alert_settings (user_id, discord_webhook, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET discord_webhook = excluded.discord_webhook, updated_at = excluded.updated_at`
  ).bind(session.user_id, hook || null, Date.now()).run();
  return json({ ok: true, discordWebhook: hook || null });
};
