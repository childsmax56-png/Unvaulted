#!/usr/bin/env python3
"""Build the "Lol" alternate Ye tracker (yelolgold) from its own Google Sheet.

Unlike scripts/build-bigupdate-csvs.py (which reads local export folders), this
fetches each tab's CSV export live over HTTP by gid — the sheet
(1wQ0WC0U9q10fLWpy9CO8YR128eE8msGXqtZI8_cNyTA) is publicly exportable. Column
parsing reuses the same header-keyword-matching approach as the big-update
importer (columns are matched by header keyword, not fixed position) since
this sheet uses the same Era/Name/Notes/... schema family.

Built independently from this sheet's own data (not copied from yzygold/yegold),
per the "build from scratch" decision — even though this sheet is a fork of the
same underlying catalog and many era names/gids coincide.

Usage: python3 scripts/build-yelolgold-csvs.py
Then wire src/artists/yelolgold.ts into src/artists/registry.ts.
"""
import csv, io, os, re, json, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
SLUG = "yelolgold"
SHEET_ID = "1wQ0WC0U9q10fLWpy9CO8YR128eE8msGXqtZI8_cNyTA"

GIDS = {
    "unreleased": "199908479",
    "released": "1295931150",
    "recent": "689133373",
    "tracklists": "1372270223",
    "stems": "495336364",
    "album-copies": "1297512832",
    "music-videos": "837199839",
    "misc": "70063278",
    "art": "1659647236",
    "fakes": "61838480",
    "groupbuys": "1022200924",
    "individual": "1333371598",  # SSC tab — merged into unreleased, see tag_sunday_service_row
}

RELEASED_VALID = {"Feature", "Production", "Single", "Album Track",
                  "Mixtape Track", "EP Track", "Other"}


# ------------------------------------------------------------------ fetch ----
def fetch_rows(gid):
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8")
    if text.lstrip().startswith("<"):
        raise RuntimeError(f"gid {gid} did not return CSV (got HTML)")
    return list(csv.reader(io.StringIO(text)))


# ------------------------------------------------------------------ helpers --
def clean(s):
    return (s or "").strip()


def is_count_header(cell):
    c = cell or ""
    return "\n" in c and re.search(r"\b(Full|Tagged|Partial|OG|Snippet|Unavailable)\b", c, re.I)


def is_junk_row(era, name):
    """Sheet banner/disclaimer rows that aren't real catalog data (e.g. the
    'Tracker News: Apply For Tracker Editor Here!' row every fork of this
    sheet seems to carry at the top of each tab)."""
    return era.strip().lower() == "tracker news" or "apply for tracker editor" in name.lower()


def tag_sunday_service_row(row):
    """Mirrors tagSundayServiceRow in functions/api/[artist]/_sheets.ts — the
    SSC tab files most of its rows under whichever studio era the song is
    really from, so tag the Name cell to mark it as a Sunday Service Choir
    recording (its own standalone album, "Jesus Is Born", is left as-is).
    "Unknown" rows (no identifiable source era) become their own "Sunday
    Service Choir" era instead of a tag."""
    era = (row[0] if row else "").strip()
    if not era or era == "Jesus Is Born" or is_count_header(row[0] if row else ""):
        return row
    row = list(row)
    if era == "Unknown":
        row[0] = "Sunday Service Choir"
        return row
    row[1] = f"{row[1] if len(row) > 1 else ''} (Sunday Service Choir)"
    return row


def merge_notes(*parts):
    seen, out = set(), []
    for p in parts:
        p = clean(p)
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return "\n\n".join(out)


def _first_line(c):
    return clean(c).split("\n")[0].strip().lower()


def find_header(rows):
    for i, r in enumerate(rows):
        firsts = {_first_line(c) for c in r}
        if firsts & {"name", "title", "main content", "full content"}:
            return i
    return 0


def col(headers, *keywords, exclude=()):
    for i, h in enumerate(headers):
        hl = clean(h).lower()
        if all(k in hl for k in keywords) and not any(x in hl for x in exclude):
            return i
    return None


def cell(row, idx):
    if idx is None or idx >= len(row):
        return ""
    return clean(row[idx])


def write_csv(data_dir, name, header, rows):
    os.makedirs(data_dir, exist_ok=True)
    with open(os.path.join(data_dir, name), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"    {name}: {len(rows)} rows")


# --------------------------------------------------------------- transforms --
UNREL_HEADER = ["Era", "Name", "Notes", "Track Length", "File Date",
                "Leak Date", "Available Length", "Quality", "Link(s)"]


def build_unreleased(rows):
    hi = find_header(rows)
    h = rows[hi]
    ci = {
        "name": (col(h, "name") or col(h, "title")),
        "notes": col(h, "note") or col(h, "info"),
        "tlen": col(h, "track", "length") or col(h, "length", exclude=("available", "full")),
        "file": col(h, "file", "date") or col(h, "obtained"),
        "leak": col(h, "leak", "date"),
        "avail": col(h, "available") or col(h, "portion") or col(h, "availability"),
        "qual": col(h, "quality"),
        "link": col(h, "link") or col(h, "source"),
    }
    out = []
    for r in rows[hi + 1:]:
        era0 = r[0] if r else ""
        if is_count_header(era0):
            era_name = cell(r, ci["name"]).split("\n")[0]
            if not era_name:
                continue
            out.append([era0, era_name, "", "", "", "", "", "", ""])
        else:
            era = clean(era0)
            name = cell(r, ci["name"])
            if not era or not name or is_junk_row(era, name):
                continue
            out.append([era, name, cell(r, ci["notes"]), cell(r, ci["tlen"]),
                        cell(r, ci["file"]), cell(r, ci["leak"]),
                        cell(r, ci["avail"]), cell(r, ci["qual"]),
                        cell(r, ci["link"])])
    return out


def build_released(rows):
    hi = find_header(rows)
    h = rows[hi]
    ci = {
        "name": (col(h, "name") or col(h, "title")),
        "notes": col(h, "note") or col(h, "info"),
        "tlen": col(h, "length"),
        "date": col(h, "date"),
        "type": col(h, "type"),
        "stream": col(h, "stream"),
        "link": col(h, "link") or col(h, "source"),
    }
    header = ["Era", "Name", "Notes", "Length", "Release Date", "Type", "Streaming", "Link(s)"]
    out = []
    for r in rows[hi + 1:]:
        era0 = r[0] if r else ""
        if is_count_header(era0):
            era_name = cell(r, ci["name"]).split("\n")[0]
            if era_name:
                out.append([era0, era_name, "", "", "", "", "", ""])
            continue
        era = clean(era0)
        name = cell(r, ci["name"])
        if not era or not name or is_junk_row(era, name):
            continue
        t = cell(r, ci["type"])
        if t == "Track":
            t = "Album Track"
        if t not in RELEASED_VALID:
            t = "Other"
        out.append([era, name, cell(r, ci["notes"]), cell(r, ci["tlen"]),
                    cell(r, ci["date"]), t, cell(r, ci["stream"]),
                    cell(r, ci["link"])])
    return out


def build_stems(rows):
    hi = find_header(rows)
    h = rows[hi]
    ci = {
        "name": (col(h, "name") or col(h, "title")),
        "notes": col(h, "note") or col(h, "info"),
        "file": col(h, "file", "date"),
        "leak": col(h, "leak", "date"),
        "full": col(h, "full", "length") or col(h, "length", exclude=("available",)),
        "bpm": col(h, "bpm"),
        "avail": col(h, "available") or col(h, "portion"),
        "qual": col(h, "quality"),
        "link": col(h, "link") or col(h, "source"),
    }
    header = ["Era", "Name", "Notes", "File Date", "Leak Date",
              "Full Length", "BPM", "Available Length", "Quality", "Link(s)"]
    out = []
    for r in rows[hi + 1:]:
        name = cell(r, ci["name"])
        if not name:
            continue
        avail, qual, link = cell(r, ci["avail"]), cell(r, ci["qual"]), cell(r, ci["link"])
        if not any((avail, qual, link)):
            continue
        out.append([clean(r[0]) if r else "", name, cell(r, ci["notes"]),
                    cell(r, ci["file"]), cell(r, ci["leak"]), cell(r, ci["full"]),
                    cell(r, ci["bpm"]), avail, qual, link])
    return out


def build_tracklists(rows, dst_dir):
    hi = find_header(rows)
    h = rows[hi]
    ci = {
        "name": (col(h, "name") or col(h, "title")),
        "tl": col(h, "tracklist"),
        "date": col(h, "date"),
        "qual": col(h, "quality"),
        "source": col(h, "source"),
        "link": col(h, "link"),
    }
    header = ["Era", "Name", "Tracklist", "Image", "Date Made", "Quality", "Source", "Link(s)"]
    out, jsonout = [], []
    for r in rows[hi + 1:]:
        name = cell(r, ci["name"])
        if not name:
            continue
        era = clean(r[0]) if r else ""
        tl = cell(r, ci["tl"])
        date, qual, source = cell(r, ci["date"]), cell(r, ci["qual"]), cell(r, ci["source"])
        out.append([era, name, tl, "", date, qual, source, ""])
        tracks = []
        for line in tl.split("\n"):
            m = re.match(r"\s*#?(\d+)[\.\)]\s+(.*\S)", line)
            if m:
                tracks.append({"num": "#" + m.group(1), "name": m.group(2).strip()})
        jsonout.append({"era": era, "name": name, "date": date, "quality": qual,
                        "source": source, "links": [], "tracks": tracks})
    with open(os.path.join(dst_dir, "Tracklists.json"), "w", encoding="utf-8") as f:
        json.dump(jsonout, f, indent=1, ensure_ascii=False)
    print(f"    Tracklists.json: {len(jsonout)} tracklists")
    return header, out


def build_fakes(rows):
    hi = find_header(rows)
    h = rows[hi]
    ci = {
        "name": (col(h, "name") or col(h, "title")),
        "notes": col(h, "note") or col(h, "info"),
        "made": col(h, "made") or col(h, "designer") or col(h, "by"),
        "type": col(h, "type"),
        "avail": col(h, "available") or col(h, "portion"),
        "qual": col(h, "quality"),
        "link": col(h, "link") or col(h, "source"),
    }
    header = ["Era", "Name", "Notes", "Made By", "Type", "Currently Available", "Link(s)"]
    out = []
    for r in rows[hi + 1:]:
        name = cell(r, ci["name"])
        if not name:
            continue
        avail = " ".join(x for x in (cell(r, ci["avail"]), cell(r, ci["qual"])) if x)
        out.append([clean(r[0]) if r else "", name, cell(r, ci["notes"]),
                    cell(r, ci["made"]), cell(r, ci["type"]), avail, cell(r, ci["link"])])
    return out


def build_groupbuys(rows):
    hi = find_header(rows)
    h = rows[hi]
    ci = {
        "content": (col(h, "main", "content") or col(h, "full", "content")
                    or col(h, "content") or (col(h, "name") or col(h, "title"))),
        "allcontent": col(h, "all", "content"),
        "price": col(h, "price"),
        "start": col(h, "start"),
        "end": col(h, "end"),
        "type": col(h, "type"),
        "status": (col(h, "finished") or col(h, "state") or col(h, "status")),
        "link": col(h, "link") or col(h, "snippet") or col(h, "source"),
    }
    header = ["Year", "YearTotal", "Era", "Name", "Content",
              "Price", "Start", "End", "Type", "Status", "Link"]
    out = []
    for r in rows[hi + 1:]:
        era = clean(r[0]) if r else ""
        content = cell(r, ci["content"])
        name = content.split("\n")[0]
        if not name:
            continue
        start, end = cell(r, ci["start"]), cell(r, ci["end"])
        year = ""
        for c in (end, start):
            m = re.search(r"\b(19|20)\d{2}\b", c)
            if m:
                year = m.group(0)
                break
        full = merge_notes(content, cell(r, ci["allcontent"]))
        out.append([year or "Unknown", "", era, name, full, cell(r, ci["price"]),
                    start, end, cell(r, ci["type"]), cell(r, ci["status"]),
                    cell(r, ci["link"])])
    return out


def build_passthrough(rows):
    return [r for r in rows if any(clean(c) for c in r)]


def derive_eras(unrel):
    order, seen = [], set()
    for r in unrel:
        if is_count_header(r[0]):
            era = clean(r[1])
        else:
            era = clean(r[0])
        if era and era not in seen:
            seen.add(era)
            order.append(era)
    return order


# ------------------------------------------------------------- config output --
def ts_str(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'"


def gen_config(eras):
    rd = ",\n".join(f"    {ts_str(e)}: '??/??/????'" for e in eras)
    order = ",\n".join(f"    {ts_str(e)}" for e in eras)
    return f"""import type {{ ArtistConfig }} from './types';

// Third Ye tracker variant ("Lol"), built independently from its own Google
// Sheet by scripts/build-yelolgold-csvs.py — NOT copied from yzygold/yegold,
// even though it's a fork of the same catalog and several gids coincide.
// Data served from committed CSV snapshots under public/yelolgold/data/*.csv.
// An era only appears in the Music grid if its name is a key in
// ALBUM_RELEASE_DATES; dates are unknown here since they weren't re-derived
// from this sheet, so every era is a placeholder until filled in by hand.
export const yelolgoldConfig: ArtistConfig = {{
  slug: 'yelolgold',
  // Off the landing grid/search — reachable via yegold's alt-tracker picker
  // or directly at /yelolgold/.
  hidden: true,
  hasGroupbuysTab: true,
  hasAlbumCopiesTab: true,
  hasIndividualProjectsTab: true,
  individualProjectsLabel: 'Sunday Service Choir',
  SITE_NAME: 'YE (Lol)',
  SITE_DESCRIPTION: 'The Kanye West tracker, alternate "Lol" version',
  SITE_URL: 'https://unvaulted.cc/yelolgold/',
  OG_IMAGE_URL: 'https://i.ibb.co/LhXdRh7j/2026-03-23-T184041-712.png',
  STORAGE_PREFIX: 'yelolgold_',

  HARDCODED_SHEET_ID: '{SHEET_ID}',
  HARDCODED_SHEET_GID: '{GIDS["unreleased"]}',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: 'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GIDS["recent"]}',

  alternateTrackers: [
    {{ slug: 'yegold', label: 'Official' }},
    {{ slug: 'yzygold', label: 'Suzy' }},
  ],

  accentColor: '#C9A224',
  artistLabel: 'Ye (Lol)',
  cardLetter: 'LOL',
  logoUrl: '/logos/yzygold.png',
  artistPhotoUrl: '/artists/kanye.jpg',
  navLogoUrl: '/yzygold/logo.png',

  getArtistName() {{
    return 'Kanye West';
  }},

  CUSTOM_IMAGES: {{}},

  ALBUM_RELEASE_DATES: {{
{rd}
  }},

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {{}},
  ALBUM_SONG_COUNTS: {{}},
  CUSTOM_ALBUM_INFO: {{}},
  ERA_MAPPINGS: {{}},

  ALBUM_ORDER: [
{order}
  ],

  TAG_MAP: {{
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
  }},
  TAG_TOOLTIP_MAP: {{
    'Best Of': 'some of the best leaks hosted on the tracker.',
    'Grails': 'the most wanted songs that have not yet leaked in full.',
    'Wanted': 'Songs that are wanted, but not as wanted as "Grails".',
    'Special': 'special songs that are not good enough to be in Best Of, but still deserves to be highlighted.',
    'Worst Of': 'some of the worst leaks hosted on the tracker.',
    'Unwanted': "Songs that we don't want to leak in full.",
    'AI': 'Track contains AI vocals.',
    'Lost Media': "Is currently lost, or we don't have a link to the media.",
  }},
  ERA_THEMES: {{}},
  hasSubAlbumsTab: false,
}};
"""


# --------------------------------------------------------------------- main --
def main():
    dst_dir = os.path.join(ROOT, "public", SLUG)
    data_dir = os.path.join(dst_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    print(f"Building {SLUG} from sheet {SHEET_ID}")

    unrel = build_unreleased(fetch_rows(GIDS["unreleased"]))
    ssc_rows = [tag_sunday_service_row(r) for r in build_unreleased(fetch_rows(GIDS["individual"]))]
    unrel.extend(ssc_rows)
    print(f"    (merged ssc: {len(ssc_rows)} rows)")
    write_csv(data_dir, "unreleased.csv", UNREL_HEADER, unrel)

    rows = build_released(fetch_rows(GIDS["released"]))
    write_csv(data_dir, "released.csv",
              ["Era", "Name", "Notes", "Length", "Release Date", "Type", "Streaming", "Link(s)"], rows)

    rows = build_unreleased(fetch_rows(GIDS["recent"]))
    write_csv(data_dir, "recent.csv", UNREL_HEADER, rows)

    rows = build_stems(fetch_rows(GIDS["stems"]))
    write_csv(data_dir, "stems.csv",
              ["Era", "Name", "Notes", "File Date", "Leak Date", "Full Length", "BPM", "Available Length", "Quality", "Link(s)"], rows)

    hdr, rows = build_tracklists(fetch_rows(GIDS["tracklists"]), dst_dir)
    write_csv(data_dir, "tracklists.csv", hdr, rows)

    rows = build_fakes(fetch_rows(GIDS["fakes"]))
    write_csv(data_dir, "fakes.csv",
              ["Era", "Name", "Notes", "Made By", "Type", "Currently Available", "Link(s)"], rows)

    rows = build_groupbuys(fetch_rows(GIDS["groupbuys"]))
    write_csv(data_dir, "groupbuys.csv",
              ["Year", "YearTotal", "Era", "Name", "Content", "Price", "Start", "End", "Type", "Status", "Link"], rows)

    for tab in ("album-copies", "art", "misc", "music-videos"):
        rows = build_passthrough(fetch_rows(GIDS[tab]))
        if rows:
            write_csv(data_dir, f"{tab}.csv", rows[0], rows[1:])

    eras = derive_eras(unrel)
    print(f"{len(eras)} eras in unreleased.csv (src/artists/{SLUG}.ts is now hand-maintained —")
    print("re-run with WRITE_CONFIG=1 only if you want it regenerated from scratch, which")
    print("discards any manual edits, e.g. alternateTrackers/HIDDEN_ALBUMS/CUSTOM_IMAGES).")
    if os.environ.get("WRITE_CONFIG"):
        cfg = gen_config(eras)
        with open(os.path.join(ROOT, "src", "artists", f"{SLUG}.ts"), "w", encoding="utf-8") as f:
            f.write(cfg)
        print(f"  wrote src/artists/{SLUG}.ts")


if __name__ == "__main__":
    main()
