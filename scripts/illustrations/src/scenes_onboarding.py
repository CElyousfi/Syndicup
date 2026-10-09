"""Onboarding (ob-*) and the welcome hero: richer scenes that tell what SyndicUp does. They
assemble in a short sequence (≈1.2 s) and keep a slow, layered ambient life."""
from __future__ import annotations

import math

from kit import Comp, F, S, arc, circle, ellipse, path, rect, rect_xy, rot, rpoly
from objects import (
    arched_window,
    ballot_box,
    block,
    broom,
    building,
    bulb,
    check_path,
    check_stroke,
    cloud,
    coin,
    drop,
    hex_pts,
    key,
    palm,
    phone,
    pie,
    shadow,
    sparkle,
    tree_round,
    window_cells,
    wrench,
)

CX, CY = 512, 512


def stage(c, r=330, y=CY, shadow_y=840, shadow_w=520):
    s = c.layer("stage", [F(circle(CX, y, r), "tint")], (CX, y))
    s.pop(0, 30, over=103, frm=70)
    g = c.layer("shadow", shadow(CX, shadow_y, shadow_w, 40, "mint"), (CX, shadow_y))
    g.pop(6, 26, over=102, frm=40)


def sparkles(c, spots, t0=44):
    for k, (x, y, r, col) in enumerate(spots):
        L = c.layer(f"sparkle{k}", sparkle(x, y, r, col), (x, y))
        L.pop(t0 + k * 6, 20, over=130).twinkle(45, 1, phase=0.15 + k * 0.29)


def zellige(x, y, w, n, c="lime", c2="g800", size=None):
    """A band of small diamond tiles (a nod to zellige)."""
    out = []
    step = w / n
    s = size or step * 0.36
    for k in range(n):
        cx = x + step * (k + 0.5)
        out += [F(rpoly([(cx, y - s), (cx + s, y), (cx, y + s), (cx - s, y)], s * 0.2), c if k % 2 == 0 else c2)]
    return out


# ── ob-1-residence : your residence, in your pocket ───────────────────────────────────────────
def ob_1_residence():
    c = Comp("ob-1-residence", intro=84)
    stage(c, 340, 500, 842, 600)
    bx, by, bw, bh = 250, 270, 320, 570
    b = c.layer("building", building(bx, by, bw, bh, floors=4, cols=3, lit=set(), face="g700") + zellige(bx + 10, by + bh * 0.8 - 8, bw - 20, 9, "lime", "g600", 10), (bx + bw / 2, by + bh))
    b.grow_y(4, 34, 103)
    cells = window_cells(bx, by, bw, bh, 4, 3)
    for k, ((f, col), (wx, wy, ww, wh)) in enumerate(cells):
        if (f * 3 + col) % 3 != 1:
            L = c.layer(f"light{k}", arched_window(wx, wy, ww, wh, "lime"), (wx + ww / 2, wy + wh / 2), b)
            L.fade(30 + ((f * 3 + col) * 3) % 24, 10).blink(25, 1, phase=(k * 0.29) % 1)
    tr = c.layer("tree", tree_round(205, 842, 220), (205, 842))
    tr.pop(26, 26, over=106).sway(2, 1, phase=0.3)
    # the phone shows the same residence, simplified
    px, py, pw, ph = 690, 520, 250, 470
    ph_l = c.layer(
        "phone",
        phone(px, py, pw, ph)
        + [F(rect_xy(px - 92, py - 170, 184, 150, 22), "tint"), F(rect_xy(px - 50, py - 150, 100, 130, 10), "g700")]
        + [F(rect_xy(px - 34 + k % 2 * 44, py - 134 + k // 2 * 38, 24, 26, 6), "lime") for k in range(6)]
        + [F(rect_xy(px - 92, py + 4, 184, 30, 15), "greige"), F(rect_xy(px - 92, py + 50, 130, 30, 15), "greige")]
        + [F(rect_xy(px - 92, py + 110, 184, 60, 20), "lime"), F(rect_xy(px - 60, py + 132, 120, 16, 8), "g800")],
        (px, py),
    )
    ph_l.rise(22, 0, 32, dx=140).float(10, 1, phase=0.2)
    ph_l.swing_in(22, 12, 40)
    hexf = c.layer("hex", [F(rpoly(hex_pts(px + 120, py - 250, 54), 12), "lime"), S(rpoly(hex_pts(px + 120, py - 250, 32), 6), "g700", 9)], (px + 120, py - 250), ph_l)
    hexf.pop(48, 22, over=120)
    sparkles(c, [(820, 210, 22, "lime"), (150, 300, 18, "lime")])
    return c


# ── ob-2-charges : shared charges, clear shares ───────────────────────────────────────────────
def ob_2_charges():
    c = Comp("ob-2-charges", intro=84)
    stage(c, 340, 500, 842, 460)
    pr = 220
    slices = [(-90, 40, "g700"), (40, 130, "lime"), (130, 210, "sage_d"), (210, 270, "g900")]
    base = c.layer("pie-base", [F(circle(CX, 500 + 22, pr), "g950")], (CX, 500))
    base.pop(4, 26, over=104)
    for k, (a0, a1, col) in enumerate(slices):
        mid = math.radians((a0 + a1) / 2)
        sl = c.layer(f"slice{k}", pie(CX, 500, pr, [(a0, a1, col)], 0.8), (CX, 500))
        sl.pop(10 + k * 5, 24, over=104, frm=60)
        sl.key("p", 10 + k * 5, [CX + math.cos(mid) * 50, 500 + math.sin(mid) * 50], "out").key("p", 34 + k * 5, [CX, 500], "out")
    hole = c.layer("hole", [F(circle(CX, 500, 92), "tint"), F(circle(CX, 500, 70), "paper")], (CX, 500))
    hole.pop(28, 22, over=110)
    cn = c.layer("coin", coin(CX, 492, 54), (CX, 492))
    cn.drop(44, -260, 30, 14).float(8, 1)
    icons = [
        ("key", key(214, 250, 120, -30, "g700", "tint"), (240, 240)),
        ("bulb", bulb(810, 250, 140), (810, 250)),
        ("drop", drop(820, 720, 120, "sage_d"), (820, 720)),
        ("broom", rot(broom(200, 720, 230, "sand_d", "g700", "lime"), -18, (200, 720)), (200, 720)),
    ]
    for k, (nm, parts, anc) in enumerate(icons):
        disc = [F(circle(anc[0], anc[1], 92), "paper"), F(circle(anc[0], anc[1] + 8, 92), "greige_d")]
        L = c.layer(nm, [disc[1], disc[0]] + parts, anc)
        L.pop(30 + k * 6, 24, over=114).float(10, 1, phase=0.25 * k)
    return c


# ── ob-3-incident : snap it, it's reported ────────────────────────────────────────────────────
def ob_3_incident():
    c = Comp("ob-3-incident", intro=84)
    stage(c, 340, 500, 842, 420)
    px, py, pw, ph = CX - 30, 500, 330, 600
    p = c.layer("phone", phone(px, py, pw, ph, screen="ink2"), (px, py + ph / 2))
    p.rise(4, 100, 34).float(8, 1)
    # viewfinder: a pipe with a leak, framed by lime corner brackets
    sx, sy = px, py - 20
    scene = [
        F(rect_xy(px - 138, py - 262, 276, 470, 30), "g900"),
        F(rect_xy(sx - 150, sy - 130, 300, 46, 23), "sage"),
        F(rect_xy(sx + 64, sy - 130, 46, 200, 23), "sage"),
        F(rect_xy(sx + 46, sy + 40, 82, 34, 12), "sage_d"),
        F(rect_xy(sx - 18, sy - 140, 50, 66, 10), "sage_d"),
    ]
    sc = c.layer("viewfinder", scene, (px, py), p)
    sc.fade(18, 12)
    br = []
    for (bxx, byy, dx_, dy_) in ((sx - 110, sy - 200, 1, 1), (sx + 110, sy - 200, -1, 1), (sx - 110, sy + 170, 1, -1), (sx + 110, sy + 170, -1, -1)):
        br += [S(path([(bxx, byy + dy_ * 50), (bxx, byy), (bxx + dx_ * 50, byy)], False), "lime", 12)]
    brk = c.layer("brackets", br, (sx, sy), p)
    brk.pop(26, 24, over=96, frm=130)
    brk.breathe(-3, 2)
    # the drip, falling forever
    d0 = (sx + 87, sy + 96)
    dl = c.layer("drip", drop(d0[0], d0[1], 40, "lime"), d0, p)
    dl.fade(30, 8)
    I, OP = c.intro, c.op
    for cyc in range(2):
        b = I + cyc * (OP - I) / 2
        e = b + (OP - I) / 2
        dl.key("p", b, [d0[0], d0[1]], "in").key("p", b + (e - b) * 0.7, [d0[0], d0[1] + 110], "linear").key("p", e, [d0[0], d0[1] + 110], "linear")
        dl.key("o", b, 100, "linear").key("o", b + (e - b) * 0.55, 100, "linear").key("o", b + (e - b) * 0.7, 0, "linear").key("o", e - 1, 0, "linear").key("o", e, 100, "linear")
        dl.key("s", b, [40, 40], "out").key("s", b + (e - b) * 0.25, [100, 100], "linear").key("s", e, [100, 100], "linear")
    # speech bubble with a check: "reported"
    bx_, by_ = px + 200, py - 270
    bub = c.layer(
        "bubble",
        [F(rpoly([(bx_ - 90, by_ + 70), (bx_ - 120, by_ + 120), (bx_ - 40, by_ + 80)], 10), "lime_d"), F(rect_xy(bx_ - 110, by_ - 80, 220, 160, 60), "lime_d"), F(rect_xy(bx_ - 110, by_ - 90, 220, 160, 60), "lime")],
        (bx_ - 90, by_ + 70),
    )
    bub.pop(46, 24, over=114).float(8, 1, phase=0.4)
    ck = c.layer("bubble-check", check_stroke(bx_, by_ - 10, 100, "g800", 20), (bx_, by_), bub)
    ck.draw(56, 18)
    wr = c.layer("wrench", wrench(260, 700, 300, -60, "g700", "tint"), (260, 700))
    wr.swing_in(34, -30, 36).sway(3, 1, phase=0.6)
    sparkles(c, [(810, 600, 20, "lime")])
    return c


# ── ob-4-ag : vote from anywhere ──────────────────────────────────────────────────────────────
def ob_4_ag():
    c = Comp("ob-4-ag", intro=84)
    stage(c, 340, 500, 842, 420)
    bxc, byc = CX, 640
    bb = c.layer("box", ballot_box(bxc, byc, 300, 260) + [F(rpoly(hex_pts(bxc, byc + 40, 44), 10), "lime")], (bxc, byc + 130))
    bb.rise(4, 70, 30).float(6, 1, phase=0.5)
    phones = [(210, 270, -8), (512, 200, 0), (814, 270, 8)]
    for k, (x, y, ang) in enumerate(phones):
        parts = phone(x, y, 130, 220, screen="paper") + [F(circle(x, y + 6, 40), "g700")] + [S(check_path(x, y + 8, 50), "lime", 11)]
        L = c.layer(f"phone{k}", rot(parts, ang, (x, y)), (x, y))
        L.pop(18 + k * 6, 26, over=110).float(10, 1, phase=0.3 * k)
        # dotted route phone → box
        tgt = (bxc, byc - 150)
        pts = []
        n = 7
        for j in range(n):
            t = (j + 1) / (n + 1)
            mx, my = (x + tgt[0]) / 2 + (0 if k == 1 else (40 if k == 0 else -40)), (y + 130 + tgt[1]) / 2 + (0 if k == 1 else 90)
            qx = (1 - t) ** 2 * x + 2 * (1 - t) * t * mx + t * t * tgt[0]
            qy = (1 - t) ** 2 * (y + 130) + 2 * (1 - t) * t * my + t * t * tgt[1]
            pts.append((qx, qy))
        dots = c.layer(f"route{k}", [F(circle(qx, qy, 7), "sage_d") for qx, qy in pts], (CX, CY))
        dots.fade(34 + k * 4, 14)
        # one lime "vote" travelling along each route
        trav = c.layer(f"vote{k}", [F(circle(0, 0, 13), "lime"), F(circle(0, 0, 6), "g700")], (0, 0))
        route = [(x, y + 130)] + pts + [tgt]
        trav.anchor = (0, 0)
        I, OP = c.intro, c.op
        span = OP - I
        off = k / 3
        seg = [math.dist(route[j], route[j + 1]) for j in range(len(route) - 1)]
        tot = sum(seg)

        def at(u):
            d = u * tot
            for j, s_ in enumerate(seg):
                if d <= s_:
                    f = d / s_ if s_ else 0
                    return [route[j][0] + (route[j + 1][0] - route[j][0]) * f, route[j][1] + (route[j + 1][1] - route[j][1]) * f]
                d -= s_
            return list(route[-1])

        # travel during the first 60 % of its own cycle, then rest invisible
        def pos(th):
            u = (th - off) % 1
            return at(min(u / 0.6, 1))

        def op_(th):
            u = (th - off) % 1
            if u < 0.06:
                return u / 0.06 * 100
            if u < 0.54:
                return 100
            if u < 0.62:
                return (0.62 - u) / 0.08 * 100
            return 0

        trav._periodic("p", pos, 1, 0.0001)
        trav._periodic("o", op_, 1, 0.0001)
        trav.tracks["p"] = [k_ for k_ in trav.tracks["p"] if k_[0] >= I]
        trav.tracks["o"] = [k_ for k_ in trav.tracks["o"] if k_[0] >= I]
        trav.key("o", 0, 0, "linear").key("o", I - 1, 0, "linear")
    return c


# ── welcome-hero : the residence that rises (the logo, built) ─────────────────────────────────
LOGO_C = (313, 318)
LOGO_R = 205


def _lp(pts, cx=CX, cy=520, R=318):
    k = R / LOGO_R
    return [(cx + (x - LOGO_C[0]) * k, cy + (y - LOGO_C[1]) * k) for x, y in pts]


def welcome_hero():
    c = Comp("welcome-hero", intro=96)
    sky = c.layer("sky", [F(circle(CX, 512, 380), "tint")], (CX, 512))
    sky.pop(0, 32, over=103, frm=70)
    sun = c.layer("sun", [F(circle(742, 250, 92), "lime")], (742, 250))
    sun.pop(14, 30, over=110).breathe(4, 1)
    for k, (x, y, s_, amp) in enumerate(((250, 300, 200, 16), (812, 430, 150, -12))):
        cl = c.layer(f"cloud{k}", cloud(x, y, s_, "paper"), (x, y))
        cl.rise(22 + k * 6, 0, 34, dx=-60 if k == 0 else 60)
        cl.bob(amp, 1, phase=0.2 * k, axis="x")
    # the hexagon of the logo (thick rounded outline)
    hx = c.layer("hex", [S(rpoly(hex_pts(CX, 520, 318), 64), "g700", 34)], (CX, 520))
    hx.pop(4, 34, over=104, frm=80)
    # three towers (logo geometry), each rising from its slanted base
    left = _lp([(193, 352), (247, 322), (247, 490), (193, 460)])
    centre = _lp([(250, 270), (316, 222), (316, 524), (250, 490)])
    roof = _lp([(316, 206), (386, 248), (386, 272), (316, 232)])
    right = _lp([(366, 290), (432, 330), (432, 446), (366, 494)])
    def win(face, rows, col_l, col_r, lit):
        (x0, y0t), (x1, y1t), (x1b, y1b), (x0b, y0b) = face
        out = []
        for r_ in range(rows):
            f0 = 0.22 + r_ * (0.62 / rows)
            f1 = f0 + 0.62 / rows * 0.55
            def P(fx, fy):
                xt = x0 + (x1 - x0) * fx
                yt = y0t + (y1t - y0t) * fx
                yb = y0b + (y1b - y0b) * fx
                return (xt, yt + (yb - yt) * fy)
            out += [F(path([P(col_l, f0), P(col_r, f0), P(col_r, f1), P(col_l, f1)]), "lime" if r_ in lit else "g800")]
        return out
    specs = [
        ("tower-l", left, "g600", 3, {0, 2}, 10),
        ("tower-r", right, "g600", 3, {1}, 16),
        ("tower-c", centre, "g700", 4, {0, 1, 3}, 4),
    ]
    for nm, face, col, rows, lit, t0 in specs:
        base_y = max(p_[1] for p_ in face)
        parts = [F(path(face), col)] + win(face, rows, 0.28, 0.72, lit)
        T = c.layer(nm, parts, ((face[0][0] + face[1][0]) / 2, base_y))
        T.grow_y(t0, 36, 105)
    rf = c.layer("roof", [F(path(roof), "lime")], (roof[0][0], roof[0][1]))
    rf.pop(46, 22, over=120)
    rf.float(6, 1)
    for k, (x, s_) in enumerate(((150, 230), (880, 210))):
        pm = c.layer(f"palm{k}", palm(x, 900, s_), (x, 900))
        pm.pop(40 + k * 6, 26, over=106).sway(2.5, 1, phase=0.3 + 0.4 * k)
    sparkles(c, [(250, 470, 20, "lime"), (640, 150, 16, "lime")], 58)
    return c


SCENES = {
    "ob-1-residence": ob_1_residence,
    "ob-2-charges": ob_2_charges,
    "ob-3-incident": ob_3_incident,
    "ob-4-ag": ob_4_ag,
    "welcome-hero": welcome_hero,
}
