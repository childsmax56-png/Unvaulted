export interface ArtistConfig {
  // Identity
  slug: string;
  SITE_NAME: string;
  SITE_DESCRIPTION: string;
  SITE_URL: string;
  OG_IMAGE_URL: string;
  STORAGE_PREFIX: string;

  // Google Sheets sync
  HARDCODED_SHEET_ID: string;
  HARDCODED_SHEET_GID: string;

  // Public link to the source spreadsheet/tracker, shown as the in-tracker
  // "Link For The Sheet". Overrides the docs.google.com URL built from
  // HARDCODED_SHEET_ID (used by trackers whose source isn't a plain Google Sheet).
  sheetUrl?: string;
  // Community members credited as the source sheet's creators/maintainers,
  // shown in the in-tracker footer ("...made by ..."). Sourced from the
  // TrackerHub credits sheet.
  sheetCreator?: string;
  SHEET_URL_UNRELEASED: string;
  SHEET_URL_RECENT: string;

  // Artist name resolver
  getArtistName: (eraName: string | undefined) => string;

  // Era data
  CUSTOM_IMAGES: Record<string, string>;
  ALBUM_RELEASE_DATES: Record<string, string>;
  HIDDEN_ALBUMS: string[];
  ALBUM_DESCRIPTIONS: Record<string, string>;
  ALBUM_SONG_COUNTS: Record<string, number>;
  CUSTOM_ALBUM_INFO: Record<string, string[]>;
  ERA_MAPPINGS: Record<string, string>;
  ALBUM_ORDER?: string[]; // explicit era order, overrides Object.keys(ALBUM_RELEASE_DATES) which hoists integer-named keys

  // Optional per-era disclaimer banner (e.g. copyright notice redirecting to another tracker)
  ERA_DISCLAIMERS?: Record<string, { text: string; linkText?: string; linkUrl?: string }>;

  // Tags
  TAG_MAP: Record<string, string>;
  TAG_TOOLTIP_MAP: Record<string, string>;

  // Themes
  ERA_THEMES: Record<string, { topBanner?: string; bottomBanner?: string; bottomBannerRepeat?: boolean; miniPlayer?: string; fullPicturePlayer?: string }>;

  // Optional tabs
  hasProductionTab?: boolean;
  hasYeditsTab?: boolean;
  hasRecentTab?: boolean;
  hasReleasedTab?: boolean; // set false to force-hide the Released tab when the sheet has no Released data
  hasCompsTab?: boolean;
  hasConcertsTab?: boolean;
  hasSubAlbumsTab?: boolean;
  hasArtTab?: boolean; // set false to force-hide the Art tab regardless of data
  hasVideosTab?: boolean; // set false to force-hide the Videos tab regardless of data
  hasMiscTab?: boolean; // set false to force-hide the Misc tab regardless of data
  hasStemsTab?: boolean; // set false to force-hide the Stems tab regardless of data
  miscLabel?: string; // override the "Misc" tab label
  hasTracklistsTab?: boolean; // set false to force-hide the Tracklists tab regardless of data
  hasAlbumCopiesTab?: boolean; // set true to enable the Album Copies tab (data from data/album-copies.csv)
  hasGroupbuysTab?: boolean; // set true to enable the Groupbuys tab (data from data/groupbuys.csv)
  hasIndividualProjectsTab?: boolean; // set true to enable a second Unreleased-style tab (e.g. a group's members' solo projects), sourced from the 'individual' sheet tab
  individualProjectsLabel?: string; // override the "Individual Projects" tab label
  hasIndividualTracklistsTab?: boolean; // set true to enable a Tracklists-style tab for the Individual Projects catalog, sourced from the 'individual-tracklists' sheet tab
  SHEET_URL_RECENT_PRODUCTION?: string; // CSV export URL for a second recent tab (production projects)
  productionFirst?: boolean; // show Production Projects before Music in navbar
  productionSecond?: boolean; // show Production Projects second (right after Music) in navbar

  // Albums to exclude from all views (neither Music nor Related)
  EXCLUDED_ALBUMS?: string[];

  // Albums that appear only in the Art tab (not in Music/Related listings)
  ART_ONLY_ALBUMS?: string[];

  // Easter-egg: keep this artist off the landing-page grid. It stays reachable
  // by URL. A hidden artist does NOT match its own name/slug in search — it only
  // appears when the query contains one of its secret `searchAliases` passphrases.
  hidden?: boolean;
  searchAliases?: string[];

  // Landing page card
  accentColor: string;
  artistLabel: string;
  cardLetter: string;
  logoUrl: string; // path to logo image, e.g. /logos/yzygold.png
  navLogoUrl?: string; // optional override logo for the navbar
  artistPhotoUrl?: string; // optional artist photo for landing page cards
  photoObjectPosition?: string; // optional CSS object-position for the card photo (default 'top center')

  // Artist-specific loading screens (overrides the default set)
  loadingScreens?: { id: string; label: string; type: 'none' | 'gif' | 'video'; url?: string }[];

  // Community trackers — user-built trackers resolved at runtime from D1 rather
  // than the static registry. `community` marks the tracker as user-made (used to
  // hide official-only UI like the source-sheet link); `createdBy` is the author.
  community?: boolean;
  createdBy?: string;
}
