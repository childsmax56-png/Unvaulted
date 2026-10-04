import type { ArtistConfig } from './types';

export const sosagoldConfig: ArtistConfig = {
  slug: 'sosagold',
  SITE_NAME: 'SOSAGOLD',
  SITE_DESCRIPTION: 'The Best Chief Keef Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/sosagold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'sosagold_',
  HARDCODED_SHEET_ID: '1oDE9gTnEG7ufPQIOMjLTegfI47qtgNCxngmxxHZL4qA',
  HARDCODED_SHEET_GID: '1792554832',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',
  accentColor: '#0ea5e9',
  artistLabel: 'Chief Keef',
  sheetCreator: 'Swaggely, GloTheActivist, Glanesky, Rojas, ej, Cortez, 1017kev',
  cardLetter: 'SOSA',
  logoUrl: '/logos/sosagold.png',
  artistPhotoUrl: '/artists/chiefkeef-v2.jpg',

  getArtistName() {
    return 'Chief Keef';
  },

  CUSTOM_IMAGES: {
    'Wiiic City': '/sosagold/eras/wiiic-city.jpg',
    'Drill': '/sosagold/eras/drill.jpg',
    'Finally Rich': '/sosagold/eras/finally-rich.jpg',
    'Lean': '/sosagold/eras/lean.jpg',
    'Rehab': '/sosagold/eras/rehab.jpg',
    'Xanax': '/sosagold/eras/xanax.jpg',
    'Cappin': '/sosagold/eras/cappin.jpg',
    'Turbo': '/sosagold/eras/turbo.jpg',
    'Glory University': '/sosagold/eras/glory-university.jpg',
    'Underwater': '/sosagold/eras/underwater.jpg',
    'Almighty So 2 [V1]': '/sosagold/eras/almighty-so-2.jpg',
    '4EB': '/sosagold/eras/4eb.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Wiiic City': '??/??/????',
    'Drill': '03/08/2011',
    'Finally Rich': '01/12/2012',
    'Lean': '12/29/2012',
    'Rehab': '11/19/2013',
    'Xanax': '02/13/2014',
    'Cappin': '12/28/2014',
    'Turbo': '07/18/2016',
    'Glory University': '01/03/2018',
    'Underwater': '09/04/2018',
    'Almighty So 2 [V1]': '04/07/2019',
    '4NEM': '??/??/????',
    'Almighty So 2 [V2]': '??/??/????',
    '4EB': '06/16/2020',
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},
  ALBUM_ORDER: [
    'Wiiic City', 'Drill', 'Finally Rich', 'Lean', 'Rehab', 'Xanax', 'Cappin', 'Turbo',
    'Glory University', 'Underwater', 'Almighty So 2 [V1]', '4NEM', 'Almighty So 2 [V2]', '4EB',
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},

  hasArtTab: false,
  hasVideosTab: true,
  hasStemsTab: false,
  hasMiscTab: true,
  miscLabel: 'MISC + STEMS',
  hasSubAlbumsTab: false,
};
