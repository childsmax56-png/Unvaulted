import type { ArtistConfig } from './types';

// Wu-Tang Clan tracker. Data served from committed CSV snapshots under
// public/wutanggold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const wutanggoldConfig: ArtistConfig = {
  slug: 'wutanggold',
  SITE_NAME: 'WUTANGGOLD',
  SITE_DESCRIPTION: 'The Best Wu-Tang Clan Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/wutanggold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'wutanggold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1dA2h1kQffOmUUeCy6YMu8IYdGGqnhnWuabKdK7emyyU/edit?gid=1275210512#1275210512',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#facc15',
  artistLabel: 'Wu-Tang Clan',
  sheetCreator: 'TK, kill, dxg51',
  cardLetter: 'W',
  logoUrl: '',
  artistPhotoUrl: '/artists/wutanggold.jpg',

  getArtistName() {
    return 'Wu-Tang Clan';
  },

  CUSTOM_IMAGES: {
    'Demo Tape':                               '/wutanggold/eras/demo-tape.jpg',
    'Enter the Wu-Tang (36 Chambers)':         '/wutanggold/eras/enter-the-wu-tang-36-chambers.png',
    'Wu-Tang Forever':                         '/wutanggold/eras/wu-tang-forever.jpg',
    'The W':                                   '/wutanggold/eras/the-w.png',
    'Iron Flag':                               '/wutanggold/eras/iron-flag.jpg',
    '8 Diagrams':                              '/wutanggold/eras/8-diagrams.png',
    'A Better Tomorrow':                       '/wutanggold/eras/a-better-tomorrow.jpg',
    'Shaolin School (Disc One)':               '/wutanggold/eras/shaolin-school-disc-one.jpg',
    'Black Samson, The Bastard Swordsman':     '/wutanggold/eras/black-samson-the-bastard-swordsman.jpg',
    'Once Upon A Time In Shaolin':             '/wutanggold/eras/once-upon-a-time-in-shaolin.jpg',
    'Twice Upon A Time In Shaolin':            '/wutanggold/eras/twice-upon-a-time-in-shaolin.png',
    'The Saga Continues [V1]':                 '/wutanggold/eras/the-saga-continues-v1.jpg',
    'The Saga Continues [V2]':                 '/wutanggold/eras/the-saga-continues-v2.jpg',
    '"The Eighth Diagrams" (8 Diagrams [V1])': '/wutanggold/eras/the-eighth-diagrams-8-diagrams-v1.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Demo Tape': '??/??/????',
    'Enter the Wu-Tang (36 Chambers)': '??/??/????',
    'Wu-Tang Forever': '??/??/????',
    'The W': '??/??/????',
    'Iron Flag': '??/??/????',
    '8 Diagrams': '??/??/????',
    'A Better Tomorrow': '??/??/????',
    'Album leaks in Full: 6': '??/??/????',
    'Once Upon A Time In Shaolin': '??/??/????',
    'Method Man & Mathematics': '??/??/????',
    'The Saga Continues [V1]': '??/??/????',
    'Black Samson, The Bastard Swordsman': '??/??/????',
    'Twice Upon A Time In Shaolin': '??/??/????',
    '"The Eighth Diagrams" (8 Diagrams [V1])': '??/??/????',
    'The Saga Continues [V2]': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Demo Tape',
    'Enter the Wu-Tang (36 Chambers)',
    'Wu-Tang Forever',
    'The W',
    'Iron Flag',
    '8 Diagrams',
    'A Better Tomorrow',
    'Album leaks in Full: 6',
    'Once Upon A Time In Shaolin',
    'Method Man & Mathematics',
    'The Saga Continues [V1]',
    'Black Samson, The Bastard Swordsman',
    'Twice Upon A Time In Shaolin',
    '"The Eighth Diagrams" (8 Diagrams [V1])',
    'The Saga Continues [V2]'
  ],

  // Matches the sheet's own "Key" tab (⭐/✨/🏆 are defined there; 🥇/🏅 aren't
  // documented but are used on songs the same way every other tracker's "Wanted"
  // tag is). Without this, these emoji stay embedded in the song name instead of
  // being pulled out into a proper "Best Of"/"Grails"/etc. tag.
  TAG_MAP: {
    '⭐': 'Best Of', '⭐️': 'Best Of',
    '✨': 'Special',
    '🏆': 'Grails',
    '🥇': 'Wanted', '🏅': 'Wanted',
  },
  TAG_TOOLTIP_MAP: {
    'Best Of': 'Some of the best leaks hosted on the tracker.',
    'Grails': 'The most wanted songs.',
    'Special': 'Recommended/suggested/special songs that are not good enough to belong in Best Of, but still deserve to be highlighted in some sort of way.',
    'Wanted': 'Songs that are wanted, but not as wanted as Grails.',
  },
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasIndividualProjectsTab: true, // members' solo/collab discography, browsed the same way as Unreleased
  hasIndividualTracklistsTab: true,
};
