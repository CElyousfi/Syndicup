"""Quick actions (quick-*): bold 512 px pictograms shown at 40–64 px in grids. They assemble in
≈0.6 s when they appear and then stay still (no idle loop — many sit side by side)."""
from __future__ import annotations

from kit import Comp, F, S, circle, path, rect_xy, rot, rpoly
from objects import (
    badge_disc,
    ballot,
    ballot_box_front,
    ballot_box_lid,
    building,
    calendar,
    card,
    check_stroke,
    chevron_up,
    coin,
    coin_side,
    door,
    drop,
    envelope_back,
    envelope_front,
    hex_pts,
    paper,
    plus,
    suitcase,
    tag,
    wrench,
)

INTRO = 40


def comp(name):
    return Comp(name, 512, 512, intro=INTRO, idle=0)


def quick_ag():
    c = comp("quick-ag")
    lid = c.layer("lid", ballot_box_lid(256, 300, 330, 300), (256, 450))
    lid.rise(0, 40, 20)
    b = c.layer("ballot", ballot(256, 170, 150, 180), (256, 170), lid)
    b.key("p", 6, [256, 60], "out").key("p", 26, [256, 170], "out").fade(6, 6)
    c.layer("box", ballot_box_front(256, 300, 330, 300), (256, 450), lid)
    m = c.layer("mark", [F(rpoly(hex_pts(256, 340, 44), 10), "lime")], (256, 340), lid)
    m.pop(20, 16, over=120)
    return c


def quick_appel():
    c = comp("quick-appel")
    back = c.layer("back", envelope_back(256, 300, 400, 280), (256, 440))
    back.rise(0, 40, 20)
    cn = c.layer("coin", coin(256, 210, 84), (256, 210), back)
    cn.key("p", 8, [256, 330], "out").key("p", 28, [256, 210], "out")
    c.layer("front", envelope_front(256, 300, 400, 280), (256, 440), back)
    return c


def quick_copropriete():
    c = comp("quick-copropriete")
    b = c.layer("building", building(80, 90, 260, 380, floors=4, cols=3, lit={(0, 0), (1, 2), (2, 1), (3, 0), (0, 2), (2, 2)}), (210, 470))
    b.grow_y(0, 24, 104)
    p = c.layer("plus", [F(circle(400, 150, 84), "paper"), F(circle(400, 158, 70), "lime_d"), F(circle(400, 150, 70), "lime")] + plus(400, 150, 70, "g800", 22), (400, 150))
    p.pop(14, 20, over=118)
    return c


def quick_incident():
    c = comp("quick-incident")
    d = c.layer("drop", drop(330, 280, 300, "lime"), (330, 280))
    d.drop(0, -60, 22, 8)
    w = c.layer("wrench", wrench(220, 280, 400, -45, "g700", "paper"), (220, 280))
    w.swing_in(8, -30, 26)
    return c


def quick_invitation():
    c = comp("quick-invitation")
    back = c.layer("back", envelope_back(256, 320, 420, 290), (256, 465))
    back.rise(0, 40, 20)
    cd = c.layer("card", paper(146, 90, 220, 230, 0, "lime", side="lime_d", depth=0) + plus(256, 190, 110, "g800", 34), (256, 200), back)
    cd.key("p", 8, [256, 330], "out").key("p", 28, [256, 200], "out")
    c.layer("front", envelope_front(256, 320, 420, 290), (256, 465), back)
    return c


def quick_paiement():
    c = comp("quick-paiement")
    cd = c.layer("card", card(236, 236, 400, 260), (236, 236))
    cd.rise(0, 40, 22)
    b = c.layer("badge", badge_disc(390, 360, 72), (390, 360))
    b.pop(14, 18, over=118)
    k = c.layer("check", check_stroke(390, 360, 76, "g800", 18), (390, 360), b)
    k.draw(20, 16)
    return c


def quick_payer():
    c = comp("quick-payer")
    for k in range(3):
        y = 420 - k * 66
        L = c.layer(f"coin{k}", coin_side(256, y, 280, 100), (256, y))
        L.drop(k * 5, -80, 20, 6)
    ch = c.layer("chev", chevron_up(256, 170, 150, 40, "g700") + chevron_up(256, 118, 150, 40, "g700"), (256, 150))
    ch.rise(16, 40, 20)
    return c


def quick_reservation():
    c = comp("quick-reservation")
    cal = c.layer("calendar", calendar(256, 276, 380, 360, hl={(1, 1): "lime", (1, 2): "g700"}), (256, 456))
    cal.rise(0, 40, 22)
    return c


def quick_sejour():
    c = comp("quick-sejour")
    s = c.layer("suitcase", suitcase(240, 280, 260, 300), (240, 470))
    s.rise(0, 40, 22)
    t = c.layer("tag", [S(path([(300, 130), (370, 200)], False), "ink2", 8)] + tag(370, 200, 110, 150), (300, 130), s)
    t.swing_in(12, 40, 26)
    return c


def quick_visiteur():
    c = comp("quick-visiteur")
    d = c.layer("door", door(150, 70, 210, 390), (256, 460))
    d.rise(0, 40, 22)
    t = c.layer("tag", [S(path([(330, 268), (370, 300)], False), "ink2", 8)] + tag(370, 300, 110, 150), (330, 268), d)
    t.swing_in(12, 40, 26)
    return c


SCENES = {
    "quick-ag": quick_ag,
    "quick-appel": quick_appel,
    "quick-copropriete": quick_copropriete,
    "quick-incident": quick_incident,
    "quick-invitation": quick_invitation,
    "quick-paiement": quick_paiement,
    "quick-payer": quick_payer,
    "quick-reservation": quick_reservation,
    "quick-sejour": quick_sejour,
    "quick-visiteur": quick_visiteur,
}
