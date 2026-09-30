import type { ArtistConfig } from './types';

// Aaliyah tracker. Data served from committed CSV snapshots under
// public/aaliyahgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const aaliyahgoldConfig: ArtistConfig = {
  slug: 'aaliyahgold',
  SITE_NAME: 'AALIYAHGOLD',
  SITE_DESCRIPTION: 'The Best Aaliyah Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/aaliyahgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'aaliyahgold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1QJR4Ku4Si5kLUL1P_vi9hCkkjDQvDWqafWiYc1v_Z8E/edit',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#b91c1c',
  artistLabel: 'Aaliyah',
  sheetCreator: 'tonixander, looserap, magik2338',
  cardLetter: 'A',
  logoUrl: '',
  artistPhotoUrl: '/artists/aaliyahgold.jpg',

  getArtistName() {
    return 'Aaliyah';
  },

  CUSTOM_IMAGES: {
    "Age Ain't Nothing But A Number": '/aaliyahgold/eras/age-aint-nothing-but-a-number.png',
    'One In A Million':               '/aaliyahgold/eras/one-in-a-million.png',
    'Aaliyah':                        '/aaliyahgold/eras/aaliyah.png',
    'Aaliyah x Drake x 40 (A)':       '/aaliyahgold/eras/aaliyah-x-drake-x-40-a.jpg',
    'Unstoppable':                    '/aaliyahgold/eras/unstoppable.png',
  },

  ALBUM_RELEASE_DATES: {
    'Age Ain\'t Nothing But A Number': '??/??/????',
    'One In A Million': '??/??/????',
    'Aaliyah': '??/??/????',
    'Aaliyah x Drake x 4 (A)': '??/??/????',
    'Unstoppable': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Age Ain\'t Nothing But A Number',
    'One In A Million',
    'Aaliyah',
    'Aaliyah x Drake x 4 (A)',
    'Unstoppable'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasRecentTab: false, // sheet has no Recent tab
  hasReleasedTab: false, // sheet has no Released tab
};
