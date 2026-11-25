import type { ArtistConfig } from './types';
import { cactigoldConfig } from './cactigold';

// Main Travis Scott tracker, read live from Yerlsd's "Travis Scott Tracker"
// sheet. It's built on the same yetracker template as yelolgold/yecomgold, and
// viewer downloads are disabled, so tabs go through the Sheets API (apiTitles in
// SHEET_SOURCES, functions/api/[artist]/_sheets.ts) with committed CSV snapshots
// under public/travisgold/data/*.csv as the fallback
// (scripts/build-travisgold-csvs.py). The previous tracker, cactigold, is now
// an alternate reachable from this card's picker.
const SHEET_ID = '18Ht_QECCPW3zPkuBmGeJDTRMjFEinRlWyAtbkBivjPo';

const COVERS = cactigoldConfig.CUSTOM_IMAGES;

export const travisgoldConfig: ArtistConfig = {
  slug: 'travisgold',
  SITE_NAME: 'Travis Scott Tracker',
  SITE_DESCRIPTION: 'The Travis Scott tracker',
  SITE_URL: 'https://unvaulted.cc/travisgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'travisgold_',
  HARDCODED_SHEET_ID: SHEET_ID,
  HARDCODED_SHEET_GID: '199908479',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',
  accentColor: '#ff4500',
  artistLabel: 'Travis Scott',
  sheetCreator: 'Yerlsd',
  cardLetter: 'TS',
  logoUrl: '/logos/cactigold.png',
  artistPhotoUrl: '/artists/travis.jpg',
  navLogoUrl: '/cactigold/logo.png',

  alternateTrackers: [
    { slug: 'cactigold', label: 'CACTIgold' },
  ],

  hasAlbumCopiesTab: true,
  hasCompsTab: false,
  hasConcertsTab: false,
  hasSubAlbumsTab: false,

  getArtistName() { return 'Travis Scott'; },

  CUSTOM_IMAGES: {
    'The Graduates': COVERS['The Graduates'],
    'The Classmates': COVERS['The Classmates'],
    'Owl Pharaoh': COVERS['Owl Pharaoh'],
    'Days Before Rodeo': COVERS['Days Before Rodeo'],
    'Rodeo': COVERS['Rodeo'],
    'Birds In The Trap Sing McKnight': COVERS['Birds'],
    'Huncho Jack, Jack Huncho': COVERS['Huncho Jack, Jack Huncho'],
    'Astroworld': COVERS['Astroworld'],
    'JACKBOYS': COVERS['JackBoys'],
    'UTOPIA [V1]': COVERS['Utopia [P1]'],
    'The Scotts': COVERS['The Scotts'],
    'UTOPIA [V2]': COVERS['Utopia [P2]'],
    'JACKBOYS 2': COVERS['JackBoys 2'],
    'Ongoing': COVERS['Post-Utopia'],
  },

  // From each era's stat-header row on the sheet ("X is released" dates).
  ALBUM_RELEASE_DATES: {
    'The Graduates': '??/??/????',
    'The Classmates': '??/??/????',
    'Owl Pharaoh': '05/21/2013',
    'Days Before Rodeo': '08/18/2014',
    'Rodeo': '09/04/2015',
    'Birds In The Trap Sing McKnight': '09/02/2016',
    'Huncho Jack, Jack Huncho': '12/21/2017',
    'Astroworld': '08/03/2018',
    'JACKBOYS': '12/26/2019',
    'UTOPIA [V1]': '??/??/????',
    'The Scotts': '??/??/????',
    'UTOPIA [V2]': '07/28/2023',
    'JACKBOYS 2': '07/13/2025',
    'Ongoing': '??/??/????',
  },

  ALBUM_ORDER: [
    'The Graduates',
    'The Classmates',
    'Owl Pharaoh',
    'Days Before Rodeo',
    'Rodeo',
    'Birds In The Trap Sing McKnight',
    'Huncho Jack, Jack Huncho',
    'Astroworld',
    'JACKBOYS',
    'UTOPIA [V1]',
    'The Scotts',
    'UTOPIA [V2]',
    'JACKBOYS 2',
    'Ongoing',
  ],

  HIDDEN_ALBUMS: [],

  // Each era's description cell on the sheet's Unreleased tab.
  ALBUM_DESCRIPTIONS: {
    'The Graduates': "Duo formed by Travis Scott and his high school friend Christopher Holloway in Missouri City, Texas. Released one self-titled MySpace EP in 2008 featuring early chopped-up beats and pitches to Ye's G.O.O.D. Music, while other early recordings remain lost.",
    'The Classmates': "Houston duo formed with high school friend Jason Eric (a.k.a. OG Chess), occasionally joined by Spuf Don. From 2009 to 2011 they released independent MySpace mixtapes including 'B.A.P.E.', 'Buddy Rich', 'The Classmates EP', and 'Cruis'n USA' before Travis went solo.",
    'Owl Pharaoh': "Travis Scott's breakthrough solo mixtape era following 'Cruis'n USA' Deluxe in mid-2011 through May 21, 2013. Originally planned as a free 2012 mixtape, the project missed multiple release dates and was heavily reworked as his connections with T.I., Ye, and Kid Cudi grew.",
    'Days Before Rodeo': "Semi-spontaneous mixtape compiled from early 'Rodeo' studio sessions and released free on August 18, 2014 as a prequel to his debut album. Marked the emergence of Travis's signature dark trap atmosphere alongside Metro Boomin, Southside, and Young Thug.",
    'Rodeo': "Travis Scott's debut studio album, officially teased as 'Fuego' in late 2013 before evolving into 'Rodeo' and releasing September 4, 2015. Defined by sprawling cinematic synth-trap production with Ye, Mike Dean, Allen Ritter, Metro Boomin, and WondaGurl.",
    'Birds In The Trap Sing McKnight': "Travis Scott's second studio album, released September 2, 2016 after being teased under working titles like 'Tina'. Built as a faster, melodic nocturnal stepping stone between 'Rodeo' and 'Astroworld', driven by darker autotuned hooks and collaborative .WAV Radio rollouts.",
    'Huncho Jack, Jack Huncho': "Joint collaborative album with Migos member Quavo, recorded largely across 2016–2017 and surprise-released on December 21, 2017. This section tracks sessions, demos, and early mixes involving Quavo, while solo songs from this window sit in 'Birds' or 'Astroworld'.",
    'Astroworld': 'Third studio album named after the demolished Houston Six Flags theme park, announced in May 2016 and released August 3, 2018. Blending psychedelic grandeur, beat switches, and stacked guest features, it debuted at #1 and launched the landmark Wish You Were Here tour.',
    'JACKBOYS': "Debut compilation from Travis Scott's Cactus Jack Records label featuring Don Toliver, Sheck Wes, Pop Smoke, Young Thug, and Offset, released December 26, 2019. Captures label-collective sessions between 'Astroworld' and early 'UTOPIA' development.",
    'UTOPIA [V1]': "First phase of 'UTOPIA' spanning post-'Astroworld' sessions through late 2021. Early directions ranged from industrial maximalism and Ye-assisted Wyoming/Cabo sessions to psychedelic rock experiments before the project was restructured after the AstroFest tragedy.",
    'The Scotts': "Collaborative album teased with Kid Cudi around their #1 Fortnite single 'THE SCOTTS' on April 23, 2020. Multiple joint sessions and a planned music video were discussed before both artists pivoted toward solo albums and shelved the project indefinitely.",
    'UTOPIA [V2]': "Second phase of 'UTOPIA' following the late-2021 rework, culminating in its July 28, 2023 release and 'Circus Maximus' film. Stripped down toward dystopian drum-heavy soundscapes with self-production, Mike Dean, Guy-Manuel de Homem-Christo, and BNYX.",
    'JACKBOYS 2': "Second Cactus Jack compilation, teased across post-'UTOPIA' tour dates and released July 13, 2025. Expanded the roster alongside SoFaygo and Wallie the Sensei.",
    'Ongoing': "Current post 'UTOPIA' and post 'JACKBOYS 2' era encompassing live previews, tour exclusives, guest features, and early sessions for Travis Scott's next solo album, described in January 2026 as capturing 'what Rodeo could be like on an ultra-scale stadium life'.",
  },

  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  TAG_MAP: {
    '⭐': 'Best Of',
    '🏆': 'Grails',
    '🥇': 'Wanted',
    '🏅': 'Wanted',
    '✨': 'Special',
    '🗑️': 'Worst Of',
    '🗑': 'Worst Of',
    '🚮': 'Unwanted',
    '🤖': 'AI',
    '⁉️': 'Lost Media',
    '⁉': 'Lost Media',
    '❓': 'Unknown',
  },
  TAG_TOOLTIP_MAP: {
    'Best Of': 'some of the best leaks hosted on the tracker.',
    'Grails': 'the most wanted songs that have not yet leaked in full.',
    'Wanted': 'Songs that are wanted, but not as wanted as "Grails".',
    'Special': 'special songs that are not good enough to be in Best Of, but still deserves to be highlighted.',
    'Worst Of': 'some of the worst leaks hosted on the tracker.',
    'Unwanted': "Songs that we don't want to leak in full.",
    'AI': 'Track contains AI vocals.',
    'Lost Media': "Is currently lost, or we don't have a link to the media.",
  },
  ERA_THEMES: {},
};
