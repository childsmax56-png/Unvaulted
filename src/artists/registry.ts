import type { ArtistConfig } from './types';
import { yzygoldConfig } from './yzygold';
import { yegoldConfig } from './yegold';
import { yelolgoldConfig } from './yelolgold';
import { vampgoldConfig } from './vampgold';
import { kdotgoldConfig } from './kdotgold';
import { drizzygoldConfig } from './drizzygold';
import { xgoldConfig } from './xgold';
import { cactigoldConfig } from './cactigold';
import { dregoldConfig } from './dregold';
import { pushagoldConfig } from './pushagold';
import { shadygoldConfig } from './shadygold';
import { twizzygoldConfig } from './twizzygold';
import { uzigoldConfig } from './uzigold';
import { wolfgoldConfig } from './wolfgold';
import { juicegoldConfig } from './juicegold';
import { luckigoldConfig } from './luckigold';
import { dongoldConfig } from './dongold';
import { colegoldConfig } from './colegold';
import { aapgoldConfig } from './aapgold';
import { mfgoldConfig } from './mfgold';
import { mjgoldConfig } from './mjgold';
import { slimegoldConfig } from './slimegold';
import { sosagoldConfig } from './sosagold';
import { gorillazgoldConfig } from './gorillazgold';
import { rihannagoldConfig } from './rihannagold';
import { fiftygoldConfig } from './fiftygold';
import { teccagoldConfig } from './teccagold';
import { keemgoldConfig } from './keemgold';
import { lonelygoldConfig } from './lonelygold';
import { futuregoldConfig } from './futuregold';
import { denzelgoldConfig } from './denzelgold';
import { cudigoldConfig } from './cudigold';
import { smokegoldConfig } from './smokegold';
import { jojigoldConfig } from './jojigold';
import { jayzgoldConfig } from './jayzgold';
import { macgoldConfig } from './macgold';
import { frankgoldConfig } from './frankgold';
import { kengoldConfig } from './kengold';
import { d4vdgoldConfig } from './d4vdgold';
// Big-update mass import (scripts/build-bigupdate-csvs.py)
import { szagoldConfig } from './szagold';
import { aaliyahgoldConfig } from './aaliyahgold';
import { antclemonsgoldConfig } from './antclemonsgold';
import { badbunnygoldConfig } from './badbunnygold';
import { chancegoldConfig } from './chancegold';
import { gambinogoldConfig } from './gambinogold';
import { chrisbrowngoldConfig } from './chrisbrowngold';
import { coldplaygoldConfig } from './coldplaygold';
import { daftpunkgoldConfig } from './daftpunkgold';
import { dannybrowngoldConfig } from './dannybrowngold';
import { doechiigoldConfig } from './doechiigold';
import { gibbsgoldConfig } from './gibbsgold';
import { gunnagoldConfig } from './gunnagold';
import { icecubegoldConfig } from './icecubegold';
import { jamesblakegoldConfig } from './jamesblakegold';
import { lauryngoldConfig } from './lauryngold';
import { nasgoldConfig } from './nasgold';
import { stevelacygoldConfig } from './stevelacygold';
import { trippiegoldConfig } from './trippiegold';
import { tydollagoldConfig } from './tydollagold';
import { ushergoldConfig } from './ushergold';
import { weekndgoldConfig } from './weekndgold';
import { westsidegoldConfig } from './westsidegold';
import { wutanggoldConfig } from './wutanggold';
import { clipsegoldConfig } from './clipsegold';
import { daxgoldConfig } from './daxgold';
import { deathgripsgoldConfig } from './deathgripsgold';
import { delasoulgoldConfig } from './delasoulgold';
import { premiergoldConfig } from './premiergold';
import { dmxgoldConfig } from './dmxgold';
import { dualipagoldConfig } from './dualipagold';
import { earlgoldConfig } from './earlgold';
import { olivertreegoldConfig } from './olivertreegold';
import { fiviogoldConfig } from './fiviogold';
import { jpegmafiagoldConfig } from './jpegmafiagold';
import { migosgoldConfig } from './migosgold';
import { nbayoungboygoldConfig } from './nbayoungboygold';

export const ARTIST_REGISTRY: Record<string, ArtistConfig> = {
  // Featured + pinned lineup drives the landing page order (see LandingPage.tsx)
  yegold: yegoldConfig,          // Featured (Ye) — default tracker, yetracker.net/.cc links
  yzygold: yzygoldConfig,        // Ye alt ("Suzy") — hidden, reachable via yegold's picker
  yelolgold: yelolgoldConfig,    // Ye alt ("Lol") — hidden, reachable via yegold's picker
  vampgold: vampgoldConfig,      // Pinned: Playboi Carti
  wolfgold: wolfgoldConfig,      // Pinned: Tyler, The Creator
  aapgold: aapgoldConfig,        // Pinned: A$AP Rocky
  drizzygold: drizzygoldConfig,  // Pinned: Drake
  mjgold: mjgoldConfig,          // Row 2: Michael Jackson
  dongold: dongoldConfig,        // Row 2: Don Toliver
  kdotgold: kdotgoldConfig,      // Row 2: Kendrick Lamar
  cactigold: cactigoldConfig,    // Row 2: Travis Scott
  slimegold: slimegoldConfig,    // Young Thug
  colegold: colegoldConfig,
  mfgold: mfgoldConfig,
  sosagold: sosagoldConfig,
  xgold: xgoldConfig,
  uzigold: uzigoldConfig,
  pushagold: pushagoldConfig,
  shadygold: shadygoldConfig,
  twizzygold: twizzygoldConfig,
  dregold: dregoldConfig,
  juicegold: juicegoldConfig,
  luckigold: luckigoldConfig,
  gorillazgold: gorillazgoldConfig,
  rihannagold: rihannagoldConfig,
  fiftygold: fiftygoldConfig,
  teccagold: teccagoldConfig,
  keemgold: keemgoldConfig,
  lonelygold: lonelygoldConfig,
  futuregold: futuregoldConfig,
  denzelgold: denzelgoldConfig,
  cudigold: cudigoldConfig,
  smokegold: smokegoldConfig,
  jojigold: jojigoldConfig,
  jayzgold: jayzgoldConfig,
  macgold: macgoldConfig,
  frankgold: frankgoldConfig,
  kengold: kengoldConfig,
  // Big-update mass import (scripts/build-bigupdate-csvs.py)
  szagold: szagoldConfig,               // SZA
  aaliyahgold: aaliyahgoldConfig,       // Aaliyah
  antclemonsgold: antclemonsgoldConfig, // Ant Clemons
  badbunnygold: badbunnygoldConfig,     // Bad Bunny
  chancegold: chancegoldConfig,         // Chance the Rapper
  gambinogold: gambinogoldConfig,       // Childish Gambino
  chrisbrowngold: chrisbrowngoldConfig, // Chris Brown
  coldplaygold: coldplaygoldConfig,     // Coldplay
  daftpunkgold: daftpunkgoldConfig,     // Daft Punk
  dannybrowngold: dannybrowngoldConfig, // Danny Brown
  doechiigold: doechiigoldConfig,       // Doechii
  gibbsgold: gibbsgoldConfig,           // Freddie Gibbs
  gunnagold: gunnagoldConfig,           // Gunna
  icecubegold: icecubegoldConfig,       // Ice Cube
  jamesblakegold: jamesblakegoldConfig, // James Blake
  lauryngold: lauryngoldConfig,         // Ms. Lauryn Hill
  nasgold: nasgoldConfig,               // Nas
  stevelacygold: stevelacygoldConfig,   // Steve Lacy
  trippiegold: trippiegoldConfig,       // Trippie Redd
  tydollagold: tydollagoldConfig,       // Ty Dolla $ign
  ushergold: ushergoldConfig,           // Usher
  weekndgold: weekndgoldConfig,         // The Weeknd
  westsidegold: westsidegoldConfig,     // Westside Gunn
  wutanggold: wutanggoldConfig,         // Wu-Tang Clan
  clipsegold:     clipsegoldConfig,     // Clipse
  daxgold:        daxgoldConfig,        // Dax
  deathgripsgold: deathgripsgoldConfig, // Death Grips
  delasoulgold:   delasoulgoldConfig,   // De La Soul
  premiergold:    premiergoldConfig,    // DJ Premier
  dmxgold:        dmxgoldConfig,        // DMX
  dualipagold:    dualipagoldConfig,    // Dua Lipa
  earlgold:       earlgoldConfig,       // Earl Sweatshirt
  olivertreegold: olivertreegoldConfig, // Oliver Tree
  fiviogold:      fiviogoldConfig,      // Fivio Foreign
  jpegmafiagold:  jpegmafiagoldConfig,  // JPEGMAFIA
  migosgold:      migosgoldConfig,      // Migos
  nbayoungboygold: nbayoungboygoldConfig, // NBA YoungBoy
  // Easter egg — hidden from the landing grid, reached by searching "d4vd".
  d4vdgold: d4vdgoldConfig,
};

export const ARTIST_LIST: ArtistConfig[] = Object.values(ARTIST_REGISTRY);

export function getArtistConfig(slug: string): ArtistConfig | undefined {
  return ARTIST_REGISTRY[slug];
}
