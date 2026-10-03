#!/usr/bin/env python3
"""Rebuild yegold's committed CSVs from the REAL yetracker.net sheet.

Discovery: yegold.ts's old HARDCODED_SHEET_ID
(1zKk5p9lDA40p0EXrvtfNTyUzUTVUW1kCpqy7BF0WyWo) was a stale fork of the real
document — it shares the same gids (tabs were copied at some point,
preserving gid numbers) but the cell DATA had since diverged (e.g. it never
got the live "CARTI YE" era that the real sheet has). The real id,
1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y, was found embedded as a "Sheet
Link" in the real site's own Name-column header cell (reachable by scraping
https://yetracker.net/htmlview/sheet?headers=true&gid=<gid>, since the
custom domain never exposes the id in its own URLs) — and is a normal public
Google Sheet, directly exportable via the standard CSV-export URL just like
every other tracker, so no special scraping is needed going forward.

Note: unlike the stale fork, the real sheet has no separate "Related" tab
(gid 520283965 404s here) — confirmed against its own full tab list.

Usage: python3 scripts/build-yegold-csvs.py
Then re-audit src/artists/yegold.ts's era list against the output (eras may
have been added/renamed/removed upstream since the stale fork was taken).
"""
import csv, io, os, re, json, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
SLUG = "yegold"
SHEET_ID = "1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y"

GIDS = {
    "unreleased": "34972268",
    "ssc": "1333371598",      # merges into unreleased (Jesus Is Born/Sunday Service Choir)
    "released": "762588265",
    "recent": "77894385",
    "stems": "495336364",
    "tracklists": "1372270223",
    "album-copies": "1297512832",
    "misc": "70063278",
    "art": "1219860820",
    "fakes": "61838480",
    "groupbuys": "1022200924",
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
    return era.strip().lower() == "tracker news" or "apply for tracker editor" in name.lower()


SSC_ERA_DISPLAY_NAMES = {
    "JESUS IS LORD": "God's Country",
    "DONDA 2": "DONDA 2 [V1]",
}


def tag_sunday_service_row(row):
    """Mirrors tagSundayServiceRow in functions/api/[artist]/_sheets.ts — the
    SSC tab marks each row's studio origin in the Era column instead of
    filing it under its own name (except the choir's own standalone album,
    "Jesus Is Born", which keeps its own section). Every other row collapses
    into one "Sunday Service Choir" era, with its original Era value folded
    into the Name cell as a tag instead."""
    era = (row[0] if row else "").strip()
    name = (row[1] if len(row) > 1 else "").strip()
    # Skip header/disclaimer rows (e.g. "This tab only tracks Sunday Service
    # Choir..."), which have no Name — only their long sentence sits in the
    # Era cell, which would otherwise get renamed into a fake tagged "song".
    if not era or not name or era == "Jesus Is Born" or is_count_header(row[0] if row else ""):
        return row
    row = list(row)
    if era != "Unknown":
        display_era = SSC_ERA_DISPLAY_NAMES.get(era, era)
        row[1] = f"{row[1] if len(row) > 1 else ''} ({display_era})"
    row[0] = "Sunday Service Choir"
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


# --------------------------------------------------------------------- main --
def main():
    dst_dir = os.path.join(ROOT, "public", SLUG)
    data_dir = os.path.join(dst_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    print(f"Building {SLUG} from the REAL sheet {SHEET_ID}")

    unrel = build_unreleased(fetch_rows(GIDS["unreleased"]))
    ssc_rows = [tag_sunday_service_row(r) for r in build_unreleased(fetch_rows(GIDS["ssc"]))]
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

    for tab in ("album-copies", "art", "misc"):
        rows = build_passthrough(fetch_rows(GIDS[tab]))
        if rows:
            write_csv(data_dir, f"{tab}.csv", rows[0], rows[1:])

    eras = derive_eras(unrel)
    print(f"\n{len(eras)} distinct eras found:")
    for e in eras:
        print(f"  - {e}")


if __name__ == "__main__":
    main()
