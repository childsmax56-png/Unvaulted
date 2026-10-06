import type { ArtistConfig } from './types';

// DJ Premier tracker. Data served from committed CSV snapshots under
// public/premiergold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const premiergoldConfig: ArtistConfig = {
  slug: 'premiergold',
  SITE_NAME: 'PREMIERGOLD',
  SITE_DESCRIPTION: 'The Best DJ Premier Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/premiergold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'premiergold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1RaAzCb3IAg0FZas9dsAMqU785xw1sDYIvx3-SVFEVsY',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#b45309',
  artistLabel: 'DJ Premier',
  cardLetter: 'P',
  logoUrl: '',
  artistPhotoUrl: '/artists/premiergold.jpg',

  getArtistName() {
    return 'DJ Premier';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Before No More Mr. Nice Guy': '??/??/????',
    'No More Mr. Nice Guy': '??/??/????',
    'Step in the Arena': '??/??/????',
    'Daily Operation': '??/??/????',
    'Hard to Earn': '??/??/????',
    'Moment of Truth': '??/??/????',
    'Full Clip: A Decade Of Gang Starr': '??/??/????',
    'The Ownerz': '??/??/????',
    'DJ Premier Presents - Get Used To Us': '??/??/????',
    'Hustlaz Union: Local NYG [V1]': '??/??/????',
    'KoleXXXion': '??/??/????',
    'PRhyme': '??/??/????',
    'Hustlaz Union: Local NYG [V2]': '??/??/????',
    'PRhyme 2': '??/??/????',
    'One of the Best Yet': '??/??/????',
    'Hip Hop 50: Vol. 1': '??/??/????',
    'The Coldest Profession': '??/??/????',
    'The Reinvention': '??/??/????',
    'Light-Years': '??/??/????',
    'Ongoing': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Before No More Mr. Nice Guy',
    'No More Mr. Nice Guy',
    'Step in the Arena',
    'Daily Operation',
    'Hard to Earn',
    'Moment of Truth',
    'Full Clip: A Decade Of Gang Starr',
    'The Ownerz',
    'DJ Premier Presents - Get Used To Us',
    'Hustlaz Union: Local NYG [V1]',
    'KoleXXXion',
    'PRhyme',
    'Hustlaz Union: Local NYG [V2]',
    'PRhyme 2',
    'One of the Best Yet',
    'Hip Hop 50: Vol. 1',
    'The Coldest Profession',
    'The Reinvention',
    'Light-Years',
    'Ongoing',
    'Unknown'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
