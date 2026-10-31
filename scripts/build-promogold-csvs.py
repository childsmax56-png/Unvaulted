#!/usr/bin/env python3
"""Build the hidden "Unvaulted Promotional" Ye tracker (promogold).

The sheet (1zKk5p9lDA40p0EXrvtfNTyUzUTVUW1kCpqy7BF0WyWo) is a copy of yegold's
template with the same gids and a public CSV export, so this reuses
scripts/build-yegold-csvs.py's parsers and only swaps the sheet and slug. Only
the Unreleased and Recent tabs are used.

Usage: python3 scripts/build-promogold-csvs.py
"""
import importlib.util, os

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("yegold", os.path.join(HERE, "build-yegold-csvs.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

base.SLUG = "promogold"
base.SHEET_ID = "1zKk5p9lDA40p0EXrvtfNTyUzUTVUW1kCpqy7BF0WyWo"
GIDS = {"unreleased": "34972268", "recent": "77894385"}


def main():
    data_dir = os.path.join(base.ROOT, "public", base.SLUG, "data")
    print(f"Building {base.SLUG} from sheet {base.SHEET_ID}")
    for tab, gid in GIDS.items():
        rows = base.build_unreleased(base.fetch_rows(gid))
        base.write_csv(data_dir, f"{tab}.csv", base.UNREL_HEADER, rows)


if __name__ == "__main__":
    main()
