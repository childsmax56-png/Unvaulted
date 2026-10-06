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

  CUSTOM_IMAGES: {
    'Before No More Mr. Nice Guy': '/premiergold/eras/before-no-more-mr-nice-guy.png',
    'No More Mr. Nice Guy': '/premiergold/eras/no-more-mr-nice-guy.jpg',
    'Step in the Arena': '/premiergold/eras/step-in-the-arena.jpg',
    'Daily Operation': '/premiergold/eras/daily-operation.jpg',
    'Hard to Earn': '/premiergold/eras/hard-to-earn.jpg',
    'Moment of Truth': '/premiergold/eras/moment-of-truth.jpg',
    'Full Clip: A Decade Of Gang Starr': '/premiergold/eras/full-clip-a-decade-of-gang-starr.png',
    'The Ownerz': '/premiergold/eras/the-ownerz.jpg',
    'DJ Premier Presents - Get Used To Us': '/premiergold/eras/dj-premier-presents-get-used-to-us.jpg',
    'Hustlaz Union: Local NYG [V1]': '/premiergold/eras/hustlaz-union-local-nyg-v1.jpg',
    'KoleXXXion': '/premiergold/eras/kolexxxion.jpg',
    'PRhyme': '/premiergold/eras/prhyme.jpg',
    'Hustlaz Union: Local NYG [V2]': '/premiergold/eras/hustlaz-union-local-nyg-v2.png',
    'PRhyme 2': '/premiergold/eras/prhyme-2.jpg',
    'One of the Best Yet': '/premiergold/eras/one-of-the-best-yet.jpg',
    'Hip Hop 50: Vol. 1': '/premiergold/eras/hip-hop-50-vol-1.jpg',
    'The Coldest Profession': '/premiergold/eras/the-coldest-profession.png',
    'The Reinvention': '/premiergold/eras/the-reinvention.jpg',
    'Light-Years': '/premiergold/eras/light-years.png',
    'Ongoing': '/premiergold/eras/ongoing.png',
    'Unknown': '/premiergold/eras/unknown.png',
  },

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
