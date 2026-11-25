#!/usr/bin/env python3
"""Build the committed CSV snapshots for travisgold (the main Travis Scott tracker).

The sheet (18Ht_QECCPW3zPkuBmGeJDTRMjFEinRlWyAtbkBivjPo, "Travis Scott Tracker" by
Yerlsd) is built on the same yetracker template as yelolgold's — same Era/Name/
Notes/... layout and most of the same gids — so this reuses
scripts/build-yelolgold-csvs.py's parsers and only swaps the sheet, slug,
tab list and fetcher.

Viewer downloads are disabled (export HTTP 401). With GOOGLE_SHEETS_API_KEY set
(env or .dev.vars) rows are read through the Sheets API, as yecomgold's builder
does; otherwise they are scraped from the public /htmlview, which needs no key
and still carries link hrefs. Production serves these tabs live through
SHEET_SOURCES in functions/api/[artist]/_sheets.ts; these files are the fallback.

The "Fakes / Remixes" tab (gid 515737333) is a "coming soon" placeholder, so it
is left out until it has rows.

Usage: python3 scripts/build-travisgold-csvs.py
"""
import html, importlib.util, os, re, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("yelol", os.path.join(HERE, "build-yelolgold-csvs.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)
_spec2 = importlib.util.spec_from_file_location("yecom", os.path.join(HERE, "build-yecomgold-csvs.py"))
yecom = importlib.util.module_from_spec(_spec2)
_spec2.loader.exec_module(yecom)

SLUG = "travisgold"
SHEET_ID = "18Ht_QECCPW3zPkuBmGeJDTRMjFEinRlWyAtbkBivjPo"
GIDS = {
    "unreleased": "199908479",
    "released": "1295931150",
    "recent": "1385926980",
    "tracklists": "1372270223",
    "stems": "495336364",
    "album-copies": "1297512832",
    "art": "887765608",
    "misc": "1436880299",
    "music-videos": "837199839",
}
TITLES = {
    "199908479": "Unreleased",
    "1295931150": "Released",
    "1385926980": "Recent",
    "1372270223": "Tracklists",
    "495336364": "Stems",
    "1297512832": "Album Copies",
    "887765608": "Art",
    "1436880299": "Misc",
    "837199839": "Music Videos",
}


def _key():
    try:
        return yecom.api_key()
    except (SystemExit, OSError):
        return None


def _unwrap(href):
    href = html.unescape(href)
    if href.startswith("https://www.google.com/url"):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get("q")
        if q:
            return q[0]
    return href


def _cell_text(inner):
    hrefs = [_unwrap(h) for h in re.findall(r'<a[^>]*href="([^"]+)"', inner)]
    t = re.sub(r"<br\s*/?>", "\n", inner)
    t = re.sub(r"</div>\s*<div[^>]*>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
    return t, hrefs


def fetch_rows_htmlview(gid):
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/htmlview/sheet?headers=false&gid={gid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        page = resp.read().decode("utf-8")
    grid = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        row = []
        for attrs, inner in re.findall(r"<td([^>]*)>(.*?)</td>", tr, re.S):
            text, hrefs = _cell_text(inner)
            row.append((text, hrefs))
            span = re.search(r'colspan="(\d+)"', attrs)
            row.extend([("", [])] * (int(span.group(1)) - 1 if span else 0))
        grid.append(row)
    hdr = next((r for r in grid if any(re.match(r"^\s*(link|source)", t, re.I) for t, _ in r)), [])
    hdr = [t for t, _ in hdr]
    out = []
    for r in grid:
        row = []
        for i, (text, hrefs) in enumerate(r):
            if hrefs and "http" not in text and (
                    yecom.LINK_HEADER.search(hdr[i] if i < len(hdr) else "")
                    or not text.strip() or text.strip().lower() in yecom.LINK_LABELS):
                text = "\n".join(dict.fromkeys(hrefs))
            row.append(text)
        out.append(row)
    return out


def fetch_rows(gid):
    if _key():
        yecom.SHEET_ID = SHEET_ID
        yecom.TITLES.update(TITLES)
        return yecom.fetch_rows(gid)
    return fetch_rows_htmlview(gid)


def main():
    dst_dir = os.path.join(base.ROOT, "public", SLUG)
    data_dir = os.path.join(dst_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    print(f"Building {SLUG} from sheet {SHEET_ID} ({'Sheets API' if _key() else 'htmlview'})")

    unrel = base.build_unreleased(fetch_rows(GIDS["unreleased"]))
    base.write_csv(data_dir, "unreleased.csv", base.UNREL_HEADER, unrel)

    rows = base.build_released(fetch_rows(GIDS["released"]))
    base.write_csv(data_dir, "released.csv",
                   ["Era", "Name", "Notes", "Length", "Release Date", "Type", "Streaming", "Link(s)"], rows)

    rows = base.build_unreleased(fetch_rows(GIDS["recent"]))
    base.write_csv(data_dir, "recent.csv", base.UNREL_HEADER, rows)

    rows = base.build_stems(fetch_rows(GIDS["stems"]))
    base.write_csv(data_dir, "stems.csv",
                   ["Era", "Name", "Notes", "File Date", "Leak Date", "Full Length", "BPM",
                    "Available Length", "Quality", "Link(s)"], rows)

    hdr, rows = base.build_tracklists(fetch_rows(GIDS["tracklists"]), dst_dir)
    base.write_csv(data_dir, "tracklists.csv", hdr, rows)


    for tab in ("album-copies", "art", "misc", "music-videos"):
        rows = base.build_passthrough(fetch_rows(GIDS[tab]))
        if rows:
            base.write_csv(data_dir, f"{tab}.csv", rows[0], rows[1:])

    eras = base.derive_eras(unrel)
    print(f"{len(eras)} eras: {eras}")


if __name__ == "__main__":
    main()
