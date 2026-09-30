import type { ArtistConfig } from './types';

// Danny Brown tracker. Data served from committed CSV snapshots under
// public/dannybrowngold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const dannybrowngoldConfig: ArtistConfig = {
  slug: 'dannybrowngold',
  SITE_NAME: 'DANNYBROWNGOLD',
  SITE_DESCRIPTION: 'The Best Danny Brown Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/dannybrowngold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'dannybrowngold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1ybtg3wbiB63eHKGv8_ZFek3qQIoRbB8DUYAWObfeDZI/edit',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#84cc16',
  artistLabel: 'Danny Brown',
  sheetCreator: 'madvilliany',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/dannybrowngold.jpg',

  getArtistName() {
    return 'Danny Brown';
  },

  CUSTOM_IMAGES: {
    'Old':                 '/dannybrowngold/eras/old.jpg',
    'Atrocity Exhibition': '/dannybrowngold/eras/atrocity-exhibition.jpg',
    'Reign Supreme':       '/dannybrowngold/eras/reign-supreme.jpg',
    'SCARING THE HOES':    '/dannybrowngold/eras/scaring-the-hoes.jpg',
    'Quaranta':            '/dannybrowngold/eras/quaranta.png',
  },

  ALBUM_RELEASE_DATES: {
    'Old': '??/??/????',
    'Atrocity Exhibition': '??/??/????',
    'Reign Supreme': '??/??/????',
    'SCARING THE HOES': '??/??/????',
    'Quaranta': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Old',
    'Atrocity Exhibition',
    'Reign Supreme',
    'SCARING THE HOES',
    'Quaranta'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasReleasedTab: false, // sheet has no Released tab
};
