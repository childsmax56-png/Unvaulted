// Leak alerts — turn freshly recorded tracker changes into notifications for
// the users who follow them, then deliver: in-app inbox rows always, plus a
// web push "tickle" and a Discord webhook message when the user set those up.
//
// Push is payload-less (no RFC 8291 encryption needed): the service worker
// (public/sw.js) wakes up and pulls the latest unread items from
// /api/alerts/push-pending using its own subscription endpoint as the key.

import { norm, type ChangeKind, type ChangeRow } from './_core';

// What each follow scope is alerted about. Artist follows only hear about the
// big moments; narrower follows hear about everything except housekeeping.
const ARTIST_KINDS = new Set<ChangeKind>(['added', 'link_added', 'availability']);
const ERA_KINDS = new Set<ChangeKind>(['added', 'link_added', 'link_changed', 'availability', 'quality', 'renamed', 'moved']);
const SONG_KINDS = new Set<ChangeKind>(['added', 'removed', 'link_added', 'link_removed', 'link_changed', 'availability', 'quality', 'renamed', 'moved']);

// Max deliveries per scan, so a burst can't blow the subrequest budget.
const MAX_PUSHES = 150;
const MAX_WEBHOOKS = 50;

export const DISCORD_WEBHOOK_RE = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function describeChange(c: Pick<ChangeRow, 'kind' | 'old_value' | 'new_value'>): string {
  switch (c.kind) {
    case 'added': return 'New song added';
    case 'removed': return 'Removed from the tracker';
    case 'renamed': return `Renamed from "${c.old_value}"`;
    case 'moved': return `Moved from ${c.old_value} to ${c.new_value}`;
    case 'link_added': return 'Link added';
    case 'link_removed': return 'Link removed';
    case 'link_changed': return 'Link updated';
    case 'availability': return c.old_value ? `${c.old_value} → ${c.new_value}` : `Now ${c.new_value}`;
    case 'quality': return c.old_value ? `Quality ${c.old_value} → ${c.new_value}` : `Quality: ${c.new_value}`;
    case 'resync': return 'Tracker reorganised';
  }
}

export async function notifyFollowers(env: Env, rows: ChangeRow[], now: number): Promise<{ notified: number }> {
  const notable = rows.filter((r) => r.kind !== 'resync');
  if (notable.length === 0) return { notified: 0 };
  const slugs = [...new Set(notable.map((r) => r.slug))];
  const follows = await env.DB.prepare(
    `SELECT user_id, slug, scope, target FROM alert_follows WHERE slug IN (${slugs.map(() => '?').join(',')})`
  ).bind(...slugs).all<{ user_id: string; slug: string; scope: string; target: string }>();
  if (follows.results.length === 0) return { notified: 0 };

  // user → change rows they should hear about
  const perUser = new Map<string, Map<string, ChangeRow>>();
  for (const f of follows.results) {
    for (const r of notable) {
      if (r.slug !== f.slug) continue;
      const hit =
        (f.scope === 'artist' && ARTIST_KINDS.has(r.kind)) ||
        (f.scope === 'era' && ERA_KINDS.has(r.kind) && norm(r.era) === f.target) ||
        (f.scope === 'song' && SONG_KINDS.has(r.kind) && r.norm_name === f.target);
      if (!hit) continue;
      let m = perUser.get(f.user_id);
      if (!m) perUser.set(f.user_id, (m = new Map()));
      m.set(r.id, r);
    }
  }
  if (perUser.size === 0) return { notified: 0 };

  const insert = env.DB.prepare(
    'INSERT OR IGNORE INTO alert_notifications (user_id, change_id, created_at) VALUES (?, ?, ?)'
  );
  const inserts = [...perUser].flatMap(([uid, m]) => [...m.keys()].map((cid) => insert.bind(uid, cid, now)));
  for (let i = 0; i < inserts.length; i += 50) await env.DB.batch(inserts.slice(i, i + 50));

  const userIds = [...perUser.keys()];
  const placeholders = userIds.map(() => '?').join(',');
  const [subs, settings] = await Promise.all([
    env.DB.prepare(`SELECT endpoint, user_id FROM alert_push_subs WHERE user_id IN (${placeholders})`)
      .bind(...userIds).all<{ endpoint: string; user_id: string }>(),
    env.DB.prepare(`SELECT user_id, discord_webhook FROM alert_settings WHERE discord_webhook IS NOT NULL AND user_id IN (${placeholders})`)
      .bind(...userIds).all<{ user_id: string; discord_webhook: string }>(),
  ]);

  const tasks: Promise<unknown>[] = [];
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    for (const s of subs.results.slice(0, MAX_PUSHES)) tasks.push(sendPush(env, s.endpoint));
  }
  for (const s of settings.results.slice(0, MAX_WEBHOOKS)) {
    tasks.push(sendDiscord(s.discord_webhook, [...perUser.get(s.user_id)!.values()]));
  }
  await Promise.allSettled(tasks);
  return { notified: perUser.size };
}

// ---- Discord ---------------------------------------------------------------

const SITE = 'https://unvaulted.cc';

export async function sendDiscord(webhook: string, changes: ChangeRow[]): Promise<boolean> {
  if (!DISCORD_WEBHOOK_RE.test(webhook)) return false;
  const lines = changes.slice(0, 15).map((c) => {
    const name = c.name.replace(/[*_`~|]/g, '');
    return `**${name}** · ${c.slug.replace(/gold$/, '')} · ${c.era}\n${describeChange(c)}`;
  });
  if (changes.length > 15) lines.push(`…and ${changes.length - 15} more`);
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'UNVAULTED Alerts',
      allowed_mentions: { parse: [] },
      embeds: [{
        title: changes.length === 1 ? 'Tracker update' : `${changes.length} tracker updates`,
        url: `${SITE}/changes`,
        description: lines.join('\n\n').slice(0, 4000),
        color: 0xf5c518,
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  return res.ok;
}

// ---- Web push (VAPID, payload-less) ----------------------------------------

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function bytesToB64url(b: ArrayBuffer | Uint8Array): string {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let signingKey: CryptoKey | null = null;
async function vapidKey(env: Env): Promise<CryptoKey> {
  if (signingKey) return signingKey;
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY!); // 0x04 || x || y
  signingKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY, x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  return signingKey;
}

async function vapidJwt(env: Env, audience: string): Promise<string> {
  const enc = (o: object) => bytesToB64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:alerts@unvaulted.cc',
  })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(env), new TextEncoder().encode(unsigned));
  return `${unsigned}.${bytesToB64url(sig)}`;
}

export async function sendPush(env: Env, endpoint: string): Promise<void> {
  const jwt = await vapidJwt(env, new URL(endpoint).origin);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      TTL: '86400',
      Urgency: 'normal',
      'Content-Length': '0',
    },
  });
  // Expired / unsubscribed endpoints are gone for good.
  if (res.status === 404 || res.status === 410) {
    await env.DB.prepare('DELETE FROM alert_push_subs WHERE endpoint = ?').bind(endpoint).run();
  }
}
