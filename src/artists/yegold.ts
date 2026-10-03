import type { ArtistConfig } from './types';

// Default Ye tracker, backed by yetracker.net's own Google Sheet
// (live-synced via SHEET_SOURCES in functions/api/[artist]/_sheets.ts, which
// also merges its separate "SSC" tab into the Unreleased data — see the
// comment there). The original hand-curated tracker now lives on as the
// hidden "Suzy" alt (see yzygold.ts, alternateTrackers below).
//
// HARDCODED_SHEET_ID was previously a stale fork of the real document (same
// gids, since it was a copy, but diverged cell data — e.g. it never got the
// real sheet's later "CARTI YE" era). The real id was recovered by scraping
// yetracker.net's own reverse-proxy view (https://yetracker.net/htmlview/sheet),
// which embeds it as a "Sheet Link" in the Name column's header cell; unlike
// yetracker.net's own domain, the real doc is a normal public Google Sheet
// with a working CSV export. See scripts/build-yegold-csvs.py.
export const yegoldConfig: ArtistConfig = {
  slug: 'yegold',
  hasGroupbuysTab: true,
  hasAlbumCopiesTab: true,
  SITE_NAME: 'YE',
  SITE_DESCRIPTION: 'The Kanye West tracker, with links sourced from yetracker.net',
  SITE_URL: 'https://unvaulted.cc/yegold/',
  OG_IMAGE_URL: 'https://i.ibb.co/LhXdRh7j/2026-03-23-T184041-712.png',
  STORAGE_PREFIX: 'yegold_',
  HARDCODED_SHEET_ID: '1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y',
  HARDCODED_SHEET_GID: '77894385',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: 'https://docs.google.com/spreadsheets/d/1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y/export?format=csv&gid=77894385',
  hasYeditsTab: true,
  hasCompsTab: false,
  hasSubAlbumsTab: true,
  alternateTrackers: [
    { slug: 'yzygold', label: 'Suzy' },
    { slug: 'yelolgold', label: 'Lol' },
  ],
  accentColor: '#C9A224',
  artistLabel: 'Ye',
  cardLetter: 'YE',
  logoUrl: '/logos/yzygold.png',
  artistPhotoUrl: '/artists/kanye.jpg',
  navLogoUrl: '/yzygold/logo.png',

  getArtistName(eraName) {
    if (!eraName) return 'Kanye West';
    const albumNames = Object.keys(this.ALBUM_RELEASE_DATES);
    const donda3Index = albumNames.indexOf('Donda [V3]');
    const eraIndex = albumNames.indexOf(eraName);
    if (donda3Index !== -1 && eraIndex !== -1 && eraIndex > donda3Index) return 'YE';
    return 'Kanye West';
  },

  CUSTOM_IMAGES: {
    "Before The College Dropout": "https://i.ibb.co/kpk9TzL/image-2026-05-04-074305465.png",
    "The College Dropout": "https://i.ibb.co/mrK8W4rL/image-2026-03-22-142639537.png",
    "Late Registration": "https://i.ibb.co/QvNMHS7f/image-2026-05-04-074325717.png",
    "Graduation": "https://i.ibb.co/gZmLyhpD/image-2026-05-04-074348808.png",
    "808s & Heartbreak": "https://i.ibb.co/gL1jHjxD/image-2026-05-04-074412180.png",
    "Good Ass Job": "https://i.ibb.co/zWDJvnF3/image-2026-05-04-074429956.png",
    "My Beautiful Dark Twisted Fantasy": "https://i.ibb.co/nMhS9cfq/image-2026-05-04-074450433.png",
    "Watch The Throne": "https://i.ibb.co/Gvh0rdt/ea89bace-a565-4fd7-aec2-de7f2a0341a2.jpg",
    "Yeezus": "https://i.ibb.co/54tTPvy/YEEZUS-COVER-1-scaled.jpg",
    "Cruel Winter [V1]": "/yzygold/CruelWinterV1.jpeg",
    "Yeezus 2": "https://i.ibb.co/gL2VPWGD/image-2026-05-04-074633664.png",
    "SWISH": "https://i.ibb.co/vvdd31rM/image-2026-05-04-074736182.png",
    "808s & Heartbreak: Live At The Hollywood Bowl": "https://i.ibb.co/gMW718Hb/i-made-the-808s-heartbreak-live-at-the-hollywood-bowl-on-v0-mz7y867oig3g1.webp",
    "ye": "https://i.ibb.co/4ffBbzd/0a170099-f725-41f6-88a9-c28ab2a6bdb8.jpg",
    "KIDS SEE GHOSTS": "https://i.ibb.co/xsRLz4k/28ef3e62-abba-4064-9dd7-44dd37803981.jpg",
    "KIDSSEEGHOSTS": "https://i.ibb.co/xsRLz4k/28ef3e62-abba-4064-9dd7-44dd37803981.jpg",
    "Good Ass Job (2018)": "https://i.ibb.co/Y4tB29pw/image-2026-05-04-075000044.png",
    "Yandhi [V1]": "https://yetracker.cc/img/9382ca79345e3a764d6f08ac9bc86898",
    "Yandhi [V2]": "https://yetracker.cc/img/ac5edf6afc2f81a5613a5292f137e548",
    "JESUS IS KING": "https://i.ibb.co/6cPT40L6/image-2026-05-04-075046079.png",
    "God's Country": "https://yetracker.cc/img/b05c530912bbca7eab6931b3fe87493e",
    "JESUS IS KING: The Dr. Dre Version": "https://yetracker.cc/img/b10a2746d60af89082ee3fe20fd60a36",
    "DONDA [V1]": "https://i.ibb.co/8rV5JJ3/children-park-manip-retouched.jpg",
    "Donda [V2]": "https://i.ibb.co/JjzVyMvT/image-2026-05-04-075158690.png",
    "Donda [V3]": "https://i.ibb.co/YX9xy2p/19e339a4-33e0-46ec-bd90-0e4ed62932cc.jpg",
    "DONDA 2 [V1]": "https://i.ibb.co/27D2fTXM/image-2026-05-04-075245507.png",
    "WAR": "https://i.ibb.co/93mVjHZV/WAR-youtube-thumbnail.png",
    "YEBU": "https://i.ibb.co/vxTD8nVh/image-2026-05-04-075337930.png",
    "¥$": "https://i.ibb.co/jknzBvyZ/image.png",
    "VULTURES 2": "https://i.ibb.co/35h4bhzG/image-2026-05-04-075431548.png",
    "VULTURES 3": "https://yetracker.cc/img/9c928643e77b50cd0f0e71ea740e6a53",
    "BULLY [V1]": "https://a5.mzstatic.com/us/r1000/0/Music221/v4/4b/38/d1/4b38d146-381d-ace2-73df-24074576e62b/656465138828_cover.jpg",
    "CUCK": "https://yetracker.cc/img/f67f57cf09620b30726b0b7df91a65b8",
    "DONDA 2 [V2]": "https://i.ibb.co/b5ZNpDXk/cover.jpg",
    "Be": "https://i.ibb.co/RGmHbWZk/Common-Be.png",
    "IN A PERFECT WORLD": "https://i.ibb.co/Fqd2crvz/iapwcover.png",
    "BULLY [V2]": "https://i.ibb.co/pBfL20KJ/HLNl-Xx-Ubs-AAaz-S8.jpg",
    "The Life Of Pablo": "https://i.ibb.co/n8DkztcP/image-2026-03-22-142914834.png",
    "Turbo Grafx 16": "https://i.ibb.co/q3fggHMz/image-2026-03-22-143044324.png",
    "Turbo Grafix 16": "https://i.ibb.co/q3fggHMz/image-2026-03-22-143044324.png",
    "TurboGrafx 16": "https://i.ibb.co/q3fggHMz/image-2026-03-22-143044324.png",
    "TurboGrafix 16": "https://i.ibb.co/q3fggHMz/image-2026-03-22-143044324.png",
    "TurboGrafx16": "https://i.ibb.co/q3fggHMz/image-2026-03-22-143044324.png",
    "LOVE EVERYONE": "https://i.ibb.co/Tq7HkRKn/cell-Image-199908479-18.png",
    "Cruel Summer": "https://i.ibb.co/wr7sS6DH/cell-Image-199908479-8.png",
    "So Help Me God": "https://i.ibb.co/Lz3b2xDD/cell-Image-199908479-13.png",
    "VULTURES 1": "https://i.ibb.co/5hFN28jM/cell-Image-199908479-37.png",
    "Cruel Winter [V2]": "https://i.ibb.co/bjFdyLjv/image-2026-04-28-131805413.png",
    "Ongoing": "https://i.ibb.co/dwZ4cwmd/image-2026-04-27-185921217.png",
    "DAYTONA": "https://i.ibb.co/1fX0N137/Daytona.jpg",
    "NASIR": "https://a5.mzstatic.com/us/r1000/0/Music125/v4/f9/41/a9/f941a9d4-099d-4b65-484a-e585136ca838/18UMGIM37154.rgb.jpg",
    "K.T.S.E.": "https://i.ibb.co/rfZM2kCp/K-T-S-E.jpg",
    "NEVER STOP": "https://i.ibb.co/vC9c5qFM/never-stop.png",
    "Jesus Is Born": "/yegold/JesusIsBorn.jpg",
    "Sunday Service Choir": "https://i.ibb.co/nN2LDSxN/SSC.jpg",
    "CARTI YE": "/yegold/CartiYe.jpg",
    "Late Orchestration": "https://i.ibb.co/whrYVzkr/Late-Orchestration.jpg",
    "Child Rebel Soldier": "https://i.ibb.co/QFLpkFcz/IMG-3998.png",
    "BULLY": "https://a5.mzstatic.com/us/r1000/0/Music221/v4/4b/38/d1/4b38d146-381d-ace2-73df-24074576e62b/656465138828_cover.jpg",
    "Live": "https://i.ibb.co/zhhhyDVq/hq720.jpg",
    "Other": "https://i.ibb.co/G3VqQV3t/IMG-3890.jpg",
  },

  ALBUM_RELEASE_DATES: {
    "Before The College Dropout": "??/??/????",
    "The College Dropout": "02/10/2004",
    "Late Registration": "08/30/2005",
    "Graduation": "09/11/2007",
    "808s & Heartbreak": "11/24/2008",
    "Good Ass Job": "??/??/2009",
    "My Beautiful Dark Twisted Fantasy": "11/22/2010",
    "Watch The Throne": "08/08/2011",
    "Cruel Summer": "09/14/2012",
    "Yeezus": "06/18/2013",
    "Cruel Winter [V1]": "??/??/2013",
    "Yeezus 2": "??/??/2014",
    "So Help Me God": "??/??/????",
    "SWISH": "??/??/2015",
    "The Life Of Pablo": "02/14/2016",
    "Cruel Winter [V2]": "??/??/????",
    "Turbo Grafix 16": "??/??/2016",
    "LOVE EVERYONE": "??/??/2018",
    "ye": "06/01/2018",
    "KIDS SEE GHOSTS": "06/08/2018",
    "Good Ass Job (2018)": "??/??/2018",
    "Yandhi [V1]": "??/??/2018",
    "Yandhi [V2]": "??/??/????",
    "JESUS IS KING": "10/25/2019",
    "Jesus Is Born": "12/25/2019",
    "Sunday Service Choir": "??/??/????",
    "God's Country": "??/??/????",
    "JESUS IS KING: The Dr. Dre Version": "??/??/????",
    "DONDA [V1]": "07/18/2020",
    "Donda [V2]": "??/??/????",
    "Donda [V3]": "08/29/2021",
    "DONDA 2 [V1]": "??/??/????",
    "WAR": "04/01/2022",
    "YEBU": "??/??/????",
    "¥$": "??/??/2023",
    "VULTURES 1": "02/10/2024",
    "VULTURES 2": "08/03/2024",
    "CARTI YE": "??/??/????",
    "VULTURES 3": "??/??/????",
    "BULLY [V1]": "03/18/2025",
    "CUCK": "03/06/2025",
    "DONDA 2 [V2]": "04/29/2025",
    "IN A PERFECT WORLD": "06/22/2025",
    "BULLY [V2]": "03/28/2026",
    "Ongoing": "??/??/????",
  },

  // DAYTONA/NASIR/K.T.S.E./NEVER STOP are NOT eras here (unlike Jesus Is Born/
  // Sunday Service Choir below) — they have no Unreleased-tab leak rows
  // anywhere on the real sheet, so listing them would just show as empty "0
  // songs" cards in the Related tab. They still have a CUSTOM_IMAGES entry
  // above, since the Released/Tracklists/Art/Stems tabs reference those names
  // directly and look covers up independent of this list. YE-I/The
  // Elementary School Dropout (present on yzygold's/Suzy's sheet) don't exist
  // anywhere on this one at all — dropped entirely.
  HIDDEN_ALBUMS: ['Jesus Is Born', 'Sunday Service Choir'],

  // Sourced from each era's own stat-header description cell on the live sheet
  // (same place the real yetracker.net site draws its own blurbs from) — not
  // ported from yzygold/Suzy's hand-written ones. DAYTONA/NASIR/K.T.S.E./NEVER
  // STOP have no such cell anywhere on this sheet (no Unreleased-tab header
  // row, and the Released tab doesn't carry one either), so they're absent
  // here rather than filled in from another tracker.
  ALBUM_DESCRIPTIONS: {
    "Before The College Dropout": "Before Kanye released his first album to critical acclaim in 2004, he pursued many other projects, including a rap trio group named the \"Go Getters\" and production for other rappers, including, but not limited to JAŸ-Z, Common, Talib Kweli, and Scarface. Two years before the release of The College Dropout, Kanye began releasing a series of mixtapes to generate hype and publicity for the eventual release of his first album. Kanye eventually signed with Roc-A-Fella records in August 2002.",
    "The College Dropout": "Following his signing to Roc-A-Fella Records, Kanye released his debut studio album, The College Dropout. It features string arrangements, choirs, and his signature soul sampling, frequently branded as \"chipmunk soul\" for its sped-up and high-pitched nature. Contrary to the popular gangster-persona lyrics at the time, his songs mostly revolved around themes of family, materialism, religion, and racism. The inspiration for finally making his music came when he was in a near-fatal car crash.",
    "Late Registration": "Late Registration continues the social themes introduced in The College Dropout, but now with orchestral production influenced by co-producer Jon Brion. Kanye's newfound success allowed him to expand his ambitions from a single violinist to an entire string orchestra. Lyrically, the album features a mix of more socially charged songs to more personal cuts. Production-wise, inspiration came from artists such as British trip-hop band Portishead and Fiona Apple's second album When The Pawn…",
    "Graduation": "Graduation is the third studio album from Kanye West. Inspiration came from stadium tours, indie rock, and house music. It was a considerable departure from the sound Kanye had used on his first two studio albums, which featured samples and inspirations from the soul and orchestral music Kanye grew up alongside. This album included a much more electronic sound, featuring layering synthesizers. Lyrically, Kanye analyzes himself and talks about his life after becoming famous and how the media criticize him.",
    "808s & Heartbreak": "Following the death of his mother due to complications after cosmetic surgery, his relationship with fiancé Alexis Phifer finally ending for good, and a struggle to adapt to his celebrity status, Kanye felt emotionally drained and lost. As a result, Kanye dealt with his pain by channeling it into a sonically stripped-down album, one dominated by his use of the titular Roland TR-808 drum machine and Auto-Tune., significantly influencing future hip-hop music, having influenced Drake, Future, Travis Scott, and more.",
    "Good Ass Job": "As far back as 2003, Kanye had planned a four-album series revolving around going to college, with Good Ass Job concluding the series. The death of his mother derailed this plan, with his fourth album becoming the somber 808s & Heartbreak. People still expected Good Ass Job to release, though, as Kanye's next album as late as early 2010. When the wake of the 2009 VMAs incident happened, it would cause Good Ass Job not to release. Kanye would take to twitter on July 27th, 2010, tweeting that the album was \"no longer called Good Ass Job\" and that he was \"bouncing a couple ideas\". The art used for this era is the original cover for the single \"POWER.\"",
    "My Beautiful Dark Twisted Fantasy": "Conceived during West's self-imposed exile following the 2009 VMA incident and further influenced by his deteriorating relationship with model Amber Rose, My Beautiful Dark Twisted Fantasy is a genre-bending masterpiece that explores the darker sides of celebrity, fame, and love. With grand production that sounds like the natural evolution of all the albums that came before it, this is seen by many as Kanye's best album, even earning an extremely rare 10/10 rating from Pitchfork.",
    "Watch The Throne": "Considered one of the most legendary collab albums of all time, Watch The Throne puts together two of the most legendary figures in music history for a full studio album. Kanye teams up with his big brother, JAŸ-Z, for an album, focused primarily on luxury, black excellence, and the American dream. The album's production also reflects that, and having been recorded by two future billionaires primarily in New York City's Tribeca Grand Hotel, how could it not?",
    "Cruel Summer": "A compilation of new songs from Kanye's label, G.O.O.D. Music, 2012's Cruel Summer is one of the most collaborative Kanye projects he accomplished. Featuring various collaborations with Pusha T, Big Sean, 2 Chainz, John Legend, and many more, this album spawned many big hits, including \"Mercy\" and the remix of the Chief Keef song \"Don't Like.\" This album also marks the first time Kanye would work with Travis Scott, an at-the-time complete unknown with no mixtape to his name.",
    "Yeezus": "Yeezus marked a complete reverse from the bombastic production that Kanye accomplished on My Beautiful Dark Twisted Fantasy. He swapped lush soul and anthemic hooks for splintering electro, acid house, and industrial force while packaging some of his most lewd and heart-crushing tales. Initially envisioned as Thank God For Drugs, a much larger project, Kanye would play the album for Rick Rubin, he later recalled listening to roughly 3-hours of unfinished material that seemed to need months worth of work - despite the release date being a month away. Kanye enlisted Rubin to refine and complete the project, finishing a majority of the songs just two days before release.",
    "Cruel Winter [V1]": "The 2013 version of Cruel Winter, the first version of the sequel to 2012's Cruel Summer, is a mystery. No single for this album was released, and most of the info comes from leakers and insiders. It had many songs with A Tribe Called Quest member Q-Tip, who was notably absent from Cruel Summer despite having already been signed to the label. There is no known cover for this album, so we're using a fanmade cover to represent this era.",
    "Yeezus 2": "After Rick Rubin and Kanye West cut down Yeezus to the final ten tracks, Kanye still saw potential in much of the cut material. Thus, shortly after Yeezus was released, an EP of leftovers titled Lost Yeezus was already being teased. The project then evolved into a full-fledged album of mostly new material, with Yeezus 2 acting as a codename before they could choose the last name. This project would develop into So Help Me God as the songs evolved.",
    "So Help Me God": "Announced in February 2015, So Help Me God is now one of Kanye's most infamous unreleased projects. Essentially being a more advanced version of the songs developed during the Yeezus 2 era, So Help Me God gained significant hype as the teaser tracks of \"Wolves,\" \"All Day,\" and \"Only One\" was revealed to the public. Despite intending to release the album in March 2015, Kanye never finished So Help Me God, and only a few songs from the era ended up on The Life Of Pablo.",
    "SWISH": "After changing the name of his 7th solo album from So Help Me God to SWISH, Kanye began to develop all new songs throughout mid-late 2015 meant for the album, with most of them eventually making it onto the final release of The Life Of Pablo. Kanye also continued to work on many So Help Me God and Yeezus 2 tracks, but by the end of 2015 and the start of 2016, Kanye had dropped most of these tracks from the tracklist for SWISH, which began to resemble the final The Life Of Pablo tracklist strongly.",
    "The Life Of Pablo": "The Life Of Pablo is Kanye's 7th studio album, with constant name changes before release. Sporadic and scatter-shot, the album is one of a kind. The title refers to three people: artist Pablo Picasso, drug dealer Pablo Escobar, and Paul the Apostle, whose name is Pablo in Spanish. The album was initially released only on TIDAL, but later made its way to other streaming services with some updates. Kanye finally finished it by adding the track \"Saint Pablo.\"",
    "Cruel Winter [V2]": "After the 2013 rendition of Cruel Winter ended production, Kanye revived it in 2016. With only one official single released, this album took many ideas from popular music at the time, including many trap elements, remixes, and the biggest music stars. The label supposedly worked on it as late as November 2017, but the album has yet to come. There isn't an official cover for this album we know of, so we are using the single art for \"Champions.\"",
    "Turbo Grafix 16": "Immediately after Kanye released The Life of Pablo, he announced a whole new album titled Turbo Grafx 16, intended to be released in the summer of 2016. Kanye intended to pursue a futuristic sound, wanting to incorporate video game samples into the record. However, work on the album was short-lived, as Kanye began touring in August 2016 and scrapped the concept entirely after being diagnosed as bipolar. The cover included for this era is unofficial, despite being popular among fans.",
    "LOVE EVERYONE": "After Kanye was released from UCLA Medical Hospital and diagnosed as bipolar, he bought a ranch in Wyoming where he would produce his next album and multiple albums for his collaborators. The concept of the album came together in 2018. The album's subject matter varied wildly, with some songs being about introspection and change and others discussing his political views. The public name given for this album is LOVE EVERYONE, but it is known that Kanye likely considered the Hitler title longer, with this later being corroborated by Hassan Khaffaf on a stream with Auger.",
    "ye": "ye discusses topics in Kanye's life, including mental health, family, and addiction. He also explicitly announced his diagnosis of bipolar disorder through the album's artwork and a proclamation within the album. The seven-song project, created in Jackson Hole, Wyoming, was released alongside five other projects. Kanye revealed in an interview that after his infamous TMZ interview (in which he stated that slavery was a choice), he completely re-did his album with an entirely new theme.",
    "KIDS SEE GHOSTS": "Out of the five Wyoming projects from 2018, people consider KIDS SEE GHOSTS one of the best. This album focuses heavily on overcoming struggles caused by mental health, which Kanye and Cudi have been fighting. It's characterized by many psychedelic and rock-influenced elements, making for an album that sounds like nothing else. The album was originally meant to release on New Year's Eve 2017 under the name Everybody Wins, but didn't officially release until June 8th, 2018, making it Kanye's second collab album.",
    "Good Ass Job (2018)": "Kanye and Chance collab project that people talked about for years before being officially announced in 2018. The project was supposed to be just seven tracks long, similar to all the Wyoming albums. The central theme of this project is a celebration, as many of the tracks we've heard from this project seem to be very joyful and uplifting. Kanye and Chance presumably canceled it sometime in 2019. This project has no covers we know of, so we have used a photo of the two together.",
    "Yandhi [V1]": "Upon hearing the beat to \"Hurricane\" during sessions for Good Ass Job (2018), Kanye became inspired to create a whole new album titled Yandhi. With the album's concept in his mind, Kanye and his producers began frenzied work as they developed multiple new songs throughout September 2018, aiming for a September 29 release date. As they did not meet this deadline, Kanye went to Uganda to conduct further work on the album, but delayed it indefinitely on November 13.",
    "Yandhi [V2]": "After Kanye delayed Yandhi indefinitely, he began working with record producer Timbaland to create \"more healing music\" for the album. Shortly after the announcement of the delay, Kanye underwent a sudden and dramatic conversion towards born-again evangelical Christianity, debuting the Sunday Service Choir at the start of 2019. The creation of the choir coincided with the songs on Yandhi taking a new Christian lyrical focus. Eventually, the album would morph into the thoroughly Christian JESUS IS KING by mid-2019.",
    "JESUS IS KING": "Following a revelation on Easter 2019 at Coachella, Kanye scrapped Yandhi and reworked it to focus on God and Christianity. This album ended up being JESUS IS KING. After a private listening party in Detroit, Kim Kardashian announced that the album would release on Sunday, September 29, following listening parties in Chicago and New York. It didn't, and there were no updates for almost a month. On October 20, 2019, Kanye suddenly reappeared on Twitter to announce the final release date.",
    "Jesus Is Born": "First announced on Kanye's interview with Zane Lowe on Apple's Beats 1 Radio station, Jesus Is Born is the first - and only - album from the Sunday Service Choir (also referred to as Sunday Service), a gospel choir founded and led by Kanye West. It would release on Christmas Day 2019, peaking at #2 on the Billboard U.S. Gospel charts, and #73 on the Billboard 200 charts. The album does not have a single original song, as all are interpolations of other artists' songs - or interpolations of Kanye West originals.",
    "Sunday Service Choir": "Sunday Service Choir rehearsals and performances with no identifiable source era — everything else recorded at Sunday Service is instead filed under whichever studio era it actually belongs to (e.g. Yandhi, God's Country, DONDA [V1]), tagged \"(Sunday Service Choir)\" in its name.",
    "God's Country": "Shortly after the release of JESUS IS KING, Kanye (almost immediately) started working on new material. Songs from this era revolve around his faith while also consisting of dark themes (such as prison) and lyrics about current social issues. Initially announced as God's Country on May 20th, 2020 by Arthur Jafa, tracks from this album would go on to be developed further during DONDA WITH CHILD sessions, following Kanye getting new inspiration to make an album dedicated to his mother.",
    "JESUS IS KING: The Dr. Dre Version": "The release of JESUS IS KING was met with mixed reviews from fans and critics. Kanye then took to Twitter to announce that he was working on a new album with Dr. Dre. Initially conceived as a remix album, it eventually grew to incorporate mainly unreleased material. It was supposed to release officially during the #WESTDAYEVER campaign Kanye did on Twitter in 2020, but never did. It ended up being scrapped sometime in 2020, as stated by producer Dem Jointz. Randomly, Kanye posted an album cover in 2022 on his Instagram story, which is assumed to be for the album.",
    "DONDA [V1]": "With new inspiration to work on an album dedicated to his mother, Kanye continued working on previous demos and new ideas. The music of this era reflects Donda's impact on Kanye in a colorful sound while reflecting his mania and the stress he was going through focusing on his businesses while also running for President and struggling with his marriage. With multiple failed release dates for the album, Kanye went into silence in early 2021, finishing up tracks until the album morphed into something very different.",
    "Donda [V2]": "After taking a break from music in early 2021 due to his divorce with Kim Kardashian, Kanye went to work at the Pio Pico studio in LA, owned by frequent collaborators Nick Knight and Vanessa Beecroft, with an entirely new vision for the album. While the name remained the same, the sound shifted to be more experimental and less soulful. Working with producers such as E.VAX, Dem Jointz, and Digital Nas, Kanye went through hundreds of beats, laying down vocals and trying to come up with ideas for songs. This era would continue until Kanye decided to finalize the album, shifting to the more minimalistic release sound.",
    "Donda [V3]": "Almost a year after the initial announcement of Donda, a Beats by Dre ad revealed that a listening party would take place at the Mercedes-Benz Stadium in Atlanta. It happened, but the album didn't drop. Kanye moved into the stadium and lived there until the second listening event two weeks later. Once again, the album did not release. Ye later announced a third listening party at Soldier Field in Chicago, with the album coming the next day. It didn't. The album ended up releasing on August 29th, 2021 at 8AM EST, almost two days after the final listening party.",
    "DONDA 2 [V1]": "In Feburary 2022, Ye announced a sequel to Donda, exectutively produced by Future and intended to release 2.22.22. Following this, Ye and his collaborators began rushing to complete the project. Ye also found himself in many controversies, with him constantly harassing Kim Kardashian's boyfriend Pete Davidson on Instagram. A listening party for the project was held on 2.22.22, with the project being released on the Stem Player the next day, albeit unfinished. Ye got into even more controversies, namely proclaiming \"White Lives Matter\" at YZYSZN9 and saying he was going to go \"death con 3\" on the Jews, making him get dropped by Adidas and lose his billionaire status.",
    "WAR": "On his third Drink Champs interview, Ye would announce that him, James Blake, and No ID were working on an album together, though No ID did not do very much for the project according to James. Three songs were played at a party featured on Naomi Campbell's Instagram, with \"Virgil's Funeral\" being previewed in full at YZYSZN9 shortly thereafter. James has gone on record to say that Ye is the only thing stopping the project from seeing a release. According to James, though it ended up with the name WAR, all of the songs were about love. \"This One Here\", \"Rest Of Your Life\", \"Through The High Wire\", and \"Talking\" have since seen releases on James and Ye's projects.",
    "YEBU": "Ye's antisemetic rants came to a head in late 2022 in an interview with Alex Jones, in which he explicitly proclaimed himself a Nazi and claimed he \"liked Hitler\". Many fans and artists gave up supporting Ye and his antics following this moment, and after watching 21 Jump Street and claiming to \"like jews again\" on Instagram months later, Ye went silent and began working on new, allegedly Christian-focused material with both frequent and new collaborators. The project was shelved once Ye and Ty Dolla $ign decided to merge their solo projects and work on a collab project. The cover for this era is from the \"Someday We'll All Be Free\" single.",
    "¥$": "After Ye's birthday party in June 2023, Ye would begin to executive produce Ty Dolla $ign's album Beach House 4, with Ty being flown out to Japan to work with Ye. This work would eventually turn into a full-on collaborative album, with them going to Italy to work on music on July 27th, 2023. A video of Ye and Ty listening to \"BACK TO ME\" was posted by TMZ on October 2nd, 2023, with Ty confirming a joint album on Instagram. Ty would later say in an interview that the two went through their hard drives to find all their best material to speed up the process. The single \"Vultures\" would release on November 11th, 2023, marking a sound shift and a rename to VULTURES 1.",
    "VULTURES 1": "After the album's name change from Bad Bitch Playbook Vol. 1 to VULTURES 1, four listening parties were scheduled between December 12, 2023, and February 9, 2024. In 2024, Ye announced that VULTURES would be a trilogy, with the first installment dropping on February 9, followed by the second and third albums in March and April. VULTURES 1 would end up being released on February 10th, the day after the final listening party, which would end up becoming a recurring theme.",
    "VULTURES 2": "VULTURES 2 was announced alongside 2 other volumes of VULTURES, and was meant to release on March 8th, 2024, before being moved to May 3rd, 2024. This album would've became the first release exclusive to the YZYAPP, which was cancelled due to developer infighting. The cover shows Ty Dolla $ign holding a portrait of his brother Big TC, who is currently in prison. After the album failed to drop on May 3rd, 2024, the direction of the project completely shifted, and was to be censored. The album failed to drop August 2nd, releasing one day later with questionable mixing and songs, featuring the use of AI, and gradually receiving real-time updates to mixing and production.",
    "CARTI YE": "Conceived during Carti's involvement in VULTURES sessions, CARTI YE, a play on the name of the designer brand \"Cartier”, is a largely unknown collaboration between the two artists. Knowledge of its exisence only came to light admist one of Ye's mental episodes on March 15th, 2025 where he would call out Carti and \"the Jewish business” for not putting either of his features on Carti's album MUSIC. Mid-Twitter breakdown, he would reveal that \"WE WERE WORKING ON [A] PROJECT CALLED CARTI YE. I'M SORRY THAT THIS WONT HAPPEN NOW\". Frequent Carti collaborator F1LTHY would later corroborate the album's existence in an interview.",
    "VULTURES 3": "VULTURES 3 was announced alongside the 2 other volumes and was set to release on April 5th, 2024, however this didn't happen. The project was being worked on shortly after the release of VULTURES 2, with Ty stating \"V3 boutta rip heads off\" in an 88-Keys IG live chat, and Ye heart reacting a fan's message asking if the project still exists. After Ye's statements against Ty Dolla $ign, it was assumed that the project was scrapped, with this later confirmed by Digital Nas. In 2026, Ty did state that he's open to working on VULTURES 3 again, after Ye publicly apologized for his actions during prolonged manic episodes, saying \"He took accountability... I forgive him\".",
    "BULLY [V1]": "In response to the negative reception of VULTURES 2, Ye decided to begin work on a new solo album that was much simpler and stripped back than the VULTURES era sound, being built around sample chops. On September 28th, 2024, on the second Haikou listening event, Ye confirmed that the album's name is BULLY, which references the movie with the same name that he posted on his Instagram story a few days prior to the event. On January 2nd, 2025, Ye announced the album would have AI on it after months of speculation, and that it could help AI become used more in music. This concept was scrapped for release, with Ye resinging the AI last minute in response to fan backlash.",
    "CUCK": "Following the start of controversial rants on X/Twitter in early 2025, Ye met with Dave Blunts after taking a liking to his music and told him to write an entire album based on his tweets, as well as their conversations with eachother. On March 6th, 2025, Ye tweeted, \"this next album got that antisemitic sound\", with him previewing the song \"WW3\" days later. Akademiks eventually announced the album as \"WW3\", with Ye sending him a tracklist and April 8th release date, however the album would miss this date and continued to be worked on until it was leaked on May 18th. During this, the album would infamously be renamed to CUCK, which was the title used for most of it's development.",
    "DONDA 2 [V2]": "After releasing DONDA 2 via the Stem Player in 2022, Ye would eventually move onto other projects. However, the project never left his mind, with some songs continuing to be considered in the VULTURES era. 2025 would see Ye enter a new era of creative fuel, once again working on multiple projects at once. With plans to release BULLY and CUCK, Ye also spoke of plans to officially release DONDA 2, repeatedly saying he planned to \"re-record\" verses and upload a finished version of the album. The album released in April 2025, with rough mixing and AI vocals.",
    "IN A PERFECT WORLD": "While working on CUCK, Ye was also working on another separate solo project titled IN A PERFECT WORLD. After taking to Twitter in May 2025 to supposedly \"denounce\" his antisemitism, Ye would return to being mostly absent from social media and the public eye, as well as admitting himself and Bianca into a wellness retreat. In late-June, Ye would announce another album name change to IN A PERFECT WORLD, seemingly implying a merger between CUCK and the aformentioned solo album.",
    "BULLY [V2]": "After the release of BULLY V1, Ye confirmed his intention to re-sing the AI on BULLY and stated it was being mixed. The album would see several delays from September 22nd to March 27th, 2026. On January 3rd, preorder options and physicals were posted to yeezy.com alongside an updated tracklist. The YZY team would claim that the album is free of AI vocals, later confirmed when Ye posted a new tracklist to Twitter on March 25th, with the caption \"BULLY ON THE WAY NO AI\". The album would release a day late on March 28th, 2026. gamma. would reveal a deluxe for the album was on the way, with the release date being announced in a Spurs vs. Knicks ad as June 19th, 2026.",
    "Ongoing": "Multiple inside sources claimed that Ye has been working on a solo project separate from BULLY since the cancellation of CUCK. This was thought to be IN A PERFECT WORLD, but given what we have from that album, it is more than likely a whole separate project. Following his apology to Rabbi Yosef Pinto, Ye also began meeting with collaborators such as Travis Scott and Playboi Carti to apologize to them for his behavior, among others such as Ty Dolla $ign and Kid Cudi. The cover for this era is from the single \"GEMINI SEASON\".",
  },

  ALBUM_SONG_COUNTS: {},

  CUSTOM_ALBUM_INFO: {},

  ERA_MAPPINGS: {
    "BULLY": "BULLY [V1]",
    "Bully": "BULLY [V1]",
    "Donda [V1]": "DONDA [V1]",
    "Hitler": "LOVE EVERYONE",
    "DONDA 2": "DONDA 2 [V1]",
  },

  TAG_MAP: {
    '⭐': 'Best Of',
    '🏆': 'Grails',
    '🥇': 'Wanted',
    '🏅': 'Wanted',
    '✨': 'Special',
    '🗑️': 'Worst Of',
    '🗑': 'Worst Of',
    '🚮': 'Unwanted',
    '🤖': 'AI',
    '⁉️': 'Lost Media',
    '⁉': 'Lost Media',
    '❓': 'Unknown',
  },

  ERA_THEMES: {},

  TAG_TOOLTIP_MAP: {
    'Best Of': 'some of the best leaks hosted on the tracker.',
    'Grails': 'the most wanted songs that have not yet leaked in full.',
    'Wanted': 'Songs that are wanted, but not as wanted as "Grails".',
    'Special': 'special songs that are not good enough to be in Best Of, but still deserves to be highlighted.',
    'Worst Of': 'some of the worst leaks hosted on the tracker.',
    'Unwanted': "Songs that we don't want to leak in full.",
    'AI': 'Track contains AI vocals.',
    'Lost Media': "Is currently lost, or we don't have a link to the media.",
  },
};
