"""
Reusable drawn objects. Every function returns a list of parts (Lottie groups) in absolute
composition coordinates, painted back-to-front. Objects follow one visual grammar:

  • chunky flat forms with a solid "depth" side in the next darker tone (light from the top-left)
  • one lighter highlight per object, never a gradient
  • rounded corners everywhere (r ≈ 6–10 % of the object size)
  • lime is the accent (checks, coins, light), brand greens carry the objects, greige the paper
"""
from __future__ import annotations

import math

from kit import (
    F,
    S,
    arc,
    bez,
    circle,
    ellipse,
    path,
    rect,
    rect_xy,
    rpoly,
    sparkle_shape,
    wedge,
)


# ─── primitives ────────────────────────────────────────────────────────────────────────────────
def hex_pts(cx, cy, r, flat=False):
    a0 = 0 if flat else -90
    return [(cx + r * math.cos(math.radians(a0 + 60 * k)), cy + r * math.sin(math.radians(a0 + 60 * k))) for k in range(6)]


def hexagon(cx, cy, r, c, rr=None):
    return F(rpoly(hex_pts(cx, cy, r), rr if rr is not None else r * 0.16), c)


def block(x, y, w, h, r, face, side, depth):
    """Rounded slab with a solid bottom depth (extrusion)."""
    return [F(rect_xy(x, y + depth, w, h, r), side), F(rect_xy(x, y, w, h, r), face)]


def disc3d(cx, cy, r, face, side, depth):
    return [F(circle(cx, cy + depth, r), side), F(circle(cx, cy, r), face)]


def shadow(cx, cy, w, h=None, c="greige_d", a=1.0):
    return [F(ellipse(cx, cy, w, h or w * 0.12), c, a)]


def sparkle(cx, cy, r, c="lime"):
    return [F(sparkle_shape(cx, cy, r), c)]


def dot(cx, cy, r, c):
    return [F(circle(cx, cy, r), c)]


def bar(cx, cy, length, th, angle, c):
    """Rounded confetti bar."""
    a = math.radians(angle)
    dx, dy = math.cos(a) * length / 2, math.sin(a) * length / 2
    return [S(path([(cx - dx, cy - dy), (cx + dx, cy + dy)], False), c, th)]


def check_path(cx, cy, s):
    """Check mark path (open) centred on (cx, cy), size s = total width."""
    return path([(cx - s * 0.42, cy + s * 0.02), (cx - s * 0.12, cy + s * 0.3), (cx + s * 0.44, cy - s * 0.3)], False)


def check_stroke(cx, cy, s, c="g800", w=None):
    return [S(check_path(cx, cy, s), c, w or s * 0.17)]


def badge_disc(cx, cy, r, face="lime", ring="paper", ring_w=None):
    """Round badge (with a white ring so it separates from what it sits on)."""
    out = []
    if ring:
        out += [F(circle(cx, cy, r + (ring_w or r * 0.16)), ring)]
    out += [F(circle(cx, cy + r * 0.08, r), "lime_d"), F(circle(cx, cy, r), face)]
    return out


# ─── objects ───────────────────────────────────────────────────────────────────────────────────
def coin(cx, cy, r, edge=None):
    e = edge if edge is not None else r * 0.22
    return [
        F(circle(cx, cy + e, r), "lime_d"),
        F(rect(cx, cy + e / 2, r * 2, e, 0), "lime_d"),
        F(circle(cx, cy, r), "lime"),
        S(ellipse(cx, cy, r * 1.36, r * 1.36), "lime_d", r * 0.1),
        F(rpoly([(cx, cy - r * 0.36), (cx + r * 0.3, cy + r * 0.02), (cx + r * 0.12, cy + r * 0.02), (cx + r * 0.12, cy + r * 0.32), (cx - r * 0.12, cy + r * 0.32), (cx - r * 0.12, cy + r * 0.02), (cx - r * 0.3, cy + r * 0.02)], r * 0.05), "lime_d"),
    ]


def coin_side(cx, cy, w, h):
    """A coin seen edge-on in a stack (ellipse slab)."""
    return [
        F(ellipse(cx, cy + h * 0.45, w, h), "lime_d"),
        F(rect(cx, cy + h * 0.22, w, h * 0.45, 0), "lime_d"),
        F(ellipse(cx, cy, w, h), "lime"),
        S(ellipse(cx, cy, w * 0.7, h * 0.62), "lime_d", h * 0.08),
    ]


def card(cx, cy, w, h, face="g700", side="g900", depth=None, chip=True, stripe=True):
    d = depth if depth is not None else h * 0.08
    r = h * 0.12
    x, y = cx - w / 2, cy - h / 2
    out = block(x, y, w, h, r, face, side, d)
    if stripe:
        out += [F(rect_xy(x, y + h * 0.2, w, h * 0.16, 0), "g900")]
    if chip:
        out += [F(rect_xy(x + w * 0.1, y + h * 0.56, w * 0.17, h * 0.2, h * 0.05), "lime")]
        out += [F(rect_xy(x + w * 0.34, y + h * 0.62, w * 0.3, h * 0.08, h * 0.04), "g600")]
    return out


def paper(x, y, w, h, lines=3, c="paper", line_c="greige_d", r=None, side="greige_d", depth=None, first_c=None):
    r = r if r is not None else w * 0.07
    d = depth if depth is not None else w * 0.04
    out = block(x, y, w, h, r, c, side, d)
    pad = w * 0.14
    lh = max(6, h * 0.055)
    for k in range(lines):
        ly = y + h * 0.2 + k * h * 0.16
        lw = (w - 2 * pad) * (0.55 if k == 0 else (0.9 if k % 2 else 0.75))
        out += [F(rect_xy(x + pad, ly, lw, lh, lh / 2), first_c if (k == 0 and first_c) else line_c)]
    return out


def envelope_back(cx, cy, w, h, c="g800"):
    x, y = cx - w / 2, cy - h / 2
    return [F(rect_xy(x, y, w, h, w * 0.06), c)]


def envelope_front(cx, cy, w, h, face="g700", flap="g600", side="g900"):
    """Front pocket of an envelope (two side flaps + bottom), open at the top."""
    x, y = cx - w / 2, cy - h / 2
    r = w * 0.06
    d = h * 0.06
    return [
        F(rpoly([(x, y + h * 0.28), (cx, y + h * 0.66), (x + w, y + h * 0.28), (x + w, y + h + d), (x, y + h + d)], [r, r * 0.6, r, r, r]), side),
        F(rpoly([(x, y + h * 0.28), (cx, y + h * 0.66), (x + w, y + h * 0.28), (x + w, y + h), (x, y + h)], [r, r * 0.6, r, r, r]), face),
        F(rpoly([(x, y + h), (cx, y + h * 0.56), (x + w, y + h)], [r, r * 1.5, r]), flap),
    ]


def envelope_flap_closed(cx, cy, w, h, c="g600"):
    x, y = cx - w / 2, cy - h / 2
    return [F(rpoly([(x, y), (x + w, y), (cx, y + h * 0.56)], [w * 0.06, w * 0.06, w * 0.05]), c)]


def calendar(cx, cy, w, h, face="paper", head="g700", side="greige_dd", cells="greige", hl=None, rings=True):
    x, y = cx - w / 2, cy - h / 2
    r = w * 0.09
    d = w * 0.05
    out = [F(rect_xy(x, y + d, w, h, r), side), F(rect_xy(x, y, w, h, r), face)]
    hh = h * 0.24
    out += [F(rpoly([(x, y + hh), (x, y), (x + w, y), (x + w, y + hh)], [0, r, r, 0]), head)]
    cols, rows = 4, 3
    gx, gy = w * 0.12, y + hh + h * 0.1
    cw = (w - 2 * gx) / cols
    ch = (h - hh - h * 0.18) / rows
    for rr_ in range(rows):
        for cc in range(cols):
            col = cells
            if hl and (rr_, cc) in hl:
                col = hl[(rr_, cc)]
            out += [F(rect_xy(x + gx + cc * cw + cw * 0.12, gy + rr_ * ch + ch * 0.12, cw * 0.76, ch * 0.7, cw * 0.16), col)]
    if rings:
        for k in (0.28, 0.5, 0.72):
            out += [F(rect_xy(x + w * k - w * 0.03, y - h * 0.08, w * 0.06, h * 0.16, w * 0.03), "ink2")]
    return out


def clipboard(cx, cy, w, h, board="g700", side="g900", sheet="paper", clip="ink2"):
    x, y = cx - w / 2, cy - h / 2
    r = w * 0.08
    out = block(x, y, w, h, r, board, side, w * 0.05)
    out += [F(rect_xy(x + w * 0.09, y + h * 0.1, w * 0.82, h * 0.84, r * 0.6), sheet)]
    out += [F(rect_xy(cx - w * 0.22, y - h * 0.05, w * 0.44, h * 0.13, h * 0.04), clip)]
    out += [F(circle(cx, y - h * 0.045, w * 0.06), clip), F(circle(cx, y - h * 0.045, w * 0.025), sheet)]
    return out


def building(x, y, w, h, face="g700", side="g900", win="lime", win_off="g800", floors=4, cols=3, arch=True, lit=None, roof="g800", door="g900"):
    """Front facade of a residential block (with an arched door), its depth to the right."""
    d = w * 0.12
    out = [F(rpoly([(x + w, y + h * 0.04), (x + w + d, y + h * 0.04 - d * 0.5), (x + w + d, y + h - d * 0.5), (x + w, y + h)], 4), side)]
    out += [F(rpoly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], [w * 0.05, w * 0.05, 0, 0]), face)]
    out += [F(rect_xy(x - w * 0.03, y - h * 0.02, w * 1.06, h * 0.05, h * 0.02), roof)]
    gx = w * 0.14
    gw = (w - 2 * gx) / cols
    top = y + h * 0.1
    fh = (h * 0.7) / floors
    lit = lit or set()
    for f in range(floors):
        for c in range(cols):
            wx = x + gx + c * gw + gw * 0.18
            ww = gw * 0.64
            wy = top + f * fh + fh * 0.14
            wh = fh * 0.62
            col = win if lit == "all" or (f, c) in lit else win_off
            if arch:
                out += [F(rpoly([(wx, wy + wh), (wx, wy), (wx + ww, wy), (wx + ww, wy + wh)], [0, ww / 2, ww / 2, 0]), col)]
            else:
                out += [F(rect_xy(wx, wy, ww, wh, ww * 0.12), col)]
    dw = w * 0.22
    out += [F(rpoly([(x + w / 2 - dw / 2, y + h), (x + w / 2 - dw / 2, y + h * 0.84), (x + w / 2 + dw / 2, y + h * 0.84), (x + w / 2 + dw / 2, y + h)], [0, dw / 2, dw / 2, 0]), door)]
    return out


def window_cells(x, y, w, h, floors, cols, arch=True):
    """Just the window rectangles (for a 'lights' layer laid over a building)."""
    gx = w * 0.14
    gw = (w - 2 * gx) / cols
    top = y + h * 0.1
    fh = (h * 0.7) / floors
    cells = []
    for f in range(floors):
        for c in range(cols):
            wx = x + gx + c * gw + gw * 0.18
            ww = gw * 0.64
            wy = top + f * fh + fh * 0.14
            wh = fh * 0.62
            cells.append(((f, c), (wx, wy, ww, wh)))
    return cells


def arched_window(wx, wy, ww, wh, c):
    return [F(rpoly([(wx, wy + wh), (wx, wy), (wx + ww, wy), (wx + ww, wy + wh)], [0, ww / 2, ww / 2, 0]), c)]


def tower_iso(cx, base_y, w, h, roof_rise, left="g700", right="g900", top=None):
    """Logo-style isometric tower: two faces meeting at a front edge, a pitched cut on top."""
    hw = w / 2
    sk = w * 0.28
    out = [
        F(path([(cx - hw, base_y - h + sk), (cx, base_y - h + sk * 2 - roof_rise), (cx, base_y), (cx - hw, base_y - sk)]), left),
        F(path([(cx, base_y - h + sk * 2 - roof_rise), (cx + hw, base_y - h + sk), (cx + hw, base_y - sk), (cx, base_y)]), right),
    ]
    return out


def tree_round(cx, base_y, s, crown="g600", crown2="g700", trunk="g900"):
    return [
        F(rect_xy(cx - s * 0.06, base_y - s * 0.55, s * 0.12, s * 0.55, s * 0.05), trunk),
        F(circle(cx - s * 0.18, base_y - s * 0.68, s * 0.3), crown2),
        F(circle(cx + s * 0.16, base_y - s * 0.74, s * 0.32), crown),
        F(circle(cx - s * 0.02, base_y - s * 0.98, s * 0.3), crown),
    ]


def palm(cx, base_y, s, trunk="sand_d", leaf="g600", leaf2="g700"):
    out = [F(rpoly([(cx - s * 0.05, base_y), (cx - s * 0.03, base_y - s * 0.8), (cx + s * 0.05, base_y - s * 0.8), (cx + s * 0.06, base_y)], 4), trunk)]
    top = (cx + s * 0.01, base_y - s * 0.8)
    for ang, c, ln in ((-160, leaf2, 0.5), (-125, leaf, 0.55), (-55, leaf, 0.55), (-20, leaf2, 0.5), (-90, leaf, 0.42)):
        a = math.radians(ang)
        tip = (top[0] + math.cos(a) * s * ln, top[1] + math.sin(a) * s * ln + s * 0.12)
        mid = ((top[0] + tip[0]) / 2, (top[1] + tip[1]) / 2 - s * 0.1)
        nx, ny = -math.sin(a) * s * 0.09, math.cos(a) * s * 0.09
        out += [F(bez([(top[0], top[1]), (mid[0] + nx, mid[1] + ny, -s * 0.0, 0, 0, 0), (tip[0], tip[1]), (mid[0] - nx, mid[1] - ny)], True), c)]
    return out


def plant_pot(cx, base_y, s, pot="sand", pot_d="sand_d", leaf="g600", leaf2="g700"):
    out = []
    for ang, c, ln in ((-120, leaf2, 0.62), (-60, leaf, 0.66), (-92, leaf, 0.82), (-145, leaf, 0.5), (-35, leaf2, 0.5)):
        a = math.radians(ang)
        bx, by = cx, base_y - s * 0.32
        tip = (bx + math.cos(a) * s * ln, by + math.sin(a) * s * ln)
        nx, ny = -math.sin(a) * s * 0.11, math.cos(a) * s * 0.11
        mid = ((bx + tip[0]) / 2, (by + tip[1]) / 2)
        out += [F(bez([(bx, by), (mid[0] + nx, mid[1] + ny, -(tip[0] - bx) * 0.2, -(tip[1] - by) * 0.2, (tip[0] - bx) * 0.2, (tip[1] - by) * 0.2), (tip[0], tip[1]), (mid[0] - nx, mid[1] - ny, (tip[0] - bx) * 0.2, (tip[1] - by) * 0.2, -(tip[0] - bx) * 0.2, -(tip[1] - by) * 0.2)], True), c)]
    out += [F(rpoly([(cx - s * 0.24, base_y - s * 0.36), (cx + s * 0.24, base_y - s * 0.36), (cx + s * 0.18, base_y), (cx - s * 0.18, base_y)], s * 0.05), pot)]
    out += [F(rect_xy(cx - s * 0.27, base_y - s * 0.4, s * 0.54, s * 0.1, s * 0.04), pot_d)]
    return out


def cloud(cx, cy, s, c="paper"):
    return [
        F(rect_xy(cx - s * 0.5, cy - s * 0.02, s, s * 0.26, s * 0.13), c),
        F(circle(cx - s * 0.2, cy, s * 0.2), c),
        F(circle(cx + s * 0.08, cy - s * 0.08, s * 0.27), c),
        F(circle(cx + s * 0.32, cy + s * 0.04, s * 0.16), c),
    ]


def wrench(cx, cy, s, angle=-45, c="g700", hole="paper"):
    """Open-ended wrench along +x, rotated by `angle` around (cx, cy); s = total length.
    Jaw on the left end (opening outward), ring on the right end."""
    a = math.radians(angle)

    def R(x, y):
        return (cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a))

    th = s * 0.14
    hl = s * 0.5
    Rh = s * 0.17  # jaw head radius
    hx = -hl + Rh  # jaw head centre (local x)
    half = Rh * 0.36  # half width of the jaw slot
    depth = Rh * 1.1  # slot depth from the outer edge
    out = [F(rpoly([R(hx, -th / 2), R(hl - Rh * 0.8, -th / 2), R(hl - Rh * 0.8, th / 2), R(hx, th / 2)], th * 0.2), c)]
    # jaw head: circle outline from just below the slot round to just above it, then the slot
    th0 = math.degrees(math.asin(half / Rh))
    pts = []
    for n in _arc_local(hx, 0, Rh, 180 + th0, 540 - th0):
        x, y, ix, iy, ox, oy = n
        X, Y = R(x, y)
        rix, riy = ix * math.cos(a) - iy * math.sin(a), ix * math.sin(a) + iy * math.cos(a)
        rox, roy = ox * math.cos(a) - oy * math.sin(a), ox * math.sin(a) + oy * math.cos(a)
        pts.append((X, Y, rix, riy, rox, roy))
    for (x, y) in ((hx - Rh + depth, half), (hx - Rh + depth, -half)):
        X, Y = R(x, y)
        pts.append((X, Y))
    out += [F(bez(pts, True), c)]
    rx = hl - Rh * 0.85
    out += [F(circle(*R(rx, 0), Rh * 0.82), c), F(circle(*R(rx, 0), Rh * 0.36), hole)]
    return out


def _arc_local(cx, cy, r, a0, a1):
    from kit import _arc_pts

    return _arc_pts(cx, cy, r, r, a0, a1)


def drop(cx, cy, s, c="sage"):
    return [F(bez([(cx, cy - s * 0.62), (cx + s * 0.42, cy + s * 0.12, 0, -s * 0.3, 0, s * 0.24), (cx, cy + s * 0.5, s * 0.24, 0, -s * 0.24, 0), (cx - s * 0.42, cy + s * 0.12, 0, s * 0.24, 0, -s * 0.3)], True), c)]


def phone(cx, cy, w, h, body="ink", screen="paper", side="ink2"):
    x, y = cx - w / 2, cy - h / 2
    r = w * 0.16
    out = [F(rect_xy(x + w * 0.04, y + w * 0.05, w, h, r), side), F(rect_xy(x, y, w, h, r), body)]
    out += [F(rect_xy(x + w * 0.07, y + w * 0.07, w * 0.86, h - w * 0.14, r * 0.7), screen)]
    out += [F(rect_xy(cx - w * 0.14, y + w * 0.11, w * 0.28, w * 0.06, w * 0.03), body)]
    return out


def ballot_box(cx, cy, w, h, face="g700", top="g600", side="g900", slot="g950"):
    x, y = cx - w / 2, cy - h / 2
    lid = h * 0.18
    out = [F(rect_xy(x, y + lid * 0.6, w, h - lid * 0.6 + h * 0.06, w * 0.06), side)]
    out += [F(rect_xy(x, y + lid * 0.6, w, h - lid * 0.6, w * 0.06), face)]
    out += [F(rect_xy(x - w * 0.04, y, w * 1.08, lid, lid * 0.35), top)]
    out += [F(rect_xy(cx - w * 0.28, y + lid * 0.32, w * 0.56, lid * 0.36, lid * 0.18), slot)]
    return out


def ballot_box_front(cx, cy, w, h, face="g700", side="g900"):
    """Only the body of the box (so a ballot can drop behind its front)."""
    x, y = cx - w / 2, cy - h / 2
    lid = h * 0.18
    return [F(rect_xy(x, y + lid * 0.95 + h * 0.06, w, h - lid * 0.95, w * 0.06), side), F(rect_xy(x, y + lid * 0.95, w, h - lid * 0.95, w * 0.06), face)]


def ballot_box_lid(cx, cy, w, h, top="g600", slot="g950"):
    x, y = cx - w / 2, cy - h / 2
    lid = h * 0.18
    return [F(rect_xy(x - w * 0.04, y, w * 1.08, lid, lid * 0.35), top), F(rect_xy(cx - w * 0.28, y + lid * 0.32, w * 0.56, lid * 0.36, lid * 0.18), slot)]


def ballot(cx, cy, w, h, c="paper", mark="g700"):
    x, y = cx - w / 2, cy - h / 2
    return [F(rect_xy(x + w * 0.04, y + w * 0.05, w, h, w * 0.08), "greige_d"), F(rect_xy(x, y, w, h, w * 0.08), c), S(check_path(cx, cy, w * 0.5), mark, w * 0.1)]


def door(x, y, w, h, frame="g800", leaf="g700", knob="lime", open_frac=0.0, inside="ink2"):
    out = [F(rect_xy(x - w * 0.08, y - w * 0.08, w * 1.16, h + w * 0.08, w * 0.08), frame)]
    out += [F(rect_xy(x, y, w, h, w * 0.04), inside)]
    lw = w * (1 - open_frac * 0.55)
    skew = h * 0.05 * open_frac
    out += [F(rpoly([(x, y), (x + lw, y - skew), (x + lw, y + h + skew), (x, y + h)], w * 0.04), leaf)]
    out += [F(rect_xy(x + lw * 0.14, y + h * 0.1, lw * 0.72, h * 0.32, w * 0.05), "g600")]
    out += [F(rect_xy(x + lw * 0.14, y + h * 0.5, lw * 0.72, h * 0.36, w * 0.05), "g600")]
    out += [F(circle(x + lw * 0.84, y + h * 0.48, w * 0.055), knob)]
    return out


def suitcase(cx, cy, w, h, face="g700", side="g900", band="g800", handle="ink2"):
    x, y = cx - w / 2, cy - h / 2
    out = [S(rpoly([(cx - w * 0.2, y + 2), (cx - w * 0.2, y - h * 0.16), (cx + w * 0.2, y - h * 0.16), (cx + w * 0.2, y + 2)], w * 0.06, closed=False), handle, w * 0.07)]
    out += block(x, y, w, h, w * 0.14, face, side, w * 0.06)
    for k in (0.3, 0.7):
        out += [F(rect_xy(x + w * k - w * 0.045, y, w * 0.09, h, 0), band)]
    out += [F(circle(x + w * 0.2, y + h + w * 0.08, w * 0.07), "ink2"), F(circle(x + w * 0.8, y + h + w * 0.08, w * 0.07), "ink2")]
    return out


def tag(cx, cy, w, h, c="lime", side="lime_d", hole="paper"):
    """Luggage/key tag hanging from its top (cx, cy) = string attach point."""
    x, y = cx - w / 2, cy
    out = [F(rpoly([(cx, y), (x + w, y + h * 0.28), (x + w, y + h), (x, y + h), (x, y + h * 0.28)], [w * 0.12, w * 0.1, w * 0.12, w * 0.12, w * 0.1]), side)]
    out += [F(rpoly([(cx, y - h * 0.04), (x + w, y + h * 0.24), (x + w, y + h * 0.95), (x, y + h * 0.95), (x, y + h * 0.24)], [w * 0.12, w * 0.1, w * 0.12, w * 0.12, w * 0.1]), c)]
    out += [F(circle(cx, y + h * 0.2, w * 0.1), hole)]
    return out


def bell(cx, cy, s, c="sage", side="sage_d", clap="g800"):
    """Bell centred at its waist; s = height."""
    w = s * 0.86
    top = cy - s * 0.5
    out = [F(circle(cx, top - s * 0.02, s * 0.07), side)]
    body = bez(
        [
            (cx, top, -w * 0.3, 0, w * 0.3, 0),
            (cx + w * 0.34, cy + s * 0.08, 0, -s * 0.3, w * 0.02, s * 0.12),
            (cx + w * 0.52, cy + s * 0.3, 0, -s * 0.06, 0, 0),
            (cx - w * 0.52, cy + s * 0.3, 0, 0, 0, -s * 0.06),
            (cx - w * 0.34, cy + s * 0.08, -w * 0.02, s * 0.12, 0, -s * 0.3),
        ],
        True,
    )
    out += [F(body, c)]
    out += [F(rect_xy(cx - w * 0.56, cy + s * 0.26, w * 1.12, s * 0.1, s * 0.05), side)]
    return out


def bell_clapper(cx, cy, s, c="g800"):
    return [F(circle(cx, cy + s * 0.39, s * 0.075), c)]


def crescent(cx, cy, r, ox, oy, r2, c="lime"):
    """Crescent = circle (cx, cy, r) minus circle (cx+ox, cy+oy, r2), built from the two arcs."""
    from kit import _arc_pts

    d = math.hypot(ox, oy)
    a = (r * r - r2 * r2 + d * d) / (2 * d)
    h = math.sqrt(max(r * r - a * a, 0))
    ux, uy = ox / d, oy / d
    mx, my = cx + ux * a, cy + uy * a
    p1 = (mx - uy * h, my + ux * h)
    p2 = (mx + uy * h, my - ux * h)
    dirc = math.degrees(math.atan2(oy, ox))

    def ang(p, c0):
        return math.degrees(math.atan2(p[1] - c0[1], p[0] - c0[0]))

    def sweep(a0, a1, avoid, want_far):
        # choose the direction (a0→a1 increasing or decreasing) whose midpoint is far from / near `avoid`
        inc = (a1 - a0) % 360
        dec = inc - 360
        mid_inc = a0 + inc / 2
        mid_dec = a0 + dec / 2

        def dist(m):
            return abs(((m - avoid) + 180) % 360 - 180)

        pick_inc = dist(mid_inc) > dist(mid_dec) if want_far else dist(mid_inc) < dist(mid_dec)
        return (a0, a0 + inc) if pick_inc else (a0, a0 + dec)

    o0, o1 = sweep(ang(p1, (cx, cy)), ang(p2, (cx, cy)), dirc, True)
    c2 = (cx + ox, cy + oy)
    i0, i1 = sweep(ang(p2, c2), ang(p1, c2), dirc + 180, False)
    outer = _arc_pts(cx, cy, r, r, o0, o1)
    inner = _arc_pts(c2[0], c2[1], r2, r2, i0, i1)
    nodes = [tuple(n) for n in outer[:-1]] + [(outer[-1][0], outer[-1][1], outer[-1][2], outer[-1][3], inner[0][4], inner[0][5])] + [tuple(n) for n in inner[1:-1]]
    last = inner[-1]
    nodes[0] = (nodes[0][0], nodes[0][1], last[2], last[3], nodes[0][4], nodes[0][5])
    return [F(bez(nodes, True), c)]


def moon(cx, cy, r, c="lime"):
    return crescent(cx, cy, r, r * 0.55, -r * 0.42, r * 0.86, c)


def magnifier(cx, cy, r, ring="ink", glass="tint", handle="ink", angle=45):
    a = math.radians(angle)
    hx, hy = cx + math.cos(a) * r * 1.0, cy + math.sin(a) * r * 1.0
    ex, ey = cx + math.cos(a) * r * 1.9, cy + math.sin(a) * r * 1.9
    return [
        S(path([(hx, hy), (ex, ey)], False), handle, r * 0.36),
        F(circle(cx, cy, r * 1.08), ring),
        F(circle(cx, cy, r * 0.82), glass),
        S(arc(cx, cy, r * 0.58, 200, 255), "paper", r * 0.12),
    ]


def scales(cx, cy, s, post="g800", beam="g800", pan="lime", pan_d="lime_d"):
    """Static post of a pair of scales; beam & pans are separate (see scales_beam)."""
    return [
        F(rect_xy(cx - s * 0.035, cy - s * 0.38, s * 0.07, s * 0.74, s * 0.03), post),
        F(rpoly([(cx - s * 0.22, cy + s * 0.44), (cx - s * 0.12, cy + s * 0.34), (cx + s * 0.12, cy + s * 0.34), (cx + s * 0.22, cy + s * 0.44)], s * 0.03), post),
        F(circle(cx, cy - s * 0.4, s * 0.06), "lime"),
    ]


def scales_beam(cx, cy, s, c="g800"):
    return [F(rect_xy(cx - s * 0.42, cy - s * 0.38 - s * 0.025, s * 0.84, s * 0.05, s * 0.025), c)]


def scales_pan(px, py, s, cord="g800", pan="lime", pan_d="lime_d"):
    """Pan hanging from (px, py)."""
    return [
        S(path([(px, py), (px - s * 0.14, py + s * 0.3)], False), cord, s * 0.018),
        S(path([(px, py), (px + s * 0.14, py + s * 0.3)], False), cord, s * 0.018),
        F(wedge(px, py + s * 0.3, s * 0.17, 0, 180), pan_d),
        F(rect_xy(px - s * 0.18, py + s * 0.28, s * 0.36, s * 0.05, s * 0.025), pan),
    ]


def toolbox(cx, cy, w, h, face="g700", side="g900", lid="g600", handle="ink2", latch="lime"):
    x, y = cx - w / 2, cy - h / 2
    out = [S(rpoly([(cx - w * 0.2, y + 4), (cx - w * 0.2, y - h * 0.24), (cx + w * 0.2, y - h * 0.24), (cx + w * 0.2, y + 4)], w * 0.06, closed=False), handle, w * 0.06)]
    out += block(x, y, w, h, w * 0.07, face, side, w * 0.05)
    out += [F(rpoly([(x, y + h * 0.36), (x, y), (x + w, y), (x + w, y + h * 0.36)], [0, w * 0.07, w * 0.07, 0]), lid)]
    out += [F(rect_xy(x + w * 0.16, y + h * 0.28, w * 0.12, h * 0.18, w * 0.02), latch), F(rect_xy(x + w * 0.72, y + h * 0.28, w * 0.12, h * 0.18, w * 0.02), latch)]
    return out


def folder_back(cx, cy, w, h, c="sage_d"):
    x, y = cx - w / 2, cy - h / 2
    return [F(rpoly([(x, y + h), (x, y), (x + w * 0.36, y), (x + w * 0.44, y + h * 0.1), (x + w, y + h * 0.1), (x + w, y + h)], w * 0.05), c)]


def folder_front(cx, cy, w, h, c="sage", side="sage_d"):
    x, y = cx - w / 2, cy - h / 2
    return [
        F(rpoly([(x - w * 0.02, y + h * 0.3), (x + w * 1.02, y + h * 0.3), (x + w * 0.98, y + h + w * 0.04), (x + w * 0.02, y + h + w * 0.04)], w * 0.05), side),
        F(rpoly([(x - w * 0.02, y + h * 0.26), (x + w * 1.02, y + h * 0.26), (x + w * 0.98, y + h), (x + w * 0.02, y + h)], w * 0.05), c),
    ]


def podium(cx, base_y, w, h, face="greige", side="greige_dd", top="g700"):
    x = cx - w / 2
    y = base_y - h
    out = [F(rpoly([(x + w * 0.1, y + h * 0.16), (x + w * 0.9, y + h * 0.16), (x + w, base_y), (x, base_y)], w * 0.04), side)]
    out += [F(rpoly([(x + w * 0.1, y + h * 0.16), (x + w * 0.88, y + h * 0.16), (x + w * 0.94, base_y), (x + w * 0.04, base_y)], w * 0.04), face)]
    out += [F(rect_xy(x - w * 0.04, y, w * 1.08, h * 0.17, h * 0.05), top)]
    out += [F(rect_xy(cx - w * 0.14, y + h * 0.36, w * 0.28, w * 0.28, w * 0.06), "g700")]
    out += [F(rpoly(hex_pts(cx, y + h * 0.36 + w * 0.14, w * 0.09), w * 0.02), "lime")]
    return out


def mic(cx, base_y, s, c="ink2", head="ink"):
    return [
        S(bez([(cx, base_y), (cx + s * 0.08, base_y - s * 0.5, -s * 0.02, s * 0.2, s * 0.02, -s * 0.2), (cx + s * 0.26, base_y - s * 0.86, -s * 0.06, s * 0.12, 0, 0)], False), c, s * 0.05),
        F(rpoly([(cx + s * 0.18, base_y - s * 0.84), (cx + s * 0.34, base_y - s * 1.02), (cx + s * 0.42, base_y - s * 0.94), (cx + s * 0.26, base_y - s * 0.76)], s * 0.05), head),
    ]


def board(cx, cy, w, h, frame="g700", side="g900", cork="sand"):
    x, y = cx - w / 2, cy - h / 2
    out = block(x, y, w, h, w * 0.05, frame, side, w * 0.035)
    out += [F(rect_xy(x + w * 0.06, y + w * 0.06, w * 0.88, h - w * 0.12, w * 0.025), cork)]
    return out


def pin(cx, cy, r, c="lime", c2="lime_d"):
    return [F(circle(cx, cy + r * 0.2, r), c2), F(circle(cx, cy, r), c)]


def map_pin(cx, tip_y, s, c="lime", side="lime_d", hole="g700"):
    """Map pin whose tip touches (cx, tip_y); s = height."""
    r = s * 0.36
    cy = tip_y - s + r
    body = bez([(cx, tip_y), (cx - r, cy, s * 0.06, s * 0.28, 0, -r * K), (cx, cy - r, -r * K, 0, r * K, 0), (cx + r, cy, 0, -r * K, s * -0.06, s * 0.28)], True)
    return [F(body, c), F(circle(cx, cy, r * 0.42), hole)]


K = 0.5523


def car_top(cx, cy, w, h, body="g700", roof="g600", glass="ink2"):
    x, y = cx - w / 2, cy - h / 2
    return [
        F(rect_xy(x - w * 0.04, y + h * 0.14, w * 0.08, h * 0.16, w * 0.03), "ink2"),
        F(rect_xy(x + w * 0.96, y + h * 0.14, w * 0.08, h * 0.16, w * 0.03), "ink2"),
        F(rect_xy(x - w * 0.04, y + h * 0.7, w * 0.08, h * 0.16, w * 0.03), "ink2"),
        F(rect_xy(x + w * 0.96, y + h * 0.7, w * 0.08, h * 0.16, w * 0.03), "ink2"),
        F(rect_xy(x, y, w, h, w * 0.32), body),
        F(rect_xy(x + w * 0.12, y + h * 0.2, w * 0.76, h * 0.2, w * 0.1), glass),
        F(rect_xy(x + w * 0.12, y + h * 0.66, w * 0.76, h * 0.14, w * 0.08), glass),
        F(rect_xy(x + w * 0.14, y + h * 0.42, w * 0.72, h * 0.22, w * 0.06), roof),
        F(rect_xy(x + w * 0.08, y + h * 0.02, w * 0.16, h * 0.05, w * 0.03), "lime"),
        F(rect_xy(x + w * 0.76, y + h * 0.02, w * 0.16, h * 0.05, w * 0.03), "lime"),
    ]


def broom(cx, cy, s, stick="sand_d", head="g700", bristle="lime"):
    """Upright broom; (cx, cy) = middle of the stick; s = total height."""
    top = cy - s * 0.5
    bot = cy + s * 0.5
    return [
        S(path([(cx, top), (cx, bot - s * 0.28)], False), stick, s * 0.045),
        F(rpoly([(cx - s * 0.2, bot), (cx - s * 0.12, bot - s * 0.24), (cx + s * 0.12, bot - s * 0.24), (cx + s * 0.2, bot)], [s * 0.03, s * 0.02, s * 0.02, s * 0.03]), bristle),
        F(rect_xy(cx - s * 0.12, bot - s * 0.31, s * 0.24, s * 0.09, s * 0.03), head),
    ]


def cap(cx, cy, s, crown="g700", brim="g800", btn="lime"):
    return [
        F(rpoly([(cx - s * 0.05, cy + s * 0.04), (cx + s * 0.62, cy + s * 0.04), (cx + s * 0.62, cy + s * 0.15), (cx - s * 0.05, cy + s * 0.15)], s * 0.05), brim),
        F(wedge(cx - s * 0.1, cy + s * 0.08, s * 0.36, 180, 360), crown),
        F(circle(cx - s * 0.1, cy - s * 0.28, s * 0.05), btn),
    ]


def id_badge(cx, cy, w, h, c="paper", side="greige_d", strap="g700"):
    x, y = cx - w / 2, cy - h / 2
    out = [S(path([(cx - w * 0.3, y + h * 0.02), (cx - w * 0.06, y - h * 0.55), (cx + w * 0.06, y - h * 0.55), (cx + w * 0.3, y + h * 0.02)], False), strap, w * 0.1)]
    out += [F(rect_xy(cx - w * 0.14, y - h * 0.06, w * 0.28, h * 0.12, w * 0.04), "ink2")]
    out += block(x, y, w, h, w * 0.1, c, side, w * 0.05)
    out += [F(circle(cx, y + h * 0.36, w * 0.18), "sage"), F(rect_xy(x + w * 0.2, y + h * 0.66, w * 0.6, h * 0.08, h * 0.04), "greige_d"), F(rect_xy(x + w * 0.28, y + h * 0.8, w * 0.44, h * 0.07, h * 0.035), "greige_d")]
    return out


def ring_float(cx, cy, r, c="lime", c2="paper", side="lime_d"):
    """Pool float (torus seen from the front, slightly from above)."""
    out = [F(ellipse(cx, cy + r * 0.16, r * 2, r * 1.3), side)]
    out += [F(ellipse(cx, cy, r * 2, r * 1.3), c)]
    for a0 in (20, 110, 200, 290):
        out += [F(wedge(cx, cy, r, a0, a0 + 34, r * 0.45), c2)]
    out += [F(ellipse(cx, cy + r * 0.04, r * 0.84, r * 0.48), "g800")]
    return out


def plug(cx, cy, s, c="ink2", pins="greige_dd", flip=False):
    """Plug body pointing right (or left if flip) with its cable."""
    sgn = -1 if flip else 1
    out = [S(path([(cx - sgn * s * 1.1, cy), (cx - sgn * s * 0.3, cy)], False), c, s * 0.12)]
    out += [F(rect(cx, cy, s * 0.62, s * 0.5, s * 0.12), c)]
    if not flip:
        out += [F(rect(cx + s * 0.42, cy - s * 0.12, s * 0.26, s * 0.07, s * 0.03), pins), F(rect(cx + s * 0.42, cy + s * 0.12, s * 0.26, s * 0.07, s * 0.03), pins)]
    else:
        out += [F(rect(cx - s * 0.36, cy, s * 0.12, s * 0.38, s * 0.04), c)]
        out += [F(circle(cx - s * 0.41, cy - s * 0.1, s * 0.035), "ink"), F(circle(cx - s * 0.41, cy + s * 0.1, s * 0.035), "ink")]
    return out


def megaphone(cx, cy, s, body="lime", side="lime_d", mouth="g800", handle="lime_d"):
    """Megaphone pointing right; (cx, cy) centre of the cone."""
    return [
        F(rpoly([(cx - s * 0.2, cy + s * 0.12), (cx - s * 0.08, cy + s * 0.12), (cx - s * 0.02, cy + s * 0.42), (cx - s * 0.16, cy + s * 0.42)], s * 0.04), handle),
        F(rpoly([(cx - s * 0.5, cy - s * 0.12), (cx + s * 0.34, cy - s * 0.38), (cx + s * 0.34, cy + s * 0.38), (cx - s * 0.5, cy + s * 0.12)], [s * 0.05, s * 0.04, s * 0.04, s * 0.05]), body),
        F(rect(cx - s * 0.55, cy, s * 0.14, s * 0.3, s * 0.05), side),
        F(ellipse(cx + s * 0.34, cy, s * 0.2, s * 0.76), side),
        F(ellipse(cx + s * 0.36, cy, s * 0.13, s * 0.62), mouth),
        F(rect(cx - s * 0.12, cy, s * 0.06, s * 0.2, s * 0.02), side),
    ]


def shield(cx, cy, s, face="lime", side="lime_d"):
    def sh(dy):
        return bez(
            [
                (cx, cy - s * 0.5 + dy, 0, 0, s * 0.2, s * 0.08),
                (cx + s * 0.4, cy - s * 0.36 + dy, 0, 0, 0, 0),
                (cx + s * 0.4, cy - s * 0.02 + dy, 0, 0, 0, s * 0.28),
                (cx, cy + s * 0.5 + dy, s * 0.26, -s * 0.12, -s * 0.26, -s * 0.12),
                (cx - s * 0.4, cy - s * 0.02 + dy, 0, s * 0.28, 0, 0),
                (cx - s * 0.4, cy - s * 0.36 + dy, 0, 0, 0, 0),
                (cx, cy - s * 0.5 + dy, -s * 0.2, s * 0.08, 0, 0),
            ],
            True,
        )

    return [F(sh(s * 0.05), side), F(sh(0), face)]


def keyhole(cx, cy, s, c="g800"):
    return [F(circle(cx, cy - s * 0.12, s * 0.12), c), F(rpoly([(cx - s * 0.06, cy - s * 0.1), (cx + s * 0.06, cy - s * 0.1), (cx + s * 0.1, cy + s * 0.2), (cx - s * 0.1, cy + s * 0.2)], s * 0.03), c)]


def key(cx, cy, s, angle=0, c="paper", hole=None):
    """Key: bow centred at (cx, cy), blade along +x rotated by angle."""
    a = math.radians(angle)

    def R(x, y):
        return (cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a))

    out = [
        F(rpoly([R(s * 0.1, -s * 0.06), R(s * 0.95, -s * 0.06), R(s * 0.95, s * 0.06), R(s * 0.1, s * 0.06)], s * 0.03), c),
        F(rpoly([R(s * 0.62, s * 0.04), R(s * 0.72, s * 0.04), R(s * 0.72, s * 0.2), R(s * 0.62, s * 0.2)], s * 0.02), c),
        F(rpoly([R(s * 0.8, s * 0.04), R(s * 0.9, s * 0.04), R(s * 0.9, s * 0.16), R(s * 0.8, s * 0.16)], s * 0.02), c),
        F(circle(cx, cy, s * 0.24), c),
    ]
    if hole:
        out += [F(circle(cx, cy, s * 0.1), hole)]
    return out


def pie(cx, cy, r, slices, gap=0):
    """slices: [(a0, a1, colour)]."""
    return [F(wedge(cx, cy, r, a0 + gap, a1 - gap), c) for a0, a1, c in slices]


def bulb(cx, cy, s, glass="lime", base="g800"):
    return [F(circle(cx, cy - s * 0.12, s * 0.34), glass), F(rpoly([(cx - s * 0.2, cy + s * 0.08), (cx + s * 0.2, cy + s * 0.08), (cx + s * 0.14, cy + s * 0.3), (cx - s * 0.14, cy + s * 0.3)], s * 0.04), glass), F(rect_xy(cx - s * 0.14, cy + s * 0.3, s * 0.28, s * 0.16, s * 0.04), base)]


def chevron_up(cx, cy, w, th, c):
    """Single upward chevron (stroke)."""
    return [S(path([(cx - w / 2, cy + w * 0.28), (cx, cy - w * 0.22), (cx + w / 2, cy + w * 0.28)], False), c, th)]


def plus(cx, cy, s, c, th=None):
    t = th or s * 0.3
    return [F(rect(cx, cy, s, t, t / 2), c), F(rect(cx, cy, t, s, t / 2), c)]


def bars_chart(x, base_y, w, heights, c="lime", side="lime_d", gap=0.28):
    n = len(heights)
    bw = w / (n + (n - 1) * gap)
    out = []
    for k, h in enumerate(heights):
        bx = x + k * bw * (1 + gap)
        out += [F(rect_xy(bx, base_y - h, bw, h, bw * 0.14), c)]
    return out
