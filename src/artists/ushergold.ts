import type { ArtistConfig } from './types';

// Usher tracker. Data served from committed CSV snapshots under
// public/ushergold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const ushergoldConfig: ArtistConfig = {
  slug: 'ushergold',
  SITE_NAME: 'USHERGOLD',
  SITE_DESCRIPTION: 'The Best Usher Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/ushergold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'ushergold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/10b5EFPYc5Qhn3A7arsruyeVOYdU4Ab9TuQqELV9joa8/edit',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#1d4ed8',
  artistLabel: 'Usher',
  sheetCreator: 'Wselenamoment',
  cardLetter: 'U',
  logoUrl: '',
  artistPhotoUrl: '/artists/ushergold.jpg',

  getArtistName() {
    return 'Usher';
  },

  CUSTOM_IMAGES: {
    'usher':                   '/ushergold/eras/usher.jpg',
    'My Way':                  '/ushergold/eras/my-way.jpg',
    '8701 [V1] (ALL ABOUT U)': '/ushergold/eras/8701-v1-all-about-u.jpg',
    '8701.0':                  '/ushergold/eras/87010.jpg',
    'CONFESSIONS':             '/ushergold/eras/confessions.jpg',
    'HERE I STAND':            '/ushergold/eras/here-i-stand.jpg',
    'RAYMOND V RAYMOND':       '/ushergold/eras/raymond-v-raymond.jpg',
    'Looking 4 Myself':        '/ushergold/eras/looking-4-myself.jpg',
    'UR':                      '/ushergold/eras/ur.jpg',
    'HARD II LOVE':            '/ushergold/eras/hard-ii-love.jpg',
    '"A"':                     '/ushergold/eras/a.jpg',
    'CONFESSIONS 2':           '/ushergold/eras/confessions-2.jpg',
    'COMING HOME':             '/ushergold/eras/coming-home.jpg',
    'Ongoing':                 '/ushergold/eras/ongoing.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'usher': '??/??/????',
    'Usher': '??/??/????',
    'My Way': '??/??/????',
    '8701 [V1] (ALL ABOUT U)': '??/??/????',
    '8701 [V1]': '??/??/????',
    '8701': '??/??/????',
    'CONFESSIONS': '??/??/????',
    'Confessions': '??/??/????',
    'HERE I STAND': '??/??/????',
    'Here I Stand': '??/??/????',
    'RAYMOND V RAYMOND': '??/??/????',
    'Raymond v Raymond': '??/??/????',
    'Looking 4 Myself': '??/??/????',
    'UR': '??/??/????',
    'HARD II LOVE': '??/??/????',
    'Hard II Love': '??/??/????',
    '"A"': '??/??/????',
    'CONFESSIONS 2': '??/??/????',
    'Confessions 2': '??/??/????',
    'COMING HOME': '??/??/????',
    'Ongoing': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'usher',
    'Usher',
    'My Way',
    '8701 [V1] (ALL ABOUT U)',
    '8701 [V1]',
    '8701',
    'CONFESSIONS',
    'Confessions',
    'HERE I STAND',
    'Here I Stand',
    'RAYMOND V RAYMOND',
    'Raymond v Raymond',
    'Looking 4 Myself',
    'UR',
    'HARD II LOVE',
    'Hard II Love',
    '"A"',
    'CONFESSIONS 2',
    'Confessions 2',
    'COMING HOME',
    'Ongoing',
    'Unknown'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasReleasedTab: false, // sheet has no Released tab
};
