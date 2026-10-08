import type { ArtistConfig } from './types';

// Oliver Tree tracker. Data served from committed CSV snapshots under
// public/olivertreegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const olivertreegoldConfig: ArtistConfig = {
  slug: 'olivertreegold',
  SITE_NAME: 'OLIVERTREEGOLD',
  SITE_DESCRIPTION: 'The Best Oliver Tree Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/olivertreegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'olivertreegold_',
  sheetCreator: 'Cowtools, TyreimBy, Aurien',

  HARDCODED_SHEET_ID: '1rhvQ9F8VRAj-jOyTLsvhORsVCyvcMRXJuGoDR1-z4jY',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#0284c7',
  artistLabel: 'Oliver Tree',
  cardLetter: 'O',
  logoUrl: '',
  artistPhotoUrl: '/artists/olivertreegold.jpg',

  getArtistName() {
    return 'Oliver Tree';
  },

  CUSTOM_IMAGES: {
    'The Last Supper': '/olivertreegold/eras/the-last-supper.jpg',
    'Splitting Branches': '/olivertreegold/eras/splitting-branches.jpg',
    'CalArts': '/olivertreegold/eras/calarts.jpg',
    'Untitled Soul Album': '/olivertreegold/eras/untitled-soul-album.jpg',
    'Squirt': '/olivertreegold/eras/squirt.jpg',
    'Turbo': '/olivertreegold/eras/turbo.png',
    'Ugly is Beautiful [V1]': '/olivertreegold/eras/ugly-is-beautiful-v1.jpg',
    'Ugly is Beautiful [V2]': '/olivertreegold/eras/ugly-is-beautiful-v2.jpg',
    'Little Ricky ZR3': '/olivertreegold/eras/little-ricky-zr3.jpg',
    'Cowboy Tears': '/olivertreegold/eras/cowboy-tears.jpg',
    'Super Computer': '/olivertreegold/eras/super-computer.jpg',
    'Unknown EP': '/olivertreegold/eras/unknown-ep.jpg',
    'Love You Madly, Hate You Badly': '/olivertreegold/eras/love-you-madly-hate-you-badly.jpg',
    'Posthumous': '/olivertreegold/eras/posthumous.jpg',
  },

  ALBUM_RELEASE_DATES: {
    'The Last Supper': '??/??/????',
    'Splitting Branches': '02/17/2013',
    'CalArts': '??/??/2014',
    'Untitled Soul Album': '??/??/????',
    'Squirt': '??/??/????',
    'Turbo': '??/??/????',
    'Ugly is Beautiful [V1]': '??/??/????',
    'Ugly is Beautiful [V2]': '05/28/2021',
    'Little Ricky ZR3': '??/??/????',
    'Cowboy Tears': '02/18/2022',
    'Drown the World': '??/??/????',
    'Alone in a Crowd': '??/??/????',
    'Super Computer': '10/06/2023',
    'Unknown EP': '??/??/????',
    'Love You Madly, Hate You Badly': '04/24/2026',
    'Post-LYMHYB': '??/??/????',
    'Posthumous': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'The Last Supper': 'Oliver began posting music on Soundcloud in mid-2010, under the pseudonym \'Kryph\', primarily producing instrumental dubstep tracks with Getter and other artists around Santa Cruz. Oliver would also perform freestyle raps, and gradually began incorporating his vocals into his music. Around 2011, Oliver announced via his Soundcloud comments that he would be releasing an EP titled \'The Last Supper\', featuring updated mixes of his songs - however, it never surfaced.',
    'Splitting Branches': 'As Tree began to branch out and collaborate with more creators around the Santa Cruz bay area, his style developed into a more experimental and melodic sound, incorporating electronic elements inspired by the likes of Aphex Twin, Mount Kimbie & Nosaj Thing. His unique style gradually drew more attention to his Soundcloud, culminating in him signing to R&S Records in 2013. Under the label, Oliver released his debut EP, Demons, as well as a free mixtape titled Splitting Branches, a collection of his work over the past two years with a few new tracks included.',
    'CalArts': 'In 2014, Oliver began a hiatus from releasing music to study at CalArts, and during this time he continued to develop his electronic style, producing a vast amount of experimental demos and songs. He made his return in 2016 as Oliver Tree and debuted the character \'Turbo\', beginning as a simple joke in a vine and quickly becoming somewhat of a viral sensation. Seeing the marketing potential in the meme, manager Dan Awad reached out to Oliver and connected him to Whethan, and the two began producing music together, marking a shift in Oliver\'s sound. In July 2016, Dan Awad and Danny Kang bought Oliver out of his R&S Records deal, and he and Whethan began releasing music together, with immediate commercial success.',
    'Untitled Soul Album': 'Oliver Tree and Casey Mattson began collaborating frequently as early as 2014, and over the next two years the pair would produce an unnamed \'Soul Album\' together, among other projects. Vocals from Noosa, who collaborated frequently with the two in 2016, also featured prominently in sessions for this project. The album got relatively far into production, with several finished tracks and a partially recorded music video, but much like Oliver\'s other projects from this time, the album would be scrapped as Oliver shifted to a more mainstream sound. The cover art used for this era is unofficial.',
    'Squirt': 'Oliver continued to experiment with incorporating his love of old-school hip-hop into his sound, and he and Getter collaborated frequently around this time to bring this sound to life. The two produced a collaborative mixtape called \'Squirt\', described by Oliver as a tribute to J-Dilla consisting of remixes of hip-hop classics with Oliver\'s own raps thrown in. The mixtape was announced by Oliver via interviews in 2016, with the release planned for that summer, and was almost finished before it was quietly scrapped. The cover art used for this era is unofficial, using a photoshoot from this period that may or may not have actually been intended for this project.',
    'Turbo': 'Announced in 2017, \'Turbo\' was originally intended to be Oliver\'s debut studio album under Atlantic. Following the success of When I\'m Down in 2016, and the surprise virality of Oliver\'s \'Turbo\' gimmick, Atlantic Records took notice of his work and signed him in April 2017, a month before he graduated from CalArts. At this point, Oliver and Whethan had been working together extensively, and this indie-pop evolution of Oliver\'s sound was proving to be a success; thus, under Atlantic\'s guidance, the album \'Turbo\' was put together to introduce his style to the wider world. The rollout for the project began swiftly in August 2017, with Oliver previewing new music at live shows. Singles began dropping frequently, but soon the album would be delayed, with the Alien Boy EP being released as a substitute. However, as Oliver\'s popularity began to skyrocket, it seems Atlantic decided \'Turbo\' would no longer fit the bill, and Oliver needed to go bigger - the project was scrapped some time in 2018, with work beginning on a new album.',
    'Ugly is Beautiful [V1]': 'With Oliver\'s popularity growing far quicker than expected, a new, bolder debut album was needed, with much more investment and promotion behind it, as Atlantic Records seemingly began to realize Oliver had far more potential than the indie-pop artist they thought they had signed. Oliver began leaning heavier into the more aggressive, alt-rock sound that was proving to be successful, and Ugly is Beautiful was born. The new project was announced in December 2018, with \'Hurt\' released as its lead single, but once again delays began to plague the rollout, likely due to Oliver\'s success continuing to grow exponentially. After missing its intended 2019 release, the album was delayed to 2020 and reworked, with the Do You Feel Me? EP releasing as a substitute.',
    'Ugly is Beautiful [V2]': 'With the album once again pushed back and reworked to maximise its mainstream appeal, the second rollout for Ugly is Beautiful began in December 2019, with \'Cash Machine\' released as its new lead single. At this point, Oliver had toured twice for this album, despite having no album out, and it was becoming notorious for its track record of constant delays - but the delays were not done yet, and the album would miss several 2020 release dates for increasingly absurd reasons, as Oliver and his team played into the hype surrounding the project. Eventually, in July 2020, Ugly is Beautiful was finally released, to critical acclaim and commercial success, solidifying Oliver\'s place in the alt-pop mainstream.',
    'Little Ricky ZR3': 'Some time in 2017, Oliver began experimenting with autotune-heavy psychedelic trap music, and would develop this idea over the next few years into Little Ricky ZR3, a side-project characterised by atmospheric, space-like futuristic hip-hop. Little Ricky is presented as a character in Oliver Tree\'s \'universe\', an alien from another planet who traveled to Earth to produce music, embodying the otherworldly sound of his songs. Oliver revealed this project to the world for the first time in 2020, with a mixtape planned for that summer. However, no mixtape arrived. The delay went unexplained, and for a while Ricky seemed forgotten, until in 2022 where Oliver began discussing the project again, and played several upcoming Ricky songs live throughout the following year. However, following mass leaks of Little Ricky ZR3 songs online, Oliver once again went quiet about the project, and in 2024 he stated via an interview that Ricky was \'fired\', suggesting that the project is now scrapped.',
    'Cowboy Tears': 'As work on Cowboy Tears picked up pace throughout 2021, Oliver began working on its deluxe counterpart, a punk-rock double album building on the original project\'s acoustic alt-pop sound with more aggression and depth, enlisting the help of Travis Barker to engineer the drums. After being plagued with delays due to issues with Atlantic Records as well as the sudden unexpected popularity of Miss You, and much of the material for the album leaking online, the deluxe album eventually dropped in December 2022 with fairly minimal promotion, concluding the Cowboy Tears arc.',
    'Super Computer': 'Alongside Alone in a Crowd\'s announcement in 2023, Oliver\'s newest project, Super Computer, was debuted at his Red Rocks live show. Super Computer are presented as a duo with computer screens for heads, who perform EDM music produced by Oliver and Whethan - the tracks do not contain vocals from Oliver, and instead use various short vocal samples. They are signed to Alien Boy Records, Oliver\'s own record label, alongside Little Ricky ZR3.',
    'Unknown EP': 'After touring together extensively in 2023, and teasing new music, Oliver would confirm in an interview in late 2023 that he and Tommy Cash had planned on releasing a collab EP together, but both decided to focus on their own music before releasing it. It\'s unknown if they were still planning to release it after LYMHYB and Tommy Cash\'s upcoming album. The cover art used for this era is unofficial.',
    'Love You Madly, Hate You Badly': 'Oliver began travelling extensively from 2024, becoming increasingly disillusioned with the music industry and the way social media "rewards the promotion of art more than the art itself", in his own words. As he travelled, he began producing music alone in hotel rooms, with the objective of making music for himself again instead of for the masses, aiming to recapture the passion and expression of his earlier days of making music. Out of these sessions came \'Love You Madly, Hate You Badly\', Oliver\'s fourth and final studio album, which released in April 2026.',
    'Post-LYMHYB': 'Following the release of Love You Madly, Hate You Badly, Oliver continued to travel and record new music. It\'s unknown what plans he had for future releases. On the morning of June 14, 2026, just before 9 a.m. while travelling to record a video with Youtuber Gaspi, another helicopter colided with theirs and all six lost their lives.',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'The Last Supper',
    'Splitting Branches',
    'CalArts',
    'Untitled Soul Album',
    'Squirt',
    'Turbo',
    'Ugly is Beautiful [V1]',
    'Ugly is Beautiful [V2]',
    'Little Ricky ZR3',
    'Cowboy Tears',
    'Drown the World',
    'Alone in a Crowd',
    'Super Computer',
    'Unknown EP',
    'Love You Madly, Hate You Badly',
    'Post-LYMHYB',
    'Posthumous'
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
