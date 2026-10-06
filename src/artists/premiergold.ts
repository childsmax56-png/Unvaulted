import type { ArtistConfig } from './types';

// DJ Premier tracker. Data served from committed CSV snapshots under
// public/premiergold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const premiergoldConfig: ArtistConfig = {
  slug: 'premiergold',
  SITE_NAME: 'PREMIERGOLD',
  SITE_DESCRIPTION: 'The Best DJ Premier Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/premiergold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'premiergold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1RaAzCb3IAg0FZas9dsAMqU785xw1sDYIvx3-SVFEVsY',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#b45309',
  artistLabel: 'DJ Premier',
  cardLetter: 'P',
  logoUrl: '',
  artistPhotoUrl: '/artists/premiergold.jpg',

  getArtistName() {
    return 'DJ Premier';
  },

  CUSTOM_IMAGES: {
    'Before No More Mr. Nice Guy': '/premiergold/eras/before-no-more-mr-nice-guy.png',
    'No More Mr. Nice Guy': '/premiergold/eras/no-more-mr-nice-guy.jpg',
    'Step in the Arena': '/premiergold/eras/step-in-the-arena.jpg',
    'Daily Operation': '/premiergold/eras/daily-operation.jpg',
    'Hard to Earn': '/premiergold/eras/hard-to-earn.jpg',
    'Moment of Truth': '/premiergold/eras/moment-of-truth.jpg',
    'Full Clip: A Decade Of Gang Starr': '/premiergold/eras/full-clip-a-decade-of-gang-starr.png',
    'The Ownerz': '/premiergold/eras/the-ownerz.jpg',
    'DJ Premier Presents - Get Used To Us': '/premiergold/eras/dj-premier-presents-get-used-to-us.jpg',
    'Hustlaz Union: Local NYG [V1]': '/premiergold/eras/hustlaz-union-local-nyg-v1.jpg',
    'KoleXXXion': '/premiergold/eras/kolexxxion.jpg',
    'PRhyme': '/premiergold/eras/prhyme.jpg',
    'Hustlaz Union: Local NYG [V2]': '/premiergold/eras/hustlaz-union-local-nyg-v2.png',
    'PRhyme 2': '/premiergold/eras/prhyme-2.jpg',
    'One of the Best Yet': '/premiergold/eras/one-of-the-best-yet.jpg',
    'Hip Hop 50: Vol. 1': '/premiergold/eras/hip-hop-50-vol-1.jpg',
    'The Coldest Profession': '/premiergold/eras/the-coldest-profession.png',
    'The Reinvention': '/premiergold/eras/the-reinvention.jpg',
    'Light-Years': '/premiergold/eras/light-years.png',
    'Ongoing': '/premiergold/eras/ongoing.png',
    'Unknown': '/premiergold/eras/unknown.png',
  },

  ALBUM_RELEASE_DATES: {
    'Before No More Mr. Nice Guy': '??/??/????',
    'No More Mr. Nice Guy': '06/09/1989',
    'Step in the Arena': '01/15/1991',
    'Daily Operation': '05/05/1992',
    'Hard to Earn': '03/08/1994',
    'Moment of Truth': '03/31/1998',
    'Full Clip: A Decade Of Gang Starr': '07/13/1999',
    'The Ownerz': '06/24/2003',
    'DJ Premier Presents - Get Used To Us': '12/07/2010',
    'Hustlaz Union: Local NYG [V1]': '??/??/????',
    'KoleXXXion': '03/27/2012',
    'PRhyme': '12/09/2014',
    'Hustlaz Union: Local NYG [V2]': '??/??/????',
    'PRhyme 2': '01/07/2015',
    'One of the Best Yet': '11/04/2019',
    'Hip Hop 50: Vol. 1': '07/15/2022',
    'The Coldest Profession': '08/08/2025',
    'The Reinvention': '03/31/2025',
    'Light-Years': '12/12/2025',
    'Ongoing': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {
    'Before No More Mr. Nice Guy': 'The brand of Gang Starr began in the early 80s when Keith Elam (Guru) met Cary Guy (Big Shug) & Shug\'s brother DJ Suave D at parties held in Morehouse College, Atlanta GA. Familiar with eachother as Boston natives, they formed a bond resulting in Shug teaching Keith how to rap and the three performing together at small parties & venues (by this time Keith went by MC Keithy E). When they attempted to get signed to a record label, however, they didn\'t have a name, and Shug came up with "Gangsters" but Keith found the name too edgy for rap at the time, coming up with "Gangstarr". The two of them designed the logo and moved forward with the brand until Shug got locked up around 1986, leading Suave D to leave the group as well.   Keith promptly went back to Boston and found other members to rebuild the group, including DJ 1 2 B-Down and beatboxer Damo D-Ski. They linked with producer Beatmaster Jay to produce various songs for local radio, and later got signed without Jay to WIld Pitch Records. Known as The Gangstarr Crew, they made a handful of singles for Wild Pitch, but none blew, leading Damo D and 1 2 B-Down to leave the group and only Keith to continue the name.',
    'No More Mr. Nice Guy': 'Though without artistic success, by the late 80s Keithy E had long earned himself a Bachelor\'s degree in Business, enrollment in the Fashion Institute of Technology in Manhattan (though he dropped out to pursue music) and an A&R position at Wild Pitch Records. It was there where Keith - still looking for a DJ to record with - got artists such as Lord Finesse & "Waxmaster C" signed, and decided to record new material with the latter\'s demo. Soon, he brought in Waxmaster C and labelmate The 45 King for recording sessions, leading Wax C to become DJ Premier and unite with Keithy E (now Guru) as Gang Starr.',
    'Daily Operation': '(01/15/1991) (Step in the Arena officially releases)  (05/05/1992) (Daily Operation officially releases)',
    'Moment of Truth': '(03/08/1994) (Hard to Earn officially releases)  (03/31/1998) (Moment of Truth officially releases)',
    'Full Clip: A Decade Of Gang Starr': '(03/31/1998) (Moment of Truth releases) (07/13/1999) (Full Clip: A Decade of Gang Starr releases)',
    'DJ Premier Presents - Get Used To Us': 'Sources conflict on the exact reasons for Gang Starr\'s split (Premier refuses to admit they officially broke up) but the facts say they stayed active through early 2004 to tour their album. They also recorded their last song "Counter Punch" for Big Shug\'s debut album "Who\'s Hard". Later on, Shug & Premier attempted to reconnect with Guru at about two of his concerts in New York, but they were both cancelled. By mid 2007, Guru had grown distant from most his old collaborators and been focused on building the label 7 Grand Records with DJ Solar, while Premier started his own label Year Round Records. Year Round had their first release with the NYG\'z album "Welcome 2 G-Dom", and three years later Preemo began putting together an album to promote his label.',
    'Hustlaz Union: Local NYG [V1]': 'I\'ll write a bio on this in a min, very interesting stuff',
    'KoleXXXion': 'In late 2010 DJ Premier sent his album "Beats That Collected Dust Vol. 2" to longtime collaborator Bumpy Knuckles aka Freddie Foxxx. To the former\'s surprise, Bumpy recorded songs over every beat and sent them back, which inspired both of them to do a full length collaborative project. This materialized as an album largely consisting of 2000s throwaway tracks, obscure pre-released album cuts, and new rhymes over Preemo beats rejected by other artists, aptly named "Kolexxxion" in reference to this as well as Bump\'s 2003 album "Konexion". Some songs that didn\'t make the cut appeared on the EP "Stoodiotyme" in 2011.',
    'PRhyme': 'In an interview for IDEA GENERATION, Premier broke down the origin of this album.  He stated that while the release of Slaughterhouse\'s second album was being delayed, A&R Mike Herrard suggested he produce an EP for the group to tide fans over, but with composer Adrian Younge\'s music as the main source of sampling. While Slaughterhouse liked the idea, Preemo rejected it due to his preferral to dig for older sounds, but in 2014 Royce da 5\'9 brought the idea back up for a collab project with him, which Preemo ended up trying out.',
    'Hustlaz Union: Local NYG [V2]': 'I\'ll write a bio on this in a min, very interesting stuff',
    'One of the Best Yet': 'It goes without question that Guru\'s death and purported "deathbed letter" released by John "Solar" Mosher were met with high controversy, but it wasn\'t until 2012 that Guru\'s family took Solar to court over his music. In 2014 the courts gave Guru\'s family full equitable control of his music, however no one on their side (including DJ Premier, who was supposedly involved in the legal battle) was able to obtain his unreleased music from the producer before the case was closed. That was until 2016, when Solar & Premier\'s attorneys reached a deal to have 30 unreleased Guru tracks sold for allegedly $150,000. Upon getting clearance from Guru\'s family, Premier began constructing songs around the vaulted Guru tracks in late 2017, making what would become Gang Starr\'s closing album.',
    'The Reinvention': 'A seven-track collab album notably made in one week.',
    'Light-Years': 'The highly-anticipated collaborative album between Nas and DJ Premier. It originally started work in January 2006 and devolopment was on and off until the mid 2010\'s. Inbetween this time period at least 7 tracks were completed. In early 2024, the album recieved way more focus and was worked on a lot more with it eventually releasing on December 12, 2025 through Nas\' independent record label, Mass Appeal Records.',
    'Ongoing': 'Shortly following his 2025 album run, Premier has famously embarked on the "He\'s The Preemo, I\'m The Chemist" tour with The Alchemist, releasing multiple collaborative singles with the rapper-producer. Era cover is from the artwork of their single "For The Gig".',
  },
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Before No More Mr. Nice Guy',
    'No More Mr. Nice Guy',
    'Step in the Arena',
    'Daily Operation',
    'Hard to Earn',
    'Moment of Truth',
    'Full Clip: A Decade Of Gang Starr',
    'The Ownerz',
    'DJ Premier Presents - Get Used To Us',
    'Hustlaz Union: Local NYG [V1]',
    'KoleXXXion',
    'PRhyme',
    'Hustlaz Union: Local NYG [V2]',
    'PRhyme 2',
    'One of the Best Yet',
    'Hip Hop 50: Vol. 1',
    'The Coldest Profession',
    'The Reinvention',
    'Light-Years',
    'Ongoing',
    'Unknown'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
