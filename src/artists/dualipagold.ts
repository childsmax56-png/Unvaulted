import type { ArtistConfig } from './types';

// Dua Lipa tracker. Data served from committed CSV snapshots under
// public/dualipagold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const dualipagoldConfig: ArtistConfig = {
  slug: 'dualipagold',
  SITE_NAME: 'DUALIPAGOLD',
  SITE_DESCRIPTION: 'The Best Dua Lipa Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/dualipagold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'dualipagold_',
  sheetCreator: 'raymeta12 & Dula Peep',

  HARDCODED_SHEET_ID: '1gi_foSEziQ48hTlq8hBqIwZCHz6hma1rYXr8qykBq6c',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#db2777',
  artistLabel: 'Dua Lipa',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/dualipagold.jpg',

  getArtistName() {
    return 'Dua Lipa';
  },

  CUSTOM_IMAGES: {
    'Early Career': '/dualipagold/eras/early-career.jpg',
    'Dua Lipa': '/dualipagold/eras/dua-lipa.png',
    'Future Nostalgia': '/dualipagold/eras/future-nostalgia.png',
    'Radical Optimism': '/dualipagold/eras/radical-optimism.png',
  },

  ALBUM_RELEASE_DATES: {
    'Early Career': '??/??/????',
    'Dua Lipa': '10/18/2018',
    'Future Nostalgia': '03/26/2021',
    'Radical Optimism': '05/03/2024',
    'DL4': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Early Career': 'Dua Lipa’s first song didn’t have a name. ~ “My parents inspired me to pursue music. The first song I made didn’t have a title. I was very young and it was a song I sang to my mom about when I grow up, will she lend me all her beautiful clothes? She did."',
    'Dua Lipa': 'Dua Lipa is the self-titled debut studio album by English singer Dua Lipa. Released on June 2, 2017, by Warner Bros. Records, the dance-pop and electropop record features global breakout hits like "New Rules" and "Be the One", earning widespread critical praise and commercial success',
    'Future Nostalgia': 'Future Nostalgia is Dua Lipa\'s critically acclaimed sophomore studio album. A dazzling fusion of 1970s disco, 1980s pop and modern club energy. The 11-track record spawned massive global hits like "Don\'t Start Now," "Physical," and "Levitating", cementing her status as a defining pop visionary of her generation.',
    'Radical Optimism': 'Radical Optimism is the third studio album by English singer Dua Lipa. Produced largely with Tame Impala\'s Kevin Parker and Danny L Harle, the 11-track record blends psychedelic-inflected dance-pop, Britpop elements, and disco vibes, drawing inspiration from the concept of navigating life\'s chaos with grace.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Early Career',
    'Dua Lipa',
    'Future Nostalgia',
    'Radical Optimism',
    'DL4'
  ],

  // the standard tracker key — sheets prefix song names with these emojis
  TAG_MAP: {
    '⭐': 'Best Of', '⭐️': 'Best Of',
    '✨': 'Special',
    '🏆': 'Grails',
    '🥇': 'Wanted', '🏅': 'Wanted',
    '🗑️': 'Worst Of', '🗑': 'Worst Of',
    '🤖': 'AI',
  },
  TAG_TOOLTIP_MAP: {
    'Best Of': 'Some of the best leaks hosted on the tracker.',
    'Special': 'Standout songs that are not good enough to belong in Best Of, but still deserve to be highlighted.',
    'Grails': 'The most wanted songs that have not yet leaked in full.',
    'Wanted': 'Songs that are wanted, but not as wanted as Grails.',
    'Worst Of': 'Some of the worst leaks on the tracker.',
    'AI': 'Involves AI-generated content (e.g. an AI instrumental or AI artist).',
  },
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
