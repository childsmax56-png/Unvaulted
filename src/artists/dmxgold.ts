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

  CUSTOM_IMAGES: {
    'Pre-Fame': '/dmxgold/eras/pre-fame.png',
    'It\'s Dark And Hell Is Hot': '/dmxgold/eras/it-s-dark-and-hell-is-hot.jpg',
    'Flesh Of My Flesh, Blood Of My Blood': '/dmxgold/eras/flesh-of-my-flesh-blood-of-my-blood.png',
    '...And Then There Was X': '/dmxgold/eras/and-then-there-was-x.jpg',
    'The Great Depression': '/dmxgold/eras/the-great-depression.jpg',
    'Cradle 2 The Grave': '/dmxgold/eras/cradle-2-the-grave.jpg',
    'Grand Champ': '/dmxgold/eras/grand-champ.jpg',
    'Never Die Alone Soundtrack': '/dmxgold/eras/never-die-alone-soundtrack.png',
    'Year of the Dog... Again': '/dmxgold/eras/year-of-the-dog-again.jpg',
    'Walk With Me Now / You\'ll Fly With Me Later': '/dmxgold/eras/walk-with-me-now-you-ll-fly-with-me-later.jpg',
    'Undisputed': '/dmxgold/eras/undisputed.jpg',
    'Hiatus': '/dmxgold/eras/hiatus.jpg',
    'Exodus': '/dmxgold/eras/exodus.jpg',
    'DMX Features': '/dmxgold/eras/dmx-features.png',
    'Unknown Era': '/dmxgold/eras/unknown-era.jpg',
  },

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
