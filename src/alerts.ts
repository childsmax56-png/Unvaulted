// Client for the tracker changelog + leak alerts (functions/api/changes,
// functions/api/alerts). Follows are cached in-module and shared by every
// FollowButton on the page, so a list of rows costs one request.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getToken, isLoggedIn } from './comments';

export type FollowScope = 'artist' | 'era' | 'song';
export interface Follow { slug: string; scope: FollowScope; target: string; label: string | null; createdAt: number }

export type ChangeKind =
  | 'added' | 'removed' | 'renamed' | 'moved'
  | 'link_added' | 'link_removed' | 'link_changed'
  | 'availability' | 'quality' | 'resync';

export interface ChangeItem {
  id: string;
  slug: string;
  era: string;
  name: string;
  kind: ChangeKind;
  old_value: string | null;
  new_value: string | null;
  url: string | null;
  detected_at: number;
  read_at?: number | null;
}

// Mirrors functions/api/changes/_core.ts norm().
export function normTarget(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ---- Follows store -----------------------------------------------------------

let follows: Follow[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function followKey(slug: string, scope: FollowScope, target: string) {
  return `${slug}|${scope}|${scope === 'artist' ? '' : normTarget(target)}`;
}

export function loadFollows(force = false): Promise<void> {
  if (!isLoggedIn()) { follows = []; return Promise.resolve(); }
  if (loading && !force) return loading;
  loading = fetch('/api/alerts/follows', { headers: authHeaders() })
    .then((r) => (r.ok ? r.json() : { follows: [] }))
    .then((d) => { follows = d.follows ?? []; emit(); })
    .catch(() => { follows = []; emit(); });
  return loading;
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (follows === null) loadFollows();
  return () => { listeners.delete(l); };
}

export function useFollows(): Follow[] {
  return useSyncExternalStore(subscribe, () => follows ?? EMPTY);
}
const EMPTY: Follow[] = [];

export function useIsFollowing(slug: string, scope: FollowScope, target = ''): boolean {
  const list = useFollows();
  const key = followKey(slug, scope, target);
  return list.some((f) => followKey(f.slug, f.scope, f.target) === key);
}

export async function setFollow(slug: string, scope: FollowScope, target: string, label: string, on: boolean): Promise<boolean> {
  const body = JSON.stringify({ slug, scope, target, label });
  const key = followKey(slug, scope, target);
  const before = follows ?? [];
  // Optimistic update.
  follows = on
    ? [{ slug, scope, target: scope === 'artist' ? '' : normTarget(target), label, createdAt: Date.now() }, ...before.filter((f) => followKey(f.slug, f.scope, f.target) !== key)]
    : before.filter((f) => followKey(f.slug, f.scope, f.target) !== key);
  emit();
  const res = await fetch('/api/alerts/follows', { method: on ? 'POST' : 'DELETE', headers: authHeaders(), body }).catch(() => null);
  if (!res?.ok) { follows = before; emit(); return false; }
  return true;
}

// ---- Notifications ---------------------------------------------------------

let unreadCount = 0;
const unreadListeners = new Set<() => void>();
let unreadTimer: number | null = null;

export async function refreshUnread(): Promise<void> {
  if (!isLoggedIn()) return;
  const res = await fetch('/api/alerts/notifications?limit=1', { headers: authHeaders() }).catch(() => null);
  if (!res?.ok) return;
  const d = await res.json();
  unreadCount = d.unread ?? 0;
  unreadListeners.forEach((l) => l());
}

export function useUnreadCount(): number {
  return useSyncExternalStore(
    (l) => {
      unreadListeners.add(l);
      if (unreadListeners.size === 1) {
        refreshUnread();
        unreadTimer = window.setInterval(refreshUnread, 3 * 60_000);
      }
      return () => {
        unreadListeners.delete(l);
        if (unreadListeners.size === 0 && unreadTimer !== null) { clearInterval(unreadTimer); unreadTimer = null; }
      };
    },
    () => unreadCount,
  );
}

export async function fetchNotifications(before?: number): Promise<{ items: ChangeItem[]; unread: number; nextBefore: number | null }> {
  const qs = new URLSearchParams({ limit: '50' });
  if (before) qs.set('before', String(before));
  const res = await fetch(`/api/alerts/notifications?${qs}`, { headers: authHeaders() });
  if (!res.ok) return { items: [], unread: 0, nextBefore: null };
  return res.json();
}

export async function markAllRead(): Promise<void> {
  await fetch('/api/alerts/notifications', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ all: true }) }).catch(() => null);
  unreadCount = 0;
  unreadListeners.forEach((l) => l());
}

// ---- Changelog -------------------------------------------------------------

export async function fetchChanges(opts: { slug?: string; kinds?: ChangeKind[]; before?: number }): Promise<{ items: ChangeItem[]; nextBefore: number | null; lastScanAt: number | null }> {
  const qs = new URLSearchParams({ limit: '100' });
  if (opts.slug) qs.set('slug', opts.slug);
  if (opts.kinds?.length) qs.set('kinds', opts.kinds.join(','));
  if (opts.before) qs.set('before', String(opts.before));
  const res = await fetch(`/api/changes?${qs}`);
  if (!res.ok) throw new Error('changes unavailable');
  return res.json();
}

// ---- Delivery settings -----------------------------------------------------

export interface AlertSettings { discordWebhook: string | null; pushDevices: number; vapidPublicKey: string | null }

export async function fetchAlertSettings(): Promise<AlertSettings | null> {
  const res = await fetch('/api/alerts/settings', { headers: authHeaders() }).catch(() => null);
  return res?.ok ? res.json() : null;
}

export async function saveDiscordWebhook(url: string | null, test: boolean): Promise<string | null> {
  const res = await fetch('/api/alerts/settings', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ discordWebhook: url, test }) });
  if (res.ok) return null;
  const d = await res.json().catch(() => ({}));
  return d.error || 'Could not save';
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function b64urlToUint8(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js');
}

// Whether THIS browser currently has a push subscription.
export function usePushEnabled(): [boolean | null, (v: boolean | null) => void] {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!pushSupported()) { setOn(false); return; }
    navigator.serviceWorker.getRegistration('/')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setOn(!!sub && Notification.permission === 'granted'))
      .catch(() => setOn(false));
  }, []);
  return [on, setOn];
}

export async function enablePush(vapidPublicKey: string): Promise<string | null> {
  if (!pushSupported()) return 'This browser doesn’t support push notifications. On iPhone, add the site to your Home Screen first.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Notifications are blocked for this site in your browser settings.';
  const reg = await swRegistration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToUint8(vapidPublicKey) as BufferSource });
  }
  const res = await fetch('/api/alerts/push', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ endpoint: sub.endpoint }) });
  return res.ok ? null : 'Could not register this device';
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/alerts/push', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => null);
  await sub.unsubscribe();
}

// ---- Display ---------------------------------------------------------------

export const KIND_META: Record<ChangeKind, { label: string; className: string }> = {
  added: { label: 'New song', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  link_added: { label: 'Link added', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  availability: { label: 'Availability', className: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  quality: { label: 'Quality', className: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  renamed: { label: 'Renamed', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  moved: { label: 'Moved', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  link_changed: { label: 'Link updated', className: 'bg-white/5 text-white/60 border-white/15' },
  link_removed: { label: 'Link removed', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  removed: { label: 'Removed', className: 'bg-red-500/15 text-red-300 border-red-500/30' },
  resync: { label: 'Reorganised', className: 'bg-white/5 text-white/50 border-white/15' },
};

export function describeChange(c: Pick<ChangeItem, 'kind' | 'old_value' | 'new_value'>): string {
  switch (c.kind) {
    case 'added': return 'Added to the tracker';
    case 'removed': return 'Removed from the tracker';
    case 'renamed': return `Renamed from “${c.old_value}”`;
    case 'moved': return `Moved from ${c.old_value} to ${c.new_value}`;
    case 'link_added': return 'Now has a link';
    case 'link_removed': return 'Link was removed';
    case 'link_changed': return 'Link was replaced';
    case 'availability': return c.old_value ? `${c.old_value} → ${c.new_value}` : `Now ${c.new_value}`;
    case 'quality': return c.old_value ? `${c.old_value} → ${c.new_value}` : `${c.new_value}`;
    case 'resync': return `Tracker reorganised (${c.old_value} → ${c.new_value} songs)`;
  }
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
