import type { ArtistConfig } from './types';

// Death Grips tracker. Data served from committed CSV snapshots under
// public/deathgripsgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const deathgripsgoldConfig: ArtistConfig = {
  slug: 'deathgripsgold',
  SITE_NAME: 'DEATHGRIPSGOLD',
  SITE_DESCRIPTION: 'The Best Death Grips Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/deathgripsgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'deathgripsgold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1Eh-9UyWUtyEpi_ELEhq5pD41ivFJHuQcvz2wFR2ml9g',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#18181b',
  artistLabel: 'Death Grips',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/deathgripsgold.jpg',

  getArtistName() {
    return 'Death Grips';
  },

  CUSTOM_IMAGES: {
    'Death Grips': '/deathgripsgold/eras/death-grips.jpg',
    'Exmilitary': '/deathgripsgold/eras/exmilitary.png',
    'The Money Store': '/deathgripsgold/eras/the-money-store.jpg',
    'No Love Deep Web': '/deathgripsgold/eras/no-love-deep-web.jpg',
    'Government Plates': '/deathgripsgold/eras/government-plates.jpg',
    'Fashion Week': '/deathgripsgold/eras/fashion-week.jpg',
    'Jenny Death': '/deathgripsgold/eras/jenny-death.png',
    'Bottomless Pit': '/deathgripsgold/eras/bottomless-pit.png',
    'Steroids': '/deathgripsgold/eras/steroids.jpg',
    'Year of The Snitch': '/deathgripsgold/eras/year-of-the-snitch.jpg',
    'Ongoing': '/deathgripsgold/eras/ongoing.png',
  },

  ALBUM_RELEASE_DATES: {
    'Death Grips': '03/08/2011',
    'Exmilitary': '04/25/2011',
    'The Money Store': '04/24/2012',
    'No Love Deep Web': '10/01/2012',
    'Government Plates': '11/13/2013',
    'Fashion Week': '01/04/2015',
    'Jenny Death': '03/30/2015',
    'Bottomless Pit': '05/06/2016',
    'Steroids': '05/22/2017',
    'Year of The Snitch': '06/22/2018',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Death Grips': 'Death Grips is the debut self-titled EP from Death Grips. The EP consists of six tracks the later three of which were later renamed and re-released the following month on Exmilitary, on April 25, 2011, the EP was removed from thirdworlds.net, however, Full Moon and Face Melter remained available for a short time on thirdworlds.net. "Full Moon (Death Classic)" was released as the band\'s debut single on April 27, 2011, and is the only song from the EP still available on streaming.',
    'Exmilitary': 'Exmilitary is the first mixtape from Death Grips. released on April 25th, 2011, it features 13 songs, 3 of which were on their debut EP, which was released on March 8th, 2011. The second song on the album, “Guillotine”, became the one of most popular song for the band in its early years. The mixtape was released on streaming but was removed due to samples that were not cleared, but Guillotine was released as a single on streaming.',
    'The Money Store': 'The Money Store is the debut studio album from Death Grips. It is the follow-up to mixtape Exmilitary. The album was officially released on April 24, 2012, but had been leaked to YouTube on April 14. The Money Store was announced alongside the group\'s second album, No Love, which was later renamed to No Love Deep Web and released on October 1th, 2012.',
    'No Love Deep Web': 'No Love Deep Web, is the second studio album from Death Grips, it was recorded from May–August 2012 and released October 1, 2012, leaked by the band themselves after a dispute with their label over the release date label dropped them that November. It was promoted via an Alternate Reality Game from Aug 12–16, built around encrypted files hosted on Tor. Day 1 revealed the original planned release date (Oct 23) and an unmastered copy of The Money Store; Day 5 revealed an instrumental version of the same album.',
    'Government Plates': 'Government Plates is the third studio album by Death Grips. It was released on November 13, 2013, And every track had a music video. On May 10, 2013, it was announced that Zach Hill was working Goverment Plates while writing, directing, and scoring a film. On July 8, it was announced that Death Grips had launched their own label, Third Worlds. It was revealed the album would be released the following year. On August 21, "Birds" was released. On the song Birds, Robert Pattinson played a guitar riff.',
    'Fashion Week': 'Fashion Week is an instrumental album from Death Grips. It was released, on January 4, 2015, without any prior announcement. It was the band\'s first release after their supposed disbandment in 2014, and also the first release to not feature vocals from Ride. Fashion Week was described by the group as a "soundtrack." The song titles, spell out the phrase "JENNY DEATH WHEN".',
    'Jenny Death': 'Jenny Death is the second disc on The Powers That released on March 30th, 2015. It combines Death Grips\' pulse-pounding electronic production with uncharacteristically guitar-driven instrumentation. Before the album’s release on March 19, 2015, fan anticipation was palpable. The commotion was due to the release of Niggas On the Moon almost a year before, when the band claimed via Facebook that it was the first half of a double LP called The Powers That B.  During the interim between the two installments, Death Grips put out a completely instrumental album called Fashion Week, the track listing of which acrostically spelled out “JENNY DEATH WHEN.”  The phrase went on to become a mantra for frenzied devotees.',
    'Bottomless Pit': 'Bottomless Pit is the fifth studio album from Death Grips, released May 6, 2016. The band teased the title on October 21, 2015, with a video featuring 2013 footage of the late actress Karen Black reciting lines from a script Zach Hill wrote. A December 16 tweet, "it won\'t lit," was later revealed to be a lyric from "BB Poison." The cover and tracklist dropped March 18, followed by the release date announcement on April 19, along with a document containg the lyrics. The album leaked on SoundCloud on April 29, ahead of its official release.',
    'Steroids': 'Steroids (Crouching Tiger Hidden Gabber Megamix) is the third EP by Death Grips, released on May 22, 2017. The piece, a mix of 8 songs on a single track, was described by Stereogum as a "barrage of noise". The band announced the EP on Facebook, also announcing the development of Year of the Snitch. The post reads: "we\'re working on the new death grips album. but in the meantime, here\'s a new track/mix. it\'s 22 minutes."',
    'Year of The Snitch': 'Year of the Snitch is the sixth studio album, from Death Grips it was released June 22, 2018. The band announced they were working on a new album alongside Steroids\' release, revealing collaborators Lucas Abela, Andrew Adamson (film director), and Justin Chancellor. They teased the album with a black-and-white text image on March 22, shared the artwork on April 6, and revealed the tracklist on April 11 via a video showing track names sent by SMS.',
    'Ongoing': 'Death Grips is speculated to drop in 2026. Death Grips had been off the grid since 2023 on their socials; however, on their Instagram, this post in April 2025 showed that Stefan and Zach were still part of Death Grips and that Andy had been removed from the group. On November 5th 2025, Death Grips made a post that explicitly stated they were making a new album. The Writing and recording of our next album is underway. We’re looking forward to the new Death Grips record. -Stefan and Zach.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Death Grips',
    'Exmilitary',
    'The Money Store',
    'No Love Deep Web',
    'Government Plates',
    'Fashion Week',
    'Jenny Death',
    'Bottomless Pit',
    'Steroids',
    'Year of The Snitch',
    'Ongoing'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
  hasAlbumCopiesTab: true,
};
