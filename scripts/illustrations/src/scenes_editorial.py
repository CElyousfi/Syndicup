"""Onboarding in the approved editorial style (painted art in scripts/illustrations/editorial/src,
cut into layers by hand-placed rectangles, source pixel coordinates 1254×1254)."""
from __future__ import annotations

import os

from editorial import build, falling_drop

SRC = os.path.join(os.path.dirname(__file__), "..", "editorial", "src")


def ob_2_charges():
    return build(
        "ob-2-charges",
        os.path.join(SRC, "ob-2-charges.png"),
        [
            ("plant", (110, 125, 262, 256), "panel", {}),
            ("building", (316, 78, 832, 452), "panel", {}),
            ("woman", (84, 254, 402, 762), "panel", {}),
            ("syndic", (830, 250, 1172, 674), "panel", {}),
            ("phone", (136, 756, 502, 1152), "panel", {}),
            ("houses", (500, 668, 1172, 1162), "panel", {}),
            ("pie", (492, 530, 748, 784), "float", {"t": 30, "amp": 0, "over": 106}),
            ("drop", (412, 460, 510, 558), "float", {"t": 44, "amp": 7, "phase": 0.0}),
            ("bulb", (718, 460, 818, 558), "float", {"t": 48, "amp": 7, "phase": 0.25}),
            ("key", (386, 695, 486, 795), "float", {"t": 52, "amp": 7, "phase": 0.5}),
            ("broom", (756, 686, 868, 796), "float", {"t": 56, "amp": 7, "phase": 0.75}),
            ("coins", (566, 801, 672, 905), "float", {"t": 60, "amp": 6, "phase": 0.4}),
            ("chevron", (868, 150, 948, 232), "float", {"t": 64, "amp": 10, "phase": 0.1}),
        ],
    )


def ob_3_incident():
    return build(
        "ob-3-incident",
        os.path.join(SRC, "ob-3-incident.png"),
        [
            ("olive", (102, 92, 432, 302), "panel", {}),
            ("pipe", (436, 86, 822, 732), "panel", {}),
            ("caretaker", (826, 146, 1168, 842), "panel", {}),
            ("woman", (72, 296, 502, 1004), "panel", {}),
            ("house", (396, 742, 872, 1154), "panel", {}),
            ("lift", (872, 848, 1168, 1176), "panel", {}),
            ("chevron", (1028, 114, 1112, 204), "float", {"t": 60, "amp": 10, "phase": 0.1}),
            ("bubble", (1032, 266, 1152, 392), "pulse", {"t": 50, "amp": 6, "phase": 0.0}),
            ("phone", (374, 440, 472, 604), "pulse", {"t": 44, "amp": 3, "phase": 0.5}),
        ],
        extras=[falling_drop(656, 300, 660, 26, (656, 420), n=2)],
    )


def ob_4_ag():
    return build(
        "ob-4-ag",
        os.path.join(SRC, "ob-4-ag.png"),
        [
            ("building", (440, 66, 888, 508), "panel", {}),
            ("woman", (62, 150, 432, 662), "panel", {}),
            ("cafe", (830, 198, 1194, 692), "panel", {}),
            ("office", (78, 694, 620, 1128), "panel", {}),
            ("meeting", (632, 756, 1236, 1190), "panel", {}),
            ("box", (518, 614, 738, 806), "float", {"t": 40, "amp": 0, "over": 106}),
            ("check", (548, 512, 712, 612), "float", {"t": 58, "amp": 9, "phase": 0.0}),
            ("chevron", (1102, 80, 1188, 168), "float", {"t": 64, "amp": 10, "phase": 0.3}),
        ],
    )


SCENES = {
    "ob-2-charges": ob_2_charges,
    "ob-3-incident": ob_3_incident,
    "ob-4-ag": ob_4_ag,
}
