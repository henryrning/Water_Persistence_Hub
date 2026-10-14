"""Build the Download page's lightweight map previews.

For each percentage raster (uint8, 0-100 = share of usable days under water,
255 = missing data) this writes one small PNG per view threshold and records
the county-year in assets/previews/manifest.json (+ manifest.js, so pages also
work when opened straight from disk).

Input files must be named <fips>_<year>.tif, e.g. 38071_2025.tif. Pass files
or folders; existing manifest entries for other county-years are kept.

    python tools/build_previews.py /path/to/rasters/
    python tools/build_previews.py 38071_2025.tif 38005_2025.tif --max-px 1000

A 3 m county raster is ~500 MB; the preview is ~1,000 px on its long side
(~70 m per preview pixel, ~150-250 KB per PNG). It shows where water was, not
3 m detail - that needs a tile service (see REFINEMENT.md).
"""
import argparse
import json
import math
import re
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform_bounds
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "previews"
THRESHOLDS = (70, 80, 90)
NODATA = 255
WATER_RGB = (16, 86, 196)  # same blue as the first Ramsey previews
NAME = re.compile(r"^(\d{5})_(\d{4})\.tiff?$", re.I)


def block_fracs(src, f):
    """Per f x f block: share of pixels >= each threshold, and share of nodata.
    Reads the raster in strips so a 500 MB county never sits in memory at once."""
    bh, bw = src.height // f, src.width // f
    water = {t: np.zeros((bh, bw), np.float32) for t in THRESHOLDS}
    nod = np.zeros((bh, bw), np.float32)
    strip = max(1, 2048 // f)  # block rows per read
    for r0 in range(0, bh, strip):
        n = min(strip, bh - r0)
        a = src.read(1, window=Window(0, r0 * f, bw * f, n * f))
        a = a.reshape(n, f, bw, f)
        nod[r0:r0 + n] = (a == NODATA).mean(axis=(1, 3))
        for t in THRESHOLDS:
            water[t][r0:r0 + n] = ((a >= t) & (a <= 100)).mean(axis=(1, 3))
    return water, nod


def build_one(path, max_px):
    fips, year = NAME.match(path.name).groups()
    with rasterio.open(path) as src:
        f = max(1, math.ceil(max(src.width, src.height) / max_px))
        water, nod = block_fracs(src, f)
        # Bounds of the trimmed extent actually covered by whole blocks.
        bh, bw = nod.shape
        x0, y0 = src.transform * (0, 0)
        x1, y1 = src.transform * (bw * f, bh * f)
        w, s, e, n = transform_bounds(src.crs, "EPSG:4326", min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
        res = src.res[0]
    blank = nod > 0.5
    for t in THRESHOLDS:
        rgba = np.zeros(water[t].shape + (4,), np.uint8)
        rgba[..., :3] = WATER_RGB
        # Alpha by how much of the block is water; x2.2 keeps scattered ponds visible.
        rgba[..., 3] = (np.clip(water[t] * 2.2, 0, 1) * 255).astype(np.uint8)
        rgba[blank] = 0
        Image.fromarray(rgba, "RGBA").save(OUT / f"{fips}_{year}_p{t}.png", optimize=True)
    entry = {"bounds": [round(v, 6) for v in (w, s, e, n)], "preview_m": round(res * f), "source": path.name}
    print(f"{fips}_{year}: {bw}x{bh} px, {round(res * f)} m per preview pixel")
    return f"{fips}_{year}", entry


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("inputs", nargs="+", type=Path, help="<fips>_<year>.tif files or folders of them")
    ap.add_argument("--max-px", type=int, default=1000, help="long side of each preview PNG (default 1000)")
    args = ap.parse_args()

    files = []
    for p in args.inputs:
        files += sorted(q for q in p.iterdir() if NAME.match(q.name)) if p.is_dir() else [p]
    bad = [p.name for p in files if not NAME.match(p.name)]
    if bad or not files:
        ap.error(f"expected files named <fips>_<year>.tif, got: {', '.join(bad) or 'nothing'}")

    OUT.mkdir(parents=True, exist_ok=True)
    mpath = OUT / "manifest.json"
    manifest = json.loads(mpath.read_text()) if mpath.exists() else {}
    manifest["thresholds"] = list(THRESHOLDS)
    items = manifest.setdefault("items", {})
    for p in files:
        key, entry = build_one(p, args.max_px)
        items[key] = entry
    manifest["items"] = dict(sorted(items.items()))
    text = json.dumps(manifest, indent=2)
    mpath.write_text(text + "\n")
    (OUT / "manifest.js").write_text("window.PREVIEWS=" + text + ";\n")
    print(f"manifest: {len(items)} county-years")


if __name__ == "__main__":
    main()
