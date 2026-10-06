import type { ArtistConfig } from './types';

// Dax tracker. Data served from committed CSV snapshots under
// public/daxgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const daxgoldConfig: ArtistConfig = {
  slug: 'daxgold',
  SITE_NAME: 'DAXGOLD',
  SITE_DESCRIPTION: 'The Best Dax Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/daxgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'daxgold_',
  sheetCreator: 'iaon',
  // Private — off the landing grid, feed, pickers and search; reachable by URL only.
  hidden: true,

  HARDCODED_SHEET_ID: '1t1IuCgKrx3QjCt9CLrcu3FqA32qGAF8TeQjhCQHO4AY',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#dc2626',
  artistLabel: 'Dax',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/daxgold.jpg',

  getArtistName() {
    return 'Dax';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Daniel Dax': '07/13/2017',
    '2pac Reincarnation Vol 2: By Dax': '01/18/2018',
    'It\'s Different Now': '08/22/2018',
    'I\'ll Say It For You': '03/13/2020',
    'Pain Paints Paintings': '10/15/2021',
    'What is life?': '08/18/2023',
    'From A Man\'s Perspective': '12/06/2024',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'I\'ll Say It For You': 'I’ll Say It For You is Dax’s second EP. The EP features 2 pre released songs “Dear God” and “Book of Revelations”. The EP goes through topics such as depression, suicide, religion, love, and heartbreak. The most viral song on the album is Dear God which has more than 30 million views on YouTube and almost 35 million streams on Spotify. Dax has always been known to make songs about heartbreak and religion, so this project was nothing new to his normal style, but was still good nonetheless.',
    'Pain Paints Paintings': 'Pain Paints Paintings is Dax’s debut studio album, released on October 15, 2021 through Living Legends Entertainment. It serves as a follow-up to his 2020 EP, I’ll Say It For You. Consisting of 16 tracks, the album is solely produced by fellow producer, LexNour Beats, as well as additional production from Pendo46, Raspo, and Trademark. The album also includes a wide variety guest verses from Clever, Nasty C, Tom MacDonald, Yelawolf, Lecrae, and Snow Tha Product. In August of 2021, Dax announced on his YouTube channel, teasing his fans if he should drop his debut studio album: "LIKE if I should drop my 1st Album…" He then followed up the post with a caption reading: "Been working on something that’s going to make a HUGE impact. A body of work that you’ll be able to carry through out life. Not about materialistic things that don’t come with us when it’s all over but about real life things we can all relate to. What y’all think? I’ve been scared to do this. Dropping and album independently is tough but I think I owed it to the real ones". On September 17, 2021, Dax released the lead single to the album, “Propaganda,” featuring the controversial rapper Tom MacDonald. On October 6, 2021, Dax released the second single to the album, “40 Days 40 Nights,” featuring Nasty C. Then on October 11, five days after the release of the second single, Dax announced on his YouTube page that the album was done. Two days later, Dax revealed the album’s title, cover art, and an October 14 release date. The artwork for the album was done by Jerell Stanley. A day later, Dax revealed the album’s features, as well as the official tracklist of the album.',
    'What is life?': 'What is life? is Dax’s first major release with Columbia Records and his third EP overall, following up his October 2021 album, Pain Paints Paintings. Prior to the EP’s release, in September 2022, Dax earned himself a record deal with Columbia after keeping his promise on signing to a major label after reaching his like goal on the song “The Next Rap God 2.” Since then, Dax released three singles for the EP: “Dear Alcohol,” “To Be A Man,” and “God’s Eyes,” all were released in through the span of March 2022 to July 2023. In typical Dax fashion, on August 14, 2023, Dax took to his YouTube page teasing his fans if they wanted a new project from him released on the same week. On August 16, 2023, Dax took to Instagram to reveal the EP’s official title and a new video would be droping the night of its release: "My new Album/EP is called “What is life?” It and a new video drops Friday… #whatislife". The night before the EP’s release on August 17, Dax took to social media to reveal the EP’s cover art and tracklist. Like with Pain Paints Paintings, LexNour Beats provides sole production throughout the entire project.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Daniel Dax',
    '2pac Reincarnation Vol 2: By Dax',
    'It\'s Different Now',
    'I\'ll Say It For You',
    'Pain Paints Paintings',
    'What is life?',
    'From A Man\'s Perspective',
    'Ongoing'
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
