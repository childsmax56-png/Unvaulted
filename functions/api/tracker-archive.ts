// GET /api/tracker-archive[?v=lol] — a community "TrackerArchive" Google Sheet
// (index of every Ye tracker copy, other artists' trackers, the Leaktionary,
// sheet templates, instructions and the status key), shaped for /archive.
//
// Two archives share one layout: the main TrackerArchive and "the .lol
// archive". Each tab is read live (links in both sheets are plain-text URLs,
// so CSV keeps them) and falls back to the committed snapshot in
// public/tracker-archive-data/{variant}/ if Google is unreachable. Edge-cached 1h.

type TabName = 'home' | 'trackers' | 'leaktionary' | 'templates' | 'instructions' | 'key';

interface ArchiveSource {
  sheetId: string;
  // The .lol sheet has viewer downloads disabled: /export answers 401, but
  // gviz still serves cell text.
  via: 'export' | 'gviz';
  // A tab may be stitched together from several sheet tabs, in order.
  tabs: Partial<Record<TabName, number[]>>;
}

const SOURCES: Record<string, ArchiveSource> = {
  main: {
    sheetId: '1oEzVbKJJfNXPf2TFOsMjzZjcCB08NPvIJ3K_CZfKGJA',
    via: 'export',
    tabs: {
      home: [733830576],
      trackers: [713654230],
      leaktionary: [1864378379],
      templates: [210670964],
      instructions: [730023433],
      key: [1481588139],
    },
  },
  lol: {
    sheetId: '1xiU8dJVMOSD-OYy-1o-HFPPtG-W5PJdgvBUvdO5ELsc',
    via: 'gviz',
    tabs: {
      // Main archive, TrackerVerse, other trackers, websites, misc.
      trackers: [206903783, 2076989861, 1150640988, 1335212443, 993569498],
      leaktionary: [1864378379],
      templates: [210670964],
      key: [1481588139],
    },
  },
};

const CACHE_VERSION = 'v2';
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

// Full URLs anywhere in the cell, plus lines that are just a bare domain
// ("yetracker.net", "discord.gg/yedits").
const BARE_DOMAIN_RE = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i;
function splitLinks(cell: string): string[] {
  const links = (cell.match(/https?:\/\/[^\s"]+/g) ?? []).map((u) => u.replace(/[),.]+$/, ''));
  for (const line of cell.split('\n')) {
    const t = line.trim();
    if (!/https?:\/\//.test(t) && BARE_DOMAIN_RE.test(t)) links.push(`https://${t}`);
  }
  return links;
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

function sheetCsvUrl(src: ArchiveSource, gid: number): string {
  const base = `https://docs.google.com/spreadsheets/d/${src.sheetId}`;
  return src.via === 'gviz'
    ? `${base}/gviz/tq?tqx=out:csv&headers=0&gid=${gid}`
    : `${base}/export?format=csv&gid=${gid}`;
}

async function loadSheetTab(src: ArchiveSource, gid: number): Promise<string[][] | null> {
  try {
    const res = await fetch(sheetCsvUrl(src, gid), { cf: { cacheTtl: 600 } } as RequestInit);
    const text = res.ok ? await res.text() : '';
    // A private/removed sheet answers 200 with an HTML sign-in page.
    if (text && !text.trimStart().startsWith('<')) return parseRows(text);
  } catch { /* fall through */ }
  return null;
}

// Rows of every sheet tab behind `tab`. Each sheet tab keeps its own header
// row, so consumers that slice(1) per tab get them as separate chunks.
async function loadTab(origin: string, variant: string, tab: TabName): Promise<string[][][]> {
  const src = SOURCES[variant];
  const gids = src.tabs[tab] ?? [];
  return Promise.all(gids.map(async (gid) => {
    const live = await loadSheetTab(src, gid);
    if (live) return live;
    const res = await fetch(`${origin}/tracker-archive-data/${variant}/${gid}.csv`);
    return res.ok ? parseRows(await res.text()) : [];
  }));
}

const ENTRY_TYPES = new Set(['Trackers', 'Websites', 'Archive']);

function buildTrackers(tabs: string[][][]) {
  const entries: unknown[] = [];
  const sections: { name: string; info?: string }[] = [];
  const changelog: { date: string; note: string }[] = [];
  for (const rows of tabs) {
    let section = '';
    // 'dated': "Date Made | Update Notes" (main); 'undated': notes in column A (.lol).
    let changelogMode: '' | 'dated' | 'undated' = '';
    for (const r of rows.slice(1)) {
      const [type = '', name = '', info = '', status = '', working = '', links = ''] = r;
      if (/^Date Made$/i.test(type)) { changelogMode = 'dated'; continue; }
      if (/^Update Notes$/i.test(type)) { changelogMode = 'undated'; continue; }
      if (changelogMode === 'dated') {
        if (type && name) changelog.push({ date: type, note: stripTags(name).name });
        continue;
      }
      if (changelogMode === 'undated') {
        if (type) changelog.push({ date: (type.match(/\[([^\]]+)\]\s*$/) ?? [])[1] ?? '', note: stripTags(type).name.replace(/\s*\[[^\]]+\]\s*$/, '') });
        continue;
      }
      // Section header: blank type (or a non-entry label like "14/08/26\nArchives")
      // with a name and no status/links. Its blurb may sit in any later column.
      if (name && !ENTRY_TYPES.has(type) && (!type || (!status && !working && !links))) {
        section = stripTags(name).name.replace(/\s+/g, ' ').trim();
        const blurb = [info, status, working, links].find(Boolean);
        sections.push(blurb ? { name: section, info: blurb } : { name: section });
        continue;
      }
      if (!ENTRY_TYPES.has(type) || !name) continue;
      const { name: clean, tags } = stripTags(name);
      const { title, alt } = splitName(clean);
      entries.push({
        type, section, title, alt, info, status, working, tags,
        links: splitLinks(links),
        note: links && !splitLinks(links).length ? links : undefined,
      });
    }
  }
  return { entries, sections, changelog: changelog.reverse() };
}

function buildLeaktionary(rows: string[][]) {
  // Column order differs between archives — find "Link(s)//Other" by header.
  const header = rows[0] ?? [];
  const linkCol = Math.max(header.findIndex((h) => /^Link/i.test(h)), 3);
  return rows.slice(1).flatMap((r) => {
    const [type = '', word = '', def = ''] = r;
    const other = r[linkCol] ?? '';
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
  const variant = SOURCES[url.searchParams.get('v') ?? ''] ? url.searchParams.get('v')! : 'main';
  const src = SOURCES[variant];
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(`${url.origin}/__tracker-archive/${CACHE_VERSION}/${variant}`);
  if (!url.searchParams.has('fresh')) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const names = Object.keys(src.tabs) as TabName[];
  const tabs = await Promise.all(names.map((t) => loadTab(url.origin, variant, t)));
  const get = (t: TabName) => tabs[names.indexOf(t)] ?? [];
  const first = (t: TabName) => get(t)[0] ?? [];
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${src.sheetId}/edit`;

  const body = {
    variant,
    sheetUrl,
    tabUrls: Object.fromEntries(names.map((t) => [t, `${sheetUrl}?gid=${src.tabs[t]![0]}#gid=${src.tabs[t]![0]}`])),
    home: buildHome(first('home')),
    trackers: buildTrackers(get('trackers')),
    leaktionary: buildLeaktionary(first('leaktionary')),
    templates: buildTemplates(first('templates')),
    instructions: src.tabs.instructions ? buildInstructions(first('instructions')) : null,
    key: buildKey(first('key')),
    generated_at: Date.now(),
  };
  const response = new Response(JSON.stringify(body), { headers: CACHE_HEADERS });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
