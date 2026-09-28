"""Build the static assets the prototype front end uses.

- assets/data/counties.geojson : ND + SD county outlines with coverage flags
- assets/img/ramsey_*.png      : downsampled previews of the Ramsey 2025 masks
- assets/data/ramsey_preview.json : preview bounds (WGS84) + real mask statistics

Run from the repository root:  python frontend/tools/prepare_assets.py
"""
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform_bounds

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "assets"
SRC = ROOT / "_data" / "Ramsey_ND_2025"

STATES = {"38": "ND", "46": "SD"}

# Demo coverage for the beta: Prairie Pothole counties (approximate list; the
# real catalogue will come from the publication records in the database).
PPR = {
    "ND": """Barnes Benson Bottineau Burke Burleigh Cavalier Dickey Divide Eddy Emmons
        Foster Griggs Kidder LaMoure Logan McHenry McIntosh McLean Mountrail Nelson
        Pierce Ramsey Ransom Renville Rolette Sargent Sheridan Steele Stutsman Towner
        Ward Wells Williams""".split(),
    "SD": """Aurora Beadle Brookings Brown Brule Buffalo Campbell Clark Codington Davison
        Day Deuel Edmunds Faulk Grant Hamlin Hand Hanson Hughes Hyde Jerauld Kingsbury
        Lake McCook McPherson Marshall Miner Moody Potter Roberts Sanborn Spink Sully
        Walworth""".split(),
}


def ring_area_km2(ring):
    # Equirectangular approximation; good enough for size estimates.
    lat0 = math.radians(sum(p[1] for p in ring) / len(ring))
    kx, ky = 111.32 * math.cos(lat0), 110.57
    a = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        a += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky)
    return abs(a) / 2


def rnd(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 4), round(coords[1], 4)]
    return [rnd(c) for c in coords]


def build_counties(ramsey_bytes, ramsey_area):
    src = json.loads((ROOT / "_data" / "counties.json").read_text())
    feats = []
    for f in src["features"]:
        st = STATES.get(f["properties"]["STATE"])
        if not st:
            continue
        name = f["properties"]["NAME"]
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        area = sum(ring_area_km2(p[0]) for p in polys)
        covered = name in PPR[st]
        scale = area / ramsey_area
        feats.append({
            "type": "Feature",
            "id": f["id"],
            "properties": {
                "fips": f["id"],
                "name": name,
                "state": st,
                "area_km2": round(area),
                "years": [2025] if covered else [],
                "sample": name == "Ramsey" and st == "ND",
                # Estimated ZIP bytes per cutoff, scaled from the real Ramsey files.
                "size": {k: int(v * scale) for k, v in ramsey_bytes.items()} if covered else None,
            },
            "geometry": {"type": g["type"], "coordinates": rnd(g["coordinates"])},
        })
    feats.sort(key=lambda f: (f["properties"]["state"], f["properties"]["name"]))
    (OUT / "data" / "counties.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))
    print("counties:", len(feats), "covered:", sum(1 for f in feats if f["properties"]["years"]))


def block_mean(a, f):
    h, w = (a.shape[0] // f) * f, (a.shape[1] // f) * f
    return a[:h, :w].reshape(h // f, f, w // f, f).mean(axis=(1, 3))


def build_previews():
    masks, stats, sizes = {}, {}, {}
    for p in (70, 80, 90):
        path = SRC / f"standing_water_{p}pct.tif"
        sizes[p] = path.stat().st_size
        with rasterio.open(path) as s:
            a = s.read(1)
            bounds = transform_bounds(s.crs, "EPSG:4326", *s.bounds)
            meta = {"crs": str(s.crs), "res": s.res[0], "width": s.width, "height": s.height,
                    "dtype": s.dtypes[0], "nodata": int(s.nodata)}
        water = int((a == 1).sum())
        valid = int((a != 255).sum())
        stats[p] = {"water_px": water, "valid_px": valid,
                    "water_km2": round(water * 9 / 1e6, 1),
                    "water_pct": round(100 * water / valid, 2)}
        masks[p] = a
    f = 24  # 3 m -> 72 m preview pixels (~940 x 970 image)
    nod = block_mean((masks[70] == 255).astype(np.float32), f) > 0.5
    frac = {p: block_mean((masks[p] == 1).astype(np.float32), f) for p in masks}

    # Per-cutoff overlay: water in blue, alpha by fraction of water in the block.
    for p in masks:
        rgba = np.zeros(frac[p].shape + (4,), np.uint8)
        rgba[..., 0], rgba[..., 1], rgba[..., 2] = 16, 86, 196
        rgba[..., 3] = (np.clip(frac[p] * 2.2, 0, 1) * 255).astype(np.uint8)
        rgba[nod] = 0
        Image.fromarray(rgba, "RGBA").save(OUT / "img" / f"ramsey_{p}.png", optimize=True)

    # Landing-page sample: field background + nested persistence classes.
    base = np.array([236, 231, 214], np.float32)
    img = np.tile(base, frac[70].shape + (1,))
    for p, col in ((70, (126, 182, 232)), (80, (54, 128, 212)), (90, (14, 64, 146))):
        t = np.clip(frac[p] * 2.2, 0, 1)[..., None]
        img = img * (1 - t) + np.array(col, np.float32) * t
    out = np.dstack([img.astype(np.uint8), np.where(nod, 0, 255).astype(np.uint8)])
    Image.fromarray(out, "RGBA").save(OUT / "img" / "ramsey_sample.png", optimize=True)

    info = {"bounds": bounds, "meta": meta, "stats": stats, "bytes": sizes}
    (OUT / "data" / "ramsey_preview.json").write_text(json.dumps(info, indent=2))
    return sizes, info


if __name__ == "__main__":
    sizes, info = build_previews()
    # Ramsey area from the county file itself, so the scale factor is consistent.
    src = json.loads((ROOT / "_data" / "counties.json").read_text())
    ram = next(f for f in src["features"] if f["id"] == "38071")
    ramsey_area = ring_area_km2(ram["geometry"]["coordinates"][0])
    build_counties({str(k): v for k, v in sizes.items()}, ramsey_area)
    print(json.dumps(info["stats"], indent=1))


def build_detail(x0=18288, y0=13536, n=432):
    """Full-resolution (3 m) crop for the landing-page detail lens."""
    img = np.zeros((n, n, 3), np.uint8)
    img[:] = (236, 231, 214)
    for p, col in ((70, (126, 182, 232)), (80, (54, 128, 212)), (90, (14, 64, 146))):
        with rasterio.open(SRC / f"standing_water_{p}pct.tif") as s:
            a = s.read(1, window=rasterio.windows.Window(x0, y0, n, n))
        img[a == 1] = col
    Image.fromarray(img).save(OUT / "img" / "ramsey_detail.png", optimize=True)


if __name__ == "__main__":
    build_detail()


def write_js_mirrors():
    """Same data as .js so pages also work when opened straight from disk."""
    d = OUT / "data"
    (d / "counties.js").write_text("window.COUNTIES=" + (d / "counties.geojson").read_text() + ";")
    (d / "ramsey_preview.js").write_text("window.RAMSEY_PREVIEW=" + (d / "ramsey_preview.json").read_text() + ";")


if __name__ in ("__main__", "lib"):
    write_js_mirrors()


def build_explainer_grid(x0=18288, y0=13536, n=432, f=9):
    """48x48 cell grid for the home-page explainer animation: per cell, the
    probability that a daily observation reads water, from the pixel classes."""
    import json
    from rasterio.windows import Window
    w = None
    for p, prob in ((70, .75), (80, .85), (90, .97)):
        with rasterio.open(SRC / f"standing_water_{p}pct.tif") as s:
            m = s.read(1, window=Window(x0, y0, n, n)) == 1
        if w is None: w = np.zeros(m.shape, np.float32)
        w[m] = prob
    N = n // f
    q = np.clip(np.round(w.reshape(N, f, N, f).mean(axis=(1, 3)) * 99), 0, 99).astype(int)
    out = {"n": N, "cell_m": 3 * f, "origin": "Ramsey County, ND", "year": 2025, "lat": 48.17, "lon": -98.79,
           "score": "".join(f"{v:02d}" for v in q.ravel())}
    (OUT / "data" / "explainer_grid.js").write_text("window.EXPLAINER_GRID=" + json.dumps(out) + ";")


if __name__ in ("__main__", "lib"):
    build_explainer_grid()
