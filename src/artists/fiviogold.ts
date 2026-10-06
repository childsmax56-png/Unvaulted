import type { ArtistConfig } from './types';

// Fivio Foreign tracker. Data served from committed CSV snapshots under
// public/fiviogold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const fiviogoldConfig: ArtistConfig = {
  slug: 'fiviogold',
  SITE_NAME: 'FIVIOGOLD',
  SITE_DESCRIPTION: 'The Best Fivio Foreign Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/fiviogold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'fiviogold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1K8WDS6pL7uOPvf7j78Om5kO1k0-h-beqMZaXpMAUy74',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#4f46e5',
  artistLabel: 'Fivio Foreign',
  cardLetter: 'F',
  logoUrl: '',
  artistPhotoUrl: '/artists/fiviogold.jpg',

  getArtistName() {
    return 'Fivio Foreign';
  },

  CUSTOM_IMAGES: {
    'Before Pain and Love': '/fiviogold/eras/before-pain-and-love.jpg',
    'Pain and Love': '/fiviogold/eras/pain-and-love.jpg',
    '800 B.C.': '/fiviogold/eras/800-b-c.jpg',
    'B.I.B.L.E.': '/fiviogold/eras/b-i-b-l-e.png',
    'Collaboration with DJ Drama': '/fiviogold/eras/collaboration-with-dj-drama.jpg',
    'Without Warning': '/fiviogold/eras/without-warning.jpg',
    'Pain & Love 2': '/fiviogold/eras/pain-love-2.jpg',
    'Still Standing': '/fiviogold/eras/still-standing.jpg',
    'Ongoing': '/fiviogold/eras/ongoing.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Before Pain and Love': '??/??/????',
    'Pain and Love': '06/05/2019',
    '800 B.C.': '04/24/2020',
    'B.I.B.L.E.': '07/15/2022',
    'Collaboration with DJ Drama': '??/??/????',
    'Without Warning': '05/31/2023',
    'Pain & Love 2': '02/09/2024',
    'Still Standing': '03/27/2026',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Before Pain and Love': 'In 2011, Maxie Lee Ryles III began his rap career under the moniker "Lite Fivio", laying his foundation with early music videos like "Boss" and "I Does Me". Throughout 2012, he continued to develop his style by dropping freestyles over popular industry beats such as "Crew Love" and "Wild Boy". This early chapter of his career wrapped up when he teased a now-lost mixtape titled "Welcome to the Lite House" with an official intro video, right before officially transitioning to his new name, Fivio Foreign, in 2013.',
    'Pain and Love': '"Pain and Love" is Fivio Foreign\'s debut commercial EP, originally released on June 5, 2019. The project spawned the single "Big Drip," which became his breakout hit and propelled him to international prominence in the Brooklyn drill scene. This viral success eventually led to his major label signing with Columbia and RichFish Records later that same year.',
    '800 B.C.': 'Serving as his major-label debut under RichFish and Columbia Records, 800 B.C. (Before Corona) was officially released on April 24, 2020. This 8-track EP solidified his position in the mainstream drill scene, featuring the viral single \'Wetty,\' the official \'Big Drip\' remix with Lil Baby and Quavo, and collaborations with Meek Mill and Lil Tjay.',
    'B.I.B.L.E.': 'B.I.B.L.E. (Basic Instructions Before Leaving Earth) is Fivio Foreign\'s debut studio album, officially released on April 8, 2022. The era was heavily catalyzed by his standout feature on Kanye West\'s "Off The Grid" the previous year, which led directly to West serving as the project\'s executive producer. The album features 17 tracks and a star-studded guest list including A$AP Rocky, Quavo, Polo G, Lil Tjay, and Lil Yachty, and spawned hit singles like \'City of Gods\' and \'What\'s My Name\'.',
    'Collaboration with DJ Drama': 'The foundation for this unreleased Gangsta Grillz project was first established on January 24, 2023, when Fivio Foreign tweeted, \'DJ Drama doin my Mixtape tho 🔥\'. This initial announcement generated significant press coverage across hip-hop media outlets and was followed by a formal confirmation slated for an April 2023 release. However, the project failed to meet its target window. Following a delay announced in May 2023, the collaboration was shelved indefinitely as Fivio pivoted to his independent Without Warning EP. The Gangsta Grillz recording sessions remain largely undocumented.',
    'Without Warning': 'Released exclusively on YouTube and SoundCloud on May 31, 2023, Without Warning is an 8-track independent mixtape that Fivio dropped after his collaborative project with DJ Drama was shelved. Deliberately avoiding commercial platforms, the release is most notable for the track \'Concussion\' featuring Kanye West. Despite the high-profile feature, the song drew heavy criticism from fans who felt West\'s contribution was an unpolished, mumble-heavy reference track rather than a finished verse.',
    'Pain & Love 2': 'Serving as a direct continuation of his 2019 debut, Pain & Love 2 was officially released on February 9, 2024. The project blends his original drill style with mainstream polish and highlights his industry reach, featuring a massive collaborative lineup of Meek Mill, Lil Tjay, Swae Lee, Popcaan, Vory, Sheff G, Rowdy Rebel, and 41.',
    'Still Standing': 'Still Standing is a 9-track album officially released on March 27, 2026. The project serves as Fivio\'s musical return following a tumultuous 2025, where an early-year arrest in New Jersey resulted in months of jail time and a guilty plea for terroristic threats. He channeled these real-life challenges into the album\'s defiant tone, blending reflective tracks with nostalgic moments like \'Big Drip 2.0\' and guest appearances from drill contemporaries Polo G and Lil Tjay.',
    'Ongoing': 'On July 31, 2026, Fivio dropped \'Chasin\', launching his Gospel Drill chapter. After a live choir performance at the Times Square Red Steps on August 16, he previewed a snippet with Dee-1 on Instagram and updated his bio to \'Gospel Album Mode\' ahead of the September 11 release of \'Soldier\'. Interviews confirmed a total shift away from secular drill, tracking a full album for late 2026.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Before Pain and Love',
    'Pain and Love',
    '800 B.C.',
    'B.I.B.L.E.',
    'Collaboration with DJ Drama',
    'Without Warning',
    'Pain & Love 2',
    'Still Standing',
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
