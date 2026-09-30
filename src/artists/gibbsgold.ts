import type { ArtistConfig } from './types';

// Freddie Gibbs tracker. Data served from committed CSV snapshots under
// public/gibbsgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const gibbsgoldConfig: ArtistConfig = {
  slug: 'gibbsgold',
  SITE_NAME: 'GIBBSGOLD',
  SITE_DESCRIPTION: 'The Best Freddie Gibbs Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/gibbsgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'gibbsgold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1CCe1DI9VIp0J4MQyTsdMuOriZ9ucmCVMw6nS9j8e4N0/edit',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#7c2d12',
  artistLabel: 'Freddie Gibbs',
  sheetCreator: 'madvilliany, vexlcx',
  cardLetter: 'F',
  logoUrl: '',
  artistPhotoUrl: '/artists/gibbsgold.jpg',

  getArtistName() {
    return 'Freddie Gibbs';
  },

  CUSTOM_IMAGES: {
    'Baby Face Killa':      '/gibbsgold/eras/baby-face-killa.jpg',
    'ESGN':                 '/gibbsgold/eras/esgn.jpg',
    'Piñata':               '/gibbsgold/eras/piñata.jpg',
    'Shadow of a Doubt':    '/gibbsgold/eras/shadow-of-a-doubt.jpg',
    'You Only Live 2wice':  '/gibbsgold/eras/you-only-live-2wice.jpg',
    'Freddie':              '/gibbsgold/eras/freddie.jpg',
    'Bandana':              '/gibbsgold/eras/bandana.jpg',
    'Montana':              '/gibbsgold/eras/montana.jpg',
    'Alfredo':              '/gibbsgold/eras/alfredo.jpg',
    '$oul $old $eparately': '/gibbsgold/eras/oul-old-eparately.jpg',
    'Alfredo 2':            '/gibbsgold/eras/alfredo-2.jpg',
    // Released-tab-only early mixtapes (not in ALBUM_RELEASE_DATES/the Music grid, but
    // still shown as their own group on the Released tab, so they need covers too).
    'Str8 Killa No Filla':               '/gibbsgold/eras/str8-killa-no-filla.jpg',
    'The Miseducation of Freddie Gibbs': '/gibbsgold/eras/the-miseducation-of-freddie-gibbs.jpg',
    "Fuckin' Wit Fred":                  '/gibbsgold/eras/fuckin-wit-fred.jpg',
    'Live from Gary, Indiana Part 2':    '/gibbsgold/eras/live-from-gary-indiana-part-2.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Pre-BFK': '??/??/????',
    'Baby Face Killa': '??/??/????',
    'ESGN': '??/??/????',
    'Piñata': '??/??/????',
    'Shadow of a Doubt': '??/??/????',
    'You Only Live 2wice': '??/??/????',
    'Freddie': '??/??/????',
    'Bandana': '??/??/????',
    'Montana': '??/??/????',
    'Alfredo': '??/??/????',
    '$oul $old $eparately': '??/??/????',
    '[Unknown title]': '??/??/????',
    'Ye x Gibbs': '??/??/????',
    'You Only Die 1nce': '??/??/????',
    'Alfredo 2': '??/??/????',
    'TBA': '??/??/????',
    'Hypnotized Rabbit': '??/??/????',
    'Unknown Era': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Pre-BFK',
    'Baby Face Killa',
    'ESGN',
    'Piñata',
    'Shadow of a Doubt',
    'You Only Live 2wice',
    'Freddie',
    'Bandana',
    'Montana',
    'Alfredo',
    '$oul $old $eparately',
    '[Unknown title]',
    'Ye x Gibbs',
    'You Only Die 1nce',
    'Alfredo 2',
    'TBA',
    'Hypnotized Rabbit',
    'Unknown Era',
    'Unknown'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
