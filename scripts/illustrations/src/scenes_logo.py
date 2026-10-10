"""The brand symbol, rising: welcome-hero and poster-onboarding.

The SyndicUp symbol (two upward chevrons, the lower one on a short stem — traced from
apps/mobile/assets/images/logo-foreground.png, see objects.symbol) climbs out of a residence:
the building settles, the lower chevron and its stem rise from behind the roof, the upper chevron
lands above. Idle: the chevrons keep a slow upward lift, one after the other.
"""
from __future__ import annotations

import math

from kit import Comp, F, S, circle, ellipse, path, rect, rect_xy
from objects import arched_window, building, crescent, shadow, sparkle, symbol_low, symbol_top, window_cells

# ── refined palm ───────────────────────────────────────────────────────────────────────────────
def _quad(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def palm_parts(cx, base_y, s, lean=0.08, trunk="sand", trunk_d="sand_d", leaf="g600", leaf_d="g800", nut="sand_d"):
    """Returns (trunk_parts, crown_parts, top). s = total height. lean > 0 leans right."""
    top = (cx + s * lean, base_y - s * 0.74)
    ctrl = (cx - s * lean * 0.4, base_y - s * 0.4)
    trunk_parts = []
    segs = 7
    for k in range(segs):
        t0, t1 = k / segs, (k + 1) / segs
        a, b = _quad((cx, base_y), ctrl, top, t0), _quad((cx, base_y), ctrl, top, t1)
        w0, w1 = s * (0.05 - 0.018 * t0), s * (0.05 - 0.018 * t1)
        trunk_parts.append(F(path([(a[0] - w0, a[1]), (b[0] - w1 * 1.08, b[1] + 1), (b[0] + w1 * 1.08, b[1] + 1), (a[0] + w0, a[1])]), trunk if k % 2 == 0 else trunk_d))
    crown = []
    # (angle°, length, droop): back fronds first, painted darker; front fronds on top
    back = [(-158, 0.60, 0.50), (-112, 0.50, 0.22), (-68, 0.50, 0.22), (-22, 0.60, 0.50)]
    front = [(-178, 0.56, 0.62), (-136, 0.58, 0.36), (-90, 0.40, 0.06), (-44, 0.58, 0.36), (-2, 0.56, 0.62)]
    for layer_fronds, c_up, c_lo in ((back, leaf_d, leaf_d), (front, leaf, leaf_d)):
        for ang, ln, droop in layer_fronds:
            a = math.radians(ang)
            L_ = s * ln
            d = (math.cos(a), math.sin(a))
            tip = (top[0] + d[0] * L_, top[1] + d[1] * L_ * 0.6 + s * droop * 0.5)
            ctl = (top[0] + d[0] * L_ * 0.55, top[1] + d[1] * L_ * 0.55 - s * 0.12)
            W = s * 0.055
            n = 18
            cl = [_quad(top, ctl, tip, i / n) for i in range(n + 1)]
            upper, lower = [], []
            for i, p in enumerate(cl):
                q = cl[min(i + 1, n)]
                r_ = cl[max(i - 1, 0)]
                tx, ty = q[0] - r_[0], q[1] - r_[1]
                tl = math.hypot(tx, ty) or 1
                nx, ny = -ty / tl, tx / tl
                if ny > 0:
                    nx, ny = -nx, -ny
                t = i / n
                w = W * min(1.0, t / 0.14) * (1 - t) ** 0.85  # widest near the base, sharp tip
                upper.append((p[0] + nx * w, p[1] + ny * w))
                lower.append((p[0] - nx * w * 0.9, p[1] - ny * w * 0.9))
            crown.append(F(path(cl + list(reversed(lower))), c_lo))
            crown.append(F(path(upper + list(reversed(cl))), c_up))
    for dx, dy in ((-0.03, 0.03), (0.025, 0.035), (0.0, 0.055)):
        crown.append(F(circle(top[0] + s * dx, top[1] + s * dy, s * 0.028), nut))
    return trunk_parts, crown, top


def add_palm(c, cx, base_y, s, t, lean=0.08, phase=0.0, **kw):
    tp, cp, top = palm_parts(cx, base_y, s, lean, **kw)
    tr = c.layer("palm-trunk", tp, (cx, base_y))
    tr.grow_y(t, 26, 103)
    cr = c.layer("palm-crown", cp, top, tr)
    cr.pop(t + 14, 26, over=108, frm=30)
    cr.sway(2.4, 1, phase=phase)
    return tr, cr


def cloud_pill(cx, cy, w, c="paper"):
    h = w * 0.3
    return [
        F(rect_xy(cx - w / 2, cy - h / 2, w, h, h / 2), c),
        F(circle(cx - w * 0.12, cy - h * 0.45, h * 0.62), c),
        F(circle(cx + w * 0.16, cy - h * 0.35, h * 0.48), c),
    ]


def sparkles(c, spots, t0):
    for k, (x, y, r, col) in enumerate(spots):
        L_ = c.layer(f"sparkle{k}", sparkle(x, y, r, col), (x, y))
        L_.pop(t0 + k * 6, 20, over=130).twinkle(40, 1, phase=0.15 + k * 0.29)


def rising_symbol(c, cx, cy, h, col, t0):
    """Symbol layers: the lower part climbs from below (hidden by whatever is drawn after it),
    the upper chevron follows and lands. Returns (low, top)."""
    low = c.layer("symbol-low", symbol_low(cx, cy, h, col), (cx, cy))
    low.key("p", t0, [cx, cy + h * 0.62], "out").key("p", t0 + 30, [cx, cy - h * 0.03], "inout").key("p", t0 + 42, [cx, cy], "inout")
    low.fade(t0, 6)
    top = c.layer("symbol-top", symbol_top(cx, cy, h, col), (cx, cy))
    top.drop(t0 + 26, -h * 0.42, 26, h * 0.035)
    # idle: an upward lift, the top chevron leading
    low.float(h * 0.012, 1, phase=0.0)
    top.float(h * 0.03, 1, phase=0.0)
    return low, top


def residence(c, x, y, w, h, t, face, side, win, win_off, roof, door, lit):
    b = c.layer("residence", building(x, y, w, h, face=face, side=side, win=win, win_off=win_off, floors=2, cols=5, lit=lit, roof=roof, door=door), (x + w / 2, y + h))
    b.grow_y(t, 30, 103)
    return b


# ── welcome-hero ───────────────────────────────────────────────────────────────────────────────
def welcome_hero():
    c = Comp("welcome-hero", intro=100)
    disc = c.layer("disc", [F(circle(512, 500, 392), "tint")], (512, 500))
    disc.pop(0, 32, over=103, frm=70)
    sun = c.layer("sun", [F(circle(786, 250, 58), "lime")], (786, 250))
    sun.pop(16, 28, over=112).breathe(4, 1)
    for k, (x, y, w, dx, amp) in enumerate(((236, 300, 150, -60, 14), (818, 420, 110, 60, -10))):
        cl = c.layer(f"cloud{k}", cloud_pill(x, y, w), (x, y))
        cl.rise(24 + k * 6, 0, 36, dx=dx)
        cl.bob(amp, 1, phase=0.25 * k, axis="x")
    g = c.layer("ground", shadow(512, 812, 600, 34, "mint"), (512, 812))
    g.pop(8, 28, over=102, frm=30)
    add_palm(c, 196, 812, 236, 52, lean=-0.06, phase=0.1)
    add_palm(c, 838, 812, 208, 58, lean=0.07, phase=0.55)
    rising_symbol(c, 512, 418, 350, "g700", 30)
    residence(c, 262, 580, 500, 232, 6, "paper", "greige_dd", "lime", "sage", "greige_d", "g700", {(0, 1), (0, 3), (1, 0), (1, 4)})
    sparkles(c, [(340, 180, 18, "lime"), (690, 150, 12, "lime")], 76)
    return c


# ── poster-onboarding : the symbol over the residence, at night (ink room) ─────────────────────
def poster_onboarding():
    c = Comp("poster-onboarding", 1600, 1000, intro=96)
    c.layer("bg", [F(rect_xy(0, 0, 1600, 1000, 0), "ink")], (800, 500))
    glow = c.layer("glow", [F(circle(1190, 500, 430), "#17201B"), F(circle(1190, 500, 320), "#1B2620")], (1190, 500))
    glow.pop(0, 34, over=103, frm=70).breathe(2, 1)
    moon = c.layer("moon", crescent(1478, 170, 52, 30, -22, 46, "lime"), (1478, 170))
    moon.pop(18, 28, over=112).float(6, 1)
    add_palm(c, 892, 860, 300, 56, lean=-0.06, phase=0.2, leaf="g600", leaf_d="g800", trunk="sand_d", trunk_d="#A8956C")
    add_palm(c, 1500, 860, 240, 62, lean=0.07, phase=0.6, leaf="g600", leaf_d="g800", trunk="sand_d", trunk_d="#A8956C")
    rising_symbol(c, 1190, 400, 420, "lime", 28)
    residence(c, 950, 640, 480, 220, 6, "g800", "g900", "lime", "#123D2B", "g900", "g950", {(0, 0), (0, 2), (1, 1), (1, 3), (0, 4)})
    gl = c.layer("ground", [F(rect_xy(860, 864, 660, 10, 5), "g900"), F(rect_xy(930, 888, 520, 8, 4), "#123D2B")], (1190, 870))
    gl.grow_x(10, 30)
    sparkles(c, [(960, 210, 18, "lime"), (1060, 120, 9, "paper"), (1330, 96, 11, "lime"), (1550, 380, 9, "paper"), (880, 430, 8, "paper"), (1560, 640, 7, "lime")], 60)
    return c


SCENES = {"welcome-hero": welcome_hero, "poster-onboarding": poster_onboarding}
