"""Poster cards (poster-*): 1600×1000, solid brand room (green or ink) with the art in the right
45 % — the title sits on the left half (mirrored in Arabic). Ambient idle life, slow."""
from __future__ import annotations

import math

from kit import Comp, F, S, arc, circle, path, rect, rect_xy, rot, rpoly
from objects import (
    arched_window,
    ballot,
    ballot_box_front,
    ballot_box_lid,
    bars_chart,
    chevron_up,
    hex_pts,
    symbol,
    key,
    keyhole,
    magnifier,
    megaphone,
    palm,
    shield,
    sparkle,
)

W, H = 1600, 1000
AX = 1200  # art centre x


def poster(name, bg):
    c = Comp(name, W, H, intro=84)
    c.layer("bg", [F(rect_xy(0, 0, W, H, 0), bg)], (W / 2, H / 2))
    return c


def stars(c, spots, t0=50):
    for k, (x, y, r, col) in enumerate(spots):
        L = c.layer(f"star{k}", sparkle(x, y, r, col), (x, y))
        L.pop(t0 + k * 5, 20, over=130).twinkle(40, 1, phase=0.13 + k * 0.27)


def glow(c, x, y, r, col, a=1.0):
    g = c.layer("glow", [F(circle(x, y, r), col, a)], (x, y))
    g.pop(0, 34, over=103, frm=60).breathe(3, 1)
    return g


# ── poster-ag : the assembly, every vote lands ────────────────────────────────────────────────
def poster_ag():
    c = poster("poster-ag", "g700")
    glow(c, AX, 560, 340, "g600")
    by = 700
    lid = c.layer("lid", ballot_box_lid(AX, by, 380, 340, top="lime", slot="g900"), (AX, by + 170))
    lid.rise(4, 80, 30)
    # a ballot that keeps dropping in, one per cycle
    b = c.layer("ballot", ballot(AX, by - 150, 150, 190), (AX, by - 150))
    I, OP = c.intro, c.op
    b.key("p", 10, [AX, by - 380], "out").key("p", 34, [AX, by - 150], "inout").fade(10, 8)
    b.key("p", I, [AX, by - 150], "in")
    span = OP - I
    b.key("p", I + span * 0.35, [AX, by - 150], "in").key("p", I + span * 0.5, [AX, by - 20], "linear")
    b.key("o", I + span * 0.44, 100, "linear").key("o", I + span * 0.5, 0, "linear")
    b.key("p", I + span * 0.52, [AX, by - 320], "out").key("p", I + span * 0.82, [AX, by - 150], "inout").key("p", OP, [AX, by - 150], "linear")
    b.key("o", I + span * 0.56, 0, "linear").key("o", I + span * 0.66, 100, "linear")
    b.key("r", I + span * 0.52, -10, "out").key("r", I + span * 0.82, 0, "inout")
    front = c.layer("box", ballot_box_front(AX, by, 380, 340, face="lime", side="lime_d"), (AX, by + 170), lid)
    mk = c.layer("mark", symbol(AX, by + 70, 112, "g700"), (AX, by + 70), lid)
    mk.pop(40, 20, over=118)
    for k, (x, y, ang) in enumerate(((960, 360, -14), (1450, 330, 12))):
        L = c.layer(f"ballot{k}", rot(ballot(x, y, 120, 150, "paper", "g700"), ang, (x, y)), (x, y))
        L.pop(24 + k * 8, 24, over=110).float(14, 1, phase=0.3 + 0.4 * k)
    stars(c, [(1000, 640, 22, "lime"), (1420, 600, 18, "lime"), (1300, 200, 16, "mint")])
    return c


# ── poster-annonce : make it known (ink room) ─────────────────────────────────────────────────
def poster_annonce():
    c = poster("poster-annonce", "ink")
    glow(c, AX, 520, 330, "ink2")
    mx, my, ms = 1080, 560, 420
    mg = c.layer("megaphone", rot(megaphone(mx, my, ms), -14, (mx, my)), (mx - 120, my + 80))
    mg.rise(4, 60, 30).swing_in(4, -12, 40)
    mg.sway(2, 1)
    a = math.radians(-14)
    mox, moy = mx + ms * 0.36 * math.cos(a), my + ms * 0.36 * math.sin(a)
    for k in range(3):
        r = 200 + k * 64
        w = c.layer(f"wave{k}", [S(arc(mox, moy, r, -54, 26), "lime" if k == 0 else "g500", 24)], (mox, moy))
        w.fade(30 + k * 6, 10)
        # waves breathe outward in turn
        w._periodic("o", lambda th, k=k: 100 * (0.35 + 0.65 * (0.5 + 0.5 * math.cos(2 * math.pi * (th - k * 0.18)))), 1, 0.0001)
    for k, (x, y, r, col) in enumerate(((1460, 260, 14, "lime"), (1500, 420, 10, "g500"), (1470, 700, 16, "lime"), (960, 280, 12, "g500"))):
        L = c.layer(f"dot{k}", [F(circle(x, y, r), col)], (x, y))
        L.pop(40 + k * 4, 18, over=140).float(10, 1, phase=0.25 * k)
    return c


# ── poster-onboarding : your residence, tonight (ink room) ────────────────────────────────────
def poster_onboarding():
    c = poster("poster-onboarding", "ink")
    glow(c, AX, 620, 360, "ink2")
    moon_ = c.layer("moon", [F(circle(1450, 220, 60), "lime")], (1450, 220))
    moon_.pop(10, 26, over=110).breathe(4, 1)
    base = 900
    towers = [(1040, 150, 380, "g600"), (1360, 150, 340, "g600"), (1200, 190, 560, "g700")]
    for k, (x, w, h, col) in enumerate(towers):
        hw = w / 2
        top = base - h
        parts = [F(path([(x - hw, top + 40), (x + hw, top), (x + hw, base - 40), (x - hw, base)]), col)]
        if k == 2:
            parts = [F(path([(x - hw, top + 16), (x + hw, top - 40), (x + hw, top - 10), (x - hw, top + 46)]), "lime")] + parts
        rows = 5 if k == 2 else 3
        for r_ in range(rows):
            for cc in range(2):
                wx = x - hw + 28 + cc * (w - 56) / 2
                wy = top + 90 + r_ * 84 - cc * 18
                lit = (r_ + cc + k) % 3 != 0
                parts += [F(rpoly([(wx, wy + 12), (wx + 44, wy), (wx + 44, wy + 40), (wx, wy + 52)], 6), "lime" if lit else "g800")]
        T = c.layer(f"tower{k}", parts, (x, base))
        T.grow_y(8 + [6, 12, 0][k], 36, 104)
    for k, (x, s_) in enumerate(((900, 300), (1490, 240))):
        pm = c.layer(f"palm{k}", palm(x, base + 20, s_, leaf="g600", leaf2="g700"), (x, base + 20))
        pm.pop(36 + k * 6, 26, over=106).sway(2.5, 1, phase=0.3 + 0.4 * k)
    c.layer("ground", [F(rect_xy(820, base - 8, 780, 140, 0), "g900")], (1200, base))
    stars(c, [(980, 220, 20, "lime"), (1080, 120, 12, "paper"), (1300, 100, 14, "lime"), (1560, 420, 12, "paper"), (880, 420, 10, "paper")])
    return c


# ── poster-securite : your data, locked (green room) ──────────────────────────────────────────
def poster_securite():
    c = poster("poster-securite", "g700")
    glow(c, AX, 500, 330, "g600")
    sh = c.layer("shield", shield(1160, 500, 470) + keyhole(1160, 520, 190), (1160, 500))
    sh.pop(6, 30, over=106).float(10, 1)
    k = c.layer("key", key(1360, 640, 220, -35, "paper", "g700"), (1360, 640))
    k.rise(24, 60, 30, dx=80).swing_in(24, 30, 40)
    k.sway(4, 1, phase=0.3)
    ring = c.layer("ring", [S(arc(1160, 500, 330, 200, 330), "lime", 10)], (1160, 500))
    ring.draw(30, 30)
    ring.spin_loop(1)
    stars(c, [(960, 260, 22, "lime"), (1460, 300, 16, "lime"), (1420, 820, 14, "mint")])
    return c


# ── poster-transparence : every dirham, visible (green room) ──────────────────────────────────
def poster_transparence():
    c = poster("poster-transparence", "g700")
    glow(c, AX, 560, 340, "g600")
    base = 820
    heights = [180, 270, 360, 470]
    bw = 110
    for k, h in enumerate(heights):
        x = 960 + k * 150
        b = c.layer(f"bar{k}", [F(rect_xy(x, base - h, bw, h, 18), "lime")], (x + bw / 2, base))
        b.grow_y(8 + k * 5, 30, 104)
        b._periodic("s", lambda th, k=k: [100, 100 + 4 * math.sin(2 * math.pi * (th + k * 0.2))], 1, 0.0001)
    ax = c.layer("axis", [F(rect_xy(930, base, 610, 16, 8), "g900")], (1235, base))
    ax.grow_x(4, 26)
    ch = c.layer("chev", chevron_up(1460, 230, 120, 30, "lime") + chevron_up(1460, 180, 120, 30, "lime"), (1460, 210))
    ch.rise(40, 40, 24).float(12, 1)
    mg = c.layer("magnifier", magnifier(1080, 420, 110, "paper", "g600", "paper"), (1080, 420))
    mg.pop(30, 26, over=110).orbit(40, 20, 1)
    stars(c, [(950, 260, 18, "lime"), (1530, 520, 14, "mint")])
    return c


SCENES = {
    "poster-ag": poster_ag,
    "poster-annonce": poster_annonce,
    "poster-onboarding": poster_onboarding,
    "poster-securite": poster_securite,
    "poster-transparence": poster_transparence,
}
