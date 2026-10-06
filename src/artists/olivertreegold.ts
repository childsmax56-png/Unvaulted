import type { ArtistConfig } from './types';

// Oliver Tree tracker. Data served from committed CSV snapshots under
// public/olivertreegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const olivertreegoldConfig: ArtistConfig = {
  slug: 'olivertreegold',
  SITE_NAME: 'OLIVERTREEGOLD',
  SITE_DESCRIPTION: 'The Best Oliver Tree Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/olivertreegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'olivertreegold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1rhvQ9F8VRAj-jOyTLsvhORsVCyvcMRXJuGoDR1-z4jY',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#0284c7',
  artistLabel: 'Oliver Tree',
  cardLetter: 'O',
  logoUrl: '',
  artistPhotoUrl: '/artists/olivertreegold.jpg',

  getArtistName() {
    return 'Oliver Tree';
  },

  CUSTOM_IMAGES: {
    'The Last Supper': '/olivertreegold/eras/the-last-supper.jpg',
    'Splitting Branches': '/olivertreegold/eras/splitting-branches.jpg',
    'CalArts': '/olivertreegold/eras/calarts.jpg',
    'Untitled Soul Album': '/olivertreegold/eras/untitled-soul-album.jpg',
    'Squirt': '/olivertreegold/eras/squirt.jpg',
    'Turbo': '/olivertreegold/eras/turbo.png',
    'Ugly is Beautiful [V1]': '/olivertreegold/eras/ugly-is-beautiful-v1.jpg',
    'Ugly is Beautiful [V2]': '/olivertreegold/eras/ugly-is-beautiful-v2.jpg',
    'Little Ricky ZR3': '/olivertreegold/eras/little-ricky-zr3.jpg',
    'Cowboy Tears': '/olivertreegold/eras/cowboy-tears.jpg',
    'Super Computer': '/olivertreegold/eras/super-computer.jpg',
    'Unknown EP': '/olivertreegold/eras/unknown-ep.jpg',
    'Love You Madly, Hate You Badly': '/olivertreegold/eras/love-you-madly-hate-you-badly.jpg',
    'Posthumous': '/olivertreegold/eras/posthumous.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'The Last Supper': '??/??/????',
    'Splitting Branches': '??/??/????',
    'CalArts': '??/??/????',
    'Untitled Soul Album': '??/??/????',
    'Squirt': '??/??/????',
    'Turbo': '??/??/????',
    'Ugly is Beautiful [V1]': '??/??/????',
    'Ugly is Beautiful [V2]': '??/??/????',
    'Little Ricky ZR3': '??/??/????',
    'Cowboy Tears': '??/??/????',
    'Drown the World': '??/??/????',
    'Alone in a Crowd': '??/??/????',
    'Super Computer': '??/??/????',
    'Unknown EP': '??/??/????',
    'Love You Madly, Hate You Badly': '??/??/????',
    'Post-LYMHYB': '??/??/????',
    'Posthumous': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'The Last Supper',
    'Splitting Branches',
    'CalArts',
    'Untitled Soul Album',
    'Squirt',
    'Turbo',
    'Ugly is Beautiful [V1]',
    'Ugly is Beautiful [V2]',
    'Little Ricky ZR3',
    'Cowboy Tears',
    'Drown the World',
    'Alone in a Crowd',
    'Super Computer',
    'Unknown EP',
    'Love You Madly, Hate You Badly',
    'Post-LYMHYB',
    'Posthumous'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasAlbumCopiesTab: true,
};
