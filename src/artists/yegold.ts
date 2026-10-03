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
    "Jesus Is Born": "https://i.ibb.co/nN2LDSxN/SSC.jpg",
    "JESUS IS LORD": "https://i.ibb.co/nN2LDSxN/SSC.jpg",
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
    "JESUS IS LORD": "??/??/????",
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

  // DAYTONA/NASIR/K.T.S.E./NEVER STOP/YE-I/The Elementary School Dropout — all
  // present on yzygold's (Suzy's) sheet — don't exist as eras on the real
  // yetracker.net document at all; Sunday Service Choir content there is
  // split across two real eras instead, both kept out of the main grid.
  HIDDEN_ALBUMS: ['Jesus Is Born', 'JESUS IS LORD'],

  ALBUM_DESCRIPTIONS: {
    "CARTI YE": "A collaborative mixtape between Ye and Playboi Carti. The two linked up for the \"2024\" music video shoot on 12/13/2023, and the project's existence was later confirmed by Ye before being scrapped on 03/15/2025.",
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
