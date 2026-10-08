// GET /api/tracker-archive — the community "TrackerArchive" Google Sheet
// (index of every Ye tracker copy, other artists' trackers, the Leaktionary,
// sheet templates, instructions and the status key), shaped for /archive.
//
// Each tab is read live from the public CSV export (links in this sheet are
// plain-text URLs, so CSV keeps them) and falls back to the committed snapshot
// in public/tracker-archive-data/ if Google is unreachable. Edge-cached 1h.

const SHEET_ID = '1oEzVbKJJfNXPf2TFOsMjzZjcCB08NPvIJ3K_CZfKGJA';
const TABS = {
  home: 733830576,
  trackers: 713654230,
  leaktionary: 1864378379,
  templates: 210670964,
  instructions: 730023433,
  key: 1481588139,
} as const;
type TabName = keyof typeof TABS;

const CACHE_VERSION = 'v1';
const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=600, s-maxage=3600',
};

// Icon tags the sheet prefixes onto names (see the Key tab).
const TAGS: Record<string, string> = {
  '⭐': 'best', '🌟': 'best', '✨': 'special', '🗑': 'worst', '🤡': 'joke', '🏅': 'wanted', '🚧': 'wip',
};
const TAG_RE = /^[\s️]*(⭐|🌟|✨|🗑|🤡|🏅|🚧)[️]?\s*/u;

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

function splitLinks(cell: string): string[] {
  return (cell.match(/https?:\/\/[^\s"]+/g) ?? []).map((u) => u.replace(/[),.]+$/, ''));
}

// Peel leading icon tags off a name: "🤡 ✨ Foo" → { name: "Foo", tags: [joke, special] }.
function stripTags(raw: string): { name: string; tags: string[] } {
  let name = raw;
  const tags: string[] = [];
  for (let m = name.match(TAG_RE); m; m = name.match(TAG_RE)) {
    const t = TAGS[m[1]];
    if (t && !tags.includes(t)) tags.push(t);
    name = name.slice(m[0].length);
  }
  return { name: name.trim(), tags };
}

// "Ye Tracker\n(Monki, YZYCORD)" → title + subtitle.
function splitName(name: string): { title: string; alt?: string } {
  const [title, ...rest] = name.split('\n');
  const alt = rest.join(' ').trim();
  return alt ? { title: title.trim(), alt } : { title: title.trim() };
}

async function loadTab(origin: string, tab: TabName): Promise<string[][]> {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TABS[tab]}`, {
      cf: { cacheTtl: 600 },
    } as RequestInit);
    const text = res.ok ? await res.text() : '';
    // A private/removed sheet answers 200 with an HTML sign-in page.
    if (text && !text.trimStart().startsWith('<')) return parseRows(text);
  } catch { /* fall through */ }
  const res = await fetch(`${origin}/tracker-archive-data/${tab}.csv`);
  return res.ok ? parseRows(await res.text()) : [];
}

const ENTRY_TYPES = new Set(['Trackers', 'Websites', 'Archive']);

function buildTrackers(rows: string[][]) {
  const entries: unknown[] = [];
  const sections: { name: string; info?: string }[] = [];
  const changelog: { date: string; note: string }[] = [];
  let section = '';
  let inChangelog = false;
  for (const r of rows.slice(1)) {
    const [type = '', name = '', info = '', status = '', working = '', links = ''] = r;
    if (/^Date Made$/i.test(type)) { inChangelog = true; continue; }
    if (inChangelog) {
      if (type && name) changelog.push({ date: type, note: stripTags(name).name });
      continue;
    }
    if (!type && name) {
      section = name.replace(/\s+/g, ' ').trim();
      sections.push(info ? { name: section, info } : { name: section });
      continue;
    }
    if (!ENTRY_TYPES.has(type) || !name) continue;
    const { name: clean, tags } = stripTags(name);
    const { title, alt } = splitName(clean);
    entries.push({
      type, section, title, alt, info, status, working, tags,
      links: splitLinks(links),
      note: links && !/https?:\/\//.test(links) ? links : undefined,
    });
  }
  return { entries, sections, changelog: changelog.reverse() };
}

function buildLeaktionary(rows: string[][]) {
  return rows.slice(1).flatMap(([type = '', word = '', def = '', other = '']) => {
    if (!type || !word) return [];
    const { name, tags } = stripTags(word);
    const { title, alt } = splitName(name);
    const links = splitLinks(other);
    return [{ type, title, alt, def, tags, links, note: other && !links.length ? other : undefined }];
  });
}

function buildTemplates(rows: string[][]) {
  return rows.slice(1).flatMap(([type = '', name = '', info = '', working = '', link = '']) => {
    if (!name || /MORE TEMPLATES SHOULD BE ADDED/i.test(name)) return [];
    const { title, alt } = splitName(name);
    return [{ type, title, alt, info, working, links: splitLinks(link) }];
  });
}

function buildInstructions(rows: string[][]) {
  const title = rows[0]?.find(Boolean) ?? '';
  const steps: { label: string; text: string }[] = [];
  const cells = rows.slice(1).map((r) => r.find(Boolean) ?? '').filter(Boolean);
  for (let i = 0; i < cells.length; i++) {
    if (/^STEP\s*\d+/i.test(cells[i])) {
      steps.push({ label: cells[i].replace(/:$/, ''), text: cells[i + 1] ?? '' });
      i++;
    }
  }
  return { title, steps };
}

function buildKey(rows: string[][]) {
  const status: { value: string; meaning: string }[] = [];
  const working: { value: string; meaning: string }[] = [];
  const icons: { icon: string; tag: string; meaning: string }[] = [];
  let inIcons = false;
  for (const r of rows.slice(1)) {
    if (/^Icon Tags$/i.test(r[0] ?? '')) { inIcons = true; continue; }
    if (inIcons) {
      const icon = (r[0] ?? '').trim();
      if (icon && r[1]) icons.push({ icon, tag: TAGS[icon.replace(/️/g, '')] ?? '', meaning: r[1] });
      continue;
    }
    if (r[0] && r[1]) status.push({ value: r[0], meaning: r[1] });
    if (r[3] && r[4]) working.push({ value: r[3], meaning: r[4] });
  }
  return { status, working, icons };
}

function buildHome(rows: string[][]) {
  const stats = rows.flat().filter((c) => /^Total Sheets Listed/i.test(c) || /Estimated FileSize/i.test(c));
  return { stats };
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(`${url.origin}/__tracker-archive/${CACHE_VERSION}`);
  if (!url.searchParams.has('fresh')) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const names = Object.keys(TABS) as TabName[];
  const tabs = await Promise.all(names.map((t) => loadTab(url.origin, t)));
  const get = (t: TabName) => tabs[names.indexOf(t)];

  const body = {
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
    tabUrls: Object.fromEntries(names.map((t) => [t, `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${TABS[t]}#gid=${TABS[t]}`])),
    home: buildHome(get('home')),
    trackers: buildTrackers(get('trackers')),
    leaktionary: buildLeaktionary(get('leaktionary')),
    templates: buildTemplates(get('templates')),
    instructions: buildInstructions(get('instructions')),
    key: buildKey(get('key')),
    generated_at: Date.now(),
  };
  const response = new Response(JSON.stringify(body), { headers: CACHE_HEADERS });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
