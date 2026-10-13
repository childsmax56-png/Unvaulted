#!/usr/bin/env python3
"""Normalize the artist socials CSVs (~/Downloads/socials/*.csv) into a single
bundled TS data file consumed by the landing-page Socials modal.

Each source sheet has its own column layout, so mappings are declared per-file
by column index. Output schema (per entry): platform, handle, notes, type,
status, link. Rows with an empty platform (title / section separators) are
skipped. Values like "Deleted" / "???" in the link column become empty links.

Run:  python3 scripts/build-socials.py
Writes: src/socialsData.ts
"""
import csv
import json
import os
import re

HOME = os.path.expanduser("~")
SRC_DIR = os.path.join(HOME, "Downloads", "socials")
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "socialsData.ts")

# slug -> (filename, column-role map). Indexes are 0-based columns in the CSV.
# type_const overrides a per-row Type column when the sheet has none.
FILES = {
    "aapgold":    dict(file="A$AP Rocky Tracker - Media.csv",
                       platform=0, handle=1, notes=2, type=3, link=4),
    "wolfgold":   dict(file="Creator Tracker - 🌐 Socials.csv",
                       platform=0, handle=1, notes=2, years=3, type=4, link=5),
    "drizzygold": dict(file="Drake Tracker - Media.csv",
                       platform=0, handle=1, notes=2, type=3, link=4),
    "frankgold":  dict(file="Frank Ocean Tracker - Socials.csv",
                       platform=0, handle=1, notes=2, link=3, type=4),
    "jojigold":   dict(file="Joji Tracker - 👤 Socials [WIP].csv",
                       platform=0, handle=1, notes=2, years=3, type=4, link=5),
    "kdotgold":   dict(file="Kendrick Lamar Music Tracker - 🌐 Socials.csv",
                       platform=0, handle=1, notes=2, link=3, type_const="Other"),
    "vampgold":   dict(file="Playboi Carti Tracker [Official] - 📝 Social Media .csv",
                       platform=3, handle=1, notes=2, status=5, link=6,
                       type_const="Social Media"),
    "xgold":      dict(file="XXXTENTACION Tracker - Media.csv",
                       platform=0, handle=1, notes=2, type=3, link=4),
    "twizzygold": dict(file="Yeat Trackër - Media.csv",
                       platform=0, handle=1, notes=2, type=3, status=4, link=5),
    "deathgripsgold": dict(file="Death Grips Tracker - Socials.csv",
                       platform=0, handle=1, notes=2, link=3, type_infer=True),
    # archival sheet: availability (Full / Archived / Screenshots Only ...) as the
    # status, archive.org link when the original is gone
    "jpegmafiagold": dict(file="JPEGMAFIA Tracker - Accounts.csv",
                       platform=0, handle=1, notes=2, status=3, link=4, link_fallback=5,
                       type_infer=True),
}

STREAMING = {"amazon music", "apple music", "deezer", "spotify", "tidal", "pandora", "qobuz",
             "soundcloud", "bandcamp", "audiomack", "youtube music", "napster"}


def infer_type(platform):
    p = platform.lower()
    if p in STREAMING:
        return "Streaming Service"
    if p in ("nicknames", "website", "websites"):
        return "Other"
    return "Social Media"


def clean(s):
    """Collapse internal newlines and trim."""
    return " ".join((s or "").split()).strip()


def cell(row, idx):
    if idx is None or idx >= len(row):
        return ""
    return row[idx]


def norm_status(raw):
    v = clean(raw).lower()
    if v in ("yes", "active", "still used", "current"):
        return "Active"
    if v in ("no", "inactive", "deleted", "dead"):
        return "Inactive"
    return clean(raw)


def norm_link(raw):
    # several links may share a cell (one per line) — use the first; bare domains
    # ('dvonhendryx.bandcamp.com') get a scheme
    for line in (raw or "").split("\n"):
        v = clean(line)
        if v.lower().startswith("http"):
            return v
        if re.match(r"^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(/\S*)?$", v, re.I):
            return "https://" + v
    return ""


def build_entries(path, m):
    out = []
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    for row in rows[1:]:  # skip header
        platform = clean(cell(row, m.get("platform")))
        if not platform:
            continue  # title / section-separator rows
        entry = {
            "platform": platform,
            "handle": clean(cell(row, m.get("handle"))),
            "notes": clean(cell(row, m.get("notes"))),
            "type": clean(cell(row, m.get("type"))) or (infer_type(platform) if m.get("type_infer")
                                                         else m.get("type_const", "Other")),
            "status": norm_status(cell(row, m.get("status"))),
            "link": norm_link(cell(row, m.get("link"))) or norm_link(cell(row, m.get("link_fallback"))),
        }
        # Fold "years active" into notes if present and not already there.
        years = clean(cell(row, m.get("years"))) if m.get("years") is not None else ""
        if years and years.lower() not in entry["notes"].lower():
            entry["notes"] = (entry["notes"] + f" ({years})").strip()
        out.append(entry)
    return out


def main():
    data = {}
    for slug, m in FILES.items():
        path = os.path.join(SRC_DIR, m["file"])
        if not os.path.exists(path):
            print(f"  ! missing: {path}")
            continue
        entries = build_entries(path, m)
        data[slug] = entries
        print(f"  {slug:12s} {len(entries):3d} entries")

    body = json.dumps(data, ensure_ascii=False, indent=2)
    ts = (
        "// AUTO-GENERATED by scripts/build-socials.py — do not edit by hand.\n"
        "// Source: ~/Downloads/socials/*.csv\n\n"
        "export interface SocialEntry {\n"
        "  platform: string;\n"
        "  handle: string;\n"
        "  notes: string;\n"
        "  type: string;\n"
        "  status: string;\n"
        "  link: string;\n"
        "}\n\n"
        f"export const SOCIALS_DATA: Record<string, SocialEntry[]> = {body};\n\n"
        "export function hasSocials(slug: string): boolean {\n"
        "  return (SOCIALS_DATA[slug]?.length ?? 0) > 0;\n"
        "}\n"
    )
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(ts)
    print(f"\nWrote {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
