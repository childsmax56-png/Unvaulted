import type { ArtistConfig } from './types';

// The Weeknd tracker. Data served from committed CSV snapshots under
// public/weekndgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const weekndgoldConfig: ArtistConfig = {
  slug: 'weekndgold',
  SITE_NAME: 'WEEKNDGOLD',
  SITE_DESCRIPTION: 'The Best The Weeknd Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/weekndgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'weekndgold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1luU-KL_vKt72goUpSO2F0qMvXyqaT_q8VwYNjPeLgTg/edit?gid=766670282#766670282',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#b91c1c',
  artistLabel: 'The Weeknd',
  sheetCreator: 'KrackerZ, Dr Wolf, shri, raymeta12, hannahandevelyn, jae, DxG51, indeed, FADED',
  cardLetter: 'W',
  logoUrl: '',
  artistPhotoUrl: '/artists/weekndgold.jpg',

  getArtistName() {
    return 'The Weeknd';
  },

  CUSTOM_IMAGES: {
    "Bulleez N' Nerdz":          '/weekndgold/eras/bulleez-n-nerdz.jpg',
    'The Noise':                 '/weekndgold/eras/the-noise.png',
    'House Of Balloons':         '/weekndgold/eras/house-of-balloons.jpg',
    'Thursday':                  '/weekndgold/eras/thursday.png',
    'Echoes Of Silence':         '/weekndgold/eras/echoes-of-silence.jpg',
    'Kiss Land':                 '/weekndgold/eras/kiss-land.png',
    'Kiss Land (Remastered)':    '/weekndgold/eras/kiss-land.png',
    'Untitled':                  '/weekndgold/eras/untitled.png',
    'Beauty Behind The Madness': '/weekndgold/eras/beauty-behind-the-madness.jpg',
    'Starboy':                   '/weekndgold/eras/starboy.png',
    'My Dear Melancholy,':       '/weekndgold/eras/my-dear-melancholy.jpg',
    'After Hours [V1]':          '/weekndgold/eras/after-hours-v1.jpg',
    'After Hours [V2]':          '/weekndgold/eras/after-hours-v2.png',
    'Dawn FM':                   '/weekndgold/eras/dawn-fm.png',
    'The Idol':                  '/weekndgold/eras/the-idol.jpg',
    'Hurry Up Tomorrow':         '/weekndgold/eras/hurry-up-tomorrow.png',
  },

  ALBUM_RELEASE_DATES: {
    'Bulleez N\' Nerdz': '??/??/????',
    'The Noise': '??/??/????',
    'House Of Balloons': '??/??/????',
    'Thursday': '??/??/????',
    'Echoes Of Silence': '??/??/????',
    'Kiss Land': '??/??/????',
    'Untitled': '??/??/????',
    'Pre-BBTM': '??/??/????',
    'Beauty Behind The Madness': '??/??/????',
    'BBTM': '??/??/????',
    'Pre-Starboy': '??/??/????',
    'Starboy': '??/??/????',
    'Post-Starboy': '??/??/????',
    'My Dear Melancholy,': '??/??/????',
    'After Hours [V1]': '??/??/????',
    'After Hours [V2]': '??/??/????',
    'Dawn FM': '??/??/????',
    'The Idol': '??/??/????',
    'Hurry Up Tomorrow': '??/??/????',
    'Hurry Up Tomorrow (Score)': '??/??/????',
    'Kiss Land (Remastered)': '??/??/????',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Bulleez N\' Nerdz',
    'The Noise',
    'House Of Balloons',
    'Thursday',
    'Echoes Of Silence',
    'Kiss Land',
    'Untitled',
    'Pre-BBTM',
    'Beauty Behind The Madness',
    'BBTM',
    'Pre-Starboy',
    'Starboy',
    'Post-Starboy',
    'My Dear Melancholy,',
    'After Hours [V1]',
    'After Hours [V2]',
    'Dawn FM',
    'The Idol',
    'Hurry Up Tomorrow',
    'Hurry Up Tomorrow (Score)',
    'Kiss Land (Remastered)',
    'Ongoing'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
