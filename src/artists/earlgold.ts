import type { ArtistConfig } from './types';

// Earl Sweatshirt tracker. Data served from committed CSV snapshots under
// public/earlgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const earlgoldConfig: ArtistConfig = {
  slug: 'earlgold',
  SITE_NAME: 'EARLGOLD',
  SITE_DESCRIPTION: 'The Best Earl Sweatshirt Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/earlgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'earlgold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1EKEnvdiwSudiPJSePPzfCXIQ_W-AYeAIY6_r-a12bdM',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#65a30d',
  artistLabel: 'Earl Sweatshirt',
  cardLetter: 'E',
  logoUrl: '',
  artistPhotoUrl: '/artists/earlgold.jpg',

  getArtistName() {
    return 'Earl Sweatshirt';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Kitchen Cutlery': '??/??/????',
    'Earl': '??/??/????',
    'EarlWolf': '??/??/????',
    'Doris': '??/??/????',
    'I Don\'t Like Shit, I Don\'t Go Outside': '??/??/????',
    '4 MY DAWGS': '??/??/????',
    'Some Rap Songs': '??/??/????',
    'FEET OF CLAY': '??/??/????',
    'The People Could Fly': '??/??/????',
    'SICK!': '??/??/????',
    'Voir Dire': '??/??/????',
    'Live, Laugh, Love': '??/??/????',
    'POMPEII // UTILITY': '??/??/????',
    'Upcoming': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Kitchen Cutlery',
    'Earl',
    'EarlWolf',
    'Doris',
    'I Don\'t Like Shit, I Don\'t Go Outside',
    '4 MY DAWGS',
    'Some Rap Songs',
    'FEET OF CLAY',
    'The People Could Fly',
    'SICK!',
    'Voir Dire',
    'Live, Laugh, Love',
    'POMPEII // UTILITY',
    'Upcoming'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
