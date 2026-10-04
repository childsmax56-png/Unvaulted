// Client for dead-link detection (functions/api/links/*).
//
// `useDeadLinks(tracker)` returns the set of that tracker's confirmed-dead
// links (one shared fetch per tracker per page load), so song rows can show a
// "Dead link" badge. `reportBrokenLink` files a report — from the row's flag
// button, or automatically when the player fails to load a song's audio — and
// the server re-checks the link before anything is marked dead.
import { useEffect, useState } from 'react';
import { getToken } from './comments';

// Mirrors functions/api/links/_links.ts normalizeLinkUrl — keep in sync.
export function normalizeLinkUrl(raw: string): string {
  let u = (raw || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

const deadCache = new Map<string, Promise<Set<string>>>();
const deadValues = new Map<string, Set<string>>();
const listeners = new Map<string, Set<() => void>>();

function loadDead(tracker: string): Promise<Set<string>> {
  let p = deadCache.get(tracker);
  if (!p) {
    p = fetch(`/api/links/dead?tracker=${encodeURIComponent(tracker)}`)
      .then(r => (r.ok ? r.json() : { dead: [] }))
      .then((d: { dead?: string[] }) => new Set(d.dead ?? []))
      .catch(() => new Set<string>());
    p.then(set => { deadValues.set(tracker, set); listeners.get(tracker)?.forEach(fn => fn()); });
    deadCache.set(tracker, p);
  }
  return p;
}

export function useDeadLinks(tracker: string | undefined): Set<string> {
  const [, force] = useState(0);
  useEffect(() => {
    if (!tracker) return;
    const fn = () => force(n => n + 1);
    if (!listeners.has(tracker)) listeners.set(tracker, new Set());
    listeners.get(tracker)!.add(fn);
    loadDead(tracker);
    return () => { listeners.get(tracker)?.delete(fn); };
  }, [tracker]);
  return (tracker && deadValues.get(tracker)) || EMPTY;
}
const EMPTY = new Set<string>();

export function isDeadLink(dead: Set<string>, url: string | undefined): boolean {
  return !!url && dead.size > 0 && dead.has(normalizeLinkUrl(url));
}

// Playback auto-reports fire at most once per link per page load.
const autoReported = new Set<string>();

export async function reportBrokenLink(args: {
  tracker: string; url: string; label?: string; era?: string; reason?: 'user' | 'playback';
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const url = normalizeLinkUrl(args.url);
  if (!args.tracker || !url) return { ok: false, error: 'Missing link' };
  if (args.reason === 'playback') {
    const key = `${args.tracker}::${url}`;
    if (autoReported.has(key)) return { ok: true };
    autoReported.add(key);
  }
  try {
    const token = getToken();
    const res = await fetch('/api/links/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...args, url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Report failed' };
    if (data.status === 'dead') {
      // Badge it right away without waiting for the 5-min cached list.
      const set = new Set(deadValues.get(args.tracker) ?? []);
      set.add(url);
      deadValues.set(args.tracker, set);
      listeners.get(args.tracker)?.forEach(fn => fn());
    }
    return { ok: true, status: data.status };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
