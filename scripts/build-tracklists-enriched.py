#!/usr/bin/env python3
"""
Enrich the Tracklists tab by pulling data straight out of each artist's Google
Sheet.  The plain CSV export throws away everything but text, so this instead
grabs the whole workbook as .xlsx (the export endpoint keeps cell fills and
embedded images) and pulls out, per album row:

  - description  : the prose that precedes the numbered tracklist
  - tracks       : the numbered lines (with a per-track colour when the sheet
                   colours individual track lines via rich text)
  - availability : text from the availability/quality column
  - availColor   : the row's fill colour when it matches a legend swatch
  - images       : backup tracklist screenshots embedded in the sheet
                   (saved, downscaled, to public/<slug>/art/tl-*.jpg)

plus the sheet's legend/colour key (parsed from the coloured runs of the legend
header cell).  Output goes to public/<slug>/Tracklists.json as

    { "legend": [ {"label","color"} ... ], "albums": [ ... ] }

Sheets that block the xlsx download (viewer-downloads disabled) fall back to the
committed public/<slug>/data/tracklists.csv for the text-only fields.

Usage:
  python3 scripts/build-tracklists-enriched.py                 # all artists
  python3 scripts/build-tracklists-enriched.py wolfgold uzigold # subset
  XLSX_CACHE=~/tl-scratch/xlsx python3 ...                      # reuse downloads
"""
import csv as csvmod
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import zipfile
from xml.etree import ElementTree as ET

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
CACHE = os.path.expanduser(os.environ.get("XLSX_CACHE", "~/tl-scratch/xlsx"))
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# artist slug -> [spreadsheet id, tracklists gid]
SHEETS = {
    "aapgold":        ["1rbt_VyQyHEfVRv_XmVBNrwMyF0uMx7FF-1T8-N0wf0E", "1024624532"],
    "antclemonsgold": ["11Ta0gixhRv9uUq-_O9nID_rjUf3oembw57f2sblMP3k", "1372270223"],
    "badbunnygold":   ["1O5RFNuOF4-K7xWCYMRQXy3Y_WkYOWu6o9zClsw8lPi4", "2035478417"],
    "coldplaygold":   ["1i4xfiqtONMps_FL9n_2O5UmpKKio6HUCh5y6zQniyPk", "1999300901"],
    "colegold":       ["1hjMtB-acUEpXYkR6TWQVeVoUzSLrAVIdy1lMoM6aFFw", "1282750024"],
    "d4vdgold":       ["1N6_EyCC6AM_cpFkIJivCN0kWzEwJRev7vQCmFAChnjk", "745709653"],
    "doechiigold":    ["1P2inSuDEuS_kp45qDAXJpb_hmj__Lj409bytyp4xiw8", "1038033313"],
    "dongold":        ["1qsO4SuzzB17d5orqbKWHsaQsRdk0lzTSF9rV2FwQf-Q", "1236129964"],
    "drizzygold":     ["1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI", "230473404"],
    "fiftygold":      ["1UBHQ067bIEDH3TapHIt3MCdwDNRe30Qv0VdBP9JLgFM", "1717251426"],
    "futuregold":     ["1WrsgBEo5pv1eFC8ge6kG-FmSV6eZd_N_9t5HCNir7mk", "1309224685"],
    "gambinogold":    ["1eyBjj7qPxIT_P93RaSPZf5hTJemGi5jMqSJF777OsdE", "1016050461"],
    "gorillazgold":   ["1jauTeMKDULPud0hGD-gPeD-HM70HiBSedrLyOyAqUh0", "710536063"],
    "gunnagold":      ["1P_BA-CIy05lDl9j1H06awxNqvXYJcD-KeBPVdgTO7Eo", "1476869338"],
    "icecubegold":    ["1bsNrVejh4H27uafX6jpnllbAuiVqRnDUMegKdTYAFQA", "1369615792"],
    "jayzgold":       ["18GwItf2M92QimNMAbUCfFsxCkiHlkf8DPJPLWHAcoxQ", "1236871730"],
    "jojigold":       ["1FPlWbXnx94y5FODJ2qniLf0BzViNSAmj6Xdfw1ZNwQ4", "2027576133"],
    "kdotgold":       ["1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI", "1043194158"],
    "keemgold":       ["1_SNZQS-AAXVleukgKlraegaozkLOu8WMHbUwmPm61hc", "489341454"],
    "kengold":        ["1OARID98xCqRaBr8gyQCvI3aD4jKQDGgtedyRaiP_pyo", "372423620"],
    "lonelygold":     ["1J16EyxHqZD4m0VZ6g6SoY_1GC21TU7P2kk9FeteSKvE", "654868102"],
    "macgold":        ["17TycQCSpIm-6DyWId4ve8fVaM7Ewg3lgV1DDNRwauh0", "179600863"],
    "mjgold":         ["1i59TKrIZ1OvFFPJFuOMw1VXlvyzaVOH0Wb0vVJp9BTw", "608188924"],
    "shadygold":      ["1x9tTOOqH5WpKOoptdQzABSN_x8oZbMgzIGlGH9w1IKA", "1443132755"],
    "slimegold":      ["12zc2reK5y8XP6SQhv1ujQtiG9VpJy7yDWwDuE-S-wpc", "1999300901"],
    "smokegold":      ["1-Kd8molYeR1WpmWR81DqmSCGng3g-AVmZfgd752kh3M", "1999300901"],
    "sosagold":       ["1oDE9gTnEG7ufPQIOMjLTegfI47qtgNCxngmxxHZL4qA", "1885470461"],
    "stevelacygold":  ["1xqnIw0wymufIjKfoaXGDC-KAVuF81S5quMCCX7lYQyc", "1251519406"],
    "szagold":        ["1mPq6ZvoQ1_kWqIH9JS8I2VbBb8WboFYyeMP2yqjtz7s", "1999300901"],
    "trippiegold":    ["1hZdGFBZmukWGH4IlnH0NJvphwEct2XEMJT_moTFhTvc", "1800483758"],
    "twizzygold":     ["1FUzAZyTCgFTVxQ--qbCAS2bUk4dsAw6ASxwjURPHbyI", "602198332"],
    "tydollagold":    ["11Kk3Mi8iiFmXEFV8vzcmTrnjcMkfgImABCavXhC4D48", "813585500"],
    "uzigold":        ["1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo", "1983561937"],
    "vampgold":       ["1Irtfvymu26CShYowLMMfD-rM0o9CJqE6-BBSlYsAaF4", "1038033313"],
    "weekndgold":     ["1luU-KL_vKt72goUpSO2F0qMvXyqaT_q8VwYNjPeLgTg", "337423375"],
    "wolfgold":       ["19GJTNp7PxK1OtyVBmGelZSMm5i8Fy82EGtcFdIkBpsY", "660032103"],
    "wutanggold":     ["1dA2h1kQffOmUUeCy6YMu8IYdGGqnhnWuabKdK7emyyU", "1817611336"],
    "xgold":          ["1wKq7lSERmXYutRFxipNbFFc-DUdqhVXWWlFnqkzwRFA", "666785613"],
    "yzygold":        ["12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM", "1372270223"],
}

# ── xlsx download ─────────────────────────────────────────────────────────────

def download_xlsx(slug, sid):
    """Return raw xlsx bytes, using an on-disk cache. None when blocked."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{slug}.xlsx")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        with open(path, "rb") as f:
            head = f.read(2)
        if head == b"PK":
            return path
    url = f"https://docs.google.com/spreadsheets/d/{sid}/export?format=xlsx"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=180) as r, open(path, "wb") as out:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    out.write(chunk)
            with open(path, "rb") as f:
                if f.read(2) == b"PK":
                    return path
        except urllib.error.HTTPError as e:
            print(f"    xlsx blocked ({e.code})")
            return None
        except Exception as e:
            print(f"    download attempt {attempt+1} failed: {e}")
            time.sleep(3)
    return None


# ── xlsx parsing helpers ──────────────────────────────────────────────────────

def col_of(ref):
    letters = "".join(c for c in ref if c.isalpha())
    n = 0
    for c in letters:
        n = n * 26 + (ord(c) - 64)
    return n


def parse_shared_strings(z):
    """Return (plain_texts, runs) where runs[i] = [(text, color), ...]."""
    if "xl/sharedStrings.xml" not in z.namelist():
        return [], []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    plain, runs = [], []
    for si in root.findall(NS + "si"):
        r_list = si.findall(NS + "r")
        if r_list:
            cur = []
            for r in r_list:
                t = r.find(NS + "t")
                txt = t.text if t is not None and t.text else ""
                color = None
                rpr = r.find(NS + "rPr")
                if rpr is not None:
                    c = rpr.find(NS + "color")
                    if c is not None:
                        color = c.get("rgb")
                cur.append((txt, color))
            plain.append("".join(t for t, _ in cur))
            runs.append(cur)
        else:
            t = si.find(NS + "t")
            plain.append(t.text if t is not None and t.text else "")
            runs.append(None)
    return plain, runs


def parse_fills(z):
    """cellXf index -> fill rgb (or None)."""
    root = ET.fromstring(z.read("xl/styles.xml"))
    fills = []
    for f in root.find(NS + "fills").findall(NS + "fill"):
        pf = f.find(NS + "patternFill")
        rgb = None
        if pf is not None:
            fg = pf.find(NS + "fgColor")
            if fg is not None:
                rgb = fg.get("rgb")
        fills.append(rgb)
    xfs = []
    for xf in root.find(NS + "cellXfs").findall(NS + "xf"):
        fid = int(xf.get("fillId", "0"))
        xfs.append(fills[fid] if fid < len(fills) else None)
    return xfs


def sheet_file_for_gid(z, gid):
    """Map a Google gid to the exported worksheet file, best-effort.

    The xlsx keeps sheets in Google's tab order; gid isn't preserved, so we
    fall back to locating the tab whose header row mentions 'Tracklist'."""
    wb = z.read("xl/workbook.xml").decode("utf8", "ignore")
    rels = dict(re.findall(r'Id="([^"]*)"[^>]*Target="([^"]*)"',
                           z.read("xl/_rels/workbook.xml.rels").decode("utf8", "ignore")))
    sheets = re.findall(r'<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"', wb)
    files = []
    for name, rid in sheets:
        tgt = rels.get(rid, "")
        files.append((name, "xl/" + tgt.replace("../", "")))
    return files


DECOY_WORDS = ("wip", "old", "obsolete", "draft", "alt", "backup", "copy")


def find_tracklists_sheet(z, files, plain):
    """Pick the worksheet whose header row looks like the tracklists tab.

    Workbooks often keep stale duplicates alongside the live tab
    (e.g. 'Tracklists (WIP)' next to 'Tracklists'), so prefer the sheet whose
    name is exactly 'Tracklists', then any 'tracklist' tab that isn't obviously
    a decoy, before falling back to the first match."""
    named = [(name, path) for name, path in files if "tracklist" in name.lower()]
    for name, path in named:
        if name.strip().lower() == "tracklists":
            return path
    for name, path in named:
        low = name.lower()
        if not any(w in low for w in DECOY_WORDS):
            return path
    if named:
        return named[0][1]
    # otherwise sniff header rows for 'tracklist' + 'name'
    for name, path in files:
        if path not in z.namelist():
            continue
        try:
            head = z.read(path)[:20000].decode("utf8", "ignore").lower()
        except Exception:
            continue
        if "tracklist" in name.lower():
            return path
    # fall back: scan each sheet's first rows via shared strings is costly;
    # default to the first sheet mentioning tracklist in its cells
    for name, path in files:
        if path not in z.namelist():
            continue
        xml = z.read(path).decode("utf8", "ignore")
        # cells reference shared strings by index; check plain texts of this sheet
        idxs = re.findall(r'<c[^>]*t="s"[^>]*><v>(\d+)</v>', xml)[:200]
        joined = " ".join(plain[int(i)].lower() for i in idxs if int(i) < len(plain))
        if "tracklist" in joined:
            best = path
            break
    return best


def read_rows(z, path, plain, runs, xfs):
    """Return list of rows; each row = {colnum: (value, color, run_list)}."""
    sh = ET.fromstring(z.read(path))
    data = sh.find(NS + "sheetData")
    out = []
    for row in data.findall(NS + "row"):
        cells = {}
        for c in row.findall(NS + "c"):
            ref = c.get("r")
            if not ref:
                continue
            col = col_of(ref)
            s = c.get("s")
            color = xfs[int(s)] if s is not None and int(s) < len(xfs) else None
            t = c.get("t")
            v = c.find(NS + "v")
            val, run = "", None
            if t == "s" and v is not None:
                si = int(v.text)
                val = plain[si] if si < len(plain) else ""
                run = runs[si] if si < len(runs) else None
            elif t == "inlineStr":
                istr = c.find(NS + "is")
                if istr is not None:
                    val = "".join(x.text or "" for x in istr.iter(NS + "t"))
            elif v is not None:
                val = v.text or ""
            cells[col] = (val, color, run)
        out.append((int(row.get("r")), cells))
    return out


# ── images ────────────────────────────────────────────────────────────────────

def extract_images(z, sheet_path, slug, art_dir):
    """Return {sheet_row(1-based): [rel_url, ...]} for images anchored on sheet."""
    names = set(z.namelist())
    rel_path = sheet_path.replace("worksheets/", "worksheets/_rels/") + ".rels"
    if rel_path not in names:
        return {}
    srels = z.read(rel_path).decode("utf8", "ignore")
    m = re.search(r'Target="([^"]*drawing[^"]*\.xml)"', srels)
    if not m:
        return {}
    drawing = "xl/" + m.group(1).replace("../", "")
    if drawing not in names:
        return {}
    d = z.read(drawing).decode("utf8", "ignore")
    drel = drawing.replace("drawings/", "drawings/_rels/") + ".rels"
    relmap = {}
    if drel in names:
        relmap = dict(re.findall(r'Id="([^"]*)"[^>]*Target="([^"]*)"',
                                 z.read(drel).decode("utf8", "ignore")))
    anchors = re.findall(
        r"<xdr:from>.*?<xdr:row>(\d+)</xdr:row>.*?</xdr:from>.*?r:embed=\"([^\"]*)\"",
        d, re.S)
    if not anchors:
        return {}
    os.makedirs(art_dir, exist_ok=True)
    result = {}
    for row0, rid in anchors:
        tgt = relmap.get(rid)
        if not tgt:
            continue
        media = "xl/" + tgt.replace("../", "")
        if media not in names:
            continue
        row = int(row0) + 1  # xdr row is 0-based
        try:
            raw = z.read(media)
            out_name = f"tl-{row}-{len(result.get(row, []))}.jpg"
            out_path = os.path.join(art_dir, out_name)
            if Image is not None:
                im = Image.open(io.BytesIO(raw)).convert("RGB")
                w, h = im.size
                if max(w, h) > 1500:
                    scale = 1500 / max(w, h)
                    im = im.resize((int(w * scale), int(h * scale)))
                im.save(out_path, "JPEG", quality=82, optimize=True)
            else:
                out_name = f"tl-{row}-{len(result.get(row, []))}{os.path.splitext(media)[1]}"
                out_path = os.path.join(art_dir, out_name)
                with open(out_path, "wb") as f:
                    f.write(raw)
            result.setdefault(row, []).append(f"/{slug}/art/{out_name}")
        except Exception as e:
            print(f"    image {media} failed: {e}")
    return result


# ── text parsing ──────────────────────────────────────────────────────────────

TRACK_RE = re.compile(r"^\s*#?(\d+|\?)[\.\)]\s+(.*\S)\s*$")


def split_tracklist(text, run=None, legend_colors=None):
    """Return (description, [ {num,name,color?} ]).

    Lines that look like `1. Song` / `#?. Song` become tracks; everything
    before the first such line is the description. When the cell colours
    individual track lines with a legend swatch (rich text), that line's track
    inherits the colour — plain white/black body text is ignored."""
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    # per-line colour from rich runs, if present
    line_colors = {}
    if run:
        idx = 0
        buf = ""
        for seg, color in run:
            for ch in seg:
                if ch == "\n":
                    idx += 1
                    buf = ""
                else:
                    if not buf and ch.strip() and color:
                        line_colors[idx] = color
                    buf += ch
    desc_lines, tracks = [], []
    seen_track = False
    for i, line in enumerate(lines):
        m = TRACK_RE.match(line)
        if m:
            seen_track = True
            num = m.group(1)
            entry = {"num": ("#?" if num == "?" else "#" + num), "name": m.group(2).strip()}
            c = line_colors.get(i)
            if c:
                hx = "#" + c[-6:]
                if legend_colors and hx.lower() in legend_colors:
                    entry["color"] = hx
                    entry["colorLabel"] = legend_colors[hx.lower()]
            tracks.append(entry)
        elif not seen_track:
            desc_lines.append(line)
    description = "\n".join(desc_lines).strip()
    return description, tracks


def looks_like_tracklist(s):
    """True when a cell that should be a name is actually the tracklist itself
    (several numbered lines) — happens on sheets with no dedicated Name column."""
    if not s:
        return False
    hits = sum(1 for line in s.split("\n") if TRACK_RE.match(line))
    return hits >= 2


def find_col(header_cells, *keys):
    """Return the column number whose header contains any of keys."""
    for col, (val, _c, _r) in header_cells.items():
        low = (val or "").lower()
        for k in keys:
            if k in low:
                return col
    return None


def parse_legend(cells):
    """Find the legend cell (multiple coloured runs) and return [{label,color}]."""
    for col, (val, _c, run) in cells.items():
        if run and val and "|" in val and ("available" in val.lower() or "unheard" in val.lower()):
            out = []
            for seg, color in run:
                label = seg.strip().strip("|").strip()
                if label and color and label != "|":
                    out.append({"label": label, "color": "#" + color[-6:]})
            if out:
                return out
    return []


def parse_links(val):
    """Split a Link(s) cell into a list of distinct http(s) URLs."""
    if not val:
        return []
    urls = re.findall(r"https?://\S+", val)
    seen, out = set(), []
    for u in urls:
        u = u.rstrip(").,;")
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def excel_date(val):
    """Convert an Excel serial date to YYYY-MM-DD-ish text, else pass through."""
    if not val:
        return ""
    try:
        f = float(val)
        if 20000 < f < 60000:
            import datetime
            base = datetime.date(1899, 12, 30)
            return (base + datetime.timedelta(days=int(f))).isoformat()
    except (ValueError, TypeError):
        pass
    return str(val).strip()


def excel_text(val):
    """Undo Google Sheets auto-formatting a text cell as a date/time.

    An era or copy name that looks like a clock time (e.g. "4:44") gets stored by
    Sheets as a time-of-day serial — a bare fraction of a day — instead of the typed
    string, so the xlsx export hands back "0.19722222222222222" instead of "4:44".
    Convert that back to H:MM; leave genuine dates/other numbers untouched."""
    if not val:
        return ""
    try:
        f = float(val)
    except (ValueError, TypeError):
        return str(val).strip()
    if 0 <= f < 1:
        total_minutes = round(f * 24 * 60)
        h, m = divmod(total_minutes, 60)
        return f"{h}:{m:02d}"
    return str(val).strip()


# ── per-artist build ──────────────────────────────────────────────────────────

def build_from_xlsx(slug, path):
    z = zipfile.ZipFile(path)
    plain, runs = parse_shared_strings(z)
    xfs = parse_fills(z)
    files = sheet_file_for_gid(z, None)
    sheet_path = find_tracklists_sheet(z, files, plain)
    if not sheet_path:
        print("    could not locate tracklists sheet")
        return None
    rows = read_rows(z, sheet_path, plain, runs, xfs)
    if not rows:
        return None

    # header = first row that has a 'name'-ish and 'tracklist'-ish column. Real header
    # cells are short labels, so skip prose-heavy data rows that happen to contain the
    # word "name" incidentally (e.g. a tracklist entry titled "What's in a Name?") —
    # sheets with no real header row at all (e.g. jayzgold) then keep header_idx at 0
    # and fall through to the positional defaults below.
    header_idx = 0
    found_header = False
    for i, (rn, cells) in enumerate(rows[:6]):
        vals = [(v or "").strip() for v, _, _ in cells.values()]
        if any(len(v) > 40 for v in vals):
            continue
        joined = " ".join(v.lower() for v in vals)
        if "tracklist" in joined and ("name" in joined or "era" in joined):
            header_idx = i
            found_header = True
            break
    # Without a real header row, rows[0] is often the legend/notes row, whose prose
    # can accidentally contain header-ish substrings (e.g. the legend text "...
    # Available" matches an "availab" search) — don't scan it for column keywords.
    header_cells = rows[header_idx][1] if found_header else {}

    c_era = find_col(header_cells, "era") or 1
    c_name = find_col(header_cells, "name", "title")
    c_tl = find_col(header_cells, "tracklist") or 3
    if c_name is None and not found_header:
        c_name = 2  # no header row at all — assume the usual era/name/tracklist order
    if c_name is None or c_name == c_tl:
        c_name = None  # no dedicated name column — fall back to the era below
    c_date = find_col(header_cells, "date")
    c_avail = find_col(header_cells, "availab")
    c_qual = find_col(header_cells, "quality")
    c_source = find_col(header_cells, "source")
    c_link = find_col(header_cells, "link")

    # legend: search header rows for the coloured legend cell
    legend = []
    legend_colors = {}
    for _rn, cells in rows[: header_idx + 2]:
        legend = parse_legend(cells) or legend
        if legend:
            legend_colors = {l["color"].lower(): l["label"] for l in legend}
            break

    art_dir = os.path.join(PUBLIC, slug, "art")
    images_by_row = extract_images(z, sheet_path, slug, art_dir)

    albums = []
    for rn, cells in rows[header_idx + 1:]:
        raw_name = excel_text(cells.get(c_name, ("", None, None))[0]) if c_name else ""
        tl_val, _tlc, tl_run = cells.get(c_tl, ("", None, None))
        era = excel_text(cells.get(c_era, ("", None, None))[0])
        tl_stripped = (tl_val or "").strip()
        has_img = rn in images_by_row
        description, tracks = split_tracklist(tl_val, tl_run, legend_colors)
        # When the sheet has a real Name column, drop spacer / legend / guideline
        # rows: a row with no Name value, no numbered tracklist and no backup
        # image is a note whose prose merely lands in the era/notes columns — the
        # era-as-name fallback would otherwise surface it as a bogus "album".
        if c_name is not None and not raw_name and not tracks and not has_img:
            continue
        name = raw_name
        if not name or looks_like_tracklist(name):
            name = era  # sheet has no real name — title the copy by its era
        if not name and not tl_stripped:
            continue
        date = excel_date(cells.get(c_date, ("", None, None))[0]) if c_date else ""
        availability = ""
        if c_avail:
            availability = (cells.get(c_avail, ("", None, None))[0] or "").strip()
        quality = (cells.get(c_qual, ("", None, None))[0] or "").strip() if c_qual else ""
        source = (cells.get(c_source, ("", None, None))[0] or "").strip() if c_source else ""
        links = parse_links(cells.get(c_link, ("", None, None))[0]) if c_link else []

        # per-album availability colour: first cell on the row whose fill
        # matches a legend swatch
        avail_color, avail_label = "", ""
        if legend_colors:
            for col, (_v, color, _r) in cells.items():
                if color:
                    hx = "#" + color[-6:]
                    if hx.lower() in legend_colors:
                        avail_color = hx
                        avail_label = legend_colors[hx.lower()]
                        break

        entry = {
            "era": era or name,
            "name": name or era,
            "date": date,
            "quality": quality or source,
            "source": source,
            "links": links,
            "description": description,
            "tracks": tracks,
        }
        if availability:
            entry["availability"] = availability
        if avail_color:
            entry["availColor"] = avail_color
            entry["availLabel"] = avail_label
        if rn in images_by_row:
            entry["images"] = images_by_row[rn]
        albums.append(entry)

    return {"legend": legend, "albums": albums}


def build_from_csv(slug):
    """Text-only fallback from the committed CSV (no colours/images)."""
    csv_path = os.path.join(PUBLIC, slug, "data", "tracklists.csv")
    if not os.path.exists(csv_path):
        return None
    with open(csv_path, encoding="utf-8") as f:
        rows = list(csvmod.reader(f))
    if not rows:
        return None
    header = rows[0]
    low = [h.lower() for h in header]

    def col(*keys):
        for i, h in enumerate(low):
            if any(k in h for k in keys):
                return i
        return None

    c_name = col("name", "title")
    c_tl = col("tracklist", "notes", "description")
    if c_name is not None and c_name == c_tl:
        c_name = None
    c_date = col("date")
    c_qual = col("quality")
    c_avail = col("availab")
    c_source = col("source")
    c_link = col("link")
    legend = []
    # legend is usually the first data row's first cell (pipe separated)
    if len(rows) > 1 and rows[1] and "|" in rows[1][0]:
        parts = [p.strip() for p in rows[1][0].split("|") if p.strip()]
        legend = [{"label": p, "color": ""} for p in parts]
    albums = []
    start = 2 if legend else 1
    for r in rows[start:]:
        def cell(i):
            return (r[i] if i is not None and i < len(r) else "").strip()
        raw_name = cell(c_name) if c_name is not None else ""
        tl = cell(c_tl)
        era = (r[0] if r else "").strip()
        if c_name is not None and not raw_name and not tl:
            continue  # spacer / legend / guideline row
        name = raw_name
        if not name or looks_like_tracklist(name):
            name = era
        if not name and not tl:
            continue
        description, tracks = split_tracklist(tl)
        entry = {
            "era": era or name,
            "name": name,
            "date": cell(c_date),
            "quality": cell(c_qual) or cell(c_source),
            "source": cell(c_source),
            "links": parse_links(cell(c_link)) if c_link is not None else [],
            "description": description,
            "tracks": tracks,
        }
        if c_avail is not None and cell(c_avail):
            entry["availability"] = cell(c_avail)
        albums.append(entry)
    return {"legend": legend, "albums": albums}


def build(slug):
    sid = SHEETS.get(slug, [None])[0]
    result = None
    if sid:
        path = download_xlsx(slug, sid)
        if path:
            try:
                result = build_from_xlsx(slug, path)
            except Exception as e:
                print(f"    xlsx parse failed: {e}")
            # workbooks are 100s of MB each; drop them unless asked to keep
            if not os.environ.get("KEEP_XLSX"):
                try:
                    os.remove(path)
                except OSError:
                    pass
    if not result or not result.get("albums"):
        print("    falling back to committed CSV")
        result = build_from_csv(slug)
    if not result:
        print("    no data")
        return
    out_path = os.path.join(PUBLIC, slug, "Tracklists.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1, ensure_ascii=False)
    n_img = sum(len(a.get("images", [])) for a in result["albums"])
    n_desc = sum(1 for a in result["albums"] if a.get("description"))
    n_color = sum(1 for a in result["albums"] if a.get("availColor"))
    print(f"    {len(result['albums'])} albums · {n_desc} descriptions · "
          f"{len(result['legend'])} legend · {n_color} coloured · {n_img} images")


def main():
    targets = sys.argv[1:] or list(SHEETS.keys())
    for slug in targets:
        print(f"[{slug}]")
        try:
            build(slug)
        except Exception as e:
            print(f"    ERROR: {e}")


if __name__ == "__main__":
    main()
