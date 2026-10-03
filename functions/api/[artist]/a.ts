import { parseCSV, csvResponse } from './_csvParser';
import { fetchTrackerCsv } from './_sheets';
import { resolveCommunityTracker, buildCommunityTrackerData } from './_community';

// Extract the URL from a Google Sheets HYPERLINK formula: =HYPERLINK("url","text") → url
function extractHyperlinkUrl(cell: string): string {
  const m = cell.match(/^=HYPERLINK\("([^"]+)"/i);
  if (m) return m[1];
  // Some sheets (e.g. daftpunkgold) prefix a real source link with stray text like
  // "N/A https://..." — the leading text makes looksLikeRealLink() pass (it just checks
  // for "://") but breaks the URL when used as-is. Strip anything before the link itself.
  const httpIdx = cell.search(/https?:\/\//i);
  if (httpIdx > 0) return cell.slice(httpIdx).trim();
  return cell;
}

function parseSongName(raw: string): { name: string; extra: string | undefined } {
  const newline = raw.indexOf('\n');
  if (newline === -1) return { name: raw.trim(), extra: undefined };
  const name = raw.substring(0, newline).trim();
  const extra = raw.substring(newline).trim().replace(/^\n+/, '') || undefined;
  return { name, extra };
}

// App.tsx ERA_MAPPINGS renames these keys after receiving the response, which moves them
// to the end of the object and breaks ordering. Return the final names directly so
// App.tsx sees them as already-mapped and leaves them in place.
const ERA_NAME_MAP: Record<string, string> = {
  'Turbo Grafx 16': 'Turbo Grafix 16',
  'Turbo Grafx-16': 'Turbo Grafix 16',
  // yegold — the real sheet titles the era "Hitler" directly (Ye's own name for
  // it) rather than the "LOVE EVERYONE" title used everywhere else in the app;
  // a stray 2-song "DONDA 2" row from the SSC merge tab folds into DONDA 2 [V1];
  // the SSC tab's own "JESUS IS LORD" section is this era's current real name,
  // God's Country, reused by the live sheet for an unrelated earlier era.
  'Hitler': 'LOVE EVERYONE',
  'DONDA 2': 'DONDA 2 [V1]',
  'JESUS IS LORD': "God's Country",
  'KIDS SEE GHOSTS': 'KIDS SEE GHOSTS',
  'KIDS SEE GHOST': 'KIDS SEE GHOSTS',
  'KIDSSEEGHOSTS': 'KIDS SEE GHOSTS',
  'Kids See Ghosts': 'KIDS SEE GHOSTS',
  'Donda [V1]': 'DONDA [V1]',
  'Bully': 'BULLY [V1]',
  'BULLY': 'BULLY [V1]',
  // dongold — song rows use the short name, section header uses the trilogy name
  'Space Age Pimping': 'Space Age Pimping Trilogy',
  // colegold
  'Cole World': 'Cole World: The Sideline Story',
  'J. Cole x Kendrick Project': 'Collaboration with Kendrick Lamar',
  'J. Cole x JID Project': 'Collaboration with JID',
  'Revenge of the Dreamers 2': 'Revenge of the Dreamers 2 [V1]',
  'Revenge of the Dreamers II': 'Revenge of the Dreamers 2 [V1]',
  '4 Your Eyez Only [V1]': '4 Your Eyez Only',
  '4 Your Eyez Only [V2]': '4 Your Eyez Only',
  'Born Sinner Deluxe': 'Born Sinner',
  // aapgold
  'Pre-A.L.L.A.': 'Pre-AT.LONG.LAST.A$AP',
  'A$AP               (with A$AP Mob)': 'A$AP (Mob Collab)',
  'THE GRIM [V1]': 'THE GR1M [V1]',
  'Rug Of War 1984': 'Rug Of War 1994',
  'LIVE.LOVE.A$AP (Re-Release)': 'LIVE.LOVE.A$AP [Re-Release]',
  'GRIM': 'GR1M [V3]',
  // dregold
  "The Chronic II: A New World Odor (Poppa's Got A Brand New Funk)": 'The Chronic II',
  'The Chronic II: A New World Odor': 'The Chronic II',
  'N.W.A. Reunion Album': 'N.W.A. Reunion',
  // kdotgold — merge duplicate eras (song rows use short name, section header uses versioned name)
  'Tu Pimp A Caterpillar': 'Tu Pimp A Caterpillar [V1]',
  'To Pimp A Butterfly [V2]': 'To Pimp A Butterfly',
  // vampgold
  'THC: The High Chronical$': 'The High Chronical$',
  'THC: The High Chronicals': 'The High Chronical$',
  'Ye - DONDA': 'Donda',
  // pushagold
  'Fear of God II: Let Us Pray': 'Fear of God II',
  'King Push – Darkest Before Dawn: The Prelude': 'Darkest Before Dawn',
  'King Push - Darkest Before Dawn: The Prelude': 'Darkest Before Dawn',
  // wolfgold — song rows use a shorter/differently-spaced name than the section header
  'PinkGold SquarePixals': 'PinkGoldSquarePixals',
  'SuperDuper SteezMonster': 'SuperDuperSteezMonster',
  'The OF Tape Vol. 1': 'The Odd Future Tape Vol. 1',
  'The OF Tape Vol. 2': 'The Odd Future Tape Vol. 2',
  'Grinch EP': "Music Inspired by Illumination & Dr. Seuss's The Grinch",
  'Infinite Rhyhtms': 'Infinite Rhythms',
  // wolfgold — the section header is titled "CALL ME WHEN YOU GET LOST" (with
  // "CALL ME IF YOU GET LOST [V1]" as a parenthetical); use that as the canonical
  // name and merge the V1-tagged song rows into it.
  'CALL ME IF YOU GET LOST [V1]': 'CALL ME WHEN YOU GET LOST',
  // wolfgold — single mistagged song row inside the WOLF [V3] block uses the
  // versionless "WOLF" era value; merge it into WOLF [V3].
  'WOLF': 'WOLF [V3]',
  // gorillazgold — song rows use short/typo'd names, section headers use the full names.
  'G-SIdes': 'G-Sides',
  'Journey To The West': 'Monkey - Journey To The West',
  'Song Machine, Season One': 'Song Machine, Season One: Strange Timez',
  // slimegold — CSV uses special characters / different era names
  'Hy!£UN35 [V3]': 'HiTunes [V3]',
  'Collaboration with Juice WRLD': 'Slime WRLD',
};

function mapEraName(name: string): string {
  return ERA_NAME_MAP[name] ?? name;
}

// Artists whose ERA_ORDER is exhaustive — unlisted rows (e.g. changelog footer) are dropped.
const EXHAUSTIVE_ERA_ORDER_ARTISTS = new Set(['yzygold', 'kdotgold', 'dongold', 'colegold', 'aapgold', 'mfgold', 'mjgold', 'slimegold', 'sosagold', 'rihannagold']);

// Per-artist ERA_ORDER for artists whose CSVs have eras in the wrong order.
const ARTIST_ERA_ORDERS: Record<string, string[]> = {
  sosagold: [
    'Wiiic City', 'Drill', 'Finally Rich', 'Lean', 'Rehab', 'Xanax', 'Cappin', 'Turbo',
    'Glory University', 'Underwater', 'Almighty So 2 [V1]', '4EB',
  ],
  slimegold: [
    'I Came From Nothing', '1017 Thug', 'Black Portland', 'HiTunes [V1]', 'Metro Thuggin',
    'Rich Gang: Tha Tour Pt. 1', 'Rich Gang: Tha Tour Pt. 2', 'Barter 6', 'Hy!£UN35 [V2]',
    'Slime Season', 'Slime Season 2', 'MigoThuggin', 'ThuggaWapp', "I'm Up", 'Slime Season 3',
    'HiTunes [V3]', 'JEFFERY', 'BEAUTIFUL THUGGER GIRLS', 'Young Martha', 'SUPER SLIMEY',
    'Collaboration with 808 Mafia', 'Hy!£UN35 [V4]', 'Slime Language', 'Barter 7', 'Static',
    'Slime WRLD', 'So Much Fun', 'So Much Fun (Deluxe)', 'SUPER SLIMEY: SURFER EDITION',
    'Punk [V1]', 'Slime Language 2', 'Punk [V2]', 'Unknown (2022)', 'BUSINESS IS BUSINESS',
    'LOVE YOU LATER', 'Slime Sea4on', 'Edd, Ed n Eddy', 'UY SCUTI', 'Day Before Coachella', 'GØŁDMØÜFDÖG',
  ],
  mjgold: [
    'Got To Be There', 'Ben', 'Music & Me', 'Forever, Michael',
    'Off The Wall', 'Thriller', 'Bad', 'Dangerous',
    'HIStory: Past, Present, And Future: Book I', 'Blood On The Dance Floor: HIStory In The Mix',
    'Invincible', 'The Ultimate Collection', 'Post-Invincible', 'Thriller 25', 'This Is It',
    'Final sessions', 'Michael', 'Bad 25', 'XSCAPE', 'Thriller 40', 'Ongoing', 'Unclassified',
  ],
  mfgold: [
    'By All Means Necessary', 'Mr. Hood', 'BL_CK B_ST_RDS', 'Mental Illness',
    'Operation: Doomsday', '1999 - 2003', 'Vaudeville Villain', 'Take Me To Your Leader', 'Venomous Villain', 'Madvillainy', 'MM..FOOD',
    'The Mouse And The Mask', '2006 - 2008', 'Dilla-DOOM', 'Madvillainy 2', 'Special Herbs, Vols. 9 & 0',
    'BORN LIKE THIS', 'Swift & Changeable', 'Key to the Kuffs', 'DOOMYORKES', 'NehruvianDOOM',
    '2015 - 2017', 'Special Herbs 10', 'The Missing Notebook Rhymes', 'WestSide Doom', 'Czarface Meets Metal Face',
    'Flylo-DOOM', 'Super What?', 'Post Super What?', 'Unknown', 'Ongoing',
  ],
  aapgold: [
    'Pre-MDB', 'MDB', 'A$AP (2007-2009)', 'A$AP (Mob Collab)', 'A$AP (2010)', 'Untitled',
    'Untitled Mixtape with Seth Narley',
    'Rug Of War 1994', 'Purple Swag', 'Me, Myself & A$AP', 'Mouth Fulla Gold',
    'LIVE.LOVE.A$AP [V1]', 'LIVE.LOVE.A$AP [Promo CD]', 'LIVE.LOVE.A$AP [V2]', 'B.M.W', 'LIVE.LOVE.A$AP [Deluxe]',
    'Pre-LONG.LIVE.A$AP', 'LONG.LIVE.A$AP (with A$AP Mob) [V1]', 'Last Cab 2 Harlem [V2]', "Lord$ Never Worry", 'LONG.LIVE.A$AP',
    'Pre-AT.LONG.LAST.A$AP', 'BEAUTY AND THE BEAST: SLOWED DOWN SESSIONS, CHAPTER 1', 'L.O.R.D.',
    'AT.LONG.LAST.A$AP', 'Cozy Tapes Vol. 1: Friends -', 'Pre-TESTING', 'Wavy Wednesdays',
    'TESTING [V1]', 'Rocky Montana', 'DUMMY [V1]', 'Cozy Tapes Vol. 2: Too Cozy', 'DUMMIE [V2]', 'DUMMIE',
    'TESTING [V2]', 'TESTING [Deluxe]', 'TESTING [Chopped & Screwed]', 'Cozy Tapes Vol. 3 [V1]', 'WANG$AP', 'TESTING',
    'ALL $MILE$ [V1]', 'ALL $MILE$ [V2]', 'ALL $MILE$', 'Cozy Tapes Vol. 3 [V2]', 'THE GR1M [V1]',
    'Cozy Tapes Vol. 3 [V3]', 'GR1M [V2]', 'LIVE.LOVE.A$AP [Re-Release]', 'GR1M [V3]', "DON'T BE DUMB [V1]", 'A$AP JEAN',
    "DON'T BE DUMB [V2]", "DON'T BE DUMB [V3]", "DON'T BE DUMB [V4]", "DON'T BE DUMB",
    "DON'T BE DUMB [DISC 2]",
  ],
  colegold: [
    'Before The Come Up',
    'The Come Up',
    'The Warm Up',
    'Friday Night Lights',
    'Cole World: The Sideline Story',
    'Truly Yours',
    'Truly Yours 2',
    'Born Sinner',
    'Truly Yours 4',
    'Collaboration with Kendrick Lamar',
    'J. Cole x Chance Project',
    'Revenge of the Dreamers 2 [V1]',
    '2014 Forest Hills Drive',
    '4 Your Eyez Only',
    'The Fall-Off [V1]',
    'KOD',
    'The Off-Season',
    'Collaboration with JID',
    'Might Delete Later',
    'The Fall-Off [V2]',
    "It's A Boy",
    'Ongoing',
  ],
  dongold: [
    'Before Space Age Pimping',
    'Space Age Pimping Trilogy',
    'Pimp Olympics',
    'Life Before Death',
    'Playa Familia',
    'Playa Familia 2',
    'Donny Womack',
    'JACKBOYS',
    'Heaven Or Hell',
    'Escapism',
    'Life of a DON',
    'Love Sick',
    'Hardstone Psycho',
    'JACKBOYS 2',
    'OCTANE',
    'DT6',
  ],
  kdotgold: [
    'Y.H.N.I.C.',
    'Training Day',
    "No Sleep 'Til NYC",
    'C4',
    'The Kendrick Lamar EP',
    'Overly Dedicated',
    'Section.80',
    'Collaboration with J. Cole',
    'good kid, m.A.A.d city',
    'Tu Pimp A Caterpillar [V1]',
    'To Pimp A Butterfly',
    'untitled unmastered.',
    'DAMN.',
    'Black Panther: The Album',
    'Look Woman',
    'Everybody Sensitive [V1]',
    'Mr. Morale [V2]',
    'Mr. Morale [V3]',
    'Mr. Morale & The Big Steppers',
    'Drake vs. Kendrick Lamar',
    'GNX',
    'Rap Album',
    'Compton Cowboys',
    'Ongoing',
  ],
  uzigold: [
    'Purple Thoughtz',
    'Home Economic$',
    'The Real Uzi',
    '1017 vs. The World',
    'Luv Is Rage',
    'Lil Uzi Vert vs. The World',
    'Luv Is Rage 1.5',
    '2 Luv Is 2 Rage',
    'Barter 16',
    'The Perfect LUV Tape',
    'Luv Is Rage 2 [V1]',
    '16*29',
    'Lil Uzi Vert vs. The World 2 [V1]',
    'Luv Is Rage 2 [V2]',
    'Too Fast',
    'Tsunami Island',
    'Eternal Atake [V1]',
    'Eternal Atake [V2]',
    'Eternal Atake [V3]',
    'Baby Pluto Era',
    'Pluto x Baby Pluto',
    'Luv Is Rage 3 [V2]',
    'Eternal Atake 2',
    'Pink Tape [V1]',
    'Pink Tape [V2]',
    'Pink Tape [V3]',
    'RED & WHITE',
    'METROOOO PINK',
    'ALL WHITE',
    'Forever Young',
    'Super gëëky',
    'DPONTHEBEAT Vol 5',
    'W.H.2.U',
    'LP 5',
    'Ongoing',
  ],
  twizzygold: [
    'Lyfëstyle [V1]',
    'Different Creature',
    "I'm So Me",
    'Wake Up Call',
    'Up 2 Më [V1]',
    'Up 2 Më [V3]',
    'Alivë',
    'Hold Ön',
    '2093',
    'A DANGEROUS LYFE [V1]',
    'ADL [V2]',
    'ADL [V3]',
    'ADL',
    'ADL (Deluxe)',
    'AftërLyfe',
    'AftërLyfe (Deluxe)',
    '2 Alivë',
    '2 Alivë (Geëk Pack)',
    'DANGEROUS SUMMER',
    'Deep Blue $trips',
    'LYFESTYLE [V2]',
    'LYFESTYLE',
    'LYFESTYLE DIGITAL DELUXE',
    'Lyfë',
    'Trëndi',
    '4L',
    'Up 2 Më',
    'We Us',
    'DC2',
    'Elegance',
    'Super Sonic',
    'Super geëky',
    'Collaboration with 2kthagoon',
    'Collaboration with SwagHollywood',
    'Ongoing',
  ],
  dregold: [
    'N.W.A. And The Posse',
    'Straight Outta Compton',
    "100 Miles & Runnin'",
    'efiL4zaggiN',
    'The Chronic',
    'Helter Skelter',
    'The Chronic II',
    '2001',
    'Break Up To Make Up',
    'The Wash',
    'N.W.A. Reunion',
    'Detox [V1]',
    'Detox [V2]',
    'Detox [V3]',
    'Planets [V1]',
    'Detox [V4]',
    'Detox [V5]',
    'Compton',
    'Detox [V6]',
    'JESUS IS KING: The Dr. Dre Version',
    'Detox [V7]',
    'Missionary',
    'LP4',
    'Planets [V2]',
    'Ongoing',
  ],
  xgold: [
    'CD MIxtape',
    'XXX (UNMASTERED)',
    'Ice Hotel',
    'e.motion',
    'THE NOBODYS',
    'The Fall',
    '♡ ʳ ᵃ ʳ ᵉ ♡',
    'Heartbreak Hotel',
    'Red Light District',
    'Members Only Vol. 1',
    'Members Only Vol. 2',
    'KIDS',
    'IWABOS',
    'Bad Vibes Forever',
    'Death Note',
    'Members Only Vol. 3',
    'Revenge',
    'UGLY',
    '17',
    'A GHETTO CHRISTMAS CAROL',
    'I Need Jesus',
    '?',
    'SKINS',
    'Members Only Vol. 4',
    '? (Deluxe)',
    'Bad Vibes Forever (2019)',
    'LOOK AT ME: THE ALBUM',
    'LOOK AT ME: XXXTENTACION',
    'Ongoing',
    'Unknown',
  ],
  gorillazgold: [
    'Gorillaz',
    'G-Sides',
    'Laika Come Home',
    'Demon Days',
    'D-Sides',
    'Carousel',
    'Monkey - Journey To The West',
    'Plastic Beach',
    'The Fall',
    'HUMANZ',
    'The Now Now',
    'Song Machine, Season One: Strange Timez',
    'Meanwhile',
    'Cracker Island',
    'The Mountain',
  ],
  rihannagold: [
    'Music Of The Sun',
    'A Girl Like Me',
    'Good Girl Gone Bad',
    'Rated R',
    'Loud',
    'Talk That Talk',
    'Unapologetic',
    'ANTI',
    'R9 [V1]',
    'R9 [V2]',
  ],
};

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const artist = (context.params as Record<string, string>).artist ?? "yzygold";
    const env = context.env as Env;
    const db = env.DB;

    // Community trackers are DB-backed: build their eras JSON directly and skip
    // the CSV path entirely. Pass the request so the creator/admin can preview
    // an unapproved tracker.
    const communityTracker = await resolveCommunityTracker(env, artist, context.request);
    if (communityTracker) {
      return csvResponse(await buildCommunityTrackerData(db, communityTracker));
    }

    // Note: the SPA catch-all (_redirects /* /index.html 200) means missing static
    // files return index.html with status 200 — detect HTML by its leading char.
    const isCsvText = (t: string) => !t.trimStart().startsWith('<');

    // Committed unreleased.csv (or live sheet) first, then the unreleased-main.csv
    // variant (e.g. dregold).
    let text = await fetchTrackerCsv(url.origin, artist, 'unreleased', env, context.request);
    if (text === null) {
      const fallbackRes = await fetch(`${url.origin}/${artist}/data/unreleased-main.csv`);
      if (!fallbackRes.ok) return new Response('CSV not found', { status: 404 });
      const fallbackText = await fallbackRes.text();
      if (!isCsvText(fallbackText)) return new Response('CSV not found', { status: 404 });
      text = fallbackText;
    }

    // Some CSVs (e.g. wolfgold) have a disclaimer block before the real header row.
    // Find the first line that starts with "Era," and strip everything before it.
    const eraHeaderIdx = text.split('\n').findIndex(l => l.trimStart().startsWith('Era,') || l.trimStart().startsWith('"Era"'));
    const csvText = eraHeaderIdx > 0 ? text.split('\n').slice(eraHeaderIdx).join('\n') : text;

    const rows = parseCSV(csvText);

    // Detect which column holds the song/era name — different CSVs use different headers.
    // Some use 'Name\n(Join The Discord!)', others use 'Name\n(Check out the Tracker website!)', etc.
    const NAME_KEY = rows.length > 0
      ? (Object.keys(rows[0]).find(k => k === 'Name\n(Join The Discord!)')
        ?? Object.keys(rows[0]).find(k => k.startsWith('Name'))
        ?? Object.keys(rows[0]).find(k => k.startsWith('Title'))
        ?? 'Name')
      : 'Name';

    // Similarly detect the Notes column (wolfgold uses 'Info').
    const NOTES_KEY = rows.length > 0
      ? (Object.keys(rows[0]).find(k => k === 'Notes') ?? Object.keys(rows[0]).find(k => k.startsWith('Notes')) ?? Object.keys(rows[0]).find(k => k === 'Info') ?? 'Notes')
      : 'Notes';

    // Detect track length and available length columns (wolfgold uses 'Length' / 'Availability';
    // sosagold/jayzgold/cudigold/macgold use 'Currently Available'; sosagold uses 'Link').
    const firstRowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    const TRACK_LENGTH_KEY = firstRowKeys.find(k => k === 'Track Length') ?? firstRowKeys.find(k => k === 'Length') ?? 'Track Length';
    const AVAIL_LENGTH_KEY = firstRowKeys.find(k => k === 'Available Length') ?? firstRowKeys.find(k => k === 'Availability') ?? firstRowKeys.find(k => k === 'Currently Available') ?? firstRowKeys.find(k => k === 'Portion') ?? 'Available Length';
    const LINKS_KEY = firstRowKeys.find(k => k === 'Link(s)') ?? firstRowKeys.find(k => k === 'Source') ?? firstRowKeys.find(k => k === 'Link') ?? 'Link(s)';

    const eras: Record<string, any> = {};

    // First pass: collect real era names from header rows (mapped to final names).
    // Header rows have newlines in the Era field (file counts). Stats rows also have newlines
    // but their Name field starts with a digit — skip those.
    const validEraNames = new Set<string>(); // raw CSV names AND mapped names
    for (const row of rows) {
      const eraField = row['Era'] ?? '';
      if (!eraField.includes('\n')) continue;
      const { name: eraName } = parseSongName(row[NAME_KEY] ?? '');
      if (eraName && !/^\d+\s/.test(eraName)) {
        validEraNames.add(eraName);
        // Also add the mapped name so song rows whose Era column uses the short name are found
        validEraNames.add(mapEraName(eraName));
      }
    }

    // Always supplement validEraNames with song-row era names so eras that have songs
    // but no header row (e.g. TrapMoneyBenny Collab, 004PF in vampgold) are not dropped.
    // Some sheets (e.g. nasgold) trail a changelog/credits block ("Update Notes",
    // "6/22/26: [iaon] made editor", a long "Special Thanks to..." sentence) below the
    // real tracklist, in the same Era column — exclude that free text so it doesn't turn
    // into its own bogus era.
    const isJunkEraText = (s: string): boolean =>
      s.length > 120 || /^\d{1,2}\/\d{1,2}\/\d{2,4}:/.test(s) || /^(Update Notes|Tracker Guidelines)$/i.test(s);
    for (const row of rows) {
      const eraField = (row['Era'] ?? '').trim();
      if (eraField && !eraField.includes('\n') && !/^\d+\s+(OG|Full|Tagged|Partial|Snippet|Unavailable)\b/i.test(eraField) && !isJunkEraText(eraField)) {
        validEraNames.add(eraField);
        validEraNames.add(mapEraName(eraField));
      }
    }

    // Second pass: build eras and songs, ignoring anything outside known eras.
    for (const row of rows) {
      const eraField = row['Era'] ?? '';
      const nameField = row[NAME_KEY] ?? '';

      if (eraField.includes('\n')) {
        // Era header row
        const { name: rawName, extra } = parseSongName(nameField);
        if (!rawName || !validEraNames.has(rawName)) continue;
        const eraName = mapEraName(rawName);

        eras[eraName] = {
          name: eraName,
          extra: extra ?? undefined,
          timeline: row[NOTES_KEY]?.trim() || undefined,
          fileInfo: eraField.split('\n').map((l: string) => l.trim()).filter(Boolean),
          data: { 'Unreleased Tracks': [] },
        };
      } else if (eraField && (validEraNames.has(eraField.trim()) || validEraNames.has(mapEraName(eraField.trim())))) {
        // Regular song row — only if it belongs to a known era.
        // Also accept rows whose era maps to a known name (e.g. "THC: The High Chronical$" → "The High Chronical$").
        const eraName = mapEraName(eraField.trim());
        if (!eras[eraName]) {
          eras[eraName] = { name: eraName, data: { 'Unreleased Tracks': [] } };
        }

        const { name, extra } = parseSongName(nameField);
        const links = (row[LINKS_KEY] ?? '').split('\n').map((l: string) => extractHyperlinkUrl(l.trim())).filter(Boolean);

        eras[eraName].data['Unreleased Tracks'].push({
          name,
          extra: extra ?? undefined,
          description: row[NOTES_KEY] ?? '',
          track_length: row[TRACK_LENGTH_KEY] ?? '',
          file_date: row['File Date'] ?? row['Origin'] ?? '',
          leak_date: row['Leak Date'] ?? '',
          available_length: row[AVAIL_LENGTH_KEY] ?? '',
          quality: row['Quality'] ?? '',
          url: links[0] ?? '',
          urls: links,
        });
      }
    }

    let orderedEras: Record<string, any>;

    if (artist === 'yzygold') {
      // Wolves has no CSV entry — seed it so the order list can place it correctly.
      // App.tsx will only overwrite this if it's missing, so pre-seeding keeps the position.
      if (!eras['Wolves']) {
        eras['Wolves'] = {
          name: 'Wolves',
          extra: '(Collaboration with Drake) (New Abu Dhabi, Calabasas Is The New Abu Dhabi)',
          data: { 'Main Tracks': [], 'Snippets & Leaks': [] },
        };
      }

      const ERA_ORDER = [
        'Before The College Dropout',
        'The College Dropout',
        'Late Registration',
        'Graduation',
        '808s & Heartbreak',
        'Good Ass Job',
        'My Beautiful Dark Twisted Fantasy',
        'Watch The Throne',
        'Cruel Summer',
        'Thank God For Drugs',
        'Yeezus',
        'Cruel Winter [V1]',
        'Yeezus 2',
        'So Help Me God',
        'SWISH',
        'The Life Of Pablo',
        'Cruel Winter [V2]',
        'Turbo Grafix 16',
        'Wolves',
        'LOVE EVERYONE',
        'DAYTONA',
        'ye',
        'KIDS SEE GHOSTS',
        'NASIR',
        'K.T.S.E.',
        'Good Ass Job (2018)',
        'Yandhi [V1]',
        'Yandhi [V2]',
        'JESUS IS KING',
        "God's Country",
        'JESUS IS KING: The Dr. Dre Version',
        'DONDA [V1]',
        'Donda [V2]',
        'Donda [V3]',
        'Donda 2',
        'WAR',
        'YEBU',
        'Bad Bitch Playbook',
        'VULTURES 1',
        'VULTURES 2',
        'The Elementary School Dropout',
        'VULTURES 3',
        'BULLY [V1]',
        'CUCK',
        'DONDA 2 (2025)',
        'NEVER STOP',
        'IN A PERFECT WORLD',
        'BULLY [V2]',
        'Ongoing',
      ];

      orderedEras = {};
      for (const name of ERA_ORDER) {
        if (eras[name]) orderedEras[name] = eras[name];
      }
      // Do NOT append extras for yzygold — ERA_ORDER is exhaustive and
      // any unlisted rows are changelog/footer garbage from the sheet.
    } else if (ARTIST_ERA_ORDERS[artist]) {
      // Apply artist-specific era ordering
      const eraOrder = ARTIST_ERA_ORDERS[artist];
      orderedEras = {};
      for (const name of eraOrder) {
        if (eras[name]) orderedEras[name] = eras[name];
      }
      // For exhaustive orders, drop unlisted rows (changelog/footer garbage).
      // For non-exhaustive orders, append any eras not in the order list.
      if (!EXHAUSTIVE_ERA_ORDER_ARTISTS.has(artist)) {
        for (const name of Object.keys(eras)) {
          if (!orderedEras[name]) orderedEras[name] = eras[name];
        }
      }
    } else {
      // For other artists, preserve CSV row order as-is.
      orderedEras = eras;
    }

    const trackerData = {
      name: 'YZY Gold',
      tabs: ['eras'],
      current_tab: 'eras',
      eras: orderedEras,
    };

    return csvResponse(trackerData);
  } catch (err) {
    return new Response('Failed to build tracker data', { status: 500 });
  }
};
