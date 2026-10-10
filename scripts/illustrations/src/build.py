"""
Build every illustration: <name>.json (Lottie) into an output directory.

    python3 build.py <out-dir> [name …]

The PNG rest frames are rendered afterwards by tools/render.mjs (see ../README.md).
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import scenes_ok  # noqa: E402

REGISTRY: dict = {}
for mod in (scenes_ok,):
    REGISTRY.update(mod.SCENES)

try:
    import scenes_empty  # noqa: E402

    REGISTRY.update(scenes_empty.SCENES)
except ImportError:
    pass
try:
    import scenes_onboarding  # noqa: E402

    REGISTRY.update(scenes_onboarding.SCENES)
except ImportError:
    pass
try:
    import scenes_logo  # noqa: E402  (overrides welcome-hero and poster-onboarding)

    _LOGO = scenes_logo.SCENES
except ImportError:
    _LOGO = {}
try:
    import scenes_quick  # noqa: E402

    REGISTRY.update(scenes_quick.SCENES)
except ImportError:
    pass
try:
    import scenes_poster  # noqa: E402

    REGISTRY.update(scenes_poster.SCENES)
except ImportError:
    pass


REGISTRY.update(_LOGO)
try:
    import scenes_editorial  # noqa: E402  (painted onboarding, overrides ob-2/3/4)

    REGISTRY.update(scenes_editorial.SCENES)
except ImportError as e:
    print("editorial scenes unavailable:", e)


def main():
    out = sys.argv[1]
    names = sys.argv[2:] or sorted(REGISTRY)
    os.makedirs(out, exist_ok=True)
    total = 0
    for n in names:
        comp = REGISTRY[n]()
        data = comp.dumps()
        json.loads(data)  # sanity
        with open(os.path.join(out, f"{n}.json"), "w") as f:
            f.write(data)
        total += len(data)
        print(f"{n:24s} {len(data) / 1024:6.1f} KB  layers={len(comp.layers)}")
    print(f"{len(names)} illustrations, {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
