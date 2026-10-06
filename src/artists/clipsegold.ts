import type { ArtistConfig } from './types';

// Clipse tracker. Data served from committed CSV snapshots under
// public/clipsegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const clipsegoldConfig: ArtistConfig = {
  slug: 'clipsegold',
  SITE_NAME: 'CLIPSEGOLD',
  SITE_DESCRIPTION: 'The Best Clipse Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/clipsegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'clipsegold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1XUtY5ris3U5R9sRBTOQdTxTNhvCbmjNAQbmLHGHTMGQ',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#a3a3a3',
  artistLabel: 'Clipse',
  cardLetter: 'C',
  logoUrl: '',
  artistPhotoUrl: '/artists/clipsegold.jpg',

  getArtistName() {
    return 'Clipse';
  },

  CUSTOM_IMAGES: {
    'Exclusive Audio Footage': '/clipsegold/eras/exclusive-audio-footage.jpg',
    'Lord Willin\'': '/clipsegold/eras/lord-willin.jpg',
    'Hell Hath No Fury': '/clipsegold/eras/hell-hath-no-fury.jpg',
    'Til the Casket Drops': '/clipsegold/eras/til-the-casket-drops.jpg',
    'Fear Of God': '/clipsegold/eras/fear-of-god.jpg',
    'Hear Ye Him': '/clipsegold/eras/hear-ye-him.jpg',
    'Fear Of God II: Let Us Pray': '/clipsegold/eras/fear-of-god-ii-let-us-pray.jpg',
    'My Name Is My Name': '/clipsegold/eras/my-name-is-my-name.png',
    'Wrath of Caine': '/clipsegold/eras/wrath-of-caine.jpg',
    'Darkest Before Dawn': '/clipsegold/eras/darkest-before-dawn.jpg',
    'DAYTONA': '/clipsegold/eras/daytona.jpg',
    'It\'s Almost Dry': '/clipsegold/eras/it-s-almost-dry.jpg',
    'Let God Sort \'Em Out': '/clipsegold/eras/let-god-sort-em-out.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Exclusive Audio Footage': '??/??/????',
    'Lord Willin\'': '??/??/????',
    'Hell Hath No Fury': '??/??/????',
    'Til the Casket Drops': '??/??/????',
    'Fear Of God': '??/??/????',
    'Hear Ye Him': '??/??/????',
    'Fear Of God II: Let Us Pray': '??/??/????',
    'My Name Is My Name': '??/??/????',
    'Wrath of Caine': '??/??/????',
    'Darkest Before Dawn': '??/??/????',
    'DAYTONA': '??/??/????',
    'It\'s Almost Dry': '??/??/????',
    'Let God Sort \'Em Out': '??/??/????',
    'PT5': '??/??/????',
    'M3': '??/??/????',
    'C5': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Exclusive Audio Footage',
    'Lord Willin\'',
    'Hell Hath No Fury',
    'Til the Casket Drops',
    'Fear Of God',
    'Hear Ye Him',
    'Fear Of God II: Let Us Pray',
    'My Name Is My Name',
    'Wrath of Caine',
    'Darkest Before Dawn',
    'DAYTONA',
    'It\'s Almost Dry',
    'Let God Sort \'Em Out',
    'PT5',
    'M3',
    'C5'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
