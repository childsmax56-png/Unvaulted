import type { ArtistConfig } from './types';

// Nas tracker. Rebuilt on a new, more complete Google Sheet (replacing the old
// troabroa/yeezus528 sheet, which only had Unreleased + Tracklists) — data is
// live-synced from the new sheet via SHEET_SOURCES in functions/api/[artist]/_sheets.ts,
// with committed CSV snapshots under public/nasgold/data/*.csv as a fallback.
// An era only appears in the Music grid if its name is a key in ALBUM_RELEASE_DATES.
export const nasgoldConfig: ArtistConfig = {
  slug: 'nasgold',
  SITE_NAME: 'NASGOLD',
  SITE_DESCRIPTION: 'The Best Nas Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/nasgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'nasgold_',

  sheetUrl: 'https://docs.google.com/spreadsheets/d/1-UZb9y-GQB5v3sysdUlYBxfUKDu58_Cw-TqUd8-v4U4/edit',

  HARDCODED_SHEET_ID: '',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#991b1b',
  artistLabel: 'Nas',
  sheetCreator: 'T.E.A.T.I., iaon, mel0njuice',
  cardLetter: 'N',
  logoUrl: '',
  artistPhotoUrl: '/artists/nasgold.jpg',

  getArtistName() {
    return 'Nas';
  },

  CUSTOM_IMAGES: {
    'Before Illmatic':                              '/nasgold/eras/pre-matic.png',
    'Illmatic':                                     '/nasgold/eras/illmatic.jpg',
    'It Was Written':                                '/nasgold/eras/it-was-written.jpg',
    'The Album':                                     '/nasgold/eras/the-album.jpg',
    'I Am...':                                       '/nasgold/eras/i-am.jpg',
    'Nastradamus':                                   '/nasgold/eras/nastradamus.jpg',
    'Stillmatic':                                    '/nasgold/eras/stillmatic.jpg',
    "God's Son":                                     '/nasgold/eras/gods-son.jpg',
    "Street's Disciple":                             '/nasgold/eras/streets-disciple.jpg',
    'Hip-Hop Is Dead':                               '/nasgold/eras/hip-hop-is-dead.jpg',
    'Nas':                                           '/nasgold/eras/nas-untitled.jpg',
    'Distant Relatives':                             '/nasgold/eras/distant-relatives.jpg',
    'Life Is Good':                                  '/nasgold/eras/life-is-good.jpg',
    'NASIR':                                         '/nasgold/eras/nasir.jpg',
    "King's Disease":                                '/nasgold/eras/kings-disease.jpg',
    "King's Disease II":                             '/nasgold/eras/kings-disease-ii.png',
    'Light-Years':                                   '/nasgold/eras/light-years.png',
    // Combined era used by the Unreleased tab's own header banner for these three.
    "King's Disease III / Magic 2 / Magic 3":        '/nasgold/eras/kings-disease-iii.png',
    // The Released tab tracks these as four separate albums instead.
    'Magic':                                         '/nasgold/eras/magic.jpg',
    "King's Disease III":                            '/nasgold/eras/kings-disease-iii.png',
    'Magic 2':                                       '/nasgold/eras/magic-2.png',
    'Magic 3':                                       '/nasgold/eras/magic-3.jpg',
    // Released-tab-only compilation albums (not in ALBUM_RELEASE_DATES/the Music grid,
    // but still shown as their own group on the Released tab, so they need covers too).
    'The Lost Tapes':                                '/nasgold/eras/the-lost-tapes.jpg',
    'The Lost Tapes 2':                               '/nasgold/eras/the-lost-tapes-2.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Before Illmatic': '??/??/????',
    'Illmatic': '??/??/????',
    'It Was Written': '??/??/????',
    'The Album': '??/??/????',
    'I Am...': '??/??/????',
    'Nastradamus': '??/??/????',
    'Stillmatic': '??/??/????',
    "God's Son": '??/??/????',
    "Street's Disciple": '??/??/????',
    'NASDAQ: Dow Jones': '??/??/????',
    'Hip-Hop Is Dead': '??/??/????',
    'Nas': '??/??/????',
    'Distant Relatives': '??/??/????',
    'Life Is Good': '??/??/????',
    'Hiatus Era': '??/??/????',
    'NASIR': '??/??/????',
    "King's Disease": '??/??/????',
    "King's Disease II": '??/??/????',
    "King's Disease III / Magic 2 / Magic 3": '??/??/????',
    'Light-Years': '??/??/????',
    'LP18': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  // The Unreleased tab's song rows use the short form "KD III / Magic 2 / Magic 3",
  // while its own header banner (and ALBUM_RELEASE_DATES/CUSTOM_IMAGES above) use the
  // full "King's Disease III / Magic 2 / Magic 3" — map them together so those songs
  // land in one era instead of a second, near-empty duplicate.
  ERA_MAPPINGS: {
    'KD III / Magic 2 / Magic 3': "King's Disease III / Magic 2 / Magic 3",
  },

  ALBUM_ORDER: [
    'Before Illmatic',
    'Illmatic',
    'It Was Written',
    'The Album',
    'I Am...',
    'Nastradamus',
    'Stillmatic',
    "God's Son",
    "Street's Disciple",
    'NASDAQ: Dow Jones',
    'Hip-Hop Is Dead',
    'Nas',
    'Distant Relatives',
    'Life Is Good',
    'Hiatus Era',
    'NASIR',
    "King's Disease",
    "King's Disease II",
    "King's Disease III / Magic 2 / Magic 3",
    'Light-Years',
    'LP18',
    'Unknown'
  ],

  // Matches the sheet's own "Key" tab exactly (⭐/✨/🏆/🥇 are all defined there;
  // 🗑️ isn't documented in the Key but is used on songs the same way the rest of the
  // site's trackers use it). Without this, these emoji stay embedded in the song
  // name instead of being pulled out into a proper "Best Of"/"Grails"/etc. tag.
  TAG_MAP: {
    '⭐': 'Best Of',
    '✨': 'Special',
    '🏆': 'Grails',
    '🥇': 'Wanted',
    '🗑️': 'Worst Of', '🗑': 'Worst Of',
  },
  TAG_TOOLTIP_MAP: {
    'Best Of': 'Some of the best leaks hosted on the tracker.',
    'Special': 'Recommended/suggested/special songs that are not good enough to belong in Best Of, but still deserve to be highlighted in some sort of way.',
    'Grails': 'The most wanted songs that have not yet leaked in full.',
    'Wanted': 'Songs that are wanted, but not as wanted as Grails.',
    'Worst Of': 'Some of the worst leaks on the tracker.',
  },
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasGroupbuysTab: true,
};
