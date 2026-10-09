"""Success screens (ok-*): a sage halo, the object that was just completed, a lime check badge
that draws itself, and a calm confetti burst. Idle: the object floats, confetti twinkles."""
from __future__ import annotations

import math

from kit import Comp, F, S, circle, ellipse, path, rpoly
from objects import (
    ballot,
    ballot_box_front,
    ballot_box_lid,
    badge_disc,
    calendar,
    card,
    check_path,
    check_stroke,
    clipboard,
    coin,
    door,
    dot,
    envelope_back,
    envelope_front,
    hex_pts,
    hexagon,
    paper,
    ring_float,
    shadow,
    sparkle,
    tag,
    toolbox,
    wrench,
    building,
    bar,
)

CX, CY = 512, 500

CONFETTI = [
    # (angle°, radius, kind, colour, size)
    (-150, 360, "dot", "lime", 14),
    (-118, 330, "bar", "sage", 30),
    (-82, 372, "spark", "lime", 26),
    (-48, 338, "dot", "g700", 10),
    (-14, 368, "bar", "lime", 30),
    (22, 352, "dot", "sage", 14),
    (56, 372, "spark", "lime", 20),
    (128, 362, "bar", "sage", 26),
    (160, 340, "dot", "lime", 12),
    (196, 372, "spark", "g700", 16),
]


def halo(c: Comp, r=330):
    h = c.layer("halo", [F(circle(CX, CY, r + 40), "wash"), F(circle(CX, CY, r), "tint")], (CX, CY))
    h.pop(0, 30, over=103, frm=60).breathe(2)
    return h


def confetti(c: Comp, t0=30, skip=()):
    for k, (ang, rad, kind, col, size) in enumerate(CONFETTI):
        if k in skip:
            continue
        a = math.radians(ang)
        x, y = CX + math.cos(a) * rad, CY + math.sin(a) * rad
        if kind == "dot":
            parts = dot(x, y, size, col)
        elif kind == "bar":
            parts = bar(x, y, size, size * 0.42, ang + 90, col)
        else:
            parts = sparkle(x, y, size, col)
        L = c.layer(f"confetti{k}", parts, (x, y))
        L.burst(t0 + (k % 4) * 2, math.cos(a) * rad * 0.55, math.sin(a) * rad * 0.55, 30)
        if kind == "spark":
            L.twinkle(50, 1, phase=k * 0.13)
        else:
            L.float(6, 1, phase=(k * 0.17) % 1)


def check_badge(c: Comp, x, y, r, t0, parent=None):
    b = c.layer("badge", badge_disc(x, y, r), (x, y), parent)
    b.pop(t0, 22, over=114)
    k = c.layer("check", check_stroke(x, y, r * 1.05, "g800", r * 0.24), (x, y), b)
    k.draw(t0 + 10, 20)
    return b


def ground(c: Comp, y=842, w=330):
    g = c.layer("shadow", shadow(CX, y, w, 34, "mint"), (CX, y))
    g.pop(4, 26, over=102, frm=40).breathe(-5)
    return g


# ── ok-general ────────────────────────────────────────────────────────────────────────────────
def ok_general():
    c = Comp("ok-general")
    halo(c)
    ground(c, 800, 300)
    hx = c.layer(
        "hex",
        [F(rpoly(hex_pts(CX, CY + 26, 214), 40), "g900"), F(rpoly(hex_pts(CX, CY, 214), 40), "g700"), S(rpoly(hex_pts(CX, CY, 168), 26), "g600", 14)],
        (CX, CY),
    )
    hx.pop(8, 30, over=110).float(10)
    k = c.layer("check", [S(check_path(CX, CY + 4, 210), "lime", 46)], (CX, CY), hx)
    k.draw(28, 24)
    confetti(c, 34)
    return c


# ── ok-paiement ───────────────────────────────────────────────────────────────────────────────
def ok_paiement():
    c = Comp("ok-paiement")
    halo(c)
    ground(c, 806, 320)
    cd = c.layer("card", card(CX - 10, CY + 40, 420, 270), (CX, CY + 40))
    cd.rise(6, 90, 32).float(8)
    cd.swing_in(6, -10, 40)
    for k, (dx, dy, r, t) in enumerate(((-150, -205, 46, 26), (-30, -262, 40, 32), (96, -228, 34, 38))):
        L = c.layer(f"coin{k}", coin(CX + dx, CY + dy, r), (CX + dx, CY + dy))
        L.rise(t, 150, 30).float(10, 1, phase=0.2 * k + 0.1)
    check_badge(c, CX + 178, CY + 128, 68, 30, cd)
    confetti(c, 40, skip=(2, 3, 4))
    return c


# ── ok-incident ───────────────────────────────────────────────────────────────────────────────
def ok_incident():
    c = Comp("ok-incident")
    halo(c)
    ground(c, 820, 360)
    tb = c.layer("toolbox", toolbox(CX + 150, CY + 230, 210, 130), (CX + 150, CY + 300))
    tb.rise(14, 60, 28).float(4, 1, phase=0.4)
    cb = c.layer("clipboard", clipboard(CX - 40, CY + 10, 330, 420), (CX - 40, CY + 220))
    cb.rise(4, 100, 32).float(8)
    lines = c.layer("lines", [F(rpoly([(CX - 160, CY - 90 + k * 64), (CX - 160 + w, CY - 90 + k * 64), (CX - 160 + w, CY - 74 + k * 64), (CX - 160, CY - 74 + k * 64)], 8), "greige_d") for k, w in enumerate((150, 220, 190, 120))], (CX - 40, CY), cb)
    lines.fade(18, 12)
    wr = c.layer("wrench", wrench(CX - 30, CY + 70, 330, -38, "g700", "paper"), (CX - 30, CY + 70), cb)
    wr.swing_in(20, 40, 34)
    check_badge(c, CX + 120, CY - 150, 64, 32, cb)
    confetti(c, 40, skip=(3, 4))
    return c


# ── ok-invitation ─────────────────────────────────────────────────────────────────────────────
def ok_invitation():
    c = Comp("ok-invitation")
    halo(c)
    ground(c, 806, 340)
    ew, eh = 420, 290
    ey = CY + 120
    back = c.layer("env-back", envelope_back(CX, ey, ew, eh), (CX, ey))
    back.rise(4, 80, 30).float(8)
    inv = c.layer(
        "card",
        paper(CX - 150, ey - 250, 300, 280, 0, "paper", depth=0)
        + building(CX - 70, ey - 196, 140, 150, floors=2, cols=2, lit="all")
        + [F(rpoly([(CX - 90, ey - 46), (CX + 90, ey - 46), (CX + 90, ey - 34), (CX - 90, ey - 34)], 6), "greige_d")],
        (CX, ey - 100),
        back,
    )
    inv.rise(16, 170, 34, fade=False)
    inv.key("o", 16, 0, "linear").key("o", 22, 100, "linear")
    front = c.layer("env-front", envelope_front(CX, ey, ew, eh), (CX, ey), back)
    check_badge(c, CX + 180, CY - 120, 64, 36, back)
    confetti(c, 44, skip=(3,))
    return c


# ── ok-reservation ────────────────────────────────────────────────────────────────────────────
def ok_reservation():
    c = Comp("ok-reservation")
    halo(c)
    ground(c, 820, 360)
    cal = c.layer("calendar", calendar(CX - 50, CY + 0, 370, 350, hl={(1, 2): "g700"}), (CX - 50, CY + 175))
    cal.rise(4, 90, 32).float(8)
    fl = c.layer("float", ring_float(CX + 190, CY + 250, 78), (CX + 190, CY + 250))
    fl.pop(20, 26, over=112).float(12, 1, phase=0.35)
    fl.sway(4, 1, phase=0.2)
    check_badge(c, CX + 120, CY - 150, 62, 30, cal)
    confetti(c, 40, skip=(4, 5))
    return c


# ── ok-visiteur ───────────────────────────────────────────────────────────────────────────────
def ok_visiteur():
    c = Comp("ok-visiteur")
    halo(c)
    ground(c, 818, 340)
    dw, dh = 240, 420
    dx, dy = CX - dw / 2 - 20, CY - dh / 2 + 70
    fr = c.layer("door", [F(rpoly([(dx - 22, dy - 22), (dx + dw + 22, dy - 22), (dx + dw + 22, dy + dh), (dx - 22, dy + dh)], 18), "g800"), F(rpoly([(dx, dy), (dx + dw, dy), (dx + dw, dy + dh), (dx, dy + dh)], 8), "ink2")], (CX, dy + dh))
    fr.rise(4, 70, 30)
    leaf = c.layer("leaf", [F(rpoly([(dx, dy), (dx + dw, dy), (dx + dw, dy + dh), (dx, dy + dh)], 10), "g700"), F(rpoly([(dx + 30, dy + 40), (dx + dw - 30, dy + 40), (dx + dw - 30, dy + 170), (dx + 30, dy + 170)], 14), "g600"), F(rpoly([(dx + 30, dy + 210), (dx + dw - 30, dy + 210), (dx + dw - 30, dy + dh - 40), (dx + 30, dy + dh - 40)], 14), "g600"), F(circle(dx + dw - 34, dy + dh * 0.48, 14), "lime")], (dx, dy + dh / 2), fr)
    # the door opens a little: scale x around the hinge
    leaf.key("s", 22, [100, 100], "inout").key("s", 42, [62, 100], "out").key("s", 72, [70, 100], "inout")
    t = c.layer("tag", tag(dx + dw - 34, dy + dh * 0.48 + 6, 80, 110), (dx + dw - 34, dy + dh * 0.48 + 6), fr)
    t.swing_in(26, 30, 40).sway(5, 1, phase=0.1)
    check_badge(c, CX + 150, CY - 150, 62, 34, fr)
    confetti(c, 40, skip=(4, 5))
    return c


# ── ok-vote ───────────────────────────────────────────────────────────────────────────────────
def ok_vote():
    c = Comp("ok-vote")
    halo(c)
    ground(c, 830, 380)
    bw, bh = 360, 320
    by = CY + 150
    box_back = c.layer("box-lid", ballot_box_lid(CX, by, bw, bh), (CX, by + bh / 2))
    box_back.rise(4, 60, 28).float(6)
    bal = c.layer("ballot", ballot(CX, by - 130, 150, 190), (CX, by - 130), box_back)
    bal.key("p", 14, [CX, by - 330, 0][:2], "out").key("p", 34, [CX, by - 130], "inout")
    bal.key("p", 44, [CX, by - 130], "in").key("p", 60, [CX, by - 100], "out")
    bal.fade(14, 8)
    bal.key("r", 14, -12, "out").key("r", 34, 0, "inout")
    front = c.layer("box", ballot_box_front(CX, by, bw, bh), (CX, by + bh / 2), box_back)
    hexmark = c.layer("mark", [F(rpoly(hex_pts(CX, by + 60, 46), 10), "lime")], (CX, by + 60), box_back)
    hexmark.pop(56, 18, over=118)
    check_badge(c, CX + 170, CY - 150, 60, 44)
    confetti(c, 52, skip=(3, 4))
    return c


SCENES = {
    "ok-general": ok_general,
    "ok-paiement": ok_paiement,
    "ok-incident": ok_incident,
    "ok-invitation": ok_invitation,
    "ok-reservation": ok_reservation,
    "ok-visiteur": ok_visiteur,
    "ok-vote": ok_vote,
}
