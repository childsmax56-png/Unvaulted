import { getCommunityTrackerCsv } from './_community';
import { fetchSheetApiCsv, hasSheetApiSource } from './_sheetsApi';
import { splitCSVRows, joinCSVRows } from './_csvParser';

// Live Google Sheet fallback for trackers that don't ship committed CSVs.
//
// Most trackers store their data as static CSVs under public/<slug>/data/*.csv
// (exported from their Google Sheet and committed to the repo). A few trackers
// are wired to read straight from the live Google Sheet instead — for those the
// endpoints fetch the sheet's CSV export at request time. This keeps the tracker
// working without a committed snapshot, at the cost of a live dependency on the
// sheet staying public.
//
// Keyed by artist slug → spreadsheet id + per-tab gid. Add a tab here only when
// that tab's gid exists in the source sheet.
interface SheetSource {
  sheetId: string;
  gids: Record<string, string>;
}

// gids are enumerated from a sheet's public /htmlview by scripts/build-sheet-tabs.mjs.
// Only add a tracker here after confirming its live export preserves working links
// (some trackers merge links from a separate source into their committed CSV and the
// live sheet stores them differently — those must stay committed-CSV-only).
const SHEET_SOURCES: Record<string, SheetSource> = {
  frankgold: {
    sheetId: '1wlztKH_bwoTDtMZFm8-lYqzZWLCGf-XqE-gea-nGR0Y',
    gids: {
      unreleased: '44489322',
      released: '1454863518',
      recent: '1122958563',
      tracklists: '1543259143',
      stems: '1010941390',
      'album-copies': '1324887433',
      'music-videos': '1257792866',
      fakes: '510511701',
      art: '1257812670',
    },
  },
  yzygold: {
    sheetId: '12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM',
    gids: {
      unreleased: '199908479',
      released: '1295931150',
      recent: '1385926980',
      stems: '495336364',
      'album-copies': '1297512832',
      art: '1659647236',
      'music-videos': '1115193942',
      misc: '70063278',
      tracklists: '1372270223',
      fakes: '61838480',
    },
  },
  pushagold: {
    sheetId: '1bZ66RGgo5i_RorCtSTh4xX2tXwag2R-Zu3MsEGzrp1A',
    gids: {
      unreleased: '44489322',
      released: '1454863518',
      recent: '1122958563',
      stems: '1010941390',
      'album-copies': '1324887433',
      'music-videos': '1257792866',
      art: '1729133432',
    },
  },
  aapgold: {
    sheetId: '1rbt_VyQyHEfVRv_XmVBNrwMyF0uMx7FF-1T8-N0wf0E',
    gids: {
      unreleased: '1701548408',
      released: '2062057461',
      recent: '575509772',
      stems: '1534576419',
      fakes: '1315686298',
      'music-videos': '951684041',
      'album-copies': '1730161920',
      tracklists: '1024624532',
    },
  },
  colegold: {
    sheetId: '1hjMtB-acUEpXYkR6TWQVeVoUzSLrAVIdy1lMoM6aFFw',
    gids: {
      unreleased: '233442733',
      released: '415398936',
      recent: '809419204',
      art: '1382334609',
      stems: '1815223674',
      tracklists: '1282750024',
    },
  },
  dongold: {
    sheetId: '1qsO4SuzzB17d5orqbKWHsaQsRdk0lzTSF9rV2FwQf-Q',
    gids: {
      unreleased: '1535277716',
      released: '109676350',
      recent: '1891166449',
      art: '1054259274',
      stems: '999848743',
      fakes: '1830541966',
      'music-videos': '689795446',
      tracklists: '1236129964',
    },
  },
  drizzygold: {
    sheetId: '1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI',
    gids: {
      unreleased: '755606328',
      recent: '1786784552',
      // art intentionally omitted: most Art-tab cover art is pasted in as embedded
      // images (drawings), which the CSV export drops — 140+ of ~207 rows would come
      // back blank. The committed public/drizzygold/data/art.csv has those images
      // extracted to local files (scripts/build-drizzygold-art.py); serve that instead.
      stems: '271384102',
      fakes: '1413935661',
      'music-videos': '1645905193',
      'album-copies': '1680594839',
      tracklists: '230473404',
    },
  },
  kdotgold: {
    sheetId: '1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI',
    gids: {
      unreleased: '1169728352',
      released: '95049489',
      recent: '1122958563',
      art: '1807741861',
      stems: '1574419325',
      misc: '1439258306',
      'music-videos': '1743777120',
      'album-copies': '224191847',
    },
  },
  luckigold: {
    sheetId: '1zoRNpy7Lvr-JzPqtQLLWRVVDbgKygpBaDf4cC-Lt6k4',
    gids: {
      unreleased: '306146520',
      released: '1101697369',
      recent: '1422898255',
      'music-videos': '112443966',
      tracklists: '1592344998',
    },
  },
  mfgold: {
    sheetId: '1zEbzMVXFXzuY4wLdPvdQA23lb3RwCSOKqWtHsllXNk8',
    gids: {
      unreleased: '1493533867',
      released: '1686511551',
      recent: '1476766908',
      misc: '146029414',
    },
  },
  mjgold: {
    sheetId: '1i59TKrIZ1OvFFPJFuOMw1VXlvyzaVOH0Wb0vVJp9BTw',
    gids: {
      unreleased: '528227019',
      released: '331829674',
      recent: '180906153',
      stems: '314764055',
      tracklists: '608188924',
    },
  },
  shadygold: {
    sheetId: '1x9tTOOqH5WpKOoptdQzABSN_x8oZbMgzIGlGH9w1IKA',
    gids: {
      unreleased: '1792554832',
      stems: '965054462',
      misc: '531726349',
      fakes: '336831316',
      released: '1452347467',
      recent: '824959194',
      tracklists: '1443132755',
    },
  },
  slimegold: {
    sheetId: '12zc2reK5y8XP6SQhv1ujQtiG9VpJy7yDWwDuE-S-wpc',
    gids: {
      unreleased: '0',
      released: '1510699798',
      recent: '1507357362',
      art: '171524654',
      stems: '197907807',
      tracklists: '1999300901',
    },
  },
  sosagold: {
    sheetId: '1oDE9gTnEG7ufPQIOMjLTegfI47qtgNCxngmxxHZL4qA',
    gids: {
      unreleased: '1792554832',
      released: '766098554',
      recent: '1321754498',
      'music-videos': '943677178',
      tracklists: '1885470461',
    },
  },
  vampgold: {
    sheetId: '1Irtfvymu26CShYowLMMfD-rM0o9CJqE6-BBSlYsAaF4',
    gids: {
      unreleased: '0',
      released: '245504108',
      recent: '1962169030',
      art: '487023460',
      stems: '711785744',
      misc: '1033793988',
      fakes: '1412910635',
      'album-copies': '19287955',
    },
  },
  wolfgold: {
    sheetId: '19GJTNp7PxK1OtyVBmGelZSMm5i8Fy82EGtcFdIkBpsY',
    gids: {
      unreleased: '1246511510',
      released: '137554735',
      // recent intentionally omitted: the Recent tab is served from the committed
      // public/wolfgold/data/recent.csv, scraped from tylertracker.net's mirror
      // (gid 1356276013) by scripts/build-wolfgold-recent.py. The live wolfgold
      // sheet's recent tab uses an "Info/Notes" column that mapRecentItem() can't
      // read, so notes wouldn't show. Do not re-add a recent gid here.
      stems: '1415457574',
      misc: '1044127471',
      'album-copies': '788275515',
      tracklists: '660032103',
    },
  },
  twizzygold: {
    sheetId: '1FUzAZyTCgFTVxQ--qbCAS2bUk4dsAw6ASxwjURPHbyI',
    gids: {
      unreleased: '1241081326',
      released: '1617341558',
      recent: '1823522157',
      art: '1218331224',
      stems: '2044190869',
      misc: '1670912096',
      fakes: '473741106',
      'music-videos': '1411615262',
      'album-copies': '775892627',
      tracklists: '602198332',
    },
  },
  dregold: {
    sheetId: '10_QK8xP-WCdrfO6RaIkhdDtYUXaM966e6D1xWD__iIo',
    gids: {
      released: '197122594',
      art: '1835098630',
      stems: '1977589904',
      misc: '326443742',
      fakes: '935698299',
      tracklists: '1717251426',
    },
  },
  fiftygold: {
    sheetId: '1UBHQ067bIEDH3TapHIt3MCdwDNRe30Qv0VdBP9JLgFM',
    gids: {
      unreleased: '1520634709',
      released: '197122594',
      recent: '2048130339',
      stems: '1252728591',
      fakes: '735521922',
      tracklists: '1717251426',
    },
  },
  keemgold: {
    sheetId: '1_SNZQS-AAXVleukgKlraegaozkLOu8WMHbUwmPm61hc',
    gids: {
      unreleased: '0',
      released: '2114619384',
      recent: '464931598',
      art: '1176231722',
      stems: '349506651',
      misc: '1825453290',
      tracklists: '489341454',
    },
  },
  denzelgold: {
    sheetId: '1Pyi72FNT6KWuQE3g4BmIDCV26HMfKFcE650Duyia43o',
    gids: {
      unreleased: '788157788',
      released: '573566409',
      recent: '70327685',
      stems: '1395730976',
      fakes: '2106390675',
    },
  },
  lonelygold: {
    sheetId: '1J16EyxHqZD4m0VZ6g6SoY_1GC21TU7P2kk9FeteSKvE',
    gids: {
      unreleased: '2018221909',
      released: '1350443570',
      recent: '1413127973',
      stems: '1334073369',
      tracklists: '654868102',
    },
  },
  teccagold: {
    sheetId: '15UwihAVwPeS6eIE1FE1J6v7xiBYFkculVrzhMSIcEew',
    gids: {
      unreleased: '0',
      released: '866178204',
    },
  },
  macgold: {
    sheetId: '17TycQCSpIm-6DyWId4ve8fVaM7Ewg3lgV1DDNRwauh0',
    gids: {
      unreleased: '1466156873',
      released: '206286767',
      recent: '336463588',
      stems: '546408943',
      tracklists: '179600863',
    },
  },
  smokegold: {
    sheetId: '1-Kd8molYeR1WpmWR81DqmSCGng3g-AVmZfgd752kh3M',
    gids: {
      unreleased: '0',
      released: '2006526517',
      recent: '1507357362',
      art: '171524654',
      stems: '197907807',
      misc: '584899709',
      tracklists: '1999300901',
    },
  },
  gorillazgold: {
    sheetId: '1jauTeMKDULPud0hGD-gPeD-HM70HiBSedrLyOyAqUh0',
    gids: {
      stems: '2144277951',
      tracklists: '710536063',
    },
  },
  cudigold: {
    sheetId: '1fj9HcbyLbu5NGwJzbl1lExQud3FNKv-JUU6NY4OKM9Y',
    gids: {
      released: '1763054298',
      stems: '1395107855',
      misc: '1538684847',
    },
  },
  jayzgold: {
    sheetId: '18GwItf2M92QimNMAbUCfFsxCkiHlkf8DPJPLWHAcoxQ',
    gids: {
      unreleased: '1202580443',
      released: '1870935498',
      art: '1323374195',
      fakes: '1151658694',
      tracklists: '1236871730',
    },
  },
  szagold: {
    sheetId: '1mPq6ZvoQ1_kWqIH9JS8I2VbBb8WboFYyeMP2yqjtz7s',
    gids: {
      unreleased: '0',
      released: '1510699798',
      recent: '1507357362',
      stems: '197907807',
      misc: '2056492166',
      tracklists: '1999300901',
    },
  },
  ushergold: {
    sheetId: '10b5EFPYc5Qhn3A7arsruyeVOYdU4Ab9TuQqELV9joa8',
    gids: {
      unreleased: '0',
      recent: '1069608211',
    },
  },
  wutanggold: {
    sheetId: '1dA2h1kQffOmUUeCy6YMu8IYdGGqnhnWuabKdK7emyyU',
    gids: {
      unreleased: '1275210512',
      released: '538686042',
      recent: '1593953124',
      art: '1218630558',
      stems: '684268624',
      'music-videos': '147084403',
      tracklists: '1817611336',
      individual: '653347054',
      'individual-tracklists': '755186929',
    },
  },
  aaliyahgold: {
    sheetId: '1QJR4Ku4Si5kLUL1P_vi9hCkkjDQvDWqafWiYc1v_Z8E',
    gids: {
      unreleased: '0',
    },
  },
  antclemonsgold: {
    sheetId: '11Ta0gixhRv9uUq-_O9nID_rjUf3oembw57f2sblMP3k',
    gids: {
      unreleased: '768529073',
      released: '1295931150',
      recent: '1385926980',
      art: '1659647236',
      stems: '495336364',
      misc: '70063278',
      fakes: '436581104',
      'album-copies': '1297512832',
      tracklists: '1372270223',
    },
  },
  badbunnygold: {
    sheetId: '1O5RFNuOF4-K7xWCYMRQXy3Y_WkYOWu6o9zClsw8lPi4',
    gids: {
      unreleased: '1545615123',
      released: '1438821582',
      recent: '386822022',
      stems: '803627503',
      tracklists: '2035478417',
    },
  },
  chancegold: {
    sheetId: '1GdfybfLFKseuArE_Mz9iO4AatmAYWIKahn_vwGR-nTc',
    gids: {
      unreleased: '997745212',
      released: '1996914149',
      recent: '1477985219',
      art: '911302545',
      misc: '151105392',
    },
  },
  gambinogold: {
    sheetId: '1eyBjj7qPxIT_P93RaSPZf5hTJemGi5jMqSJF777OsdE',
    gids: {
      unreleased: '167922964',
      released: '257930529',
      recent: '229959219',
      art: '1922779540',
      stems: '43253513',
      misc: '2041549706',
      'album-copies': '655342835',
      tracklists: '1016050461',
    },
  },
  chrisbrowngold: {
    sheetId: '1o2M9juqyzh7EUCHm0ApKx0XSnGda6ZiM1kGrOp0EfMM',
    gids: {
      unreleased: '883120125',
      released: '2116936182',
      recent: '1774364092',
    },
  },
  coldplaygold: {
    sheetId: '1i4xfiqtONMps_FL9n_2O5UmpKKio6HUCh5y6zQniyPk',
    gids: {
      unreleased: '0',
      released: '1510699798',
      art: '171524654',
      fakes: '1642376975',
      tracklists: '1999300901',
    },
  },
  dannybrowngold: {
    sheetId: '1ybtg3wbiB63eHKGv8_ZFek3qQIoRbB8DUYAWObfeDZI',
    gids: {
      unreleased: '321437127',
    },
  },
  doechiigold: {
    sheetId: '1P2inSuDEuS_kp45qDAXJpb_hmj__Lj409bytyp4xiw8',
    gids: {
      unreleased: '0',
      released: '1563164834',
      recent: '1962169030',
      tracklists: '1038033313',
    },
  },
  gunnagold: {
    sheetId: '1P_BA-CIy05lDl9j1H06awxNqvXYJcD-KeBPVdgTO7Eo',
    gids: {
      unreleased: '1630289126',
      released: '219194829',
      recent: '263415468',
      art: '79062216',
      stems: '898457124',
      'music-videos': '1965487704',
      'album-copies': '1539349886',
      tracklists: '1476869338',
    },
  },
  icecubegold: {
    sheetId: '1bsNrVejh4H27uafX6jpnllbAuiVqRnDUMegKdTYAFQA',
    gids: {
      unreleased: '1360798347',
      released: '181755066',
      art: '480621125',
      misc: '346516143',
      'album-copies': '121169492',
      tracklists: '1369615792',
    },
  },
  jamesblakegold: {
    sheetId: '1_bPMUWLNzeMY0CtVEE3PHkuCsZL80wnA-6joAUfx7p4',
    gids: {
      unreleased: '2092886681',
    },
  },
  lauryngold: {
    sheetId: '1mq4kMsy_ntvh-yI3i2YsriW_PgFRXeaJWg5nS1v-5mU',
    gids: {
      unreleased: '1520634709',
      released: '197122594',
      recent: '2048130339',
    },
  },
  nasgold: {
    sheetId: '1-UZb9y-GQB5v3sysdUlYBxfUKDu58_Cw-TqUd8-v4U4',
    gids: {
      unreleased: '1520634709',
      released: '197122594',
      recent: '2048130339',
      misc: '716734258',
      stems: '35307781',
      tracklists: '1717251426',
      art: '1835098630',
      groupbuys: '1841567237',
    },
  },
  stevelacygold: {
    sheetId: '1xqnIw0wymufIjKfoaXGDC-KAVuF81S5quMCCX7lYQyc',
    gids: {
      unreleased: '944094987',
      released: '1546054641',
      recent: '924482142',
      stems: '1747609232',
      fakes: '974887049',
      tracklists: '1251519406',
    },
  },
  trippiegold: {
    sheetId: '1hZdGFBZmukWGH4IlnH0NJvphwEct2XEMJT_moTFhTvc',
    gids: {
      unreleased: '235787845',
      released: '1120395642',
      recent: '358090838',
      stems: '1785743284',
      'music-videos': '732956569',
      tracklists: '1800483758',
    },
  },
  weekndgold: {
    sheetId: '1luU-KL_vKt72goUpSO2F0qMvXyqaT_q8VwYNjPeLgTg',
    gids: {
      unreleased: '766670282',
      released: '340594683',
      recent: '881985249',
      art: '140625672',
      stems: '472927053',
      misc: '685628973',
      tracklists: '337423375',
    },
  },
  tydollagold: {
    sheetId: '11Kk3Mi8iiFmXEFV8vzcmTrnjcMkfgImABCavXhC4D48',
    gids: {
      unreleased: '2000110692',
      released: '663137012',
      recent: '1432839591',
      art: '1176669816',
      stems: '997655538',
      misc: '864600317',
      tracklists: '813585500',
    },
  },
  d4vdgold: {
    sheetId: '1N6_EyCC6AM_cpFkIJivCN0kWzEwJRev7vQCmFAChnjk',
    gids: {
      unreleased: '1194098099',
      released: '1821567829',
      recent: '352145936',
      art: '1223938693',
      stems: '376357246',
      fakes: '1822712170',
      tracklists: '745709653',
    },
  },
  daftpunkgold: {
    sheetId: '1ua9PA27-_LdSddNcU5i4PsvrzI7NMLalsOsXlDTsjuw',
    gids: {
      unreleased: '0',
    },
  },
  gibbsgold: {
    sheetId: '1CCe1DI9VIp0J4MQyTsdMuOriZ9ucmCVMw6nS9j8e4N0',
    gids: {
      unreleased: '1913240258',
    },
  },
  westsidegold: {
    sheetId: '1_dFPF4tSdIuwRUj_UXUFz5qeNVJm-9lCl3zhIGXt0wI',
    gids: {
      unreleased: '1783689060',
    },
  },
  yegold: {
    sheetId: '1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y',
    gids: {
      unreleased: '34972268',
      released: '762588265',
      recent: '77894385',
      stems: '495336364',
      tracklists: '1372270223',
      'album-copies': '1297512832',
      misc: '70063278',
      art: '1219860820',
      fakes: '61838480',
      groupbuys: '1022200924',
    },
  },
  yelolgold: {
    sheetId: '1wQ0WC0U9q10fLWpy9CO8YR128eE8msGXqtZI8_cNyTA',
    gids: {
      unreleased: '199908479',
      released: '1295931150',
      recent: '689133373',
      tracklists: '1372270223',
      stems: '495336364',
      'album-copies': '1297512832',
      'music-videos': '837199839',
      misc: '70063278',
      art: '1659647236',
      fakes: '61838480',
      groupbuys: '1022200924',
      individual: '1333371598', // Sunday Service Choir sub-tab
    },
  },
};

// yegold's source sheet splits its Sunday Service Choir content out into its
// own "SSC" tab (gid 1333371598) instead of keeping it in the main Unreleased
// tab. It uses the same 9-column layout as the main Unreleased tab, so its
// data rows are appended under the Unreleased tab's own header rather than
// fetched as a separate tab.
//
// (The stale fork of this sheet also had a "Related" tab, gid 520283965, for
// DAYTONA/NASIR/K.T.S.E. — the real document has no such tab at all; those
// eras don't exist on it.)
const EXTRA_UNRELEASED_GIDS: Record<string, string[]> = {
  yegold: ['1333371598'],
};

async function mergeExtraUnreleasedTabs(artist: string, baseCsv: string): Promise<string> {
  const extraGids = EXTRA_UNRELEASED_GIDS[artist];
  const src = SHEET_SOURCES[artist];
  if (!extraGids || !src) return baseCsv;

  const rows = splitCSVRows(baseCsv);
  for (const gid of extraGids) {
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${src.sheetId}/export?format=csv&gid=${gid}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      if (!res.ok) continue;
      const text = await res.text();
      if (!isCsvText(text)) continue;
      const extraRows = splitCSVRows(text)
        .slice(1) // drop this tab's own header row — reuse the Unreleased tab's header
        .filter(row => row.some(cell => cell.trim() !== ''));
      rows.push(...extraRows);
    } catch {
      // skip this extra tab on failure; the base tab's rows are still returned
    }
  }
  return joinCSVRows(rows);
}

// Build the Google Sheets CSV export URL for an artist's tab, or null if the
// artist has no live-sheet source (or no gid for that tab).
export function sheetCsvUrl(artist: string, tab: string): string | null {
  const src = SHEET_SOURCES[artist];
  if (!src) return null;
  const gid = src.gids[tab];
  if (!gid) return null;
  return `https://docs.google.com/spreadsheets/d/${src.sheetId}/export?format=csv&gid=${gid}`;
}

// The SPA catch-all (_redirects /* /index.html 200) means missing static files
// return index.html with status 200 — detect real CSV text by its leading char.
const isCsvText = (t: string): boolean => !t.trimStart().startsWith('<');

// Resolve a tracker tab's CSV text: DB-backed community tracker first, then the
// live Google Sheet export (when a gid is configured for the tab), then the committed
// static file. Returns null when no source yields CSV. `env`/`request` are optional so
// official trackers work unchanged; `request` lets the creator/admin preview an
// unapproved tracker.
//
// The live sheet is tried BEFORE the committed CSV so editors' edits (new songs,
// renames, moved tabs) show up without re-running a build/commit — the committed CSV
// is a snapshot fallback used only when the sheet fetch fails or isn't configured.
// Responses are edge-cached 5 min (see csvResponse), so this doesn't hammer Google.
export async function fetchTrackerCsv(
  origin: string,
  artist: string,
  tab: string,
  env?: Env,
  request?: Request,
): Promise<string | null> {
  const community = await getCommunityTrackerCsv(env, artist, tab, request);
  if (community !== null) return community;

  // Live via the Sheets API for download-disabled sheets whose plain CSV export
  // is blocked and strips hrefs (e.g. cactigold). Reconstructs the canonical CSV
  // with real hyperlink URLs; falls through to the committed snapshot on failure.
  if (hasSheetApiSource(artist, tab)) {
    const apiCsv = await fetchSheetApiCsv(artist, tab, env?.GOOGLE_SHEETS_API_KEY);
    if (apiCsv !== null) return apiCsv;
  }

  // Live Google Sheet first, when this tab has a configured gid.
  const remote = sheetCsvUrl(artist, tab);
  if (remote) {
    try {
      const res = await fetch(remote, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const text = await res.text();
        if (isCsvText(text)) {
          return tab === 'unreleased' ? await mergeExtraUnreleasedTabs(artist, text) : text;
        }
      }
    } catch {
      // fall through to the committed snapshot
    }
  }

  // Committed static CSV snapshot (fallback, or the sole source for unconfigured tabs).
  try {
    const res = await fetch(`${origin}/${artist}/data/${tab}.csv`);
    if (res.ok) {
      const text = await res.text();
      if (isCsvText(text)) return text;
    }
  } catch {
    // no committed CSV either
  }

  return null;
}
