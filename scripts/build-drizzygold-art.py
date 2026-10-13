#!/usr/bin/env python3
"""
Rebuild public/drizzygold/data/art.csv from the Drake tracker's Google Sheet.

The Art tab pastes most cover art in as *embedded images* (drawings anchored to a
cell) rather than as hyperlinks, so the plain CSV export loses them — 140 of ~207
rows come back with an empty Link(s) column.  This grabs the workbook as .xlsx
(which keeps the embedded drawings), extracts each row's image to
public/drizzygold/art/<slug>.<ext>, and writes an art.csv whose Link(s) column
prefers, per row:

  1. the local path already committed for that (Era, Name)   — no re-download churn
  2. a freshly extracted embedded image                       — new rows
  3. the sheet's hyperlink URL (from the CSV export)          — fallback
  4. blank

Because the embedded images only live in the committed CSV, drizzygold's `art`
tab must NOT be enrolled in live Google-Sheet sync (see functions/api/[artist]/
_sheets.ts) — the live export would blank those 140 rows.

Usage:
  python3 scripts/build-drizzygold-art.py
"""
import csv
import io
import os
import re
import sys
import urllib.request
import zipfile
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
SLUG = "drizzygold"
SHEET_ID = "1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI"
ART_GID = "1704963883"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

ART_DIR = os.path.join(PUBLIC, SLUG, "art")
CSV_PATH = os.path.join(PUBLIC, SLUG, "data", "art.csv")
HEADER = ["Era", "Name", "Notes", "Designer", "Art Type",
          "Image", "Project Type", "Use", "Link(s)"]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def slugify(name):
    # first physical line only; lowercase; non-alnum runs -> single hyphen
    name = name.split("\n")[0]
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "art"


def col_of(ref):
    letters = "".join(c for c in ref if c.isalpha())
    n = 0
    for c in letters:
        n = n * 26 + (ord(c) - 64)
    return n


def parse_shared_strings(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    out = []
    for si in root.findall(NS + "si"):
        parts = [t.text or "" for t in si.iter(NS + "t")]
        out.append("".join(parts))
    return out


def art_sheet_path(z):
    """Locate the worksheet file for the tab named 'Art' (gid isn't kept in xlsx)."""
    wb = z.read("xl/workbook.xml").decode("utf8", "ignore")
    rels = dict(re.findall(
        r'Id="([^"]*)"[^>]*Target="([^"]*)"',
        z.read("xl/_rels/workbook.xml.rels").decode("utf8", "ignore")))
    for name, rid in re.findall(r'<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"', wb):
        if name.strip().lower().startswith("art"):
            return "xl/" + rels.get(rid, "").replace("../", "")
    return None


def read_rows(z, path, shared):
    """Return {sheet_row_1based: {colnum: text}}."""
    sh = ET.fromstring(z.read(path))
    data = sh.find(NS + "sheetData")
    rows = {}
    for row in data.findall(NS + "row"):
        cells = {}
        for c in row.findall(NS + "c"):
            ref = c.get("r")
            if not ref:
                continue
            v = c.find(NS + "v")
            t = c.get("t")
            val = ""
            if t == "s" and v is not None:
                i = int(v.text)
                val = shared[i] if i < len(shared) else ""
            elif t == "inlineStr":
                istr = c.find(NS + "is")
                if istr is not None:
                    val = "".join(x.text or "" for x in istr.iter(NS + "t"))
            elif v is not None:
                val = v.text or ""
            cells[col_of(ref)] = val
        rows[int(row.get("r"))] = cells
    return rows


def extract_images(z, sheet_path):
    """Return {sheet_row_1based: (bytes, ext)} for embedded drawings."""
    names = set(z.namelist())
    rel_path = sheet_path.replace("worksheets/", "worksheets/_rels/") + ".rels"
    if rel_path not in names:
        return {}
    m = re.search(r'Target="([^"]*drawing[^"]*\.xml)"',
                  z.read(rel_path).decode("utf8", "ignore"))
    if not m:
        return {}
    drawing = "xl/" + m.group(1).replace("../", "")
    if drawing not in names:
        return {}
    d = z.read(drawing).decode("utf8", "ignore")
    drel = drawing.replace("drawings/", "drawings/_rels/") + ".rels"
    relmap = {}
    if drel in names:
        relmap = dict(re.findall(
            r'Id="([^"]*)"[^>]*Target="([^"]*)"',
            z.read(drel).decode("utf8", "ignore")))
    anchors = re.findall(
        r"<xdr:from>.*?<xdr:row>(\d+)</xdr:row>.*?</xdr:from>.*?r:embed=\"([^\"]*)\"",
        d, re.S)
    out = {}
    for row0, rid in anchors:
        media = "xl/" + (relmap.get(rid, "")).replace("../", "")
        if media not in names:
            continue
        row = int(row0) + 1  # xdr row is 0-based
        if row in out:
            continue  # first image per row wins
        ext = os.path.splitext(media)[1].lower() or ".png"
        out[row] = (z.read(media), ext)
    return out


def main():
    print("[drizzygold] downloading CSV + xlsx…")
    live_rows = list(csv.DictReader(io.StringIO(fetch(
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={ART_GID}"
    ).decode("utf8", "ignore"))))
    xlsx = fetch(f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx")
    z = zipfile.ZipFile(io.BytesIO(xlsx))

    sheet_path = art_sheet_path(z)
    if not sheet_path or sheet_path not in z.namelist():
        sys.exit("could not find the Art worksheet in the xlsx")
    shared = parse_shared_strings(z)
    xrows = read_rows(z, sheet_path, shared)
    images = extract_images(z, sheet_path)

    # header row in the sheet -> column indexes (1-based) for Era / Name
    header_r = min(xrows)
    hdr = xrows[header_r]
    era_col = next((c for c, v in hdr.items() if v.strip().lower() == "era"), 1)
    name_col = next((c for c, v in hdr.items() if v.strip().lower().startswith("name")), 2)

    # existing committed local links, keyed by (Era, Name) — keep to avoid churn
    committed = {}
    if os.path.exists(CSV_PATH):
        for row in csv.DictReader(open(CSV_PATH)):
            link = (row.get("Link(s)") or "").strip()
            if link.startswith(f"/{SLUG}/art/"):
                committed[(row["Era"].strip(), row["Name"].strip())] = link

    # (Era, Name) -> extracted local path. Only save files for rows we don't
    # already have a committed local image for, so existing files stay untouched.
    existing = set(os.listdir(ART_DIR)) if os.path.isdir(ART_DIR) else set()
    extracted = {}
    for r in sorted(images):
        if r <= header_r:
            continue
        era = (xrows.get(r, {}).get(era_col, "") or "").strip()
        name = (xrows.get(r, {}).get(name_col, "") or "").strip()
        if not name or (era, name) in committed:
            continue
        raw, ext = images[r]
        base = slugify(name)
        fname = f"{base}{ext}"
        n = 2
        while fname in existing:
            fname = f"{base}-{n}{ext}"
            n += 1
        existing.add(fname)
        with open(os.path.join(ART_DIR, fname), "wb") as f:
            f.write(raw)
        extracted[(era, name)] = f"/{SLUG}/art/{fname}"

    out_rows, new_local, remote, blank = [], 0, 0, 0
    for row in live_rows:
        era = (row.get("Era") or "").strip()
        name = (row.get("Name") or "").strip()
        key = (era, name)
        live_link = (row.get("Link(s)") or "").strip()
        if key in committed:
            link = committed[key]
        elif key in extracted:
            link = extracted[key]
            new_local += 1
        else:
            link = live_link
            if live_link:
                remote += 1
            else:
                blank += 1
        out_rows.append([row.get(h, "") if h != "Link(s)" else link for h in HEADER])

    with open(CSV_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(out_rows)

    print(f"[drizzygold] wrote {len(out_rows)} rows -> {os.path.relpath(CSV_PATH, ROOT)}")
    print(f"  new embedded images extracted: {new_local}")
    print(f"  remote-hyperlink fallback:     {remote}")
    print(f"  still blank:                   {blank}")


if __name__ == "__main__":
    main()
