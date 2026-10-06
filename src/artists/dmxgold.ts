import type { ArtistConfig } from './types';

// DMX tracker. Data served from committed CSV snapshots under
// public/dmxgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const dmxgoldConfig: ArtistConfig = {
  slug: 'dmxgold',
  SITE_NAME: 'DMXGOLD',
  SITE_DESCRIPTION: 'The Best DMX Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/dmxgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'dmxgold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '101y0kCIzwGoT0YmGHIchehUpO7tzAdjXSZZVRrEobOg',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#7f1d1d',
  artistLabel: 'DMX',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/dmxgold.jpg',

  getArtistName() {
    return 'DMX';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Pre-Fame': '??/??/????',
    'It\'s Dark And Hell Is Hot': '??/??/????',
    'Flesh Of My Flesh, Blood Of My Blood': '??/??/????',
    '...And Then There Was X': '??/??/????',
    'The Great Depression': '??/??/????',
    'Cradle 2 The Grave': '??/??/????',
    'Grand Champ': '??/??/????',
    'Never Die Alone Soundtrack': '??/??/????',
    'Year of the Dog... Again': '??/??/????',
    'Walk With Me Now / You\'ll Fly With Me Later': '??/??/????',
    'Undisputed': '??/??/????',
    'Hiatus': '??/??/????',
    'Exodus': '??/??/????',
    'DMX Features': '??/??/????',
    'Unknown Era': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Pre-Fame',
    'It\'s Dark And Hell Is Hot',
    'Flesh Of My Flesh, Blood Of My Blood',
    '...And Then There Was X',
    'The Great Depression',
    'Cradle 2 The Grave',
    'Grand Champ',
    'Never Die Alone Soundtrack',
    'Year of the Dog... Again',
    'Walk With Me Now / You\'ll Fly With Me Later',
    'Undisputed',
    'Hiatus',
    'Exodus',
    'DMX Features',
    'Unknown Era'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
