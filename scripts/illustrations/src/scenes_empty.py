"""Empty states (empty-*) and offline: a calm tinted stage, one object that says what the list
will hold, two or three lime sparkles. Intro: the object settles in (≈1 s). Idle: one gentle
movement that suits the object (a tag swings, a bell rocks, a magnifier searches)."""
from __future__ import annotations

import math

from kit import Comp, F, S, arc, circle, ellipse, path, rect, rect_xy, rot, rpoly
from objects import (
    ballot,
    bell,
    bell_clapper,
    block,
    board,
    broom,
    building,
    calendar,
    cap,
    car_top,
    check_path,
    clipboard,
    cloud,
    coin,
    door,
    drop,
    folder_back,
    folder_front,
    hex_pts,
    id_badge,
    magnifier,
    map_pin,
    mic,
    moon,
    paper,
    pin,
    plant_pot,
    plug,
    plus,
    podium,
    ring_float,
    scales,
    scales_beam,
    scales_pan,
    shadow,
    sparkle,
    suitcase,
    tag,
    toolbox,
    window_cells,
    arched_window,
    wrench,
)

CX, CY = 512, 512


def stage(c: Comp, shadow_y=812, shadow_w=380, r=318):
    s = c.layer("stage", [F(circle(CX, CY, r), "tint")], (CX, CY))
    s.pop(0, 30, over=103, frm=70)
    g = c.layer("shadow", shadow(CX, shadow_y, shadow_w, 36, "mint"), (CX, shadow_y))
    g.pop(6, 26, over=102, frm=40)
    return s, g


def sparkles(c: Comp, spots, t0=40):
    for k, (x, y, r, col) in enumerate(spots):
        L = c.layer(f"sparkle{k}", sparkle(x, y, r, col), (x, y))
        L.pop(t0 + k * 6, 20, over=130)
        L.twinkle(45, 1, phase=0.15 + k * 0.31)


SPARKS = [(250, 300, 26, "lime"), (790, 250, 20, "lime"), (812, 640, 16, "g600")]


# ── empty-ag : a lectern waiting for its meeting ──────────────────────────────────────────────
def empty_ag():
    c = Comp("empty-ag")
    stage(c, 812, 400)
    pd = c.layer("podium", podium(CX - 20, 812, 300, 330), (CX - 20, 812))
    pd.rise(4, 80, 30)
    m = c.layer("mic", mic(CX + 20, 482, 170), (CX + 20, 482), pd)
    m.swing_in(18, -25, 32)
    for k in range(3):
        r = 70 + k * 46
        w = c.layer(f"wave{k}", [S(arc(CX + 92, 330, r, -70, 10), "g600", 16)], (CX + 92, 330))
        w.fade(34 + k * 6, 12)
        w.blink(15, 1, phase=k * 0.18)
    chair = c.layer("ballots", ballot(CX + 210, 720, 120, 150) , (CX + 210, 790))
    chair.rise(24, 50, 26)
    sparkles(c, [(240, 310, 24, "lime"), (300, 220, 14, "g600")])
    return c


# ── empty-annonces : a notice board with pinned notes ─────────────────────────────────────────
def empty_annonces():
    c = Comp("empty-annonces")
    stage(c, 800, 420)
    bd = c.layer("board", board(CX, 490, 560, 400), (CX, 690))
    bd.rise(4, 70, 30)
    n1 = c.layer("note1", rot(paper(310, 360, 210, 250, 4, depth=8, first_c="g700"), -4, (415, 372)) + pin(415, 372, 18), (415, 372), bd)
    n1.drop(18, -60, 28, 8).sway(2.2, 1)
    n2 = c.layer("note2", rot(paper(560, 340, 170, 170, 2, "lime", "lime_d", side="lime_d", depth=8), 5, (645, 352)) + pin(645, 352, 16, "g700", "g900"), (645, 352), bd)
    n2.drop(26, -60, 28, 8).sway(2.6, 1, phase=0.4)
    n3 = c.layer("note3", rot(paper(560, 540, 200, 110, 2, depth=6), -2, (660, 552)) + pin(660, 552, 14), (660, 552), bd)
    n3.drop(34, -50, 26, 6).sway(1.6, 1, phase=0.7)
    sparkles(c, [(220, 250, 26, "lime"), (830, 300, 18, "lime")])
    return c


# ── empty-appels : an empty tray, a call for funds about to land ──────────────────────────────
def empty_appels():
    c = Comp("empty-appels")
    stage(c, 806, 440)
    tx, ty, tw, th = CX - 250, 600, 500, 170
    back = c.layer("tray-back", [F(rpoly([(tx + 30, ty), (tx + tw - 30, ty), (tx + tw, ty + th), (tx, ty + th)], 26), "sage_d")], (CX, ty + th))
    back.rise(4, 60, 28)
    p1 = c.layer("bill", paper(CX - 140, 330, 280, 340, 4, first_c="g700") + coin(CX + 60, 560, 46), (CX, 500), back)
    p1.rise(16, -40, 30).float(10)
    front = c.layer(
        "tray-front",
        [
            F(rpoly([(tx - 10, ty + 60), (tx + tw + 10, ty + 60), (tx + tw - 10, ty + th + 18), (tx + 10, ty + th + 18)], 26), "g900"),
            F(rpoly([(tx - 10, ty + 50), (tx + tw + 10, ty + 50), (tx + tw - 10, ty + th), (tx + 10, ty + th)], 26), "g700"),
            F(rect_xy(CX - 70, ty + 92, 140, 20, 10), "g600"),
        ],
        (CX, ty + th),
        back,
    )
    sparkles(c, SPARKS[:2])
    return c


# ── empty-documents : a folder with papers peeking out ────────────────────────────────────────
def empty_documents():
    c = Comp("empty-documents")
    stage(c, 806, 440)
    fw, fh = 500, 380
    fy = 540
    fb = c.layer("folder-back", folder_back(CX, fy, fw, fh), (CX, fy + fh / 2))
    fb.rise(4, 70, 30)
    p1 = c.layer("paper1", paper(CX - 190, fy - 230, 250, 300, 4, first_c="g700"), (CX - 65, fy - 80), fb)
    p1.rise(18, 160, 30, fade=False).float(10, 1, phase=0.1)
    p2 = c.layer("paper2", rot(paper(CX - 30, fy - 200, 220, 270, 3, "lime_l", "lime_d", side="lime_d"), 6, (CX + 80, fy - 60)), (CX + 80, fy - 60), fb)
    p2.rise(24, 160, 30, fade=False).float(8, 1, phase=0.45)
    ff = c.layer("folder-front", folder_front(CX, fy, fw, fh), (CX, fy + fh / 2), fb)
    sparkles(c, [(250, 270, 24, "lime"), (790, 300, 18, "lime")])
    return c


# ── empty-incidents : a toolbox at rest ───────────────────────────────────────────────────────
def empty_incidents():
    c = Comp("empty-incidents")
    stage(c, 808, 440)
    tb = c.layer("toolbox", toolbox(CX, 640, 440, 270), (CX, 790))
    tb.rise(4, 80, 30)
    wr = c.layer("wrench", wrench(CX + 10, 440, 360, -14, "sage_d", "tint"), (CX + 10, 470), tb)
    wr.swing_in(20, -30, 34).sway(3, 1)
    dp = c.layer("drop", drop(290, 360, 70, "sage"), (290, 360))
    dp.drop(30, -90, 26, 8).bob(6, 1, phase=0.3)
    sparkles(c, [(780, 300, 24, "lime"), (740, 220, 14, "lime")])
    return c


# ── empty-lcd : a suitcase for short stays ────────────────────────────────────────────────────
def empty_lcd():
    c = Comp("empty-lcd")
    stage(c, 830, 360)
    sc = c.layer("suitcase", suitcase(CX, 560, 300, 380), (CX, 800))
    sc.rise(4, 80, 30)
    t = c.layer("tag", [S(path([(CX - 60, 376), (CX - 150, 420)], False), "ink2", 8)] + tag(CX - 150, 420, 100, 140), (CX - 60, 376), sc)
    t.swing_in(22, 40, 40).sway(6, 1, phase=0.1)
    pinl = c.layer("pin", map_pin(760, 420, 150), (760, 420))
    pinl.drop(32, -100, 28, 12).bob(8, 1, phase=0.6)
    sparkles(c, [(260, 280, 24, "lime"), (800, 640, 16, "g600")])
    return c


# ── empty-litiges : balanced scales ───────────────────────────────────────────────────────────
def empty_litiges():
    c = Comp("empty-litiges")
    stage(c, 812, 360)
    S_ = 560
    by = 520
    post = c.layer("post", scales(CX, by, S_), (CX, by + S_ * 0.44))
    post.rise(4, 70, 30)
    beam_y = by - S_ * 0.38
    deg = 4
    beam = c.layer("beam", scales_beam(CX, by, S_), (CX, beam_y), post)
    beam.swing_in(18, 10, 36).sway(deg, 1)
    arm = S_ * 0.4
    for side, sgn in (("L", -1), ("R", 1)):
        px = CX + sgn * arm
        pan = c.layer(f"pan{side}", scales_pan(px, beam_y, S_), (px, beam_y), post)
        pan.fade(26, 10)
        # follow the beam: a beam rotation of +deg lowers the right end, raises the left
        pan.bob(sgn * arm * math.sin(math.radians(deg)), 1)
    hub = c.layer("hub", [F(circle(CX, beam_y, S_ * 0.05), "lime")], (CX, beam_y), post)
    sparkles(c, [(230, 300, 24, "lime"), (800, 300, 20, "lime")])
    return c


# ── empty-lots : a building waiting for its units ─────────────────────────────────────────────
def empty_lots():
    c = Comp("empty-lots")
    stage(c, 820, 420)
    bx, by, bw, bh = CX - 190, 290, 330, 520
    b = c.layer("building", building(bx, by, bw, bh, floors=4, cols=3, lit=set()), (CX, by + bh))
    b.grow_y(4, 34, 104)
    for k, ((f, col), (wx, wy, ww, wh)) in enumerate(window_cells(bx, by, bw, bh, 4, 3)):
        if (f + col) % 2 == 0 or k in (4,):
            L = c.layer(f"light{k}", arched_window(wx, wy, ww, wh, "lime"), (wx + ww / 2, wy + wh / 2), b)
            L.fade(26 + k * 2, 10).blink(30, 1, phase=(k * 0.23) % 1)
    pl = c.layer("plus", [F(circle(720, 330, 74), "paper"), F(circle(720, 338, 62), "lime_d"), F(circle(720, 330, 62), "lime")] + plus(720, 330, 60, "g800", 18), (720, 330))
    pl.pop(34, 24, over=118).float(10, 1, phase=0.3)
    sparkles(c, [(260, 290, 22, "lime"), (300, 220, 12, "g600")])
    return c


# ── empty-notifications : a quiet bell, a moon ────────────────────────────────────────────────
def empty_notifications():
    c = Comp("empty-notifications")
    stage(c, 812, 300)
    s = 430
    bcx, bcy = CX - 20, 520
    top = (bcx, bcy - s * 0.52)
    cl = c.layer("clapper", bell_clapper(bcx, bcy, s), top)
    bl = c.layer("bell", bell(bcx, bcy, s, "sage", "sage_d"), top)
    bl.drop(4, -90, 30, 10).sway(5, 1)
    cl.parent = bl
    cl.sway(4, 1, phase=0.08)
    mn = c.layer("moon", moon(740, 290, 70, "lime"), (740, 290))
    mn.pop(28, 26, over=112).float(10, 1, phase=0.3)
    for k, (x, y, r) in enumerate(((270, 300, 14), (300, 380, 9), (820, 420, 10))):
        L = c.layer(f"star{k}", [F(circle(x, y, r), "lime")], (x, y))
        L.pop(38 + k * 6, 18, over=140).twinkle(30, 1, phase=0.2 + 0.3 * k)
    return c


# ── empty-parkings : an empty bay and a pin ───────────────────────────────────────────────────
def empty_parkings():
    c = Comp("empty-parkings")
    stage(c, 820, 460)
    lot = c.layer(
        "lot",
        block(CX - 240, 420, 480, 330, 40, "ink2", "ink", 20)
        + [S(path([(CX - 80, 452), (CX - 80, 718)], False), "paper", 10), S(path([(CX + 80, 452), (CX + 80, 718)], False), "paper", 10)]
        + [S(path([(CX - 200, 452), (CX - 200, 718)], False), "paper", 10), S(path([(CX + 200, 452), (CX + 200, 718)], False), "paper", 10)],
        (CX, 750),
    )
    lot.rise(4, 60, 30)
    car = c.layer("car", car_top(CX - 140, 585, 96, 180), (CX - 140, 585), lot)
    car.rise(18, 160, 32)
    car2 = c.layer("car2", car_top(CX + 140, 585, 96, 180, body="sage_d", roof="sage"), (CX + 140, 585), lot)
    car2.rise(24, 160, 32)
    pn = c.layer("pin", map_pin(CX, 600, 230), (CX, 600))
    pn.drop(34, -140, 30, 14).bob(10, 1)
    sparkles(c, [(240, 320, 22, "lime"), (790, 330, 18, "lime")])
    return c


# ── empty-personnel : the caretaker's kit ─────────────────────────────────────────────────────
def empty_personnel():
    c = Comp("empty-personnel")
    stage(c, 812, 420)
    br = c.layer("broom", broom(330, 560, 470), (330, 800))
    br.rise(10, 70, 30).sway(2, 1, phase=0.5)
    cp = c.layer("cap", cap(560, 730, 220), (600, 760))
    cp.drop(26, -80, 26, 8)
    bd = c.layer("badge", id_badge(CX + 60, 400, 190, 230), (CX + 60, 190))
    bd.drop(4, -120, 32, 10).sway(3, 1)
    sparkles(c, [(780, 300, 24, "lime"), (800, 560, 14, "g600")])
    return c


# ── empty-reservations : a calendar and a pool float ──────────────────────────────────────────
def empty_reservations():
    c = Comp("empty-reservations")
    stage(c, 812, 440)
    cal = c.layer("calendar", calendar(CX - 40, 500, 420, 400), (CX - 40, 700))
    cal.rise(4, 80, 30)
    fl = c.layer("float", ring_float(CX + 210, 690, 92), (CX + 210, 690))
    fl.pop(24, 26, over=112).bob(10, 1).sway(3, 1, phase=0.25)
    sparkles(c, [(250, 280, 24, "lime"), (800, 300, 20, "lime")])
    return c


# ── empty-search : searching a card ───────────────────────────────────────────────────────────
def empty_search():
    c = Comp("empty-search")
    stage(c, 812, 440)
    cd = c.layer("card", paper(CX - 260, 380, 440, 320, 4, "paper", first_c="sage"), (CX - 40, 700))
    cd.rise(4, 70, 30)
    mg = c.layer("magnifier", magnifier(CX + 70, 470, 120, "ink", "tint", "ink"), (CX + 70, 470))
    mg.pop(20, 26, over=110).orbit(26, 14, 1)
    sparkles(c, [(780, 260, 26, "lime"), (250, 290, 18, "lime")])
    return c


# ── empty-taches : a checklist waiting for tasks ──────────────────────────────────────────────
def empty_taches():
    c = Comp("empty-taches")
    stage(c, 812, 380)
    cbx, cby, cbw, cbh = CX - 40, 500, 360, 470
    cb = c.layer("clipboard", clipboard(cbx, cby, cbw, cbh), (cbx, cby + cbh / 2))
    cb.rise(4, 80, 30)
    for k in range(3):
        y = cby - 120 + k * 110
        row = c.layer(
            f"row{k}",
            [F(rect_xy(cbx - 120, y - 28, 56, 56, 14), "greige"), S(rect_xy(cbx - 120, y - 28, 56, 56, 14), "greige_dd", 6), F(rect_xy(cbx - 40, y - 10, 150 - k * 20, 20, 10), "greige_d")],
            (cbx - 92, y),
            cb,
        )
        row.rise(18 + k * 6, 30, 22)
    pc = c.layer(
        "pencil",
        rot(
            [
                F(rpoly([(0, 0), (300, 0), (300, 44), (0, 44)], 10), "lime"),
                F(rect_xy(270, 0, 40, 44, 8), "g800"),
                F(rpoly([(0, 0), (-60, 22), (0, 44)], [6, 4, 6]), "sand"),
                F(rpoly([(-38, 14), (-60, 22), (-38, 30)], 3), "ink"),
                F(rect_xy(30, 14, 230, 6, 3), "lime_d"),
            ],
            -52,
            (0, 22),
        ),
        (0, 22),
    )
    # place the pencil: rotate geometry built at the origin, then move the layer
    pc.anchor = (0, 22)
    pc.key("p", 0, [700, 520], "out")
    pc.key("p", 28, [700, 520], "out").key("p", 52, [700, 480], "out")
    pc.fade(28, 10)
    pc._periodic("p", lambda th: [700 + 10 * math.sin(2 * math.pi * th * 2), 480 + 6 * math.sin(2 * math.pi * th)], 1)
    sparkles(c, [(250, 270, 24, "lime"), (300, 200, 12, "g600")])
    return c


# ── empty-visites : a welcoming front door ────────────────────────────────────────────────────
def empty_visites():
    c = Comp("empty-visites")
    stage(c, 816, 440)
    dw, dh = 250, 430
    dx, dy = CX - dw / 2 - 30, 816 - dh
    dr = c.layer("door", door(dx, dy, dw, dh), (CX, 816))
    dr.rise(4, 70, 30)
    mat = c.layer("mat", [F(rect_xy(dx - 30, 806, dw + 60, 26, 13), "sand_d")], (CX - 30, 816), dr)
    pl = c.layer("plant", plant_pot(CX + 210, 816, 230), (CX + 210, 816 - 80))
    pl.pop(22, 26, over=108).sway(2.5, 1)
    lamp = c.layer("lamp", [F(rect_xy(dx + dw + 50, dy + 20, 16, 60, 8), "ink2"), F(circle(dx + dw + 58, dy + 96, 26), "lime")], (dx + dw + 58, dy + 96), dr)
    lamp.blink(60, 1, phase=0.2)
    sparkles(c, [(240, 290, 22, "lime")])
    return c


# ── offline : a cloud, a gentle unplug ────────────────────────────────────────────────────────
def offline():
    c = Comp("offline")
    stage(c, 812, 320)
    cl = c.layer("cloud", cloud(CX, 400, 520, "sage"), (CX, 400))
    cl.rise(4, 50, 30).float(8)
    gap = 70
    left = c.layer("plug-l", plug(CX - gap - 40, 660, 170), (CX - gap - 40, 660))
    left.rise(16, 0, 26, dx=-80).bob(10, 1, axis="x")
    right = c.layer("plug-r", plug(CX + gap + 40, 660, 170, flip=True), (CX + gap + 40, 660))
    right.rise(16, 0, 26, dx=80).bob(-10, 1, axis="x")
    for k, (x, y) in enumerate(((CX, 600), (CX - 10, 720))):
        L = c.layer(f"spark{k}", sparkle(x, y, 20 - k * 6, "lime"), (x, y))
        L.pop(36 + k * 6, 18, over=130).twinkle(30, 1, phase=0.3 + k * 0.4)
    return c


SCENES = {
    "empty-ag": empty_ag,
    "empty-annonces": empty_annonces,
    "empty-appels": empty_appels,
    "empty-documents": empty_documents,
    "empty-incidents": empty_incidents,
    "empty-lcd": empty_lcd,
    "empty-litiges": empty_litiges,
    "empty-lots": empty_lots,
    "empty-notifications": empty_notifications,
    "empty-parkings": empty_parkings,
    "empty-personnel": empty_personnel,
    "empty-reservations": empty_reservations,
    "empty-search": empty_search,
    "empty-taches": empty_taches,
    "empty-visites": empty_visites,
    "offline": offline,
}
