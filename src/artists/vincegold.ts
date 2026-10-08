import type { ArtistConfig } from './types';

// Vince Staples tracker. Data served from committed CSV snapshots under
// public/vincegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const vincegoldConfig: ArtistConfig = {
  slug: 'vincegold',
  SITE_NAME: 'VINCEGOLD',
  SITE_DESCRIPTION: 'The Best Vince Staples Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/vincegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'vincegold_',
  sheetCreator: 'BigGuy87, Digital Hendryk, dylzzz, KILLRITE, maliceeee, owl',

  HARDCODED_SHEET_ID: '1_NjFkevi7tbhqAGHSfgaEsKrzRgvPePUeCLv0GG2GgU',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#0f766e',
  artistLabel: 'Vince Staples',
  cardLetter: 'V',
  logoUrl: '',
  artistPhotoUrl: '/artists/vincegold.jpg',

  getArtistName() {
    return 'Vince Staples';
  },

  CUSTOM_IMAGES: {
    'Before Shyne Coldchain Vol. 1': '/vincegold/eras/before-shyne-coldchain-vol-1.jpg',
    'Stolen Youth': '/vincegold/eras/stolen-youth.jpg',
    'Shyne Coldchain Vol. 2': '/vincegold/eras/shyne-coldchain-vol-2.jpg',
    'Summertime \'06': '/vincegold/eras/summertime-06.jpg',
    'Prima Donna': '/vincegold/eras/prima-donna.jpg',
    'Big Fish Theory': '/vincegold/eras/big-fish-theory.jpg',
    'FM!': '/vincegold/eras/fm.jpg',
    'Vince Staples': '/vincegold/eras/vince-staples.jpg',
    'Vince Staples x Pharrell Williams': '/vincegold/eras/vince-staples-x-pharrell-williams.jpg',
    'Vince Staples x The Alchemist': '/vincegold/eras/vince-staples-x-the-alchemist.png',
    'RAMONA PARK BROKE MY HEART': '/vincegold/eras/ramona-park-broke-my-heart.jpg',
    'Dark Times': '/vincegold/eras/dark-times.jpg',
    'Cry Baby': '/vincegold/eras/cry-baby.png',
  },

  ALBUM_RELEASE_DATES: {
    'Before Shyne Coldchain Vol. 1': '??/??/????',
    'Stolen Youth': '06/20/2013',
    'Shyne Coldchain Vol. 2': '03/13/2014',
    'Summertime \'06': '06/30/2015',
    'Prima Donna': '08/26/2016',
    'Big Fish Theory': '06/23/2017',
    'FM!': '11/02/2018',
    'Vince Staples': '07/09/2021',
    'Vince Staples x Pharrell Williams': '??/??/????',
    'Vince Staples x The Alchemist': '??/??/????',
    'RAMONA PARK BROKE MY HEART': '04/08/2022',
    'Dark Times': '05/24/2024',
    'Cry Baby': '06/05/2026'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Before Shyne Coldchain Vol. 1': 'Vincent Jamal Staples was born on July 2, 1993, in Compton, California. He is the youngest of four or five children, raised mainly by his mother, and his father being frequently incarcerated. Vince and his family didnt spend long in Compton, shortly after he was born, they moved to Long Beach. Staples stated Long Beach was a "getaway" / upgrade from Compton. When Vince\'s father was incarcerated again, they moved back to Compton, which he spent most of his primary school years. One thing important to note is that Vince\'s father is in a gang, which was common for many people in urban California. Vince grew up not noticing his parents had gang relations, and that they would violently fight very often. During his time in Compton, Vince also got involved in many gangs and was often getting into trouble. After getting into a serious gang-related event, Vince was sent to Atlanta for 6-7 months to "cool off," where he attended half of middle school in Fulton Country. When Vince returned to Compton, that\'s where his family met the family of Chuck Wun. Chuck and Dijon "LaVish" Samo introduced Vince to rapping, Chuck was Vince\'s first producer. Eventually, Chuck and Dijon drove Vince to Los Angeles, where he met upcoming figures such as Mike G, Syd, and Matt Martians at the Odd Future studio. From there on, Vince improved and got more exposure, appearing as features until his eventual debut mixtape, Shyne Coldchain Vol. 1.',
    'Stolen Youth': 'In 2012, Earl Sweatshirt returned from Samoa and reconnected with Vince. Earl introduced him to fellow American rapper Mac Miller. In June 2013, Miller (under the alias Larry Fisherman) and Staples released a mixtape titled Stolen Youth. The mixtape features guest appearances from Miller, Ab-Soul, Schoolboy Q, Da$H, Hardo, and Staples\'s Cutthroat Boyz co-member Joey Fatts.',
    'Shyne Coldchain Vol. 2': 'On March 13, 2014, he released his fourth mixtape, called Shyne Coldchain Vol. 2. The mixtape features the production from Earl Sweatshirt, Michael Uzowuru, Childish Major, No ID, Evidence, DJ Babu, and Scoop DeVille; as well as guest appearances from singer-songwriters Jhené Aiko and James Fauntleroy.',
    'Summertime \'06': 'Summertime ‘06 is the debut studio album by rapper Vince Staples, released on June 30, 2015, via ARTium Recordings, Blacksmith Records, and Def Jam Recordings. Spanning two discs and 20 tracks, the album dives deep into the reality of life in North Long Beach, painting a vivid portrait of the summer Vince turned 13—a season he’s described as the moment he lost his innocence.',
    'Prima Donna': 'Prima Donna is a bold and experimental EP by Vince Staples, released on August 26, 2016, through Def Jam Recordings and ARTium Recordings. Coming off the success of Summertime ‘06, Vince took a left turn with Prima Donna — a surreal, genre-bending project that blurs the lines between fame, identity, and mental health.',
    'Big Fish Theory': 'Big Fish Theory is the second studio album by Vince Staples, released on June 23, 2017, through Blacksmith Records and Def Jam Recordings. Bold, futuristic, and genre-defying, the album saw Vince step even further outside the bounds of traditional hip-hop, blending elements of electronic, techno, and UK grime with his razor-sharp lyricism and biting social commentary.',
    'FM!': 'FM! is a concept-driven, high-energy album by Vince Staples, released on November 2, 2018, via Def Jam and Blacksmith Records. Clocking in at just over 22 minutes, the project plays like a chaotic, rapid-fire day in the life, styled as a fictional broadcast from L.A.’s Big Boy’s Neighborhood radio show — complete with skits, shoutouts, and surprise interludes.',
    'Vince Staples': 'Vince Staples, the self-titled fourth studio album by the Long Beach rapper, dropped on July 9, 2021, via Motown and Blacksmith Records. Introspective, stripped-down, and deeply personal, the project marks a shift in tone, less about spectacle, more about self-reflection. Produced entirely by Kenny Beats, the album features minimalist, soulful instrumentals that give Vince space to open up like never before.',
    'Vince Staples x The Alchemist': 'An untitled collaborative EP produced by The Alchemist, the files we\'ll provide will have all custom artwork and tagging (the song names are original).',
    'RAMONA PARK BROKE MY HEART': 'Ramona Park Broke My Heart is the fifth studio album by Vince Staples, released on April 8, 2022, via Motown and Blacksmith Records. Named after the neighborhood in North Long Beach where Vince grew up, the album is both a love letter and a breakup note — to his hometown, his past, and the people and pain that shaped him.',
    'Dark Times': 'Dark Times is the eighth studio album by Long Beach rapper Vince Staples, released on May 24, 2024, through Blacksmith Records and Def Jam Recordings. This project marks his final release with Def Jam, concluding a significant chapter in his career. The album delves into themes of trauma, resilience, and introspection, offering a candid exploration of Staples\' experiences and emotional landscape.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Before Shyne Coldchain Vol. 1',
    'Stolen Youth',
    'Shyne Coldchain Vol. 2',
    'Summertime \'06',
    'Prima Donna',
    'Big Fish Theory',
    'FM!',
    'Vince Staples',
    'Vince Staples x Pharrell Williams',
    'Vince Staples x The Alchemist',
    'RAMONA PARK BROKE MY HEART',
    'Dark Times',
    'Cry Baby'
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
