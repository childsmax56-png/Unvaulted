import type { ArtistConfig } from './types';

// Xzibit tracker. Data served from committed CSV snapshots under
// public/xzibitgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const xzibitgoldConfig: ArtistConfig = {
  slug: 'xzibitgold',
  SITE_NAME: 'XZIBITGOLD',
  SITE_DESCRIPTION: 'The Best Xzibit Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/xzibitgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'xzibitgold_',
  sheetCreator: 'GrimR3xx, TEATI',

  HARDCODED_SHEET_ID: '1EVBoDCk8uZ5ft1wRpTsqJlHxfdYDnFVbbD5bRMR6qpw',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#9a3412',
  artistLabel: 'Xzibit',
  cardLetter: 'X',
  logoUrl: '',
  artistPhotoUrl: '/artists/xzibitgold.jpg',

  getArtistName() {
    return 'Xzibit';
  },

  CUSTOM_IMAGES: {
    'Restless': '/xzibitgold/eras/restless.jpg',
    'Man vs. Machine': '/xzibitgold/eras/man-vs-machine.jpg',
    'Full Circle': '/xzibitgold/eras/full-circle.jpg',
    'Napalm': '/xzibitgold/eras/napalm.jpg',
    'Kingmaker': '/xzibitgold/eras/kingmaker.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Restless': '12/12/2000',
    'Man vs. Machine': '10/01/2002',
    'WoMD': '12/14/2004',
    'Full Circle': '10/17/2006',
    'Napalm': '10/09/2012',
    'Kingmaker': '05/16/2025',
    'Summer of Sam': '10/16/2020'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Restless': 'Coming off the "Up In Smoke" tour, and frustrated by the lack of guidance from his current label management, Xzibit enlists Dre to executive produce an album he would complete in just two months and release in December of the same year.',
    'Man vs. Machine': 'Man vs. Machine was Xzibit\'s 2nd album executive produced by Dre and his overall 4th album. It had features from Dre, Snoop Dogg, M.O.P., Nate Dogg, Eminem and more. It was received positively, although a little less so than Restless, and sold over 156,000 copies along with being number 3 on the Billboard 200. It also curiously has a skit from Eminem\'s manager Paul Rosenberg. Despite all these accomplishments it resulted in the temporary end of Xzibit\'s working relationship with Dr. Dre and some friction between Xzibit and Paul Rosenberg likely resulting in some isolation from Eminem\'s camp. Xzibit\'s departure from the Aftermath circle and decline of his marketability can also be attributed to his time hosting MTV\'s "Pimp My Ride".',
    'WoMD': 'Weapons of Mass Destruction is the 5th studio album by rapper Xzibit.',
    'Full Circle': 'Full Circle is the 6th studio album by rapper Xzibit. The album was recorded in only 2 months as thats all the time Xzibit had inbetween filming seasons for Pimp My Ride.',
    'Napalm': 'Napalm is the 7th studio album by rapper Xzibit.',
    'Kingmaker': 'It\'s hard to pinpoint when exactly the Kingmaker era starts as the album has been in development since at least 2016. It was talked about multiple times by Xzibit prior to his singing to Greenback Records in 2024. The album was mostly finished recording by 2024 as Xzibit was confident enough to preview and play multiple tracks from the album during shows and after parties. The album was delayed multiple times in 2024 but finally was put out for all to hear in early 2025.',
    'Summer of Sam': 'Serial Killers Presents: Summer of Sam is the first album by the Hip-Hop group Serial Killers. Mastered by Mike Bozzi',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Restless',
    'Man vs. Machine',
    'WoMD',
    'Full Circle',
    'Napalm',
    'Kingmaker',
    'Summer of Sam'
  ],

  // the standard tracker key — sheets prefix song names with these emojis
  TAG_MAP: {
    '⭐': 'Best Of', '⭐️': 'Best Of',
    '✨': 'Special',
    '🏆': 'Grails',
    '🥇': 'Wanted', '🏅': 'Wanted',
    '🗑️': 'Worst Of', '🗑': 'Worst Of',
    '🤖': 'AI',
  },
  TAG_TOOLTIP_MAP: {
    'Best Of': 'Some of the best leaks hosted on the tracker.',
    'Special': 'Standout songs that are not good enough to belong in Best Of, but still deserve to be highlighted.',
    'Grails': 'The most wanted songs that have not yet leaked in full.',
    'Wanted': 'Songs that are wanted, but not as wanted as Grails.',
    'Worst Of': 'Some of the worst leaks on the tracker.',
    'AI': 'Involves AI-generated content (e.g. an AI instrumental or AI artist).',
  },
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
