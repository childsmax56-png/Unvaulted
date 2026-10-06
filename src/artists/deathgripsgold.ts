import type { ArtistConfig } from './types';

// Death Grips tracker. Data served from committed CSV snapshots under
// public/deathgripsgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const deathgripsgoldConfig: ArtistConfig = {
  slug: 'deathgripsgold',
  SITE_NAME: 'DEATHGRIPSGOLD',
  SITE_DESCRIPTION: 'The Best Death Grips Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/deathgripsgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'deathgripsgold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1Eh-9UyWUtyEpi_ELEhq5pD41ivFJHuQcvz2wFR2ml9g',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#18181b',
  artistLabel: 'Death Grips',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/deathgripsgold.jpg',

  getArtistName() {
    return 'Death Grips';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Death Grips': '??/??/????',
    'Exmilitary': '??/??/????',
    'The Money Store': '??/??/????',
    'No Love Deep Web': '??/??/????',
    'Government Plates': '??/??/????',
    'Fashion Week': '??/??/????',
    'Jenny Death': '??/??/????',
    'Bottomless Pit': '??/??/????',
    'Steroids': '??/??/????',
    'Year of The Snitch': '??/??/????',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Death Grips',
    'Exmilitary',
    'The Money Store',
    'No Love Deep Web',
    'Government Plates',
    'Fashion Week',
    'Jenny Death',
    'Bottomless Pit',
    'Steroids',
    'Year of The Snitch',
    'Ongoing'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasAlbumCopiesTab: true,
};
