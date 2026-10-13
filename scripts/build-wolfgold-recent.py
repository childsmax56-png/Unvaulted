#!/usr/bin/env python3
"""Build wolfgold's Recent tab CSV from tylertracker.net's static mirror.

Tyler's official tracker (tylertracker.net) is a static mirror of a private
Google Sheet, served as HTML tables at /preview/sheet/<gid>.html — the same
setup as franktracker.net (see frankgold). The underlying sheet isn't public,
so we scrape the mirror's "Recent" tab (gid 1356276013) into a committed CSV.

Output columns match the committed-CSV recent format that App.tsx's
mapRecentItem() reads (Name + Notes + dates + Link(s)), so notes render in the
Recent view. wolfgold's `recent` gid must stay OUT of SHEET_SOURCES in
functions/api/[artist]/_sheets.ts, otherwise the live wolfgold sheet (public,
different data, no readable Notes column) would override this snapshot.

Usage: python3 scripts/build-wolfgold-recent.py
"""
import csv
import html
import os
import re
import urllib.request

SRC = "https://tylertracker.net/preview/sheet/1356276013"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "wolfgold", "data", "recent.csv")

# Output column -> source header on the mirror.
COLUMN_MAP = {
    "Era": "Era",
    "Name": "Title",
    "Notes": "Notes",
    "Track Length": "Length",
    "File Date": "File Date",
    "Leak Date": "Leak Date",
    "Available Length": "Availability",
    "Quality": "Quality",
    "Link(s)": "Link(s)",
}


def clean_text(cell: str) -> str:
    """Convert a mirror <td> body to plain text, <br> -> newline."""
    cell = re.sub(r"<br\s*/?>", "\n", cell, flags=re.I)
    cell = re.sub(r"<[^>]+>", "", cell)
    return html.unescape(cell).strip()


def extract_links(cell: str) -> str:
    """Pull the real href(s) out of a Link(s) cell, newline-joined."""
    hrefs = re.findall(r'href="([^"]+)"', cell)
    if hrefs:
        return "\n".join(hrefs)
    # No anchor tags — fall back to any plain-text URL.
    return clean_text(cell)


def main() -> None:
    req = urllib.request.Request(SRC, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        page = resp.read().decode("utf-8", "replace")

    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S)
    if not rows:
        raise SystemExit("No table rows found in mirror — page structure changed?")

    # The header row isn't always first (spacer/frozen rows precede it); find the
    # row that actually contains the expected column names.
    header_idx = None
    header_cells = []
    # Each row starts with a <th> row-number cell followed by the data <td>s; match
    # <td> only so header indices line up with the data rows.
    for i, row in enumerate(rows):
        cells = [clean_text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if "Title" in cells and "Notes" in cells and "Link(s)" in cells:
            header_idx, header_cells = i, cells
            break
    if header_idx is None:
        raise SystemExit("Could not locate header row in mirror — page structure changed?")

    idx = {name: header_cells.index(name) for name in set(COLUMN_MAP.values()) if name in header_cells}
    missing = [src for src in COLUMN_MAP.values() if src not in idx]
    if missing:
        raise SystemExit(f"Mirror is missing expected columns {missing}; headers were {header_cells}")

    out_rows = []
    for row in rows[header_idx + 1:]:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) <= max(idx.values()):
            continue
        record = {}
        for out_col, src_col in COLUMN_MAP.items():
            raw = cells[idx[src_col]]
            record[out_col] = extract_links(raw) if out_col == "Link(s)" else clean_text(raw)
        # Skip blank/spacer rows and section dividers (Era set but no song name).
        if not record["Name"]:
            continue
        out_rows.append(record)

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(COLUMN_MAP.keys()))
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Wrote {len(out_rows)} rows to {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
