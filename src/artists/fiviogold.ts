import type { ArtistConfig } from './types';

// Fivio Foreign tracker. Data served from committed CSV snapshots under
// public/fiviogold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const fiviogoldConfig: ArtistConfig = {
  slug: 'fiviogold',
  SITE_NAME: 'FIVIOGOLD',
  SITE_DESCRIPTION: 'The Best Fivio Foreign Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/fiviogold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'fiviogold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1K8WDS6pL7uOPvf7j78Om5kO1k0-h-beqMZaXpMAUy74',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#4f46e5',
  artistLabel: 'Fivio Foreign',
  cardLetter: 'F',
  logoUrl: '',
  artistPhotoUrl: '/artists/fiviogold.jpg',

  getArtistName() {
    return 'Fivio Foreign';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Before Pain and Love': '??/??/????',
    'Pain and Love': '??/??/????',
    '800 B.C.': '??/??/????',
    'B.I.B.L.E.': '??/??/????',
    'Collaboration with DJ Drama': '??/??/????',
    'Without Warning': '??/??/????',
    'Pain & Love 2': '??/??/????',
    'Still Standing': '??/??/????',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Before Pain and Love',
    'Pain and Love',
    '800 B.C.',
    'B.I.B.L.E.',
    'Collaboration with DJ Drama',
    'Without Warning',
    'Pain & Love 2',
    'Still Standing',
    'Ongoing'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
