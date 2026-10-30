#!/usr/bin/env python3
"""Update the bundled Phigros catalog and artwork; not required to run the site.

Usage: python tools/update_data.py [--skip-art]
Artwork conversion requires Pillow: python -m pip install pillow
The script never accesses a player's account or credentials.
"""
import argparse
import base64
import concurrent.futures
import csv
import datetime
import hashlib
import io
import json
import re
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RAW = "https://raw.githubusercontent.com/Catrong/phi-plugin/main/resources/info/"
ART = "https://raw.githubusercontent.com/Catrong/phi-plugin-ill/main/illLow/"


def read_artwork():
    """Read static data scripts without executing JavaScript."""
    existing = ROOT / "assets/art.js"
    text = existing.read_text("utf-8") if existing.exists() else ""
    artwork = json.loads(text.split("=", 1)[1].strip().rstrip(";")) if text else {}
    for path in sorted((ROOT / "assets/art-data").glob("part-*.js")):
        source = path.read_text("utf-8").strip()
        prefix = "Object.assign(window.PHI_ART,"
        if not source.startswith(prefix) or not source.endswith(");"):
            raise ValueError(f"Invalid artwork chunk: {path.name}")
        artwork.update(json.loads(source[len(prefix):-2]))
    return artwork


def write_artwork(artwork):
    """Keep each static script below 512 KiB; works on Pages and file://."""
    prefix, suffix = "Object.assign(window.PHI_ART,", ");\n"
    chunks, current = [], {}
    for sid, encoded in artwork.items():
        candidate = {**current, sid: encoded}
        payload = prefix + json.dumps(candidate, ensure_ascii=False, separators=(",", ":")) + suffix
        if len(payload.encode("utf-8")) > 512 * 1024:
            if not current:
                raise ValueError(f"Artwork exceeds chunk limit: {sid}")
            chunks.append(current)
            current = {sid: encoded}
        else:
            current = candidate
    if current:
        chunks.append(current)
    directory = ROOT / "assets/art-data"
    directory.mkdir(exist_ok=True)
    names, digest = [], hashlib.sha256()
    for i, chunk in enumerate(chunks, 1):
        source = prefix + json.dumps(chunk, ensure_ascii=False, separators=(",", ":")) + suffix
        if len(source.encode("utf-8")) > 512 * 1024:
            raise ValueError("Artwork chunk exceeds 512 KiB")
        name = f"part-{i:03d}.js"
        path = directory / name
        temp = path.with_suffix(".tmp")
        temp.write_text(source, "utf-8")
        temp.replace(path)
        names.append(name)
        digest.update(source.encode("utf-8"))
    version = digest.hexdigest()[:12]
    (ROOT / "assets/art.js").write_text("window.PHI_ART = {};\n", "utf-8")
    block = "<!-- PHI_ART_SCRIPTS_START -->\n  " + f'<script defer src="assets/art.js?v={version}"></script>'
    block += "".join(f'\n  <script defer src="assets/art-data/{name}?v={version}"></script>' for name in names)
    block += "\n  <!-- PHI_ART_SCRIPTS_END -->"
    page = ROOT / "index.html"
    html = page.read_text("utf-8")
    pattern = r"<!-- PHI_ART_SCRIPTS_START -->.*?<!-- PHI_ART_SCRIPTS_END -->"
    if not re.search(pattern, html, flags=re.S):
        pattern = r'<script defer src="assets/art\.js(?:\?[^\"]*)?"></script>'
    html, count = re.subn(pattern, lambda _: block, html, count=1, flags=re.S)
    if count != 1:
        raise ValueError("Could not locate artwork script block in index.html")
    page.write_text(html, "utf-8")
    for old in directory.glob("part-*.js"):
        if old.name not in names:
            old.unlink()
    return len(chunks)


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Phi-Prism-Catalog-Updater/1.0"})
    with urllib.request.urlopen(req, timeout=40) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-art", action="store_true", help="Update metadata only; preserve bundled artwork")
    args = parser.parse_args()
    rows = list(csv.DictReader(io.StringIO(download(RAW + "info.csv").decode("utf-8-sig")), delimiter="\t"))
    extra = json.loads(download(RAW + "infolist.json"))
    songs = []
    for row in rows:
        sid = row["id"]
        item = {"id": sid, "title": row["song"], "artist": row["composer"], "illustrator": row["illustrator"],
                "charters": [row.get(k, "") for k in ("EZC", "HDC", "INC", "ATC")],
                "constants": [float(row[k]) if row.get(k) else None for k in ("EZ", "HD", "IN", "AT")]}
        for key in ("chapter", "bpm", "length"):
            if key in extra.get(sid, {}):
                item[key] = extra[sid][key]
        songs.append(item)
    if not songs:
        raise RuntimeError("Empty catalog; existing data was preserved")
    data = {"date": datetime.date.today().isoformat(), "source": "Catrong/phi-plugin", "songs": songs}
    payload = "window.PHI_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    artwork = None
    if not args.skip_art:
        from PIL import Image
        artwork = read_artwork()
        failures = []

        def fetch(song):
            sid = song["id"]
            try:
                raw = download(ART + urllib.parse.quote(sid + ".png", safe=""))
                im = Image.open(io.BytesIO(raw)).convert("RGB")
                im.thumbnail((720, 450))
                out = io.BytesIO()
                im.save(out, "WEBP", quality=82)
                return sid, "data:image/webp;base64," + base64.b64encode(out.getvalue()).decode("ascii"), None
            except Exception as exc:
                return sid, artwork.get(sid), str(exc)

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for sid, encoded, error in pool.map(fetch, songs):
                if encoded:
                    artwork[sid] = encoded
                if error:
                    failures.append(sid)
        artwork = {s["id"]: artwork[s["id"]] for s in songs if s["id"] in artwork}
        print(f"Artwork: {len(artwork)} covers; failed downloads: {len(failures)}")
        if failures:
            print("Kept existing covers where available:", ", ".join(failures))
    # Write only after metadata preparation and artwork processing completed.
    path = ROOT / "assets/data.js"
    temp = path.with_suffix(".tmp")
    temp.write_text(payload, "utf-8")
    temp.replace(path)
    if artwork is not None:
        print(f"Artwork split into {write_artwork(artwork)} scripts.")
    print(f"Updated {len(songs)} songs. Upload index.html, assets/data.js, assets/art.js and the entire assets/art-data/ directory to GitHub Pages.")


if __name__ == "__main__":
    main()
