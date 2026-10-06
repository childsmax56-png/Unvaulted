import type { ArtistConfig } from './types';

// JPEGMAFIA tracker. Data served from committed CSV snapshots under
// public/jpegmafiagold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const jpegmafiagoldConfig: ArtistConfig = {
  slug: 'jpegmafiagold',
  SITE_NAME: 'JPEGMAFIAGOLD',
  SITE_DESCRIPTION: 'The Best JPEGMAFIA Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/jpegmafiagold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'jpegmafiagold_',

  HARDCODED_SHEET_ID: '1IhfNqEOtwczA6JH52gv2feerMqlJEbaDV4bxaIr7gkI',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#e11d48',
  artistLabel: 'JPEGMAFIA',
  cardLetter: 'J',
  logoUrl: '',
  artistPhotoUrl: '/artists/jpegmafiagold.jpg',

  getArtistName() {
    return 'JPEGMAFIA';
  },

  CUSTOM_IMAGES: {
    'DREAMCAST SUMMER SONGS': '/jpegmafiagold/eras/dreamcast-summer-songs.jpg',
    'Generation Y': '/jpegmafiagold/eras/generation-y.png',
    'L.I.S.A': '/jpegmafiagold/eras/l-i-s-a.jpg',
    'The Rockwood Escape Plan': '/jpegmafiagold/eras/the-rockwood-escape-plan.jpg',
    'THE GHOST~POP TAPE': '/jpegmafiagold/eras/the-ghost-pop-tape.jpg',
    'Communist Slow Jams': '/jpegmafiagold/eras/communist-slow-jams.png',
    'Darkskin Manson': '/jpegmafiagold/eras/darkskin-manson.jpg',
    'Black Ben Carson': '/jpegmafiagold/eras/black-ben-carson.jpg',
    'The 2nd Amendment': '/jpegmafiagold/eras/the-2nd-amendment.jpg',
    'Veteran': '/jpegmafiagold/eras/veteran.jpg',
    'All My Heroes Are Cornballs': '/jpegmafiagold/eras/all-my-heroes-are-cornballs.jpg',
    'HOW TO BUILD A RELATIONSHIP': '/jpegmafiagold/eras/how-to-build-a-relationship.jpg',
    'LP!': '/jpegmafiagold/eras/lp.jpg',
    'SCARING THE HOES': '/jpegmafiagold/eras/scaring-the-hoes.jpg',
    'VULTURES 2': '/jpegmafiagold/eras/vultures-2.png',
    'I LAY DOWN MY LIFE FOR YOU': '/jpegmafiagold/eras/i-lay-down-my-life-for-you.jpg',
    'We Live In A Society': '/jpegmafiagold/eras/we-live-in-a-society.png',
    'EXPERIMENTAL RAP': '/jpegmafiagold/eras/experimental-rap.png',
    'Ongoing': '/jpegmafiagold/eras/ongoing.png',
  },

  ALBUM_RELEASE_DATES: {
    'DREAMCAST SUMMER SONGS': '02/27/2012',
    'Generation Y': '01/16/2011',
    'L.I.S.A': '10/08/2011',
    'The Rockwood Escape Plan': '??/??/????',
    'THE GHOST~POP TAPE': '03/23/2014',
    'Communist Slow Jams': '04/02/2015',
    'Darkskin Manson': '05/15/2015',
    'Black Ben Carson': '02/15/2016',
    'The 2nd Amendment': '07/18/2016',
    'Veteran': '01/19/2018',
    'All My Heroes Are Cornballs': '09/13/2019',
    'HOW TO BUILD A RELATIONSHIP': '??/??/????',
    'LP!': '10/22/2021',
    'SCARING THE HOES': '03/24/2023',
    'VULTURES 1': '02/09/2024',
    'VULTURES 2': '08/03/2024',
    'I LAY DOWN MY LIFE FOR YOU': '02/03/2025',
    'We Live In A Society': '05/02/2025',
    'EXPERIMENTAL RAP': '05/20/2026',
    'Ongoing': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'DREAMCAST SUMMER SONGS': 'DREAMCAST SUMMER SONGS is JPEGMAFIA\'s first release under the Devon Hendryx name, released on August 26th, 2009. The project is a compilation of the very first beats Devon made between 2007 - 2009. It originally released as "Devon\'s Tape" with only 15 tracks, & later got reissued in 2011 as "Since I Left You II", which was "a sequel to the first it was made from all samples but I never finished it." In 2012, the album was condensed & released as the title we know now.',
    'Generation Y': 'Generation Y is Devon Hendryx\'s second mixtape, released on January 16th, 2011. Two stories have been given about the creation of this album. The first is that this album was made in an abandoned Seventh Day Adventist church within 7 days, beginning on Sunday, December 19 & ending on Christmas Day 2010. The second story is that the album was made in 2009, right before JOECHILLWORLD. This album was eventually taken down in 2012 since Devon hated the project, it was considered lost media for a while before being rediscovered through the Wayback Machine. This project would later be re-released in April 2025 & given a physical release a few months later.',
    'L.I.S.A': 'L.I.S.A is Devon Hendryx\'s first collab project, made with Enso Sinatra (aka DATPIFFMAFIA), released on October 8rd, 2011. Most likely named after one of Devon\'s exes as mentioned in the original "I ♥ You Hip Hop But I Can\'t Be Your Girlfriend Because That\'s Gay" Bandcamp description and also on the original Toonami mix.',
    'The Rockwood Escape Plan': 'The Rockwood Escape Plan is Devon Hendryx\'s fourth album, released on Valentines Day 2012. In an interview from March 28th, 2012 when asked about the album\'s title Devon said: "I\'ve had an idea for this anime I want to create one day and the name of it was The Rockwood Escape Plan. I called it that because whenever I would be at school or just bored in general, I would kinda drift off and daydream or "escape" to that anime which takes place in a fictional world called "Rockwood" and the album acts as something like a soundtrack for those fantasies." In 2012, Devon also said that he was very proud of it and that it was supposed to be his last album before he gets a record deal. This album (like most Devon albums at the time) was reworked and remastered several time with tracks being removed and added.',
    'THE GHOST~POP TAPE': 'THE GHOST~POP TAPE is Devon Hendryx\'s fifth and final album, originally released on September 3rd, 2013. As a result of general lack of success of his music and various personal factors, JPEGMAFIA went into a depressive episode for the span of several years. However, he continued to make music in this time, even able to collaborate with other artists. Initially meant to be kept to himself, he released his final work under "Devon Hendryx", originally titled GenY⁵ before going through several aesthetic. naming, and mastering revisions, finally ending up as "THE GHOST~POP TAPE".',
    'Communist Slow Jams': 'Communist Slow Jams is Devon Hendryx\'s first mixtape under the new JPEGMAFIA name, released on April 2nd, 2015. After the release of "The Ghost~Pop Tape", JPEGMAFIA abandoned the Devon Hendryx name, and took on JPEGMAFIA while he worked on his first mixtape under the new name. Taking on a much more overtly political theme with this new era for his music, JPEGMAFIA utilized the cloudy production techniques he developed while producing The Ghost~Pop Tape to create a harsher and more refined atmosphere in his new work. He would release his first mixtape under JPEGMAFIA on April 2nd, 2015, titled "Communist Slow Jams", it would receive an update with different mixing and mastering several months afterwards, being retitled as a director\'s cut. JPEGMAFIA has also confirmed that most of those beats and lyrics were recorded / made around 2013 - 2014 entirely in Japan and the album was done by the end of 2014.',
    'Darkskin Manson': 'Darkskin Manson is JPEGMAFIA\'s second mixtape, released on May 15th, 2015. The mixtape was released on Bandcamp alongside a DVD of the accompanying movie. The songs were recorded during the Communist Slow Jams sessions. The mixtape was later taken down and re-released as an EP with 7 tracks, before being deleted once again.',
    'Black Ben Carson': 'Black Ben Carson is JPEGMAFIA\'s first studio album, released on February 15th, 2016. The bandcamp release of the album features album and all song stylezed in lower case for the exception of "ALL CAPS NO SPACES". The album was named after the only black 2016 presidential candidate Ben Carson, who was running Republican. Originally featured 22 tracks and was split into two sides: side A "NIGGER" (tracks 1-11) and side B "PEGGY" (tracks 12-22). Was officialy re-released in 2017 with updated mixes and tracks Flex The Connect, LL Cool J and Jerrys being removed for unknown reasons.',
    'The 2nd Amendment': 'The 2nd Amendment is the first collaborative studio EP by experimental, genre hopping Baltimore rapper JPEGMAFIA & Manic Llamadon member Freaky, released on July 18th, 2016. JPEGMAFIA and collaborator Freaky assembled The 2nd Amendment in response to the public tumult that has been bubbling in America for years and has so violently boiled over in recent years. The result is a darkly humorous, angry, pitch black, and acerbic, EP that is the embodiment of the notion that the only way to deal with an absurd world is to meet it with equal absurdity.',
    'Veteran': 'Veteran is the sophomore studio album by experimental Baltimore rapper/producer JPEGMAFIA. Officially released on January 19th, 2018 by Deathbomb Arc, Veteran is entirely produced, mixed and mastered by Peggy himself, and features Bobbi Rush, Yung Midpack & Freaky, all of whom are from Baltimore. The album’s title refers to Peggy’s legal status as a veteran. He was in the Air Force, served a four-year tour duty in Iraq, and also spent some formative years while stationed in Japan and Germany, before being honorably discharged in 2015. The album is a change of direction for JPEG musically, seeing Peggy somewhat, but not entirely abandon the harsh noise palette of his last solo album 2016’s Black Ben Carson, in favor of a more melodic and experimental array of music.',
    'All My Heroes Are Cornballs': 'JPEGMAFIA\'s 3rd studio album released September 13th, 2019. Following the release of his second and breakthrough studio album Veteran JPEGMAFIA started working on his next album. According to JPEGMAFIA himself, almost 100 songs were made for this album. The album was originaly being promoted as a "disappointment" with videos released on the his YouTube. On February 29, 2020, JPEGMAFIA announced a limited "Mystery USB" in the style of PlayStation 2 Memory Cards. The USB was revealed to be a deluxe edition of the album featuring bonus tracks and original mixes of songs.',
    'HOW TO BUILD A RELATIONSHIP': 'HOW TO BUILD A RELATIONSHIP is the given name for the era of the original version of LP! that was set to be released sometime in 2020 before his contracts made him release two EP\'s and use most the material for those. Was leaked in full on October 10th, 2023 by Reddit user u/putinsbabymama99, who is rumored to be Peggy himself. The cover is also Peggy\'s TikTok profile picture. This era combines HTBAR, EP! and EP2! material.',
    'LP!': 'LP! is JPEGMAFIA’s fourth album and the final album released under his recording contract with EQT Recordings. The album was released on October 22, 2021, which is JPEGMAFIA’s birthday. The album was first announced on August 31st, 2021 in a tweet reading “ALBUM + TOUR INCOMING.”  This album has had several updates within the span of two years, here\'s a diagram of all the songs changed.',
    'SCARING THE HOES': 'SCARING THE HOES is the first collaborative album between American rapper and producer, JPEGMAFIA, and Detroit native, Danny Brown. This is the follow-up to JPEG’s 2021 album LP! and Danny’s 2019 album uknowhatimsayin¿. The 14-track album only features one guest appearance by up-and-coming Maryland artist, redveil. Its very likely that this album will have a follow up sequel/Vol. 2 of sorts in the near future.',
    'VULTURES 1': 'During the lead up to the album (I LAY DOWN MY LIFE FOR YOU)’s rollout, two significant things occurred involving Peggy, one of them is how he fulfilled one of his lifelong dreams and was finally offered a collab with his childhood idol, Ye, doing production for his and Ty Dolla $ign’s album VULTURES 1 on “STARS”, “FUK SUMN”, “BEG FORGIVENESS”, and “KING”. This led to some controversy as, with Ye being the polarizing figure he is, many people saw this collaboration as hypocritical on Peggy’s part, as he’s said some lines on his songs that go against the very controversial rhetoric and ideals that Ye has become known for spewing in the past decade.',
    'I LAY DOWN MY LIFE FOR YOU': 'I LAY DOWN MY LIFE FOR YOU is the fifth studio album by JPEGMAFIA. Peggy initially planned to drop the album some time in 2023 after the release of his Danny Brown collaboration SCARING THE HOES. However, due to taking a break for the holidays and feeling the album would’ve felt rushed if released in the state it was in, its date was postponed until some time in 2024. Upon the release of I LAY DOWN MY LIFE FOR YOU, a premium edition version of the album was released on his website, being a limited run exclusively on vinyl. This new version of the album features a new exclusive bonus track, “Come & Get It”, and would also include the instrumentals to the album. On February 3rd, 2025, Peggy would release a director\'s cut for the album which includes new songs & extended mixes.',
    'We Live In A Society': 'During JPEGMAFIA\'s 2025 I LAY DOWN MY LIFE FOR YOU Tour, Peggy met up with producer Flume in Australia to work on music, on April 24th the single Track 1 was uploaded to Youtube, which was then proceeded by the announcement of the EP to drop in May.',
    'EXPERIMENTAL RAP': 'EXPERIMENTAL RAP is JPEGMAFIA\'s seventh studio album, and is by far his most criticised and hated, even after the announcement of the album, fans pivoted toward the album being bad or subpar, after WAR OVER LAND released, many people began to clown on Peggy for the repitition of sound and triplet flow, as well as the same lyrical topic that he\'s been doing for years. The criticism escalated once him and Earl Sweatshirt got into a minor "beef", where many people deemed Peggy a cornball. After the album released, it was heavily criticised for its repetitive song structure, lack of sound switches, similar lyrical content and filler tracks. Peggy then went on various Twitter rants, deactivating his twitter and distancing himself from his fanbase.',
    'Ongoing': 'Currently there are rumours that JPEGMAFIA is already working on his seventh album, this was backed up on September 3rd when JPEGMAFIA released a screenshot of a song called "NDA" with a cover that is most likely just the single cover (but is being used to mark this era), there is also a possibilty that JPEGMAFIA is working on SCARING THE HOES VOL.2, ALL AMERICAN ROCKSTAR & IN THE MAFIA WE TRUST, although those are speculative.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'DREAMCAST SUMMER SONGS',
    'Generation Y',
    'L.I.S.A',
    'The Rockwood Escape Plan',
    'THE GHOST~POP TAPE',
    'Communist Slow Jams',
    'Darkskin Manson',
    'Black Ben Carson',
    'The 2nd Amendment',
    'Veteran',
    'All My Heroes Are Cornballs',
    'HOW TO BUILD A RELATIONSHIP',
    'LP!',
    'SCARING THE HOES',
    'VULTURES 1',
    'VULTURES 2',
    'I LAY DOWN MY LIFE FOR YOU',
    'We Live In A Society',
    'EXPERIMENTAL RAP',
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
  hasAlbumCopiesTab: true,
};
