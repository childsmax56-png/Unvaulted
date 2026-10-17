// /api/alerts/settings — delivery settings for leak alerts.
//   GET  → { discordWebhook, pushDevices, vapidPublicKey, externalDefault, trackerExternal: { [slug]: boolean } }
//   POST { discordWebhook: string | null, test?: boolean }
//   POST { externalDefault: boolean }                    push/Discord for trackers without an override
//   POST { slug, external: boolean | null }              per-tracker override (null = follow default)
import { json, options, getSession } from '../_auth';
import { ensureChangeTables, type ChangeRow } from '../changes/_core';
import { DISCORD_WEBHOOK_RE, sendDiscord } from '../changes/_notify';

export const onRequestOptions = options;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);
  const [settings, devices, overrides] = await Promise.all([
    env.DB.prepare('SELECT discord_webhook, external_default FROM alert_settings WHERE user_id = ?').bind(session.user_id).first<{ discord_webhook: string | null; external_default: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM alert_push_subs WHERE user_id = ?').bind(session.user_id).first<{ n: number }>(),
    env.DB.prepare('SELECT slug, external FROM alert_tracker_delivery WHERE user_id = ?').bind(session.user_id).all<{ slug: string; external: number }>(),
  ]);
  return json({
    discordWebhook: settings?.discord_webhook ?? null,
    pushDevices: devices?.n ?? 0,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    externalDefault: (settings?.external_default ?? 1) !== 0,
    trackerExternal: Object.fromEntries(overrides.results.map((o) => [o.slug, !!o.external])),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);
  const body = await request.json().catch(() => ({})) as {
    discordWebhook?: string | null; test?: boolean; externalDefault?: boolean; slug?: string; external?: boolean | null;
  };

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) return json({ error: 'Invalid tracker' }, 400);
    if (typeof body.external === 'boolean') {
      await env.DB.prepare(
        `INSERT INTO alert_tracker_delivery (user_id, slug, external) VALUES (?, ?, ?)
         ON CONFLICT(user_id, slug) DO UPDATE SET external = excluded.external`
      ).bind(session.user_id, slug, body.external ? 1 : 0).run();
    } else {
      await env.DB.prepare('DELETE FROM alert_tracker_delivery WHERE user_id = ? AND slug = ?').bind(session.user_id, slug).run();
    }
    return json({ ok: true });
  }

  if (typeof body.externalDefault === 'boolean') {
    await env.DB.prepare(
      `INSERT INTO alert_settings (user_id, external_default, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET external_default = excluded.external_default, updated_at = excluded.updated_at`
    ).bind(session.user_id, body.externalDefault ? 1 : 0, Date.now()).run();
    return json({ ok: true });
  }

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
