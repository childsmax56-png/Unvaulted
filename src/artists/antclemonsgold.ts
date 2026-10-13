import type { ArtistConfig } from './types';

// Ant Clemons tracker. Data served from committed CSV snapshots under
// public/antclemonsgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const antclemonsgoldConfig: ArtistConfig = {
  slug: 'antclemonsgold',
  SITE_NAME: 'ANTCLEMONSGOLD',
  SITE_DESCRIPTION: 'The Best Ant Clemons Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/antclemonsgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'antclemonsgold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/11Ta0gixhRv9uUq-_O9nID_rjUf3oembw57f2sblMP3k/edit?gid=1295931150#1295931150',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#0ea5e9',
  artistLabel: 'Ant Clemons',
  sheetCreator: 'V3 Grailer',
  cardLetter: 'A',
  logoUrl: '',
  artistPhotoUrl: '/artists/antclemonsgold.jpg',

  getArtistName() {
    return 'Ant Clemons';
  },

  CUSTOM_IMAGES: {
    'Before HAPPY 2 BE HERE':   '/antclemonsgold/eras/before-happy-2-be-here.jpg',
    'HAPPY 2 BE HERE':          '/antclemonsgold/eras/happy-2-be-here.jpg',
    'LOVE.$WEAT.TEAR$':         '/antclemonsgold/eras/loveweattear.jpg',
    '4Play':                    '/antclemonsgold/eras/4play.jpg',
    'HAPPY 2 BE HERE WITH YOU': '/antclemonsgold/eras/happy-2-be-here-with-you.jpg',
    '4Play II':                 '/antclemonsgold/eras/4play-ii.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Before HAPPY 2 BE HERE': '??/??/????',
    'HAPPY 2 BE HERE': '??/??/????',
    'LOVE.$WEAT.TEAR$': '??/??/????',
    '4Play': '??/??/????',
    'HAPPY 2 BE HERE WITH YOU': '??/??/????',
    '4Play II': '??/??/????',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Before HAPPY 2 BE HERE',
    'HAPPY 2 BE HERE',
    'LOVE.$WEAT.TEAR$',
    '4Play',
    'HAPPY 2 BE HERE WITH YOU',
    '4Play II',
    'Ongoing'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasAlbumCopiesTab: true,
  hasMiscTab: false,
};
