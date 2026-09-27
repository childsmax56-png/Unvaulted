#!/usr/bin/env python3
"""
Replaces dead pillows.su/pillowcase links in the yzygold (Kanye West) tracker's
CSVs with live file links (mostly imgur.gg) scraped from yetracker.cc's public
JSON API, which uses a different, still-working file host.

Matches each row by (era, song title) against yetracker's own catalog. The
trailing "[V#]" version tag is ignored for matching -- the two trackers number
versions independently, so what we call "[V2]" may be their "[V1]" for the
exact same leaked file. Leak date / exact track length are used instead as the
real fingerprint to disambiguate between same-titled candidates (e.g. many
different "Beat 1" instrumentals, or a song's several versions). If more than
one of OUR rows would resolve to the same single yetracker source, none of
them are replaced -- we can't tell which one it actually is. Rows are only
replaced when the match is unambiguous, so most benefit comes on repeated runs
as yetracker's data grows.

Usage:
    python3 scripts/fix-yzygold-pillowcase-links.py            # dry run, prints stats
    python3 scripts/fix-yzygold-pillowcase-links.py --apply    # writes changes
"""
import json, csv, re, sys, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CACHE = Path("/tmp/yetracker_cache")
CACHE.mkdir(exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

TAB_MAP = {
    "unreleased.csv": ["main"],
    "recent.csv": ["recent"],
    "stems.csv": ["stems"],
    "misc.csv": ["misc"],
    "art.csv": ["art"],
    "tracklists.csv": ["tracklists"],
    "groupbuys.csv": ["groupbuys"],
    "album-copies.csv": ["copies"],
    "released.csv": ["released"],
    "fakes.csv": ["fakes"],
    "bestof.csv": ["best"],
}

CREDIT_MARKERS = ["with ", "with:", "feat.", "feat ", "ft.", "prod.", "ref.", "reference", "&"]
FILE_HOSTS = ["imgur.gg", "krakenfiles.com", "pixeldrain.com"]
PILLOW_TOKEN_RE = re.compile(r"\S*pillow\S*", re.IGNORECASE)
VERSION_TAG_RE = re.compile(r"\s*\[[^\]]*\]\s*$")  # trailing "[V1]", "[V2-V?]", etc.

# Our era name (lowercased) -> yetracker.cc's era name (lowercased), for cases
# where the two trackers independently renamed/split the same era.
ERA_ALIASES = {
    "love everyone": "hitler",
    "donda 2": "donda 2 [v1]",
    "donda 2 (2025)": "donda 2 [v2]",
    "bad bitch playbook": "¥$",
}


def fetch_tab(tab):
    fp = CACHE / f"{tab}.json"
    if not fp.exists():
        req = urllib.request.Request(f"https://yetracker.cc/api/tab/{tab}", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as resp:
            fp.write_bytes(resp.read())
    return json.loads(fp.read_text(encoding="utf-8"))


def norm_title(s):
    s = s.strip()
    s = re.sub(r'^[^\w"\'(]+', "", s)  # strip leading decorative symbols/emoji
    s = re.sub(r"\s+", " ", s)
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("“", '"').replace("”", '"')
    return s.strip().lower()


def parse_name(raw):
    lines = raw.split("\n")
    title = norm_title(lines[0]) if lines else ""
    credits, alts = [], []
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        low = line.lower()
        (credits if any(m in low for m in CREDIT_MARKERS) else alts).append(low)
    return title, credits, alts


def base_title(title):
    """Strip one trailing bracketed version tag for cross-version grouping."""
    return VERSION_TAG_RE.sub("", title).strip()


def load_yetracker_index(tabs):
    lookup = {}
    for tab in tabs:
        d = fetch_tab(tab)
        for era in d["eras"]:
            for t in era["tracks"]:
                ename = (t.get("era") or era["name"]).strip().lower()
                nm = t["name"]
                raw = nm["raw"] if isinstance(nm, dict) else (nm or "")
                title, credits, alts = parse_name(raw)
                entry = {
                    "raw": raw,
                    "credits": credits,
                    "alts": alts,
                    "leak_date": (t.get("leak_date") or "").strip().lower(),
                    "track_length": (t.get("track_length") or "").strip(),
                    "links": t.get("links", []),
                }
                lookup.setdefault((ename, base_title(title)), []).append(entry)
    return lookup


def best_file_link(links):
    for host in FILE_HOSTS:
        for l in links:
            if host in l:
                return l
    return None


def score(row_leak, row_len, row_credits, row_alts, cand):
    s = 0
    if row_leak and cand["leak_date"] and row_leak == cand["leak_date"]:
        s += 10
    if row_len and cand["track_length"] and row_len == cand["track_length"]:
        s += 5
    for rc in row_credits:
        for cc in cand["credits"]:
            s += 4 if rc == cc else (2 if (rc in cc or cc in rc) else 0)
    for ra in row_alts:
        for ca in cand["alts"]:
            if ra == ca:
                s += 3
    return s


def conflicts(row_leak, row_len, cand):
    if row_leak and cand["leak_date"] and row_leak != cand["leak_date"]:
        return True
    if row_len and cand["track_length"] and row_len != cand["track_length"]:
        return True
    return False


def match_row(era, name_raw, leak_date, track_length, lookup):
    era_key = era.strip().lower()
    era_key = ERA_ALIASES.get(era_key, era_key)
    title, credits, alts = parse_name(name_raw)
    cands = lookup.get((era_key, base_title(title)))
    if not cands:
        return None, "no_key"
    row_leak, row_len = (leak_date or "").strip().lower(), (track_length or "").strip()
    if len(cands) == 1:
        only = cands[0]
        return (None, "unique_conflict") if conflicts(row_leak, row_len, only) else (only, "unique")
    scored = [(score(row_leak, row_len, credits, alts, c), c) for c in cands if not conflicts(row_leak, row_len, c)]
    if not scored:
        return None, "ambiguous_all_conflict"
    scored.sort(key=lambda x: -x[0])
    top_score, top = scored[0]
    if len(scored) > 1 and scored[1][0] == top_score:
        return None, "ambiguous"
    if top_score <= 0:
        return None, "ambiguous_no_signal"
    return top, "disambiguated"


def is_dead_link_cell(cell):
    return "pillow" in cell.lower()


def process_file(fname, lookup, apply=False):
    fp = REPO / "public" / "yzygold" / "data" / fname
    rows = list(csv.reader(open(fp, newline="", encoding="utf-8")))
    header = rows[0]
    link_idx = len(header) - 1
    leak_idx = len_idx = None
    for i, h in enumerate(header):
        hl = h.lower()
        if "leak" in hl:
            leak_idx = i
        if ("track" in hl and "length" in hl) or hl.strip() == "full length":
            len_idx = i

    stats = {"pillow_rows": 0, "replaced": 0}

    # Pass 1: match every dead-link row to a candidate (if any), but don't
    # commit yet -- first find out whether more than one of OUR rows would
    # claim the exact same yetracker candidate (e.g. our [V1] and [V2] rows
    # both resolving to their single untagged version, since version labels
    # aren't trustworthy across trackers -- see match_row/base_title).
    pending = []  # (cand, link, old_url)
    claims = {}   # id(cand) -> count of our rows that landed on it
    for row in rows[1:]:
        if len(row) <= link_idx or not is_dead_link_cell(row[link_idx]):
            continue
        stats["pillow_rows"] += 1
        leak_date = row[leak_idx] if leak_idx is not None and leak_idx < len(row) else ""
        track_length = row[len_idx] if len_idx is not None and len_idx < len(row) else ""
        cand, reason = match_row(row[0], row[1], leak_date, track_length, lookup)
        stats[reason] = stats.get(reason, 0) + 1
        if cand is None:
            continue
        link = best_file_link(cand["links"])
        if not link:
            stats["no_file_link"] = stats.get("no_file_link", 0) + 1
            continue
        tokens = PILLOW_TOKEN_RE.findall(row[link_idx])
        if len(tokens) != 1:
            stats["skipped_unsafe"] = stats.get("skipped_unsafe", 0) + 1
            continue
        claims[id(cand)] = claims.get(id(cand), 0) + 1
        pending.append((cand, link, tokens[0]))

    # Pass 2: commit only the un-contested ones.
    replacements, seen_old = [], set()
    for cand, link, old_url in pending:
        if claims[id(cand)] > 1:
            stats["candidate_contested"] = stats.get("candidate_contested", 0) + 1
            continue
        if old_url in seen_old:
            stats["skipped_unsafe"] = stats.get("skipped_unsafe", 0) + 1
            continue
        seen_old.add(old_url)
        stats["replaced"] += 1
        replacements.append((old_url, link))

    if apply and replacements:
        raw = open(fp, newline="", encoding="utf-8").read()
        for old_url, new_url in sorted(replacements, key=lambda p: -len(p[0])):
            raw = raw.replace(old_url, new_url)
        open(fp, "w", newline="", encoding="utf-8").write(raw)

    return stats


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    total = {}
    for fname, tabs in TAB_MAP.items():
        lookup = load_yetracker_index(tabs)
        stats = process_file(fname, lookup, apply=apply)
        print(fname, stats)
        for k, v in stats.items():
            total[k] = total.get(k, 0) + v
    print("\nTOTAL", total)
    if not apply:
        print("\n(dry run — pass --apply to write changes)")
