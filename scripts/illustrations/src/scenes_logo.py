"""The logo, built: welcome-hero and poster-onboarding.

Geometry is traced from syndicuplogo.png (1254 px, OpenCV contours): the hexagon ring is open at
the bottom where the two side towers fuse into it; the centre tower carries the roof wing. Each
piece is a separate layer so the logo can assemble itself: the ring draws from its apex down both
sides, the towers rise into it, the roof wing lands, the windows light one by one.
"""
from __future__ import annotations

import math

from kit import Comp, F, S, circle, ellipse, path, rect_xy
from objects import crescent, shadow, sparkle

# ── traced logo (1254 px space) ─────────────────────────────────────────────────────────────────
RING_OUTER = [(390, 914), (305, 864), (285, 840), (270, 799), (269, 468), (279, 433), (321, 396), (622, 215), (646, 220),
              (954, 410), (976, 436), (983, 461), (983, 795), (971, 834), (940, 870), (862, 917)]
RING_INNER = [(390, 892), (340, 863), (318, 833), (312, 810), (313, 467), (326, 446), (620, 259), (637, 260),
              (926, 445), (941, 471), (940, 813), (924, 850), (862, 893)]
TOWER_L = [(390, 707), (491, 639), (492, 973), (390, 914)]
TOWER_R = [(728, 577), (860, 666), (862, 917), (730, 997)]
TOWER_C = [(630, 415), (485, 509), (487, 615), (545, 589), (546, 1004), (624, 1048), (628, 445)]
ROOF = [(630, 415), (628, 445), (768, 537), (766, 507)]
RING_W = 44
LOGO_C = (626, 631)


def _resample(pts, n):
    seg = [math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1)]
    tot = sum(seg)
    out = []
    for i in range(n):
        d = tot * i / (n - 1)
        for k, s_ in enumerate(seg):
            if d <= s_ or k == len(seg) - 1:
                f = min(d / s_, 1) if s_ else 0
                out.append((pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f))
                break
            d -= s_
    return out


def _ring_centre():
    """Centre line of the ring, from the bottom-left end, over the apex, to the bottom-right end."""
    o = _resample(RING_OUTER, 160)
    i = _resample(RING_INNER, 160)
    mid = [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(o, i)]
    # extend both ends a little INTO the towers so the stroke caps hide under them
    def ext(p, q, d):
        L = math.dist(p, q)
        return (p[0] + (p[0] - q[0]) / L * d, p[1] + (p[1] - q[1]) / L * d)
    mid[0] = ext(mid[0], mid[3], 30)
    mid[-1] = ext(mid[-1], mid[-4], 30)
    # split at the apex (topmost point)
    k = min(range(len(mid)), key=lambda j: mid[j][1])
    left = list(reversed(mid[: k + 1]))  # apex → bottom-left
    right = mid[k:]  # apex → bottom-right
    return _simplify(left), _simplify(right)


def _simplify(pts, tol=1.2):
    out = [pts[0]]
    for p in pts[1:-1]:
        a, b = out[-1], p
        if math.dist(a, b) > 6:
            out.append(p)
    out.append(pts[-1])
    return out


class Logo:
    """Maps logo coordinates into a composition: centre (cx, cy), logo hexagon height h."""

    def __init__(self, cx, cy, h):
        self.k = h / (1048 - 215)
        self.cx, self.cy = cx, cy

    def P(self, pts):
        return [(self.cx + (x - LOGO_C[0]) * self.k, self.cy + (y - LOGO_C[1]) * self.k) for x, y in pts]

    def p(self, x, y):
        return self.P([(x, y)])[0]


def slanted(x0, x1, y_top_at, h, slope):
    """Parallelogram window between x0 and x1 whose top follows `slope` (dy/dx)."""
    return path([(x0, y_top_at), (x1, y_top_at + (x1 - x0) * slope), (x1, y_top_at + (x1 - x0) * slope + h), (x0, y_top_at + h)])


def build_logo(c: Comp, L: Logo, *, ring="g700", tower="g700", tower_side="g600", roof="lime", win_off="g800", win_on="lime", t0=6, lit=None):
    """Adds the assembling logo to `c`. Returns the window layers (for idle twinkles)."""
    k = L.k
    left, right = _ring_centre()
    for nm, half in (("ring-l", left), ("ring-r", right)):
        r = c.layer(nm, [S(path(L.P(half), False), ring, RING_W * k, cap="round")], L.p(*LOGO_C))
        r.draw(t0, 34, "soft")
    # towers rise from their own bases (staggered, the centre last and tallest)
    specs = [("tower-l", TOWER_L, tower_side, 18), ("tower-r", TOWER_R, tower_side, 24), ("tower-c", TOWER_C, tower, 30)]
    towers = {}
    for nm, poly, col, t in specs:
        P = L.P(poly)
        base = max(y for _, y in P)
        cxp = sum(x for x, _ in P) / len(P)
        T = c.layer(nm, [F(path(P), col)], (cxp, base))
        T.grow_y(t0 + t, 30, 104)
        towers[nm] = T
    rf = c.layer("roof", [F(path(L.P(ROOF)), roof)], L.p(698, 476))
    rf.drop(t0 + 52, -60 * k * 1.6, 22, 6 * k * 1.6)
    # windows: slits that follow each tower's slope, one column per tower
    wins = []
    cols = [
        ("tower-l", 405, 476, 724, -0.673, 4),
        ("tower-c", 562, 610, 660, -0.0, 5),
        ("tower-r", 745, 845, 606, 0.674, 4),
    ]
    order = 0
    lit = lit or {("tower-l", 1), ("tower-l", 3), ("tower-c", 0), ("tower-c", 2), ("tower-c", 3), ("tower-r", 0), ("tower-r", 2)}
    for tname, x0, x1, ytop, slope, n in cols:
        step = 58 if tname != "tower-c" else 62
        for j in range(n):
            yy = ytop + 26 + j * step
            if tname == "tower-c":
                yy = 660 + j * 66
            pts0 = [(x0, yy), (x1, yy + (x1 - x0) * slope), (x1, yy + (x1 - x0) * slope + 26), (x0, yy + 26)]
            P = L.P(pts0)
            on = (tname, j) in lit
            parts = [F(path(P), win_on if on else win_off)]
            cxw = sum(x for x, _ in P) / 4
            cyw = sum(y for _, y in P) / 4
            W = c.layer(f"win-{tname}-{j}", parts, (cxw, cyw), towers[tname])
            W.fade(t0 + 44 + order * 2.2, 8)
            wins.append((W, on))
            order += 1
    return wins, towers


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


# ── welcome-hero ───────────────────────────────────────────────────────────────────────────────
def welcome_hero():
    c = Comp("welcome-hero", intro=100)
    disc = c.layer("disc", [F(circle(512, 500, 392), "tint")], (512, 500))
    disc.pop(0, 32, over=103, frm=70)
    sun = c.layer("sun", [F(circle(780, 236, 64), "lime")], (780, 236))
    sun.pop(16, 28, over=112).breathe(4, 1)
    for k, (x, y, w, dx, amp) in enumerate(((386, 318, 104, -40, 12), (684, 356, 80, 40, -9))):
        cl = c.layer(f"cloud{k}", cloud_pill(x, y, w), (x, y))
        cl.rise(26 + k * 6, 0, 36, dx=dx)
        cl.bob(amp, 1, phase=0.25 * k, axis="x")
    g = c.layer("ground", shadow(512, 812, 560, 34, "mint"), (512, 812))
    g.pop(10, 28, over=102, frm=30)
    add_palm(c, 196, 812, 228, 58, lean=-0.06, phase=0.1)
    add_palm(c, 862, 812, 220, 64, lean=0.07, phase=0.55)
    L = Logo(512, 488, 640)
    wins, towers = build_logo(c, L, t0=6)
    # a few lit windows breathe after the build (never all at once)
    for k, (W, on) in enumerate([w for w in wins if w[1]][1:4:2]):
        W.blink(45, k + 1)
    sparkles(c, [(360, 150, 18, "lime"), (676, 128, 12, "lime")], 74)
    return c


# ── poster-onboarding : the residence at night (ink room) ──────────────────────────────────────
def poster_onboarding():
    c = Comp("poster-onboarding", 1600, 1000, intro=96)
    c.layer("bg", [F(rect_xy(0, 0, 1600, 1000, 0), "ink")], (800, 500))
    glow = c.layer("glow", [F(circle(1190, 520, 430), "#17201B"), F(circle(1190, 520, 330), "#1B2620")], (1190, 520))
    glow.pop(0, 34, over=103, frm=70).breathe(2, 1)
    moon = c.layer("moon", crescent(1468, 176, 54, 30, -22, 48, "lime"), (1468, 176))
    moon.pop(18, 28, over=112).float(6, 1)
    add_palm(c, 846, 838, 300, 56, lean=-0.06, phase=0.2, leaf="g600", leaf_d="g800", trunk="sand_d", trunk_d="#A8956C")
    add_palm(c, 1496, 838, 230, 62, lean=0.07, phase=0.6, leaf="g600", leaf_d="g800", trunk="sand_d", trunk_d="#A8956C")
    L = Logo(1190, 500, 660)
    wins, towers = build_logo(c, L, ring="g700", tower="g700", tower_side="g600", win_off="#123D2B", t0=6,
                              lit={("tower-l", 0), ("tower-l", 2), ("tower-c", 1), ("tower-c", 2), ("tower-c", 4), ("tower-r", 1), ("tower-r", 3)})
    for k, (W, on) in enumerate([w for w in wins if w[1]][0:5:2]):
        W.blink(40, k + 1)
    # reflection line under the residence (the ground, without cutting the frame)
    gl = c.layer("ground", [F(rect_xy(860, 832, 660, 10, 5), "g900"), F(rect_xy(930, 856, 520, 8, 4), "#123D2B")], (1190, 840))
    gl.grow_x(14, 30)
    sparkles(c, [(960, 210, 18, "lime"), (1060, 120, 9, "paper"), (1330, 96, 11, "lime"), (1550, 380, 9, "paper"), (880, 430, 8, "paper"), (1540, 640, 7, "lime")], 60)
    return c


SCENES = {"welcome-hero": welcome_hero, "poster-onboarding": poster_onboarding}
