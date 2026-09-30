import type { ArtistConfig } from './types';

// Westside Gunn tracker. Data served from committed CSV snapshots under
// public/westsidegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const westsidegoldConfig: ArtistConfig = {
  slug: 'westsidegold',
  SITE_NAME: 'WESTSIDEGOLD',
  SITE_DESCRIPTION: 'The Best Westside Gunn Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/westsidegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'westsidegold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1_dFPF4tSdIuwRUj_UXUFz5qeNVJm-9lCl3zhIGXt0wI/edit?gid=514066493#514066493',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#525252',
  artistLabel: 'Westside Gunn',
  sheetCreator: 'slothsavedearth',
  cardLetter: 'W',
  logoUrl: '',
  artistPhotoUrl: '/artists/westsidegold.jpg',

  getArtistName() {
    return 'Westside Gunn';
  },

  CUSTOM_IMAGES: {
    "There's God and There's FLYGOD, Praise Both": '/westsidegold/eras/theres-god-and-theres-flygod-praise-both.jpg',
    'WestSide DOOM':                               '/westsidegold/eras/westside-doom.png',
    'Hitler Wears Hermes 5':                       '/westsidegold/eras/hitler-wears-hermes-5.jpg',
    'Pray For Paris':                              '/westsidegold/eras/pray-for-paris.jpg',
    'WHO MADE THE SUNSHINE':                       '/westsidegold/eras/who-made-the-sunshine.jpg',
    'Hitler Wears Hermes 8: Sincerely Adolf':      '/westsidegold/eras/hitler-wears-hermes-8-sincerely-adolf.jpg',
    'Peace "Fly" God':                             '/westsidegold/eras/peace-fly-god.jpg',
    '10':                                          '/westsidegold/eras/10.jpg',
    'FLYGOD is an Awesome God III':                '/westsidegold/eras/flygod-is-an-awesome-god-iii.jpg',
    'And Then You Pray For Me':                    '/westsidegold/eras/and-then-you-pray-for-me.jpg',
    '11':                                          '/westsidegold/eras/11.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'There’s God and There’s FLYGOD, Praise Both': '??/??/????',
    'WestSide DOOM': '??/??/????',
    'Hitler Wears Hermes 5': '??/??/????',
    'Pray For Paris': '??/??/????',
    'WHO MADE THE SUNSHINE': '??/??/????',
    'Hitler Wears Hermes 8: Sincerely Adolf': '??/??/????',
    'Peace "Fly" God': '??/??/????',
    '10': '??/??/????',
    'FLYGOD is an Awesome God III': '??/??/????',
    'And Then You Pray For Me': '??/??/????',
    '11': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'There’s God and There’s FLYGOD, Praise Both',
    'WestSide DOOM',
    'Hitler Wears Hermes 5',
    'Pray For Paris',
    'WHO MADE THE SUNSHINE',
    'Hitler Wears Hermes 8: Sincerely Adolf',
    'Peace "Fly" God',
    '10',
    'FLYGOD is an Awesome God III',
    'And Then You Pray For Me',
    '11'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasReleasedTab: false, // sheet has no Released tab
};
