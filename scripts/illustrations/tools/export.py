"""
Export every illustration into both apps:

    python3 scripts/illustrations/tools/export.py            # all
    python3 scripts/illustrations/tools/export.py ok-vote    # some

For each name: <name>.json (Lottie, minified) + <name>.png (the REST frame, rendered by
lottie-web itself so the static image and the animation's last intro frame are identical),
written to apps/web/public/illustrations/ and apps/mobile/assets/illustrations/.

Needs the render bench (see ../README.md): BENCH=<dir with playwright-core + lottie-web>.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(HERE, "..", "src")
TARGETS = [os.path.join(ROOT, "apps/web/public/illustrations"), os.path.join(ROOT, "apps/mobile/assets/illustrations")]

sys.path.insert(0, SRC)
from build import REGISTRY  # noqa: E402

from PIL import Image  # noqa: E402


def native_size(data):
    return max(data["w"], data["h"])


def main():
    names = sys.argv[1:] or sorted(REGISTRY)
    tmp = tempfile.mkdtemp(prefix="su-illu-")
    jdir, pdir = os.path.join(tmp, "json"), os.path.join(tmp, "png")
    os.makedirs(jdir)
    by_size: dict[int, list[str]] = {}
    for n in names:
        comp = REGISTRY[n]()
        data = comp.dumps()
        with open(os.path.join(jdir, f"{n}.json"), "w") as f:
            f.write(data)
        by_size.setdefault(native_size(json.loads(data)), []).append(os.path.join(jdir, f"{n}.json"))
    for size, files in by_size.items():
        subprocess.run(["node", os.path.join(HERE, "render.mjs"), pdir, str(size), "rest", *files], check=True)
    for n in names:
        png = os.path.join(pdir, f"{n}.png")
        im = Image.open(png).convert("RGBA")
        # Flat vector art: an adaptive 256-colour palette is visually lossless and ~5× smaller.
        q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        q.save(png, optimize=True)
        for t in TARGETS:
            os.makedirs(t, exist_ok=True)
            shutil.copyfile(os.path.join(jdir, f"{n}.json"), os.path.join(t, f"{n}.json"))
            shutil.copyfile(png, os.path.join(t, f"{n}.png"))
        print(f"{n:24s} json {os.path.getsize(os.path.join(jdir, n + '.json')) / 1024:5.1f} KB   png {os.path.getsize(png) / 1024:5.1f} KB")
    shutil.rmtree(tmp)


if __name__ == "__main__":
    main()
