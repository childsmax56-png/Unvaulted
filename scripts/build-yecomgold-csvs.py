#!/usr/bin/env python3
"""Build the "yetracker.com" alternate Ye tracker (yecomgold) from its own Google Sheet.

The sheet (1JcJOHsNdCo7rBS6dbOUbBGjeq_CS8x0FqdW9_cnTozs) is another fork of the
same catalog template as yelolgold's — identical tab layout and gids — so this
reuses scripts/build-yelolgold-csvs.py's parsers wholesale and only swaps the
sheet, slug and fetcher. Viewer downloads are disabled on this sheet (export
HTTP 401), so rows are read through the Sheets API v4 instead, with hyperlink
hrefs swapped into link cells the same way fetchApiRows in
functions/api/[artist]/_importedSheets.ts does at request time.

Usage: GOOGLE_SHEETS_API_KEY=AIza... python3 scripts/build-yecomgold-csvs.py
(falls back to the key in .dev.vars)
"""
import importlib.util, json, os, re, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("yelol", os.path.join(HERE, "build-yelolgold-csvs.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

SHEET_ID = "1JcJOHsNdCo7rBS6dbOUbBGjeq_CS8x0FqdW9_cnTozs"
TITLES = {
    "199908479": "Unreleased",
    "1295931150": "Released",
    "689133373": "Recent",
    "1372270223": "Tracklists",
    "495336364": "Stems",
    "1297512832": "Album Copies",
    "837199839": "Music Videos",
    "70063278": "Misc",
    "1659647236": "Art",
    "61838480": "Fakes / Detags",
    "1022200924": "Groupbuys",
    "1333371598": "SSC",
}

LINK_HEADER = re.compile(r"link|source|snippet|url|download", re.I)
LINK_LABELS = {"link", "links", "here", "snippet", "pillows", "pixeldrain", "download"}


def api_key():
    key = os.environ.get("GOOGLE_SHEETS_API_KEY")
    if key:
        return key
    with open(os.path.join(HERE, "..", ".dev.vars"), encoding="utf-8") as f:
        for line in f:
            if line.startswith("GOOGLE_SHEETS_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("GOOGLE_SHEETS_API_KEY not set")


def fetch_rows(gid):
    title = TITLES[gid]
    fields = "sheets.data.rowData.values(formattedValue,hyperlink,textFormatRuns.format.link.uri)"
    url = (f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}?includeGridData=true"
           f"&ranges={urllib.parse.quote(chr(39) + title.replace(chr(39), chr(39) * 2) + chr(39))}"
           f"&fields={urllib.parse.quote(fields)}&key={api_key()}")
    with urllib.request.urlopen(url, timeout=120) as resp:
        doc = json.load(resp)
    grid = [r.get("values", []) for r in doc["sheets"][0]["data"][0].get("rowData", [])]
    texts = [[c.get("formattedValue", "") for c in r] for r in grid]
    hdr = next((r for r in texts if any(re.match(r"^\s*(link|source)", c, re.I) for c in r)), [])
    out = []
    for ri, r in enumerate(grid):
        row = []
        for i, c in enumerate(r):
            text = texts[ri][i]
            hrefs = []
            if c.get("hyperlink"):
                hrefs.append(c["hyperlink"])
            for run in c.get("textFormatRuns", []):
                u = run.get("format", {}).get("link", {}).get("uri")
                if u and u not in hrefs:
                    hrefs.append(u)
            if hrefs and "http" not in text and (
                    LINK_HEADER.search(hdr[i] if i < len(hdr) else "")
                    or not text.strip() or text.strip().lower() in LINK_LABELS):
                text = "\n".join(hrefs)
            row.append(text)
        out.append(row)
    return out


base.SLUG = "yecomgold"
base.SHEET_ID = SHEET_ID
base.fetch_rows = fetch_rows

if __name__ == "__main__":
    base.main()
