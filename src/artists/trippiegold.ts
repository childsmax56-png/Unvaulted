import type { ArtistConfig } from './types';

// Trippie Redd tracker. Data served from committed CSV snapshots under
// public/trippiegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const trippiegoldConfig: ArtistConfig = {
  slug: 'trippiegold',
  SITE_NAME: 'TRIPPIEGOLD',
  SITE_DESCRIPTION: 'The Best Trippie Redd Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/trippiegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'trippiegold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1hZdGFBZmukWGH4IlnH0NJvphwEct2XEMJT_moTFhTvc/edit?gid=1555572772#1555572772',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#e11d48',
  artistLabel: 'Trippie Redd',
  sheetCreator: 'raiden, snakeyyy',
  cardLetter: 'T',
  logoUrl: '',
  artistPhotoUrl: '/artists/trippiegold.jpg',

  getArtistName() {
    return 'Trippie Redd';
  },

  CUSTOM_IMAGES: {
    'Awakening My InnerBeast':         '/trippiegold/eras/awakening-my-innerbeast.png',
    'Beast Mode ++++':                 '/trippiegold/eras/beast-mode.png',
    'Rock The World Trippie (xxxxx)':  '/trippiegold/eras/rock-the-world-trippie-xxxxx.png',
    'White Room Project':              '/trippiegold/eras/white-room-project.png',
    'A Love Letter To You':            '/trippiegold/eras/a-love-letter-to-you.png',
    'A Love Letter To You 2':          '/trippiegold/eras/a-love-letter-to-you-2.png',
    "LIFE'S A TRIP":                   '/trippiegold/eras/lifes-a-trip.png',
    'TrippieBoat':                     '/trippiegold/eras/trippieboat.png',
    'A Love Letter To You 3':          '/trippiegold/eras/a-love-letter-to-you-3.png',
    'WE DONT DIAL 911':                '/trippiegold/eras/we-dont-dial-911.png',
    '!':                               '/trippiegold/eras/exclamation.png',
    'A Love Letter To You 4':          '/trippiegold/eras/a-love-letter-to-you-4.png',
    'A Love Letter To You 4 (Deluxe)': '/trippiegold/eras/a-love-letter-to-you-4-deluxe.png',
    'Pegasus':                         '/trippiegold/eras/pegasus.png',
    'Trip At Knight [V1]':             '/trippiegold/eras/trip-at-knight-v1.png',
    'Trip At Knight [V2]':             '/trippiegold/eras/trip-at-knight-v2.png',
    'A Love Letter To You 5 [V1]':     '/trippiegold/eras/a-love-letter-to-you-5-v1.png',
    'MANSION MUSIK [V1]':              '/trippiegold/eras/mansion-musik-v1.jpg',
    'MANSION MUSIK [V2]':              '/trippiegold/eras/mansion-musik-v2.png',
    'A Love Letter To You 5 [V2]':     '/trippiegold/eras/a-love-letter-to-you-5-v2.png',
    'Saint Michael':                   '/trippiegold/eras/saint-michael.png',
    "LIFE'S A TRIP 2":                 '/trippiegold/eras/lifes-a-trip-2.jpg',
    'LIVE LOVE LAUGH DIE':             '/trippiegold/eras/live-love-laugh-die.jpg',
    'NDA':                             '/trippiegold/eras/nda.png',
  },

  ALBUM_RELEASE_DATES: {
    'Awakening My InnerBeast': '??/??/????',
    'Beast Mode ++++': '??/??/????',
    'Rock The World Trippie (xxxxx)': '??/??/????',
    'White Room Project': '??/??/????',
    'A Love Letter To You': '??/??/????',
    'A Love Letter To You 2': '??/??/????',
    'LIFE\'S A TRIP': '??/??/????',
    'TrippieBoat': '??/??/????',
    'A Love Letter To You 3': '??/??/????',
    'WE DONT DIAL 911': '??/??/????',
    '!': '??/??/????',
    'A Love Letter To You 4': '??/??/????',
    'A Love Letter To You 4 (Deluxe)': '??/??/????',
    'Pegasus': '??/??/????',
    'Trip At Knight [V1]': '??/??/????',
    'Trip At Knight [V2]': '??/??/????',
    'A Love Letter To You 5 [V1]': '??/??/????',
    'MANSION MUSIK [V1]': '??/??/????',
    'MANSION MUSIK [V2]': '??/??/????',
    'A Love Letter To You 5 [V2]': '??/??/????',
    'Saint Michael': '??/??/????',
    'LIFE\'S A TRIP 2': '??/??/????',
    'LIVE LOVE LAUGH DIE': '??/??/????',
    'NDA [V1]': '??/??/????',
    'NDA [V2]': '??/??/????',
    'NDA': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {
    '#NDA': 'NDA',
  },

  ALBUM_ORDER: [
    'Awakening My InnerBeast',
    'Beast Mode ++++',
    'Rock The World Trippie (xxxxx)',
    'White Room Project',
    'A Love Letter To You',
    'A Love Letter To You 2',
    'LIFE\'S A TRIP',
    'TrippieBoat',
    'A Love Letter To You 3',
    'WE DONT DIAL 911',
    '!',
    'A Love Letter To You 4',
    'A Love Letter To You 4 (Deluxe)',
    'Pegasus',
    'Trip At Knight [V1]',
    'Trip At Knight [V2]',
    'A Love Letter To You 5 [V1]',
    'MANSION MUSIK [V1]',
    'MANSION MUSIK [V2]',
    'A Love Letter To You 5 [V2]',
    'Saint Michael',
    'LIFE\'S A TRIP 2',
    'LIVE LOVE LAUGH DIE', 'NDA [V1]', 'NDA [V2]',
    'NDA'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasGroupbuysTab: true,
};
