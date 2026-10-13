interface Env {
  LASTFM_API_KEY: string;
  LASTFM_SHARED_SECRET: string;
  GENIUS_TOKEN: string;
  GEMINI_API_KEY: string;
  // Google Cloud API key with the Sheets API enabled. Used by _sheetsApi.ts to
  // read real hyperlink hrefs (+ live cell text) from download-disabled sheets
  // whose CSV/gviz exports strip links (e.g. cactigold / Travis Scott).
  GOOGLE_SHEETS_API_KEY?: string;
  YZYGOLD: Fetcher;
  YEDITS_BUCKET: R2Bucket;
}
