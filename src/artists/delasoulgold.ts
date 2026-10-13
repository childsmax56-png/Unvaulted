import type { ArtistConfig } from './types';

// De La Soul tracker. Data served from committed CSV snapshots under
// public/delasoulgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const delasoulgoldConfig: ArtistConfig = {
  slug: 'delasoulgold',
  SITE_NAME: 'DELASOULGOLD',
  SITE_DESCRIPTION: 'The Best De La Soul Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/delasoulgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'delasoulgold_',
  sheetCreator: 'The Invisible Man II & Mel0njuice',

  HARDCODED_SHEET_ID: '19KA4hq1j8sVhTEt4gqWWn6Potw9N_IGGJ2bwgZeVYHI',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#facc15',
  artistLabel: 'De La Soul',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/delasoulgold.jpg',

  getArtistName() {
    return 'De La Soul';
  },

  CUSTOM_IMAGES: {
    '3 FEET HIGH AND RISING': '/delasoulgold/eras/3-feet-high-and-rising.jpg',
    'De La Soul... is dead': '/delasoulgold/eras/de-la-soul-is-dead.jpg',
    'Buhloone Mindstate': '/delasoulgold/eras/buhloone-mindstate.jpg',
    'Stakes is High': '/delasoulgold/eras/stakes-is-high.jpg',
    'AOI: Mosaic Thump': '/delasoulgold/eras/aoi-mosaic-thump.jpg',
    'AOI: Bionix': '/delasoulgold/eras/aoi-bionix.png',
    'AOI: 3 [V1]': '/delasoulgold/eras/aoi-3-v1.png',
    'THE GRIND DATE': '/delasoulgold/eras/the-grind-date.png',
    'You\'re Welcome!': '/delasoulgold/eras/you-re-welcome.jpg',
    'And the Anonymous Nobody...': '/delasoulgold/eras/and-the-anonymous-nobody.jpg',
    'Cabin In The Sky': '/delasoulgold/eras/cabin-in-the-sky.png',
    '4 Exits Only': '/delasoulgold/eras/4-exits-only.png',
  },

  ALBUM_RELEASE_DATES: {
    '3 FEET HIGH AND RISING': '02/06/1989',
    'De La Soul... is dead': '05/14/1991',
    'Buhloone Mindstate': '09/21/1993',
    'Stakes is High': '07/14/1996',
    'AOI: Mosaic Thump': '08/08/2000',
    'AOI: Bionix': '12/04/2001',
    'AOI: 3 [V1]': '??/??/????',
    'THE GRIND DATE': '10/05/2004',
    'You\'re Welcome!': '??/??/????',
    'Are You In?': '??/??/????',
    'And the Anonymous Nobody...': '08/29/2016',
    'Cabin In The Sky': '11/21/2025',
    'AOI: 3 [V2]': '??/??/????',
    '4 Exits Only': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'AOI: 3 [V1]': 'As anyone may guess, a third installment of the Art Official Intelligence series was in the plans immediately after the release of Bionix, despite its mixed reception. However, due to Tommy Boy Records declining AOI 3\'s material for being too "inacessible", as well as the growing instability of the label following its split from Warner Bros. Records, De La Soul split from the label, which would lead to AOI 3 being scrapped and reworked into the Grind Date. The songs "Much More" and "Shoomp" are known to have been intended for AOI 3, but otherwise little is known about the project.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    '3 FEET HIGH AND RISING',
    'De La Soul... is dead',
    'Buhloone Mindstate',
    'Stakes is High',
    'AOI: Mosaic Thump',
    'AOI: Bionix',
    'AOI: 3 [V1]',
    'THE GRIND DATE',
    'You\'re Welcome!',
    'Are You In?',
    'And the Anonymous Nobody...',
    'Cabin In The Sky',
    'AOI: 3 [V2]',
    '4 Exits Only',
    'Unknown'
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
