import type { ArtistConfig } from './types';

// DMX tracker. Data served from committed CSV snapshots under
// public/dmxgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const dmxgoldConfig: ArtistConfig = {
  slug: 'dmxgold',
  SITE_NAME: 'DMXGOLD',
  SITE_DESCRIPTION: 'The Best DMX Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/dmxgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'dmxgold_',
  sheetCreator: 'Gypsy, TEATI Team, Bruh, HighSpeedChase/Shadyfan, SKITTLES, B4CON',

  HARDCODED_SHEET_ID: '101y0kCIzwGoT0YmGHIchehUpO7tzAdjXSZZVRrEobOg',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#7f1d1d',
  artistLabel: 'DMX',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/dmxgold.jpg',

  getArtistName() {
    return 'DMX';
  },

  CUSTOM_IMAGES: {
    'Pre-Fame': '/dmxgold/eras/pre-fame.png',
    'It\'s Dark And Hell Is Hot': '/dmxgold/eras/it-s-dark-and-hell-is-hot.jpg',
    'Flesh Of My Flesh, Blood Of My Blood': '/dmxgold/eras/flesh-of-my-flesh-blood-of-my-blood.png',
    '...And Then There Was X': '/dmxgold/eras/and-then-there-was-x.jpg',
    'The Great Depression': '/dmxgold/eras/the-great-depression.jpg',
    'Cradle 2 The Grave': '/dmxgold/eras/cradle-2-the-grave.jpg',
    'Grand Champ': '/dmxgold/eras/grand-champ.jpg',
    'Never Die Alone Soundtrack': '/dmxgold/eras/never-die-alone-soundtrack.png',
    'Year of the Dog... Again': '/dmxgold/eras/year-of-the-dog-again.jpg',
    'Walk With Me Now / You\'ll Fly With Me Later': '/dmxgold/eras/walk-with-me-now-you-ll-fly-with-me-later.jpg',
    'Undisputed': '/dmxgold/eras/undisputed.jpg',
    'Hiatus': '/dmxgold/eras/hiatus.jpg',
    'Exodus': '/dmxgold/eras/exodus.jpg',
    'DMX Features': '/dmxgold/eras/dmx-features.png',
    'Unknown Era': '/dmxgold/eras/unknown-era.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Pre-Fame': '??/??/????',
    'It\'s Dark And Hell Is Hot': '05/19/1998',
    'Flesh Of My Flesh, Blood Of My Blood': '12/22/1998',
    '...And Then There Was X': '12/21/1999',
    'The Great Depression': '10/23/2001',
    'Cradle 2 The Grave': '02/18/2003',
    'Grand Champ': '09/16/2003',
    'Never Die Alone Soundtrack': '??/??/????',
    'Year of the Dog... Again': '08/01/2006',
    'Walk With Me Now / You\'ll Fly With Me Later': '??/??/????',
    'Undisputed': '09/11/2012',
    'Hiatus': '??/??/????',
    'Exodus': '05/28/2021',
    'DMX Features': '??/??/????',
    'Unknown Era': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Pre-Fame': 'Everything made before DMX signed to Def Jam and started working on It\'s Dark and Hell Is Hot.',
    'It\'s Dark And Hell Is Hot': 'DMX\'s debut album, released on May 19, 1998. Recording sessions started even before X signed to Def Jam, but went into full force around August 1997. It was produced four singles: "Get at Me Dog" featuring Sheek Louch, "Stop Being Greedy", "Ruff Ryders\' Anthem" and "How\'s It Goin\' Down" featuring The LOX and Ma$e.',
    'Flesh Of My Flesh, Blood Of My Blood': 'DMX\'s sophomore album, recorded from September to late October 1998 and released on December 22, 1998. Originally supposed to release on December 15 of 1998, but was pushed back a few days. The album only produced 2 singles: "Slippin\'" and "No Love For Me" featuring Drag-On and Swizz Beatz. This album had a lot more Swizz Beatz production than the previous, and only one song was produced by Dame Grease.',
    '...And Then There Was X': 'DMX\'s third studio album, released on December 21, 1999. Recording sessions began in August 1999. The album produced 3 singles: "What\'s My Name", "Party Up (Up In Here)" and "What These Bitches Want" featuring Sisqo.',
    'The Great Depression': 'DMX started working on this album in late 2000.',
    'Cradle 2 The Grave': 'The movie began filming in March 2002 and was finished by April 2002.',
    'Grand Champ': 'DMX started working on this album in 2002.',
    'Never Die Alone Soundtrack': 'The Never Die Alone soundtrack was meant to be a soundtrack for the movie of the same name, but it got cancelled due to X\'s bad relationship with Def Jam. The soundtrack reportedly also featured the Obie Trice song "Bad Bitch".',
    'Year of the Dog... Again': 'DMX started working on this album in 2005. During this time DMX dropped a live album The Smoke Out Festival Presents DMX (2006)',
    'Walk With Me Now / You\'ll Fly With Me Later': 'Walk With Me Now and Fly With Me Later are 2 albums DMX was working on 2006-2011. Some tracks ended up releasing on future projects such as Undisputed. During this time DMX Dropped The Definition of X: The Pick of the Litter (2007), Playlist Your Way (2009), his unofficial mixtape called Mixtape (2010), The Best of DMX (2010), Greatest Hits With a Twist (2011)',
    'Undisputed': 'DMX started working on this album in Summer 2011 after scrapping WWMNAYFWML. During this time DMX dropped The Weigh In (2012) and Icon (2012) .',
    'Hiatus': 'During this time DMX was working on a lot of stuff and a lot of unreleased albums. Dog Eats Rabbit (2017) & Redemption of the Beast (2015) were unofficially released during this time. Attached photo is a mugshot from 2013.',
    'Exodus': 'DMX started working on this album before his death but ended up getting released 1 month after his death as a posthomous release, the album got retitled after his passing. During this time these albums dropped, DMX: The Legacy (2020), X Is Coming (2020), DMX: The Ruff Ryder (2021), A Dog’s Prayers (2021), these 2 dropped the same day he passed.',
    'DMX Features': 'This album was announced in May 2025 to release in Summer 2025, since the album has been delayed, there were other stuff dropping during this time, Exodus (Instrumentals & Acapellas) (2021), Let Us Pray: Chapter X (2024). Attached photo is not the album cover.',
    'Unknown Era': 'This era is for entries we don\'t know the year of them being made.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Pre-Fame',
    'It\'s Dark And Hell Is Hot',
    'Flesh Of My Flesh, Blood Of My Blood',
    '...And Then There Was X',
    'The Great Depression',
    'Cradle 2 The Grave',
    'Grand Champ',
    'Never Die Alone Soundtrack',
    'Year of the Dog... Again',
    'Walk With Me Now / You\'ll Fly With Me Later',
    'Undisputed',
    'Hiatus',
    'Exodus',
    'DMX Features',
    'Unknown Era'
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
