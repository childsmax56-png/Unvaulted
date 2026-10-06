#!/usr/bin/env python3
"""Mass-import the trackers dropped in "~/Downloads/big update".

Each source folder is a Google-Sheets export (one CSV per tab). This script
transforms every folder into the uniform schema the app serves from
public/<slug>/data/*.csv (+ Tracklists.json), auto-derives the era list, and
generates src/artists/<slug>.ts. It is header-driven: source column order and
naming vary per tracker, so columns are matched by header keyword rather than
by fixed position.

Usage: python3 scripts/build-bigupdate-csvs.py [batch]
  batch = "bigupdate" (default, ~/Downloads/big update) or "2026-10"
  (~/Downloads/new trackers 2026-10, one "x - <Tab>.csv" per tab, pulled via
  CSV export or — for private/display-text-link sheets — the Sheets API).
Then wire the generated configs into src/artists/registry.ts.
"""
import csv, io, os, re, json, sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC_ROOT = os.path.expanduser("~/Downloads/big update")

# folder -> (slug, artist display name, accent hex, card letter, short label)
ARTISTS = {
    "SZA":               ("szagold",        "SZA",              "#7c3aed", "S", "SZA"),
    "alliyah":           ("aaliyahgold",    "Aaliyah",          "#b91c1c", "A", "Aaliyah"),
    "ant clemons":       ("antclemonsgold", "Ant Clemons",      "#0ea5e9", "A", "Ant Clemons"),
    "bad bunny":         ("badbunnygold",   "Bad Bunny",        "#16a34a", "B", "Bad Bunny"),
    "chance the rapper": ("chancegold",     "Chance the Rapper","#f59e0b", "C", "Chance the Rapper"),
    "childish gambino":  ("gambinogold",    "Childish Gambino", "#dc2626", "C", "Childish Gambino"),
    "chris brown":       ("chrisbrowngold", "Chris Brown",      "#2563eb", "C", "Chris Brown"),
    "coldplay":          ("coldplaygold",   "Coldplay",         "#eab308", "C", "Coldplay"),
    "daft punk":         ("daftpunkgold",   "Daft Punk",        "#f97316", "D", "Daft Punk"),
    "danny brown":       ("dannybrowngold", "Danny Brown",      "#84cc16", "D", "Danny Brown"),
    "dochii":            ("doechiigold",    "Doechii",          "#a16207", "D", "Doechii"),
    "freddie gibbs":     ("gibbsgold",      "Freddie Gibbs",    "#7c2d12", "F", "Freddie Gibbs"),
    "gunna":             ("gunnagold",      "Gunna",            "#c026d3", "G", "Gunna"),
    "ice cube":          ("icecubegold",    "Ice Cube",         "#0891b2", "I", "Ice Cube"),
    "james blake":       ("jamesblakegold", "James Blake",      "#475569", "J", "James Blake"),
    "layurn hill":       ("lauryngold",     "Ms. Lauryn Hill",  "#ca8a04", "L", "Lauryn Hill"),
    "nas":               ("nasgold",        "Nas",              "#991b1b", "N", "Nas"),
    "steveie lacy":      ("stevelacygold",  "Steve Lacy",       "#059669", "S", "Steve Lacy"),
    "trippie red":       ("trippiegold",    "Trippie Redd",     "#e11d48", "T", "Trippie Redd"),
    "ty dolla $ign":     ("tydollagold",    "Ty Dolla $ign",    "#9333ea", "T", "Ty Dolla $ign"),
    "usher":             ("ushergold",      "Usher",            "#1d4ed8", "U", "Usher"),
    "weekend":           ("weekndgold",     "The Weeknd",       "#b91c1c", "W", "The Weeknd"),
    "westside gun":      ("westsidegold",   "Westside Gunn",    "#525252", "W", "Westside Gunn"),
    "wu tang":           ("wutanggold",     "Wu-Tang Clan",     "#facc15", "W", "Wu-Tang Clan"),
}

# 2026-10 batch. folder -> (slug, name, accent, letter, label, sheet id, creator)
ARTISTS_2026_10 = {
    "clipse":          ("clipsegold",     "Clipse",          "#a3a3a3", "C", "Clipse",
                        "1XUtY5ris3U5R9sRBTOQdTxTNhvCbmjNAQbmLHGHTMGQ", "iaon"),
    "dax":             ("daxgold",        "Dax",             "#dc2626", "D", "Dax",
                        "1t1IuCgKrx3QjCt9CLrcu3FqA32qGAF8TeQjhCQHO4AY", "iaon"),
    "death grips":     ("deathgripsgold", "Death Grips",     "#18181b", "D", "Death Grips",
                        "1Eh-9UyWUtyEpi_ELEhq5pD41ivFJHuQcvz2wFR2ml9g", "iaon"),
    "de la soul":      ("delasoulgold",   "De La Soul",      "#facc15", "D", "De La Soul",
                        "19KA4hq1j8sVhTEt4gqWWn6Potw9N_IGGJ2bwgZeVYHI", "iaon"),
    "dj premier":      ("premiergold",    "DJ Premier",      "#b45309", "P", "DJ Premier",
                        "1RaAzCb3IAg0FZas9dsAMqU785xw1sDYIvx3-SVFEVsY", "iaon"),
    "dmx":             ("dmxgold",        "DMX",             "#7f1d1d", "D", "DMX",
                        "101y0kCIzwGoT0YmGHIchehUpO7tzAdjXSZZVRrEobOg", "iaon"),
    "dua lipa":        ("dualipagold",    "Dua Lipa",        "#db2777", "D", "Dua Lipa",
                        "1gi_foSEziQ48hTlq8hBqIwZCHz6hma1rYXr8qykBq6c", "iaon"),
    "earl sweatshirt": ("earlgold",       "Earl Sweatshirt", "#65a30d", "E", "Earl Sweatshirt",
                        "1EKEnvdiwSudiPJSePPzfCXIQ_W-AYeAIY6_r-a12bdM", "iaon"),
    "oliver tree":     ("olivertreegold", "Oliver Tree",     "#0284c7", "O", "Oliver Tree",
                        "1rhvQ9F8VRAj-jOyTLsvhORsVCyvcMRXJuGoDR1-z4jY", "iaon"),
    "favio foreign":   ("fiviogold",      "Fivio Foreign",   "#4f46e5", "F", "Fivio Foreign",
                        "1K8WDS6pL7uOPvf7j78Om5kO1k0-h-beqMZaXpMAUy74", "iaon"),
}

# Per-tracker era-name fixes the generic reconciliation can't infer.
#   "headers": era-header Name cell (whitespace-collapsed) -> new Name cell
#   "songs":   song-row Era -> era name
ERA_FIXES = {
    # a.ts's global ERA_NAME_MAP already renames the full title to "Darkest Before Dawn"
    "clipsegold": {
        "headers": {"King Push – Darkest Before Dawn: The Prelude (by Pusha T)":
                    "Darkest Before Dawn\n(King Push – Darkest Before Dawn: The Prelude) (by Pusha T)"},
        "songs": {"King Push: The Prelude": "Darkest Before Dawn"},
    },
    "delasoulgold": {
        "headers": {
            "Art Official Itelligence: Mosiac Thump": "AOI: Mosaic Thump",
            "Art Official Intelligence: Bionix": "AOI: Bionix",
            "Art Official Intelligence: 3 [V1]": "AOI: 3 [V1]",
            "Art Official Intelligence: 3 [V2]": "AOI: 3 [V2]",
            "Maseo & Bumpy Knuckles Present... 4 Exits Only": "4 Exits Only\n(Maseo & Bumpy Knuckles)",
        },
        "songs": {"AOI: Mosiac Thump": "AOI: Mosaic Thump", "Your Welcome!": "You're Welcome!"},
    },
    "olivertreegold": {
        # the sheet titles one header block for three album eras; give it to the first
        "headers": {"Cowboy Tears Drown the World in a Swimming Pool of Sorrow": "Cowboy Tears"},
        "songs": {"Soul Album": "Untitled Soul Album", "Tommy Cash Collaboration": "Unknown EP",
                  "LYM, HYB": "Love You Madly, Hate You Badly"},
    },
}

# Kept private: off the landing grid, feed, pickers and search; reachable by URL only.
HIDDEN_TRACKERS = {"daxgold"}

ERA_FIXES.update({
    # headers wrap mid-title ("38 Baby 2 [V1] / Ain't Too"): name eras after the
    # songs' cleaner Era cells and keep the header title as the subtitle
    "nbayoungboygold": {"prefer_song_era": True, "songs": {
        "4444t": "4444", "Just Got A Lot On My Shoulders": "I Just Got A Lot On My Shoulders"}},
    "migosgold": {"songs": {"Collab with Rich The Kid": "Collaboration with Rich The Kid"}},
})

# 2026-10b batch. Migos' sheet gives the group and each member their own tab:
# "x - Unreleased+<n> <Member>.csv" files are merged into the group's eras.
ARTISTS_2026_10B = {
    "jpegmafia":    ("jpegmafiagold",    "JPEGMAFIA",     "#e11d48", "J", "JPEGMAFIA",
                     "1IhfNqEOtwczA6JH52gv2feerMqlJEbaDV4bxaIr7gkI", ""),
    "migos":        ("migosgold",        "Migos",         "#ca8a04", "M", "Migos",
                     "1MgVRlGs5DL7keB_I6YPEj4FYLOHb8DVJbxN5-h6yxOE", ""),
    "nba youngboy": ("nbayoungboygold",  "NBA YoungBoy",  "#16a34a", "Y", "NBA YoungBoy",
                     "1-eJxsD-YciRGsQ6367NQ8zKdVJKEq8pirJPcwncgSwg", ""),
}

BATCHES = {
    "bigupdate": (SRC_ROOT, ARTISTS),
    "2026-10": (os.path.expanduser("~/Downloads/new trackers 2026-10"), ARTISTS_2026_10),
    "2026-10b": (os.path.expanduser("~/Downloads/new trackers 2026-10b"), ARTISTS_2026_10B),
}

RELEASED_VALID = {"Feature", "Production", "Single", "Album Track",
                  "Mixtape Track", "EP Track", "Other"}
RELEASED_TYPE_ALIASES = {"Track": "Album Track", "Singles": "Single", "Features": "Feature",
                         "Album Tracks": "Album Track", "Mixtape": "Mixtape Track",
                         "Mixtape Tracks": "Mixtape Track", "EP Tracks": "EP Track",
                         "Productions": "Production", "Album": "Album Track", "EP": "EP Track"}


def released_type(t):
    """Sheet Type -> a released.ts type. Compound labels keep their first part
    ('Feature / Single' -> Feature); anything unknown (Remix, OST Track...) -> Other."""
    t = re.sub(r"\s+", " ", clean(t))
    for part in (t, t.split("/")[0].strip()):
        part = RELEASED_TYPE_ALIASES.get(part, part)
        if part in RELEASED_VALID:
            return part
    # descriptive labels (NBA YoungBoy: 'Lead Project Single', 'Compilation Project')
    if re.search(r"\bsingle\b", t, re.I):
        return "Single"
    if re.search(r"\bproject\b", t, re.I) and not re.search(r"skit", t, re.I):
        return "Album Track"
    return "Other"
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun",
     "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


# ------------------------------------------------------------------ helpers --
def clean(s):
    return (s or "").strip()


def is_count_header(cell):
    """Era-header rows carry a newline-separated file-count block in col 0."""
    c = cell or ""
    return "\n" in c and re.search(r"\b(Full|Tagged|Partial|OG|Snippet|Unavailable)\b", c, re.I)


def merge_notes(*parts):
    seen, out = set(), []
    for p in parts:
        p = clean(p)
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return "\n\n".join(out)


def parse_date(s):
    m = re.search(r"([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})", s or "")
    if m and m.group(1).lower() in MONTHS:
        return (int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2)))
    m = re.search(r"\b(\d{4})\b", s or "")
    return (int(m.group(1)), 0, 0) if m else None


def tidy_cell(c):
    """Drop invisible marks and filler lines some sheets pad cells with
    (NBA YoungBoy: 'Mind of a Menace Era\n(1999 - June 2016)\n\n.\n.', 'AHLAN \u200e')."""
    c = re.sub(r"[\u200b\u200e\u200f\ufeff]", "", c)
    if "\n" in c or c.strip() in (".", "|"):
        c = "\n".join(l for l in c.split("\n") if l.strip() not in (".", "|"))
    return c


def read_rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return [[tidy_cell(c) for c in r] for r in csv.reader(f)]


def _first_line(c):
    return clean(c).split("\n")[0].strip().lower()


def find_header(rows):
    """Header row = first row whose cell (first line) is Name/Title/Content.

    Header cells often carry a parenthetical second line ('Name\\n(Check out...)'),
    and some sheets prepend disclaimer rows, so match on the cell's first line.
    """
    keys = {"name", "title", "main content", "full content"}
    for i, r in enumerate(rows):
        # any line of the cell — some sheets pad headers with blank lines (' \nName\n')
        if any(l.strip().lower() in keys for c in r for l in c.split("\n")):
            return i
    return 0


def col(headers, *keywords, exclude=()):
    """First column index whose header contains all keywords and no exclude."""
    for i, h in enumerate(headers):
        hl = clean(h).lower()
        if all(k in hl for k in keywords) and not any(x in hl for x in exclude):
            return i
    return None


def cell(row, idx):
    if idx is None or idx >= len(row):
        return ""
    return clean(row[idx])


def canon_tab(tabname):
    """Map a source tab title to a canonical output tab, or None to skip."""
    t = tabname.lower()
    if "individual artists" in t or "outdated" in t or "lost tapes" in t:
        return None
    if any(x in t for x in ("hoax", "miscredit", "bootleg", "fake")):
        return "fakes"
    if any(x in t for x in ("unreleased", "off-streaming", "not on streaming")):
        return "unreleased"
    if t.strip() == "daft punk tracker":
        return "unreleased"
    if "mixtape" in t or "released" in t:
        return "released"
    if "stem" in t:
        return "stems"
    if "tracklist" in t:
        return "tracklists"
    if "album cop" in t:
        return "album-copies"
    if "music video" in t:
        return "music-videos"
    if t.strip() == "media":
        return None
    if "recent" in t:
        return "recent"
    if "art" in t:
        return "art"
    if "misc" in t:
        return "misc"
    if "buy" in t:
        return "groupbuys"
    return None


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


def link_cols(h):
    """Every 'Link(s)' column (some sheets split links by host across columns)."""
    return [i for i, x in enumerate(h) if "link" in clean(x).lower()]


def is_count_block(c):
    """'3 Full' / '24 Total\n17 Confirmed...' — every line is '<n> <word>'."""
    lines = [l.strip() for l in (c or "").split("\n") if l.strip()]
    return bool(lines) and all(re.match(
        r"^\d+\s+(Total|Full|Tagged|Partial|OG|Snippets?|Unavailable|Confirmed|Leaks?|"
        r"Beats?|Stems?|Cut|Lost|Rumou?red|Available|Instrumentals?|Demos?)\b", l, re.I)
        for l in lines)


STAT_WORD = re.compile(
    r"^\d+\s+(Total|Full|Tagged|Partial|OG|Snippets?|Unavailable|Confirmed|Leaks?|Singles?|"
    r"Album|Features?|Productions?|Remix(es)?|Mixtapes?|EP|Others?|Music|OST|Intros?|Interludes?|"
    r"Skits?|Bonus|Never|Beats?|Stems?|Demos?|Instrumentals?|Covers?|Freestyles?)\b", re.I)


def is_stat_block(c):
    """Per-era stats banner ('23 Total\n1 Single\n...', '16 Album Tracks') that
    some tabs put in the Era column above each era's rows."""
    lines = [l.strip() for l in (c or "").split("\n") if l.strip()]
    counted = [bool(re.match(r"^\d+\s+\S", l)) for l in lines]
    if not lines or not counted[0]:
        return False
    if len(lines) == 1:
        return bool(STAT_WORD.match(lines[0]))
    # tolerate a wrapped line or two ('9 "MOAM3 Reloaded"\nSongs')
    return sum(counted) / len(lines) >= 0.6


def era_header_cell(r):
    """The file-count cell of an era-header row (normally col 0; some sheets
    leave col 0 blank and put the counts further right), else None. Always
    returned with a newline — a.ts keys era headers on a multi-line Era cell."""
    if not r:
        return None
    c = None
    if is_count_header(r[0]) or is_count_block(r[0]):
        c = r[0]
    elif not clean(r[0]):
        c = next((x for x in r[1:] if is_count_block(x)), None)
    if c is None:
        return None
    return c if "\n" in c.strip() else c.strip() + "\n"


def header_desc(r, skip):
    """An era header's description: its longest free-text cell other than the
    count block, name and timeline (Notes) cells. Sheets put it in different
    columns (Type, Leak Date, ...), but always in a long prose cell."""
    best = ""
    for i, c in enumerate(r):
        c = clean(c)
        if i in skip or is_count_block(c) or is_count_header(c):
            continue
        if len(c) > len(best):
            best = c
    return best if len(best) >= 40 else ""


MONTH_NAMES = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}


def to_release_date(d):
    """Timeline date text -> MM/DD/YYYY with ?? for unknown parts, or None."""
    d = clean(d)
    m = re.fullmatch(r"([0-9xX?]{1,2})/([0-9xX?]{1,2})/(\d{4})", d)
    if m:
        part = lambda v: v.zfill(2) if v.isdigit() else "??"
        return f"{part(m.group(1))}/{part(m.group(2))}/{m.group(3)}"
    m = re.fullmatch(r"([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})", d)
    mon = lambda w: next((n for k, n in MONTH_NAMES.items() if k.startswith(w.lower()[:3])), None)
    if m and mon(m.group(1)):
        return f"{mon(m.group(1)):02d}/{int(m.group(2)):02d}/{m.group(3)}"
    m = re.fullmatch(r"([A-Za-z]+)\.?,?\s+(\d{4})", d)
    if m and mon(m.group(1)):
        return f"{mon(m.group(1)):02d}/??/{m.group(2)}"
    m = re.fullmatch(r"(\d{4})", d)
    return f"??/??/{m.group(1)}" if m else None


NOT_A_RELEASE = re.compile(r"intend|plan|schedul|delay|shelv|leak|cancel|announc|teas|push|scrap|rumou?r", re.I)


def era_release_date(era, timeline):
    """The era's release date from its header timeline, e.g.
    '(02/06/1989) (3 Feet High And Rising releases)'. Uses a release line that
    names the era, else the timeline's last line if it's a release; eras that
    never came out keep ??/??/???? rather than the previous album's date."""
    lines = []
    for line in (timeline or "").split("\n"):
        m = re.match(r"\s*\(([^)]*)\)\s*(.*)", line)
        if m:
            lines.append((m.group(1), m.group(2)))
    is_rel = lambda rest: re.search(r"releas", rest, re.I) and not NOT_A_RELEASE.search(rest)
    k = era_key(re.sub(r"\[.*?\]|\(.*?\)", "", era))
    named = [d for d, rest in lines if is_rel(rest) and k and k in re.sub(r"[^a-z0-9]", "", rest.lower())]
    # a lone line is the era's start marker (the previous release), not its end
    pick = named[-1] if named else (lines[-1][0] if len(lines) > 1 and is_rel(lines[-1][1]) else None)
    return (to_release_date(pick) if pick else None) or "??/??/????"


def strip_trailing_emoji(name):
    """'TOP ⭐' -> 'TOP': drop decorative emoji (and a dangling ' /') ending an
    era header's first line."""
    first, nl, rest = name.partition("\n")
    first = re.sub(r"[\s/\u2600-\u27bf\u2b00-\u2bff\U0001f300-\U0001faff\ufe0f]+$", "", first)
    return first + nl + rest


def era_key(s):
    s = re.sub(r"\s+", " ", (s or "").split("\n")[0]).strip().rstrip("*").strip()
    return re.sub(r"[^a-z0-9]", "", s.lower())


def reconcile_eras(out, name_rows, prefer_song_era=False):
    """Point song rows at their era-header name.

    Source sheets wrap/abbreviate the Era cell ("Year Of The \nSnitch",
    "Fear Of God II" under "Fear Of God II: Let Us Pray", "B.I.B.L.E" vs
    "B.I.B.L.E."), which would otherwise split one era into an empty header era
    plus a description-less song era. Also promotes count-less header rows
    (blank Era, era title in Name, e.g. Earl) whose title matches song eras.
    """
    hdr = {}
    for r in out:
        if "\n" in r[0]:
            name = clean(r[1].split("\n")[0])
            hdr.setdefault(era_key(name), name)
    song_keys = {era_key(r[0]) for r in out if "\n" not in r[0]}
    # count-less era headers: blank Era, title in Name, no file data
    promoted = []
    for (idx, title, notes, desc) in name_rows:
        first, _, rest = title.partition("\n")
        # exact title first ("Father Of 4 (Deluxe)"), else with parentheticals dropped
        raw = era_key(first)
        k = raw if raw in song_keys else era_key(re.sub(r"\(.*?\)", "", first))
        if k and k not in hdr and k in song_keys:
            name = clean(first) if k == raw else clean(re.sub(r"\(.*?\)", "", first))
            extra = "\n".join(x for x in (clean(first[len(name):]) if first.startswith(name) else "", clean(rest)) if x)
            hdr[k] = name
            promoted.append((idx, ["\n", name + ("\n" + extra if extra else ""), notes, "", "", "", "", "", "", desc]))
    for idx, row in reversed(promoted):
        out.insert(idx, row)
    for r in out:
        if "\n" in r[0]:
            continue
        k = era_key(r[0])
        if k in hdr:
            r[0] = hdr[k]
            continue
        cands = [v for hk, v in hdr.items() if k and hk.startswith(k)]
        if len(cands) == 1 and not prefer_song_era:
            r[0] = cands[0]
        else:
            r[0] = re.sub(r"\s+", " ", r[0]).rstrip("*").strip()
    # Headers whose name matches no song era (NBA YoungBoy: header 'Mind of a
    # Menace Era' over songs filed as 'Pre 38 Baby') take the era of the songs
    # directly below them, when no other header claims it; the sheet's header
    # title is kept as the era's subtitle.
    names = {clean(r[1].split("\n")[0]) for r in out if "\n" in r[0]}
    song_eras = {r[0] for r in out if "\n" not in r[0]}
    for i, r in enumerate(out):
        if "\n" not in r[0] or clean(r[1].split("\n")[0]) in song_eras:
            continue
        nxt = next((x for x in out[i + 1:] if "\n" not in x[0]), None)
        if nxt is not None and nxt[0] not in names and out[i + 1:].index(nxt) == 0:
            old = re.sub(r"\s*\n\s*", " ", clean(r[1])).strip()
            r[1] = nxt[0] + "\n(" + old + ")"
            names.add(nxt[0])
    # a.ts (re)initialises an era at its header row, dropping songs listed above
    # it — so move any header that trails its era's first song up to that song.
    for i in range(len(out)):
        r = out[i]
        if "\n" not in r[0]:
            continue
        name = clean(r[1].split("\n")[0])
        first = next((j for j in range(i) if "\n" not in out[j][0] and out[j][0] == name), None)
        if first is not None:
            out.insert(first, out.pop(i))
    # drop header rows of eras with no (named) songs — they'd render as empty eras
    song_eras = {r[0] for r in out if "\n" not in r[0]}
    return [r for r in out if "\n" not in r[0] or clean(r[1].split("\n")[0]) in song_eras]


def build_unreleased(rows, fixes=None):
    hi = find_header(rows)
    h = rows[hi]
    name_i = col(h, "name") or col(h, "title")
    if name_i is None:
        name_i = 1  # some sheets leave the Name header blank
    notes_i = col(h, "note") or col(h, "info") or col(h, "description")
    if notes_i is None and name_i + 1 < len(h) and not clean(h[name_i + 1]):
        notes_i = name_i + 1  # blank-headed column right after Name
    lcols = link_cols(h)
    ci = {
        "name": name_i,
        "notes": notes_i,
        "tlen": col(h, "track", "length") or col(h, "length", exclude=("available", "full")),
        "file": col(h, "file", "date") or col(h, "obtained"),
        "leak": col(h, "leak", "date"),
        "avail": col(h, "available") or col(h, "portion") or col(h, "availability"),
        "qual": col(h, "quality"),
        "link": col(h, "link") or col(h, "source"),
    }
    out, name_rows = [], []
    for r in rows[hi + 1:]:
        self_titled = r and clean(r[0]) and era_key(r[0]) == era_key(cell(r, ci["name"]))
        # (an era description may sit in the Portion column — long prose isn't an availability)
        if r and (not clean(r[0]) or self_titled) and cell(r, ci["name"]) and not era_header_cell(r) \
                and not any(cell(r, ci[k]) for k in ("link", "qual", "tlen")) \
                and (not cell(r, ci["avail"]) or len(cell(r, ci["avail"])) > 25):
            name_rows.append((len(out), cell(r, ci["name"]), cell(r, ci["notes"]),
                              header_desc(r, {0, ci["name"], ci["notes"]})))
            continue
        hdr_cell = era_header_cell(r)
        if hdr_cell:
            era_name = strip_trailing_emoji(cell(r, ci["name"]))  # a.ts: first line = era, rest = extra
            if not era_name:
                continue
            out.append([hdr_cell, era_name, cell(r, ci["notes"]), "", "", "", "", "", "",
                        header_desc(r, {0, ci["name"], ci["notes"]})])
        else:
            era = re.sub(r"\s+", " ", r[0]).strip() if r else ""
            name = cell(r, ci["name"])
            if not era or not name:
                continue
            links = "\n".join(x for x in (cell(r, i) for i in lcols) if x) if len(lcols) > 1 \
                else cell(r, ci["link"])
            out.append([era, name, cell(r, ci["notes"]), cell(r, ci["tlen"]),
                        cell(r, ci["file"]), cell(r, ci["leak"]),
                        cell(r, ci["avail"]), cell(r, ci["qual"]), links])
    fixes = fixes or {}
    for r in out:
        if "\n" in r[0]:
            key = re.sub(r"\s+", " ", r[1]).strip()
            if key in fixes.get("headers", {}):
                r[1] = fixes["headers"][key]
        elif r[0] in fixes.get("songs", {}):
            r[0] = fixes["songs"][r[0]]
    return reconcile_eras(out, name_rows, fixes.get("prefer_song_era", False))


def merge_member_tabs(blocks):
    """Merge per-member unreleased outputs into one era list.

    blocks: [(member or None, rows)]. Eras shared between tabs (Migos' "Culture"
    appears in the group, Quavo, Offset and Takeoff tabs) become one era — a.ts
    resets an era at every header row, so each era may only have one. A member's
    own eras are slotted in after the era that precedes them in that member's
    tab. Member-tab songs get a '(Member)' credit line.
    """
    order, heads, songs = [], {}, {}
    for member, rows in blocks:
        prev = None
        for r in rows:
            r = list(r)
            if "\n" in r[0]:
                era = clean(r[1].split("\n")[0])
                heads.setdefault(era, r)
            else:
                era = r[0]
                if member:
                    r[1] = r[1] + "\n(" + member + ")"
                songs.setdefault(era, []).append(r)
            if era not in order:
                order.insert(order.index(prev) + 1 if prev in order else len(order), era)
            prev = era
    out = []
    for era in order:
        if era in heads:
            out.append(heads[era])
        out.extend(songs.get(era, []))
    return out


def merge_recent_tabs(blocks):
    """Recent tabs are flat, newest-first lists: interleave the group's and each
    member's by leak date (undated rows last, in tab order)."""
    rows = []
    for member, block in blocks:
        for r in block:
            if "\n" in r[0]:
                continue
            r = list(r)
            if member:
                r[1] = r[1] + "\n(" + member + ")"
            rows.append(r)
    return sorted(rows, key=lambda r: parse_date(r[5]) or (0, 0, 0), reverse=True)


def build_recent_from_unrel(unrel):
    dated = []
    for r in unrel:
        if is_count_header(r[0]):
            continue
        d = parse_date(r[5])
        if d:
            dated.append((d, r))
    dated.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in dated[:60]]


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
    # some sheets split links across columns ('Download(s)' + 'Original Link(s)')
    lcols = [i for i, x in enumerate(h) if re.search(r"link|download", clean(x), re.I)]
    header = ["Era", "Name", "Notes", "Length", "Release Date", "Type", "Streaming", "Link(s)"]
    out = []
    for r in rows[hi + 1:]:
        era0 = r[0] if r else ""
        if is_count_header(era0):
            era_name = cell(r, ci["name"]).split("\n")[0]
            if era_name:
                out.append([era0, era_name, "", "", "", "", "", ""])
            continue
        if is_stat_block(era0):
            continue
        era = re.sub(r"\s+", " ", era0).strip()
        name = cell(r, ci["name"])
        if not era or not name:
            continue
        t = released_type(cell(r, ci["type"]))
        links = "\n".join(x for x in (cell(r, i) for i in lcols) if x) if len(lcols) > 1 \
            else cell(r, ci["link"])
        out.append([era, name, cell(r, ci["notes"]), cell(r, ci["tlen"]),
                    cell(r, ci["date"]), t, cell(r, ci["stream"]), links])
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
    """Art / Misc / Music Videos / Album Copies: re-serialise, drop empty rows.

    When links are split into a second 'Original Link(s)' column, fold them into
    the first Link(s) column — that's the one the views read."""
    rows = [r for r in rows if any(clean(c) for c in r) and not (r and is_stat_block(r[0]))]
    if not rows:
        return rows
    hi = find_header(rows)
    lcols = [i for i, x in enumerate(rows[hi]) if "link" in clean(x).lower()]
    if len(lcols) > 1 and any("original" in rows[hi][i].lower() for i in lcols[1:]):
        first = lcols[0]
        for r in rows[hi + 1:]:
            vals = [clean(r[i]) for i in lcols if i < len(r) and clean(r[i])]
            if first < len(r):
                r[first] = "\n".join(dict.fromkeys(vals))
    return rows


# ------------------------------------------------------------- era derivation --
def derive_eras(unrel):
    """Ordered union of every era referenced in the unreleased schema output."""
    order, seen = [], set()
    for r in unrel:
        if "\n" in r[0]:
            era = clean(r[1].split("\n")[0])  # a.ts: era name = Name's first line
        else:
            era = clean(r[0])
        if era and era not in seen:
            seen.add(era)
            order.append(era)
    return order


# ------------------------------------------------------------- config output --
def ts_str(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'"


def gen_config(slug, name, accent, letter, label, eras, flags, sheet_id="", creator="", covers=None,
               era_meta=None):
    era_meta = era_meta or {}
    rd = ",\n".join(f"    {ts_str(e)}: '{era_meta.get(e, ('??/??/????', ''))[0]}'" for e in eras)
    descs = [(e, era_meta[e][1]) for e in eras if e in era_meta and era_meta[e][1]]
    desc_s = ("\n" + "".join(f"    {ts_str(e)}: {ts_str(d)},\n" for e, d in descs) + "  ") if descs else ""
    order = ",\n".join(f"    {ts_str(e)}" for e in eras)
    extra = []
    if flags.get("albumcopies"):
        extra.append("  hasAlbumCopiesTab: true,")
    if flags.get("groupbuys"):
        extra.append("  hasGroupbuysTab: true,")
    extra_s = ("\n" + "\n".join(extra)) if extra else ""
    var = slug + "Config"
    creator_s = f"\n  sheetCreator: {ts_str(creator)}," if creator else ""
    if slug in HIDDEN_TRACKERS:
        creator_s += "\n  // Private — off the landing grid, feed, pickers and search; reachable by URL only.\n  hidden: true,"
    covers = {e: p for e, p in (covers or {}).items() if e in eras}
    images = ("\n" + "".join(f"    {ts_str(e)}: {ts_str(p)},\n" for e, p in covers.items()) + "  ") if covers else ""
    return f"""import type {{ ArtistConfig }} from './types';

// {name} tracker. Data served from committed CSV snapshots under
// public/{slug}/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const {var}: ArtistConfig = {{
  slug: '{slug}',
  SITE_NAME: '{slug.upper()}',
  SITE_DESCRIPTION: 'The Best {name} Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/{slug}/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: '{slug}_',{creator_s}

  HARDCODED_SHEET_ID: '{sheet_id}',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '{accent}',
  artistLabel: {ts_str(label)},
  cardLetter: '{letter}',
  logoUrl: '',
  artistPhotoUrl: '/artists/{slug}.jpg',

  getArtistName() {{
    return {ts_str(name)};
  }},

  CUSTOM_IMAGES: {{{images}}},

  ALBUM_RELEASE_DATES: {{
{rd}
  }},

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {{{desc_s}}},
  ALBUM_SONG_COUNTS: {{}},
  CUSTOM_ALBUM_INFO: {{}},
  ERA_MAPPINGS: {{}},

  ALBUM_ORDER: [
{order}
  ],

  // the standard tracker key — sheets prefix song names with these emojis
  TAG_MAP: {{
    '⭐': 'Best Of', '⭐️': 'Best Of',
    '✨': 'Special',
    '🏆': 'Grails',
    '🥇': 'Wanted', '🏅': 'Wanted',
    '🗑️': 'Worst Of', '🗑': 'Worst Of',
    '🤖': 'AI',
  }},
  TAG_TOOLTIP_MAP: {{
    'Best Of': 'Some of the best leaks hosted on the tracker.',
    'Special': 'Standout songs that are not good enough to belong in Best Of, but still deserve to be highlighted.',
    'Grails': 'The most wanted songs that have not yet leaked in full.',
    'Wanted': 'Songs that are wanted, but not as wanted as Grails.',
    'Worst Of': 'Some of the worst leaks on the tracker.',
    'AI': 'Involves AI-generated content (e.g. an AI instrumental or AI artist).',
  }},
  ERA_THEMES: {{}},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker{extra_s}
}};
"""


# --------------------------------------------------------------------- main --
def process(folder, meta, src_root=SRC_ROOT):
    slug, name, accent, letter, label = meta[:5]
    sheet_id, creator = (meta[5], meta[6]) if len(meta) > 5 else ("", "")
    src_dir = os.path.join(src_root, folder)
    dst_dir = os.path.join(ROOT, "public", slug)
    data_dir = os.path.join(dst_dir, "data")
    print(f"\n{folder} -> {slug}")

    # map source files to canonical tabs (first file wins per tab)
    tabs, member_tabs = {}, {}
    for fn in sorted(os.listdir(src_dir)):
        if not fn.lower().endswith(".csv"):
            continue
        title = fn.rsplit(" - ", 1)[-1].rsplit(".csv", 1)[0].strip()
        m = re.match(r"(.+?)\+(\d+)\s+(.+)$", title)  # "Unreleased+1 Quavo"
        if m:
            member_tabs.setdefault(canon_tab(m.group(1)), []).append(
                (int(m.group(2)), m.group(3), os.path.join(src_dir, fn)))
            continue
        c = canon_tab(title)
        if c and c not in tabs:
            tabs[c] = os.path.join(src_dir, fn)

    if "unreleased" not in tabs:
        print(f"    !! no unreleased tab found; skipping {slug}")
        return None

    os.makedirs(data_dir, exist_ok=True)
    unrel = build_unreleased(read_rows(tabs["unreleased"]), ERA_FIXES.get(slug))
    if member_tabs.get("unreleased"):
        unrel = merge_member_tabs([(None, unrel)] + [
            (member, build_unreleased(read_rows(path), ERA_FIXES.get(slug)))
            for _, member, path in sorted(member_tabs["unreleased"])])
    era_meta = {}  # era -> (release date, description) from its header row
    for r in unrel:
        if "\n" in r[0]:
            era = clean(r[1].split("\n")[0])
            era_meta.setdefault(era, (era_release_date(era, r[2]), r[9] if len(r) > 9 else ""))
    unrel = [r[:9] for r in unrel]
    write_csv(data_dir, "unreleased.csv", UNREL_HEADER, unrel)

    if "released" in tabs:
        rows = build_released(read_rows(tabs["released"]))
        write_csv(data_dir, "released.csv",
                  ["Era", "Name", "Notes", "Length", "Release Date", "Type", "Streaming", "Link(s)"], rows)
    if "stems" in tabs:
        rows = build_stems(read_rows(tabs["stems"]))
        write_csv(data_dir, "stems.csv",
                  ["Era", "Name", "Notes", "File Date", "Leak Date", "Full Length", "BPM", "Available Length", "Quality", "Link(s)"], rows)
    if "tracklists" in tabs:
        hdr, rows = build_tracklists(read_rows(tabs["tracklists"]), dst_dir)
        write_csv(data_dir, "tracklists.csv", hdr, rows)
    if "fakes" in tabs:
        rows = build_fakes(read_rows(tabs["fakes"]))
        write_csv(data_dir, "fakes.csv",
                  ["Era", "Name", "Notes", "Made By", "Type", "Currently Available", "Link(s)"], rows)

    flags = {}
    if "album-copies" in tabs:
        rows = build_passthrough(read_rows(tabs["album-copies"]))
        write_csv(data_dir, "album-copies.csv", rows[0], rows[1:])
        flags["albumcopies"] = True
    if "groupbuys" in tabs:
        rows = build_groupbuys(read_rows(tabs["groupbuys"]))
        write_csv(data_dir, "groupbuys.csv",
                  ["Year", "YearTotal", "Era", "Name", "Content", "Price", "Start", "End", "Type", "Status", "Link"], rows)
        flags["groupbuys"] = True
    for tab in ("art", "misc", "music-videos"):
        if tab in tabs:
            rows = build_passthrough(read_rows(tabs[tab]))
            if rows:
                write_csv(data_dir, f"{tab}.csv", rows[0], rows[1:])

    # recent: use source tab if present, else derive from unreleased
    if "recent" in tabs:
        rows = build_unreleased(read_rows(tabs["recent"]), ERA_FIXES.get(slug))
        if member_tabs.get("recent"):
            rows = merge_recent_tabs([(None, rows)] + [
                (member, build_unreleased(read_rows(path), ERA_FIXES.get(slug)))
                for _, member, path in sorted(member_tabs["recent"])])
        rows = [r[:9] for r in rows]
        write_csv(data_dir, "recent.csv", UNREL_HEADER, rows)
    else:
        write_csv(data_dir, "recent.csv", UNREL_HEADER, build_recent_from_unrel(unrel))

    eras = derive_eras(unrel)
    # era covers pulled from the sheet's xlsx by scripts/extract-era-covers.py
    covers_path = os.path.join(dst_dir, "eras", "covers.json")
    covers = json.load(open(covers_path, encoding="utf-8")) if os.path.exists(covers_path) else {}
    cfg = gen_config(slug, name, accent, letter, label, eras, flags, sheet_id, creator, covers, era_meta)
    with open(os.path.join(ROOT, "src", "artists", f"{slug}.ts"), "w", encoding="utf-8") as f:
        f.write(cfg)
    print(f"    src/artists/{slug}.ts: {len(eras)} eras")
    return slug


def main():
    src_root, artists = BATCHES[sys.argv[1] if len(sys.argv) > 1 else "bigupdate"]
    slugs = []
    for folder, meta in artists.items():
        s = process(folder, meta, src_root)
        if s:
            slugs.append((meta[0], meta[1]))
    print("\n\n=== registry imports ===")
    for slug, _ in slugs:
        print(f"import {{ {slug}Config }} from './{slug}';")
    print("\n=== registry entries ===")
    for slug, name in slugs:
        print(f"  {slug}: {slug}Config,   // {name}")


if __name__ == "__main__":
    main()
