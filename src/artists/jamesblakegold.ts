import type { ArtistConfig } from './types';

// James Blake tracker. Data served from committed CSV snapshots under
// public/jamesblakegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const jamesblakegoldConfig: ArtistConfig = {
  slug: 'jamesblakegold',
  SITE_NAME: 'JAMESBLAKEGOLD',
  SITE_DESCRIPTION: 'The Best James Blake Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/jamesblakegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'jamesblakegold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1_bPMUWLNzeMY0CtVEE3PHkuCsZL80wnA-6joAUfx7p4/edit?gid=2092886681#2092886681',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#475569',
  artistLabel: 'James Blake',
  sheetCreator: 'misuse._, x3mili, graceisfriend',
  cardLetter: 'J',
  logoUrl: '',
  artistPhotoUrl: '/artists/jamesblakegold.jpg',

  getArtistName() {
    return 'James Blake';
  },

  CUSTOM_IMAGES: {
    'Before James Blake':              '/jamesblakegold/eras/before-james-blake.jpg',
    'James Blake':                     '/jamesblakegold/eras/james-blake.jpg',
    'Overgrown':                       '/jamesblakegold/eras/overgrown.jpg',
    'The Colour In Anything':          '/jamesblakegold/eras/the-colour-in-anything.jpg',
    'Assume Form':                     '/jamesblakegold/eras/assume-form.png',
    'Friends That Break Your Heart':   '/jamesblakegold/eras/friends-that-break-your-heart.jpg',
    'Playing Robots Into Heaven [V1]': '/jamesblakegold/eras/playing-robots-into-heaven-v1.png',
    'WAR':                             '/jamesblakegold/eras/war.png',
    'Playing Robots Into Heaven [V2]': '/jamesblakegold/eras/playing-robots-into-heaven-v2.png',
    'Bad Cameo':                       '/jamesblakegold/eras/bad-cameo.jpg',
    'Trying Times':                    '/jamesblakegold/eras/trying-times.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Before James Blake': '??/??/????',
    'James Blake': '??/??/????',
    'Overgrown': '??/??/????',
    'The Colour In Anything': '??/??/????',
    'Assume Form': '??/??/????',
    'Friends That Break Your Heart': '??/??/????',
    'Playing Robots Into Heaven [V1]': '??/??/????',
    'WAR': '??/??/????',
    'Playing Robots Into Heaven [V2]': '??/??/????',
    'Bad Cameo': '??/??/????',
    'Trying Times': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Before James Blake',
    'James Blake',
    'Overgrown',
    'The Colour In Anything',
    'Assume Form',
    'Friends That Break Your Heart',
    'Playing Robots Into Heaven [V1]',
    'WAR',
    'Playing Robots Into Heaven [V2]',
    'Bad Cameo',
    'Trying Times',
    'Unknown'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasReleasedTab: false, // sheet has no Released tab
};
