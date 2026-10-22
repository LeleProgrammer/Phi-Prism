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
import io
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RAW = "https://raw.githubusercontent.com/Catrong/phi-plugin/main/resources/info/"
ART = "https://raw.githubusercontent.com/Catrong/phi-plugin-ill/main/illLow/"


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
    art_payload = None
    if not args.skip_art:
        from PIL import Image
        existing = ROOT / "assets/art.js"
        text = existing.read_text("utf-8") if existing.exists() else ""
        artwork = json.loads(text.split("=", 1)[1].strip().rstrip(";")) if text else {}
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
        art_payload = "window.PHI_ART = " + json.dumps(artwork, ensure_ascii=False, separators=(",", ":")) + ";\n"
        print(f"Artwork: {len(artwork)} covers; failed downloads: {len(failures)}")
        if failures:
            print("Kept existing covers where available:", ", ".join(failures))
    # Write only after metadata preparation and artwork processing completed.
    path = ROOT / "assets/data.js"
    temp = path.with_suffix(".tmp")
    temp.write_text(payload, "utf-8")
    temp.replace(path)
    if art_payload is not None:
        path = ROOT / "assets/art.js"
        temp = path.with_suffix(".tmp")
        temp.write_text(art_payload, "utf-8")
        temp.replace(path)
    print(f"Updated {len(songs)} songs. Commit and upload assets/data.js and assets/art.js to update GitHub Pages.")


if __name__ == "__main__":
    main()
