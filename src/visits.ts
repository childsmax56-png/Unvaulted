// Tracks how often each artist tracker is opened, both per-user (localStorage)
// and globally (aggregated in D1 via /api/artist-visits). Powers the landing
// page's "Most visited" and "Your most visited" sort modes.

const LOCAL_KEY = 'vg_artist_visits';

export type VisitCounts = Record<string, number>;

function readLocal(): VisitCounts {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
  } catch {
    return {};
  }
}

// Per-user visit counts from this browser.
export function getUserVisitCounts(): VisitCounts {
  return readLocal();
}

// Debounce repeat records of the same slug (React StrictMode double-mounts,
// quick remounts) so a single page view counts once.
let lastRecorded: { slug: string; at: number } | null = null;

// Record a visit to an artist tracker: bumps the local per-user counter and
// fires a best-effort POST to bump the shared global counter. Both failures
// are non-fatal.
export function recordArtistVisit(slug: string): void {
  if (!slug) return;
  const now = Date.now();
  if (lastRecorded && lastRecorded.slug === slug && now - lastRecorded.at < 2000) return;
  lastRecorded = { slug, at: now };

  const counts = readLocal();
  counts[slug] = (counts[slug] || 0) + 1;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(counts));
  } catch {
    /* storage full / disabled — local sort just won't reflect this visit */
  }

  try {
    fetch('/api/artist-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* offline — global count skipped */
  }
}

// Fetch the global (all-users) visit counts. Returns {} on any failure so the
// caller can fall back to the default order.
export async function fetchGlobalVisitCounts(): Promise<VisitCounts> {
  try {
    const res = await fetch('/api/artist-visits');
    if (!res.ok) return {};
    const data = (await res.json()) as { counts?: VisitCounts };
    return data.counts ?? {};
  } catch {
    return {};
  }
}
