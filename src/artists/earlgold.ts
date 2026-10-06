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

  CUSTOM_IMAGES: {
    'Kitchen Cutlery': '/earlgold/eras/kitchen-cutlery.jpg',
    'Earl': '/earlgold/eras/earl.png',
    'EarlWolf': '/earlgold/eras/earlwolf.png',
    'Doris': '/earlgold/eras/doris.jpg',
    'I Don\'t Like Shit, I Don\'t Go Outside': '/earlgold/eras/i-don-t-like-shit-i-don-t-go-outside.jpg',
    '4 MY DAWGS': '/earlgold/eras/4-my-dawgs.jpg',
    'Some Rap Songs': '/earlgold/eras/some-rap-songs.jpg',
    'FEET OF CLAY': '/earlgold/eras/feet-of-clay.png',
    'The People Could Fly': '/earlgold/eras/the-people-could-fly.jpg',
    'SICK!': '/earlgold/eras/sick.png',
    'Voir Dire': '/earlgold/eras/voir-dire.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Kitchen Cutlery': '07/??/2009',
    'Earl': '03/31/2010',
    'EarlWolf': '??/??/????',
    'Doris': '08/20/2013',
    'I Don\'t Like Shit, I Don\'t Go Outside': '03/15/2015',
    '4 MY DAWGS': '??/??/????',
    'Some Rap Songs': '11/30/2018',
    'FEET OF CLAY': '11/01/2019',
    'The People Could Fly': '??/??/????',
    'SICK!': '01/14/2022',
    'Voir Dire': '08/25/2023',
    'Live, Laugh, Love': '08/22/2025',
    'POMPEII // UTILITY': '04/03/2026',
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
