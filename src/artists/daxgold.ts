import type { ArtistConfig } from './types';

// Dax tracker. Data served from committed CSV snapshots under
// public/daxgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const daxgoldConfig: ArtistConfig = {
  slug: 'daxgold',
  SITE_NAME: 'DAXGOLD',
  SITE_DESCRIPTION: 'The Best Dax Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/daxgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'daxgold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1t1IuCgKrx3QjCt9CLrcu3FqA32qGAF8TeQjhCQHO4AY',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#dc2626',
  artistLabel: 'Dax',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/daxgold.jpg',

  getArtistName() {
    return 'Dax';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Daniel Dax': '??/??/????',
    '2pac Reincarnation Vol 2: By Dax': '??/??/????',
    'It\'s Different Now': '??/??/????',
    'I\'ll Say It For You': '??/??/????',
    'Pain Paints Paintings': '??/??/????',
    'What is life?': '??/??/????',
    'From A Man\'s Perspective': '??/??/????',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Daniel Dax',
    '2pac Reincarnation Vol 2: By Dax',
    'It\'s Different Now',
    'I\'ll Say It For You',
    'Pain Paints Paintings',
    'What is life?',
    'From A Man\'s Perspective',
    'Ongoing'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
