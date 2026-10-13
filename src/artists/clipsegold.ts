import type { ArtistConfig } from './types';

// Clipse tracker. Data served from committed CSV snapshots under
// public/clipsegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const clipsegoldConfig: ArtistConfig = {
  slug: 'clipsegold',
  SITE_NAME: 'CLIPSEGOLD',
  SITE_DESCRIPTION: 'The Best Clipse Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/clipsegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'clipsegold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1XUtY5ris3U5R9sRBTOQdTxTNhvCbmjNAQbmLHGHTMGQ',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#a3a3a3',
  artistLabel: 'Clipse',
  cardLetter: 'C',
  logoUrl: '',
  artistPhotoUrl: '/artists/clipsegold.jpg',

  getArtistName() {
    return 'Clipse';
  },

  CUSTOM_IMAGES: {
    'Exclusive Audio Footage': '/clipsegold/eras/exclusive-audio-footage.jpg',
    'Lord Willin\'': '/clipsegold/eras/lord-willin.jpg',
    'Hell Hath No Fury': '/clipsegold/eras/hell-hath-no-fury.jpg',
    'Til the Casket Drops': '/clipsegold/eras/til-the-casket-drops.jpg',
    'Fear Of God': '/clipsegold/eras/fear-of-god.jpg',
    'Hear Ye Him': '/clipsegold/eras/hear-ye-him.jpg',
    'Fear Of God II: Let Us Pray': '/clipsegold/eras/fear-of-god-ii-let-us-pray.jpg',
    'My Name Is My Name': '/clipsegold/eras/my-name-is-my-name.png',
    'Wrath of Caine': '/clipsegold/eras/wrath-of-caine.jpg',
    'Darkest Before Dawn': '/clipsegold/eras/darkest-before-dawn.jpg',
    'DAYTONA': '/clipsegold/eras/daytona.jpg',
    'It\'s Almost Dry': '/clipsegold/eras/it-s-almost-dry.jpg',
    'Let God Sort \'Em Out': '/clipsegold/eras/let-god-sort-em-out.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'Exclusive Audio Footage': '??/??/????',
    'Lord Willin\'': '08/20/2002',
    'Hell Hath No Fury': '09/28/2006',
    'Til the Casket Drops': '12/08/2009',
    'Fear Of God': '03/21/2011',
    'Hear Ye Him': '08/18/2013',
    'Fear Of God II: Let Us Pray': '11/08/2011',
    'My Name Is My Name': '10/08/2013',
    'Wrath of Caine': '01/28/2013',
    'Darkest Before Dawn': '??/??/????',
    'DAYTONA': '05/25/2018',
    'It\'s Almost Dry': '04/22/2022',
    'Let God Sort \'Em Out': '07/11/2025',
    'PT5': '??/??/????',
    'M3': '??/??/????',
    'C5': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Exclusive Audio Footage': 'Clipse got together in 1994, rapping together in Chad\'s house in a song titled "Thief in the Night" with The Neptunes, alongside a few other songs. They secured a record deal with the Elektra label and began working on what would be their debut album, "Exclusive Audio Footage". Only one single was released for it, titled "The Funeral", which did not get many sales and the duo were dropped, later being signed to Artista Records thanks to Pharrell before being in a joint-venture with Star Trek Entertainment.',
    'Lord Willin\'': '"Lord Willin\'" is the debut album by Clipse, comprised of Terrar, later known as Pusha T, and Malice, released on August 20, 2002. Pharrell Williams signed the duo to Arista Records where they would work on another album that was actually going to be released, produced entirely by The Neptunes, but was shelved and later got signed to Star Trek Entertainment through a joint-venture. Their first single for the album, "Grindin\'", became highly successful and later on became the signature song for Clipse. The other singles, "When the Last Time" and "Ma, I Don\'t Love Her", gained similar success.',
    'Hell Hath No Fury': '"Hell Hath No Fury" is the second album by Clipse released on September 28, 2006 after major delays and recording sessions spanning 2003 to 2006. After a tour and the release of their debut, they began recording for the album in late 2003, but work was halted in 2004 when Arista Records dissolved into Jive Records. The release was also delayed throughout the rest of 2004 and most of 2005 with additional delays soon after when Clipse sued Jive Records, later being solved in May 2006. The tone of the album is much darker because "[Clipse] couldn\'t dare come out in the same mind frame as we did in Lord Willin\' - so now, [they] were mad, angry and pissed the fuck off."',
    'Til the Casket Drops': '"Til the Casket Drops" is the third album by Clipse released in December 8, 2009 and would be the final project before the duo took a hiatus to work on solo albums of their own. This time, the album would not just be produced by The Neptunes as they reached out to other producers like DJ Khalil, Chin Injeti, and Scan C & LV. In a 2021 interview, Pusha T said "I hate it. I hate it. And when a song comes on, like "I\'m Good," man, this was a little bit of a bop. Hate It."',
    'Fear Of God': '"Fear Of God" is the first mixtape made by Pusha T after splitting with the Clipse. Although he was featured on songs without Malice by his side, he fully established his solo career after featuring on Kanye West\'s 2010 album "My Beautiful Dark Twisted Fantasy" and signing with G.O.O.D. Music. The inspiration for "Fear Of God" came from the fact that people he worked with are now in prison and Malice was no longer by his side, also starting his own solo career. It was released on March 21, 2011.',
    'Hear Ye Him': '"Hear Ye Him" is the debut studio album by Malice, who changed his stage name to No Malice on March 6, 2012, released on August 18, 2013 after splitting with the Clipse. It\'s described as "Everything that is wrong in the world, including myself".',
    'Fear Of God II: Let Us Pray': '"Fear Of God II: Let Us Pray", also known as simply "Fear Of God 2" is the first EP by Pusha T and sequel to the mixtape, "Fear Of God", which released earlier in 2011. The inspirations from the first one still remained, but with this EP not only came re-releases of five of the "Fear Of God" tracks, but seven more brand new tracks. The EP was released on November 8, 2011.',
    'My Name Is My Name': '"My Name Is My Name" is the debut studio album by Pusha T, released on October 3, 2013. After the release of "Fear Of God II: Let Us Pray", Pusha T began work on his solo album, which was influenced by the 1997 film "The Devil\'s Advocate" while the title was likely inspired from a line by Marl Stanfield from the series "The Wire". The album was originally intended to release in 2012, but was pushed to 2013 due to the release of "Cruel Summer", a compilation album for G.O.O.D. Music.',
    'Wrath of Caine': '"Wrath of Caine" is the second mixtape released by Pusha T. Announced on November 11, 2012, the tape was described by Pusha to be him "catering to [his] core. It\'s all about just street hip hop, street music. It\'s just something that I like to do."  It was originally planned to release in late 2012, but it got pushed back to January 28, 2013.',
    'Darkest Before Dawn': '"King Push – Darkest Before Dawn: The Prelude" is the second studio album By Pusha T, released on  December 18, 2015. The album serves as a prelude to "DAYTONA", then titled "King Push", with the singles "Untouchable", "M.F.T.R." and "Crutches, Crosses, Caskets" were released as instant gratification tracks. A short film was made for this album as well, which was released on December 11, 2015 exclusively to TIDAL.',
    'DAYTONA': '"DAYTONA" is the third studio album by Pusha T, released on May 25, 2018 as the first album of the five bundled in the "Wyoming Sessions". The title was originally titled "King Push" before being changed to "Blowbama" or "Blobama" mid-way before Kanye West announced the official title being "DAYTONA" on May 23, 2018, Pusha explains: "I changed the album title from "King Push" to "DAYTONA" because I felt it didn\'t represent the overall message of this body of work." The seventh track, "Infrared", also sparked beef between Pusha and Drake, resulting to Pusha releasing "The Story of Adidon".',
    'It\'s Almost Dry': '"It\'s Almost Dry" is the fourth studio album by Pusha T, released on April 22, 2022 as a follow-up to "DAYTONA", his third album. Although the album had many producers, the two main ones were Kanye West, who had produced many of Pusha\'s tracks throughout his solo career, and Pharrell Williams, who had also produced, alongside Chad Hugo as The Neptunes, many Pusha tracks during his time with Malice as Clipse in the 2000s. The title of the album is based on the term "It\'s almost dry" when making paintings or in drug culture where you can come get the product when it\'s dry.',
    'Let God Sort \'Em Out': '"Let God Sort \'Em Out" is the fourth album by Clipse after a decade-plus long hiatus as a duo released on July 11, 2025. The album itself is entirely produced by Pharrell Williams and contains features from high-profile artists like Kendrick Lamar and Tyler, the Creator. The duo was originally signed to Def Jam Recordings before a dispute about the Kendrick Lamar feature on "Chains & Whips" led to Clipse doing a six-figure deal to be dropped, later being independant when signing with Roc Nation. The vinyl versions of the album was leaked on July 8, 2025, which didn\'t contain Tyler\'s feature on "P.O.V." and So Be It.',
    'PT5': 'This is an umbrella for any solo Pusha T music. If any songs list only Pusha T as a feature, it will be put under here.',
    'M3': 'This is an umbrella for any solo Malice music. If any songs list only Malice as a feature, it will be put under here.',
    'C5': 'This is an umbrella for any Clipse music. If any songs list Clipse or both Pusha T and Malice as a feature, it will be put under here.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Exclusive Audio Footage',
    'Lord Willin\'',
    'Hell Hath No Fury',
    'Til the Casket Drops',
    'Fear Of God',
    'Hear Ye Him',
    'Fear Of God II: Let Us Pray',
    'My Name Is My Name',
    'Wrath of Caine',
    'Darkest Before Dawn',
    'DAYTONA',
    'It\'s Almost Dry',
    'Let God Sort \'Em Out',
    'PT5',
    'M3',
    'C5'
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
