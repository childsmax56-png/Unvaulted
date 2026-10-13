// Shared builder for the cross-artist credits index (/producers pages).
//
// Credits live in each song's name/extra cell as "(prod. A, B & C)",
// "(feat. X)", "(with Y)", "(ref. Z)". We parse those out of every public
// tracker's /api/{slug}/a catalog and group songs by a normalized person key so
// "Pi'erre Bourne" and "Pierre Bourne" land on the same page.
//
// Fanning out to ~75 trackers from one Function would blow the subrequest
// limit, so the work is sharded: /api/producers/shard?i=N handles SHARD_SIZE
// trackers (one subrequest each) and is edge-cached; the list + detail
// endpoints fan out to the ~8 cached shards instead.

// Public trackers to index. Kept in sync with src/artists/registry.ts — hidden
// trackers (yzygold/yelolgold Ye alts, daxgold, d4vdgold) are deliberately left out.
export const PRODUCER_SLUGS = [
  'yegold', 'vampgold', 'wolfgold', 'aapgold', 'drizzygold', 'mjgold', 'dongold',
  'kdotgold', 'cactigold', 'slimegold', 'colegold', 'mfgold', 'sosagold', 'xgold',
  'uzigold', 'pushagold', 'shadygold', 'twizzygold', 'dregold', 'juicegold',
  'luckigold', 'gorillazgold', 'rihannagold', 'fiftygold', 'teccagold', 'keemgold',
  'lonelygold', 'futuregold', 'denzelgold', 'cudigold', 'smokegold', 'jojigold',
  'jayzgold', 'macgold', 'frankgold', 'kengold', 'szagold', 'aaliyahgold',
  'antclemonsgold', 'badbunnygold', 'chancegold', 'gambinogold', 'chrisbrowngold',
  'coldplaygold', 'daftpunkgold', 'dannybrowngold', 'doechiigold', 'gibbsgold',
  'gunnagold', 'icecubegold', 'jamesblakegold', 'lauryngold', 'nasgold',
  'stevelacygold', 'trippiegold', 'tydollagold', 'ushergold', 'weekndgold',
  'westsidegold', 'wutanggold', 'clipsegold', 'deathgripsgold', 'delasoulgold',
  'premiergold', 'dmxgold', 'dualipagold', 'earlgold', 'olivertreegold',
  'fiviogold', 'jpegmafiagold', 'migosgold', 'nbayoungboygold', 'vincegold',
  'xzibitgold', 'thundercatgold',
];

export const SHARD_SIZE = 10;
export const SHARD_COUNT = Math.ceil(PRODUCER_SLUGS.length / SHARD_SIZE);
// Bump to invalidate every cached shard/list/detail response at once.
export const INDEX_VERSION = 'v3';
export const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=21600',
};

// One credited song row. Short keys keep the shard payloads small.
export interface CreditedSong {
  s: string;    // tracker slug
  e: string;    // era name
  n: string;    // song name (first line)
  x?: string;   // extra line (credits / alt names)
  u?: string;   // primary link
  q?: string;   // quality
  l?: string;   // leak date
  f?: string;   // file / recording date
  d?: string;   // availability ("Full", "Snippet", …)
  p: string[];  // credited person keys
  r: string[];  // roles per key, parallel to p: any of "p" prod, "f" feat, "w" with, "r" ref — e.g. "pf"
}

export type Role = 'p' | 'f' | 'w' | 'r';

export interface ShardPayload {
  songs: CreditedSong[];
  // person key -> display-name variant -> occurrences (picks the canonical spelling)
  names: Record<string, Record<string, number>>;
}

// Variants that normalize differently but are the same person.
const KEY_ALIASES: Record<string, string> = {
  ye: 'kanyewest',
  kanye: 'kanyewest',
  metro: 'metroboomin',
  pierre: 'pierrebourne',
  mikewillmadeit: 'mikewillmadeit',
  mikewill: 'mikewillmadeit',
  '40': 'noah40shebib',
  noah40shebib: 'noah40shebib',
  noahshebib: 'noah40shebib',
  carti: 'playboicarti',
  uzi: 'liluzivert',
  thug: 'youngthug',
  travis: 'travisscott',
};

// Placeholder credits that aren't a person.
const JUNK = new Set([
  '', 'unknown', 'na', 'none', 'tba', 'tbd', 'more', 'others', 'etc', 'various',
  'self', 'himself', 'herself', 'themselves', 'unk', 'idk', 'co', 'company', '0',
]);

export function producerKey(name: string): string {
  const k = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9]/g, '');
  return KEY_ALIASES[k] ?? k;
}

// One credit role keyword at the start of a bracket group (or of a ";"-separated
// segment inside one, e.g. "(ref. Fat Money; feat. Travis Scott)"). The
// negative lookahead keeps "(Without Me)" / "(Featherweight)" from matching.
const ROLE_PREFIX = /^\s*(co-?prod(?:uced|uction)?|prod(?:uced|uction)?|feat(?:uring)?|ft|with|w\/|ref)(?![a-z])[\s.:]*(?:by\b[\s.:]*)?/i;

function roleOf(token: string): Role {
  const t = token.toLowerCase();
  if (t.includes('prod')) return 'p';
  if (t.startsWith('f')) return 'f';
  if (t.startsWith('w')) return 'w';
  return 'r';
}

// Names that contain a separator and must not be split. Their separators are
// swapped for placeholders before splitting and restored afterwards
// (\u0000 → " & ", \u0001 → ",").
const UNSPLITTABLE: [RegExp, string][] = [
  [/tyler,\s*the creator/gi, 'Tyler\u0001 The Creator'],
  [/earth,\s*wind\s*&\s*fire/gi, 'Earth\u0001 Wind\u0000Fire'],
  [/mike\s*&\s*keys/gi, 'Mike\u0000Keys'],
  [/chase\s*&\s*status/gi, 'Chase\u0000Status'],
  [/nard\s*&\s*b\b/gi, 'Nard\u0000B'],
];

function splitNames(group: string): string[] {
  for (const [re, keep] of UNSPLITTABLE) group = group.replace(re, keep);
  const out: string[] = [];
  // A bare "&" inside a word ("Earl&E", "L&X Music") is part of the name.
  for (const part of group.split(/,|\s&\s|\s&|&\s|\+|\s+x\s+|\s+and\s+|\s*\/\s*/i)) {
    const name = part
      .replace(/\u0000/g, ' & ')
      .replace(/\u0001/g, ',')
      .replace(/\s*[(\[].*$/, '') // nested "(?)" / "[uncredited]" after the name
      .replace(/[\uFE0F\u200D]/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/[*?]+$/g, '')
      .replace(/^\s*(?:co-?prod\.?|add(?:itional)?\.?|prod\.?)\s*/i, '')
      .trim();
    if (!name || name.length > 40 || name.includes('?')) continue;
    if (JUNK.has(producerKey(name))) continue;
    out.push(name);
  }
  return out;
}

// "(prod. A & B) (feat. C) [with D]" → [{A,p},{B,p},{C,f},{D,w}]
export function parseCredits(text: string): { name: string; role: Role }[] {
  if (!text) return [];
  const out: { name: string; role: Role }[] = [];
  for (const m of text.matchAll(/[\[(]([^\])\n]+)[\])]/g)) {
    for (const seg of m[1].split(';')) {
      const rm = seg.match(ROLE_PREFIX);
      if (!rm) continue;
      // Credits use lowercase "with"; a capitalised "(With That)" is an alt title.
      if (/^with$/i.test(rm[1]) && rm[1] !== 'with') continue;
      const role = roleOf(rm[1]);
      for (const name of splitNames(seg.slice(rm[0].length))) out.push({ name, role });
    }
  }
  return out;
}

// Index one tracker's catalog into credited rows.
export function indexCatalog(slug: string, data: { eras?: Record<string, any> }, into: ShardPayload) {
  for (const era of Object.values<any>(data.eras ?? {})) {
    const eraName: string = era?.name ?? '';
    if (!eraName || !era?.data) continue;
    for (const bucket of Object.values<any>(era.data)) {
      if (!Array.isArray(bucket)) continue;
      for (const song of bucket) {
        const name = String(song?.name ?? '').trim();
        if (!name) continue;
        const credits = parseCredits(`${name}\n${song.extra ?? ''}`);
        if (credits.length === 0) continue;
        const keys: string[] = [];
        const roles: string[] = [];
        for (const { name: n, role } of credits) {
          const k = producerKey(n);
          if (!k) continue;
          let i = keys.indexOf(k);
          if (i === -1) {
            i = keys.push(k) - 1;
            roles.push('');
            const variants = (into.names[k] ??= {});
            variants[n] = (variants[n] ?? 0) + 1;
          }
          if (!roles[i].includes(role)) roles[i] += role;
        }
        if (keys.length === 0) continue;
        const url = song.url || (Array.isArray(song.urls) ? song.urls[0] : '') || '';
        const row: CreditedSong = { s: slug, e: eraName, n: name, p: keys, r: roles };
        if (song.extra) row.x = String(song.extra);
        if (url) row.u = url;
        if (song.quality) row.q = song.quality;
        if (song.leak_date) row.l = String(song.leak_date).trim();
        if (song.file_date) row.f = String(song.file_date).trim();
        if (song.available_length) row.d = song.available_length;
        into.songs.push(row);
      }
    }
  }
}

function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

// Fetch every shard (edge-cached individually) and merge them.
export async function loadAllShards(origin: string): Promise<ShardPayload> {
  const shards = await Promise.all(
    Array.from({ length: SHARD_COUNT }, async (_, i) => {
      try {
        const res = await fetch(`${origin}/api/producers/shard?i=${i}&v=${INDEX_VERSION}`);
        if (!res.ok) return null;
        return (await res.json()) as ShardPayload;
      } catch {
        return null;
      }
    }),
  );
  const merged: ShardPayload = { songs: [], names: {} };
  for (const shard of shards) {
    if (!shard) continue;
    merged.songs.push(...shard.songs);
    for (const [k, variants] of Object.entries(shard.names)) {
      const into = (merged.names[k] ??= {});
      for (const [n, c] of Object.entries(variants)) into[n] = (into[n] ?? 0) + c;
    }
  }
  return merged;
}

// Version-agnostic title key, so "Moon [V12]" … "Moon [V17]" and the same song
// cross-listed on another artist's tracker ("Ye - Moon") count once.
export function songKey(name: string): string {
  const title = name.includes(' - ') ? name.slice(name.indexOf(' - ') + 3) : name;
  return title
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Most common spelling wins; ties go to the one with more capital letters
// ("Metro Boomin" over "metro boomin").
export function displayName(variants: Record<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [n, c] of Object.entries(variants)) {
    const caps = (s: string) => (s.match(/[A-Z]/g) ?? []).length;
    if (c > bestCount || (c === bestCount && caps(n) > caps(best))) {
      best = n;
      bestCount = c;
    }
  }
  return best;
}

// Serve `build()` through the edge cache under a synthetic key.
export async function cached(
  request: Request,
  waitUntil: (p: Promise<unknown>) => void,
  key: string,
  build: () => Promise<unknown>,
): Promise<Response> {
  const origin = new URL(request.url).origin;
  const cacheKey = new Request(`${origin}/__producers/${INDEX_VERSION}/${key}`);
  const hit = await edgeCache().match(cacheKey);
  if (hit) return hit;
  const body = await build();
  const response = new Response(JSON.stringify(body), { headers: CACHE_HEADERS });
  waitUntil(edgeCache().put(cacheKey, response.clone()));
  return response;
}
