import type { ArtistConfig } from './types';

// Thundercat tracker. Data served from committed CSV snapshots under
// public/thundercatgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const thundercatgoldConfig: ArtistConfig = {
  slug: 'thundercatgold',
  SITE_NAME: 'THUNDERCATGOLD',
  SITE_DESCRIPTION: 'The Best Thundercat Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/thundercatgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'thundercatgold_',
  sheetCreator: '@madvilliany',

  HARDCODED_SHEET_ID: '1KN1eE89gaCsf8Lh_mnjxjfrz7HNQd7V833uxMPibZkU',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#c2410c',
  artistLabel: 'Thundercat',
  cardLetter: 'T',
  logoUrl: '',
  artistPhotoUrl: '/artists/thundercatgold.jpg',

  getArtistName() {
    return 'Thundercat';
  },

  CUSTOM_IMAGES: {
    'Apocalypse': '/thundercatgold/eras/apocalypse.jpg',
    'The Beyond / Where the Giants Roam': '/thundercatgold/eras/the-beyond-where-the-giants-roam.png',
    'Drunk': '/thundercatgold/eras/drunk.jpg',
    'It Is What It Is': '/thundercatgold/eras/it-is-what-it-is.jpg',
    'Ongoing': '/thundercatgold/eras/ongoing.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Apocalypse': '07/??/2013',
    'The Beyond / Where the Giants Roam': '06/22/2015',
    'Drunk': '02/24/2017',
    'It Is What It Is': '??/??/????',
    'Ongoing': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Apocalypse': 'Apocalypse is the second studio album by American musician Thundercat. It was released in July 2013 under the label Brainfeeder.',
    'The Beyond / Where the Giants Roam': 'The Beyond / Where the Giants Roam is an EP by American musician Thundercat. It was released on June 22, 2015 via Brainfeeder. Most stuff here is from TPAB',
    'Drunk': 'Drunk is the third studio album by American musician Thundercat, released on February 24, 2017, by Brainfeeder. It features guest appearances from Kenny Loggins, Michael McDonald, Kendrick Lamar, Wiz Khalifa, Mac Miller, and Pharrell. It was released nearly four years after his previous studio album, Apocalypse.',
    'It Is What It Is': 'It Is What It Is is the fourth studio album by American musician Thundercat, released through Brainfeeder on April 3, 2020',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Apocalypse',
    'The Beyond / Where the Giants Roam',
    'Drunk',
    'It Is What It Is',
    'Ongoing',
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
  hasReleasedTab: false, // the sheet has no Released tab
};
