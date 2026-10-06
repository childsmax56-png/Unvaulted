#!/usr/bin/env python3
"""Pull era cover art for trackers imported by build-bigupdate-csvs.py.

Tracker sheets paste each era's cover as an image over the era-header row of
the Unreleased tab. Neither the CSV export nor the Sheets API returns those
images, but the sheet's xlsx export embeds them as drawings anchored to a cell.
This maps every image anchored on the Unreleased tab to the era-header row it
sits on, saves it to public/<slug>/eras/<era-slug>.<ext> (downscaled to 600px),
and writes public/<slug>/eras/covers.json ({era: path}). build-bigupdate-csvs.py
reads covers.json into the config's CUSTOM_IMAGES — re-run it afterwards.

Usage: python3 scripts/extract-era-covers.py [batch] [folder ...]
"""
import csv, importlib.util, io, json, os, posixpath, re, subprocess, sys, tempfile, urllib.request, zipfile
from xml.etree import ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("imp", os.path.join(HERE, "build-bigupdate-csvs.py"))
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
RID = "{%s}id" % NS["r"]
EMBED = "{%s}embed" % NS["r"]


def rels(z, path):
    d, b = posixpath.split(path)
    rp = f"{d}/_rels/{b}.rels"
    if rp not in z.namelist():
        return {}
    return {e.get("Id"): posixpath.normpath(posixpath.join(d, e.get("Target")))
            for e in ET.fromstring(z.read(rp))}


def sheet_images(z, sheet_name):
    """[(row, col, media path)] for images drawn on the named sheet."""
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    wr = rels(z, "xl/workbook.xml")
    for s in wb.find("m:sheets", NS):
        if s.get("name") != sheet_name:
            continue
        path = wr[s.get(RID)]
        sr = rels(z, path)
        out = []
        for d in ET.fromstring(z.read(path)).findall("m:drawing", NS):
            dp = sr[d.get(RID)]
            dr = rels(z, dp)
            for anc in ET.fromstring(z.read(dp)):
                fr, blip = anc.find("xdr:from", NS), anc.find(".//a:blip", NS)
                if fr is not None and blip is not None and dr.get(blip.get(EMBED)):
                    out.append((int(fr.find("xdr:row", NS).text),
                                int(fr.find("xdr:col", NS).text), dr[blip.get(EMBED)]))
        return out
    return []


# workbooks holding several Unreleased-looking tabs (backups, drafts)
UNRELEASED_TAB = {"olivertreegold": "The Unreleased"}


def flatten_alpha(path):
    """Logos pasted with transparency (e.g. DMX's black label logos) sit on the
    sheet's white cells but vanish on the site's dark cards — flatten onto white."""
    try:
        from PIL import Image
    except ImportError:
        return
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P") and "A" in im.convert("RGBA").getbands():
        rgba = im.convert("RGBA")
        if rgba.getextrema()[3][0] < 255:
            bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            bg.alpha_composite(rgba)
            bg.convert("RGB").save(path)


def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-") or "era"


def main():
    args = sys.argv[1:]
    batch = args.pop(0) if args and args[0] in imp.BATCHES else "2026-10"
    src_root, artists = imp.BATCHES[batch]
    for folder, meta in artists.items():
        if args and folder not in args:
            continue
        slug, sheet_id = meta[0], (meta[5] if len(meta) > 5 else "")
        unrel_csv = os.path.join(src_root, folder, "x - Unreleased.csv")
        if not sheet_id or not os.path.exists(unrel_csv):
            continue
        print(f"\n{folder} -> {slug}")
        try:
            data = urllib.request.urlopen(
                f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx").read()
            z = zipfile.ZipFile(io.BytesIO(data))
        except Exception as e:  # private sheet (e.g. Dax) — export 401s
            print(f"    !! xlsx export unavailable: {e}")
            continue

        # the Unreleased tab: the workbook sheet whose name canon_tab maps to unreleased
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        names = [s.get("name") for s in wb.find("m:sheets", NS)]
        tab = UNRELEASED_TAB.get(slug) or next(
            (n for n in names if imp.canon_tab(n) == "unreleased"
             and not re.search(r"backup|copy|before|old", n, re.I)), None)
        if not tab:
            print("    !! no Unreleased tab in workbook")
            continue

        raw = imp.read_rows(unrel_csv)
        hi = imp.find_header(raw)
        h = raw[hi]
        name_i = imp.col(h, "name") or imp.col(h, "title") or 1
        # era names exactly as the importer emits them (header rows, post-fixes)
        built = imp.build_unreleased(raw, imp.ERA_FIXES.get(slug))
        eras = [imp.clean(r[1].split("\n")[0]) for r in built if "\n" in r[0]]
        fixes = imp.ERA_FIXES.get(slug, {}).get("headers", {})

        def era_for_row(row):
            cell = raw[row][name_i] if row < len(raw) and name_i < len(raw[row]) else ""
            cell = fixes.get(re.sub(r"\s+", " ", cell).strip(), cell)
            k = imp.era_key(re.sub(r"\(.*?\)", "", cell.split("\n")[0]))
            if not k:
                return None
            exact = [e for e in eras if imp.era_key(e) == k]
            if exact:
                return exact[0]
            pref = [e for e in eras if imp.era_key(e).startswith(k) or k.startswith(imp.era_key(e))]
            return pref[0] if len(pref) == 1 else None

        out_dir = os.path.join(HERE, "..", "public", slug, "eras")
        os.makedirs(out_dir, exist_ok=True)
        covers = {}
        for row, _col, media in sorted(sheet_images(z, tab)):
            era = era_for_row(row)
            if not era or era in covers:
                print(f"    skip image at row {row + 1}" + (f" ({era} already has one)" if era else " (not an era header)"))
                continue
            ext = os.path.splitext(media)[1].lower()
            ext = ".jpg" if ext in (".jpeg", ".jpg") else ext
            fn = slugify(era) + ext
            dst = os.path.join(out_dir, fn)
            with open(dst, "wb") as f:
                f.write(z.read(media))
            # downscale big pastes; covers render at card size
            subprocess.run(["sips", "-Z", "600", dst], capture_output=True)
            flatten_alpha(dst)
            covers[era] = f"/{slug}/eras/{fn}"
        with open(os.path.join(out_dir, "covers.json"), "w", encoding="utf-8") as f:
            json.dump(covers, f, indent=1, ensure_ascii=False)
        missing = [e for e in eras if e not in covers]
        print(f"    {len(covers)}/{len(eras)} eras have covers" + (f"; missing: {missing}" if missing else ""))


if __name__ == "__main__":
    main()
