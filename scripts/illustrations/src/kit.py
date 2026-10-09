"""
SyndicUp illustration kit — vector scenes → Lottie JSON (one file per illustration, shared by the
web app and the Flutter app).

Only Lottie features that lottie-web AND the Flutter `lottie` package render identically are
emitted: shape layers, layer parenting, groups, rect / ellipse / bezier paths, solid fills,
round-capped strokes, layer-level trim paths, transforms (anchor, position, scale, rotation,
opacity) and composition markers. No masks, mattes, expressions, gradients or text.

Timeline contract (read by both players):
  marker "intro" : [0, INTRO)      the illustration assembles itself, played once
  marker "idle"  : [INTRO, OP)     a seamless, subtle loop (absent for small icons)
  frame INTRO is the REST frame: what reduced-motion users see, and what the PNG shows.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

FPS = 60
K = 0.5522847498  # circle bezier constant

# ─── Palette (brand tokens + tonal steps for depth) ────────────────────────────────────────────
PAL = {
    "g950": "#0B3A28",
    "g900": "#0F4A33",
    "g800": "#17603F",  # --color-brand-deep
    "g700": "#1E7552",  # --color-brand
    "g600": "#2A8560",
    "g500": "#3D9A72",
    "sage": "#A4C8AE",  # --color-sage
    "sage_d": "#8DB89A",
    "mint": "#CBE1D2",
    "tint": "#E2EEE7",  # --color-sage-tint
    "wash": "#F0F6F2",
    "lime": "#E3EF8D",  # --color-lime
    "lime_d": "#CDDC6A",
    "lime_l": "#F1F7C6",
    "ink": "#121212",
    "ink2": "#2B2B2E",
    "ink3": "#45474B",
    "greige": "#ECEBE4",  # --color-greige / ground
    "greige_d": "#DCDACF",
    "greige_dd": "#C9C6B8",
    "paper": "#FFFFFF",
    "sand": "#E5D6B8",
    "sand_d": "#CDB98F",
}


def rgba(c: str, a: float = 1.0):
    c = PAL.get(c, c)
    c = c.lstrip("#")
    return [round(int(c[i : i + 2], 16) / 255, 4) for i in (0, 2, 4)] + [a]


def st(v):
    return {"a": 0, "k": v}


# ─── Easing (cubic-bezier as Lottie out/in tangents) ───────────────────────────────────────────
EASES = {
    "linear": ((0.0, 0.0), (1.0, 1.0)),
    "out": ((0.16, 1.0), (0.3, 1.0)),  # expo-ish out: fast start, soft landing
    "soft": ((0.33, 0.0), (0.2, 1.0)),
    "inout": ((0.45, 0.0), (0.55, 1.0)),  # sine in-out, for idle loops
    "in": ((0.5, 0.0), (0.75, 0.0)),
    "back": ((0.34, 1.0), (0.64, 1.0)),
}


# ─── Geometry → Lottie shape items ─────────────────────────────────────────────────────────────
def rect(cx, cy, w, h, r=0):
    return {"ty": "rc", "d": 1, "p": st([cx, cy]), "s": st([w, h]), "r": st(min(r, w / 2, h / 2))}


def rect_xy(x, y, w, h, r=0):
    return rect(x + w / 2, y + h / 2, w, h, r)


def ellipse(cx, cy, w, h=None):
    return {"ty": "el", "d": 1, "p": st([cx, cy]), "s": st([w, h if h is not None else w])}


def circle(cx, cy, r):
    return ellipse(cx, cy, 2 * r, 2 * r)


def _sh(v, i, o, closed=True):
    return {"ty": "sh", "d": 1, "ks": st({"v": v, "i": i, "o": o, "c": closed})}


def path(points, closed=True):
    """Straight polyline / polygon."""
    v = [list(p) for p in points]
    z = [[0, 0] for _ in v]
    return _sh(v, z, [list(p) for p in z], closed)


def bez(nodes, closed=True):
    """nodes: (x, y, in_dx, in_dy, out_dx, out_dy) — tangents relative to the vertex."""
    v, i, o = [], [], []
    for n in nodes:
        x, y = n[0], n[1]
        ix, iy, ox, oy = (n[2:] + (0, 0, 0, 0))[:4] if len(n) > 2 else (0, 0, 0, 0)
        v.append([x, y])
        i.append([ix, iy])
        o.append([ox, oy])
    return _sh(v, i, o, closed)


def rpoly(points, r, closed=True):
    """Polygon with every corner rounded by radius r (a single r or one per corner)."""
    n = len(points)
    rs = r if isinstance(r, (list, tuple)) else [r] * n
    v, ii, oo = [], [], []
    for k in range(n):
        p = points[k]
        if not closed and (k == 0 or k == n - 1) or rs[k] <= 0:
            v.append(list(p))
            ii.append([0, 0])
            oo.append([0, 0])
            continue
        a, b = points[k - 1], points[(k + 1) % n]
        da = math.dist(p, a)
        db = math.dist(p, b)
        rr = min(rs[k], da / 2, db / 2)
        ua = ((a[0] - p[0]) / da, (a[1] - p[1]) / da)
        ub = ((b[0] - p[0]) / db, (b[1] - p[1]) / db)
        p1 = (p[0] + ua[0] * rr, p[1] + ua[1] * rr)
        p2 = (p[0] + ub[0] * rr, p[1] + ub[1] * rr)
        h = rr * K
        v.append(list(p1))
        ii.append([0, 0])
        oo.append([-ua[0] * h, -ua[1] * h])
        v.append(list(p2))
        ii.append([-ub[0] * h, -ub[1] * h])
        oo.append([0, 0])
    return _sh(v, ii, oo, closed)


def _arc_pts(cx, cy, rx, ry, a0, a1):
    """Bezier nodes along an elliptical arc from a0 to a1 (degrees, 0 = +x, clockwise on screen)."""
    segs = max(1, math.ceil(abs(a1 - a0) / 90))
    step = (a1 - a0) / segs
    out = []
    for s in range(segs + 1):
        a = math.radians(a0 + step * s)
        hk = 4 / 3 * math.tan(math.radians(step) / 4)
        x, y = cx + rx * math.cos(a), cy + ry * math.sin(a)
        tx, ty = -rx * math.sin(a) * hk, ry * math.cos(a) * hk
        out.append([x, y, -tx, -ty, tx, ty])
    out[0][2], out[0][3] = 0, 0
    out[-1][4], out[-1][5] = 0, 0
    return out


def wedge(cx, cy, r, a0, a1, r_in=0):
    """Pie slice (or ring segment when r_in > 0)."""
    outer = _arc_pts(cx, cy, r, r, a0, a1)
    if r_in > 0:
        inner = _arc_pts(cx, cy, r_in, r_in, a1, a0)
        nodes = [tuple(n) for n in outer] + [tuple(n) for n in inner]
    else:
        nodes = [tuple(n) for n in outer] + [(cx, cy)]
    return bez(nodes, True)


def arc(cx, cy, r, a0, a1, ry=None):
    """Open arc (for strokes)."""
    return bez([tuple(n) for n in _arc_pts(cx, cy, r, ry or r, a0, a1)], False)


def sparkle_shape(cx, cy, r, thin=0.28):
    """4-point star with concave sides."""
    t = r * thin
    return bez(
        [
            (cx, cy - r, 0, 0, 0, r * 0.45),
            (cx + t, cy - t, -t * 0.2, -t * 0.6, t * 0.6, t * 0.2),
            (cx + r, cy, -r * 0.45, 0, -r * 0.45, 0),
            (cx + t, cy + t, t * 0.6, -t * 0.2, -t * 0.2, t * 0.6),
            (cx, cy + r, 0, -r * 0.45, 0, -r * 0.45),
            (cx - t, cy + t, t * 0.2, t * 0.6, -t * 0.6, -t * 0.2),
            (cx - r, cy, r * 0.45, 0, r * 0.45, 0),
            (cx - t, cy - t, -t * 0.6, t * 0.2, t * 0.2, -t * 0.6),
            (cx, cy - r, 0, r * 0.45, 0, 0),
        ],
        True,
    )


def chevron_shape(cx, cy, w, h, th, r=10):
    """Upward chevron (^) of total width w, height h and arm thickness th."""
    hw = w / 2
    return rpoly(
        [
            (cx, cy - h / 2),
            (cx + hw, cy - h / 2 + hw * (h - th) / hw if False else cy + h / 2 - th),
            (cx + hw, cy + h / 2),
            (cx, cy - h / 2 + th * 1.35),
            (cx - hw, cy + h / 2),
            (cx - hw, cy + h / 2 - th),
        ],
        [r * 0.6, r, r * 0.6, r * 0.6, r * 0.6, r],
    )


# ─── Paint ─────────────────────────────────────────────────────────────────────────────────────
def fill(c, a=1.0, evenodd=False):
    return {"ty": "fl", "c": st(rgba(c)), "o": st(round(a * 100, 2)), "r": 2 if evenodd else 1}


def stroke(c, w, a=1.0, cap="round"):
    return {
        "ty": "st",
        "c": st(rgba(c)),
        "o": st(round(a * 100, 2)),
        "w": st(w),
        "lc": {"butt": 1, "round": 2, "square": 3}[cap],
        "lj": 2,
        "ml": 4,
    }


def _tr():
    return {
        "ty": "tr",
        "p": st([0, 0]),
        "a": st([0, 0]),
        "s": st([100, 100]),
        "r": st(0),
        "o": st(100),
        "sk": st(0),
        "sa": st(0),
    }


def group(items, paint, name="g"):
    items = items if isinstance(items, list) else [items]
    paint = paint if isinstance(paint, list) else [paint]
    return {"ty": "gr", "nm": name, "it": items + paint + [_tr()]}


def rot(parts, angle, pivot):
    """Statically rotate already-built parts around a pivot (wraps them in a transformed group)."""
    tr = _tr()
    tr["a"] = st(list(pivot))
    tr["p"] = st(list(pivot))
    tr["r"] = st(angle)
    return [{"ty": "gr", "nm": "rot", "it": list(reversed(parts)) + [tr]}]


# Part helpers: geometry + paint in one call
def F(geom, c, a=1.0, evenodd=False):
    return group(geom, fill(c, a, evenodd))


def S(geom, c, w, a=1.0, cap="round"):
    return group(geom, stroke(c, w, a, cap))


# ─── Layers & animation ────────────────────────────────────────────────────────────────────────
@dataclass
class Layer:
    comp: "Comp"
    name: str
    parts: list
    anchor: tuple
    parent: "Layer | None" = None
    ind: int = 0
    tracks: dict = field(default_factory=dict)  # prop -> [(t, value, ease)]
    trim: list | None = None  # [(t, end%, ease)] → layer-level trim on all strokes

    # base values
    @property
    def base(self):
        return {"p": [self.anchor[0], self.anchor[1]], "s": [100, 100], "r": 0, "o": 100}

    def key(self, prop, t, value, ease="out"):
        if not isinstance(value, list) and prop in ("p", "s"):
            value = [value, value]
        self.tracks.setdefault(prop, []).append((round(t, 3), value, ease))
        return self

    def at(self, dx=0, dy=0):
        return [self.anchor[0] + dx, self.anchor[1] + dy]

    # ── intro vocabulary ──
    def pop(self, t, dur=24, over=108, frm=0):
        """Scale in from `frm`% with a soft overshoot, fading in."""
        self.key("s", t, frm, "out").key("s", t + dur * 0.62, over, "inout").key("s", t + dur, 100, "inout")
        self.key("o", t, 0, "linear").key("o", t + min(8, dur * 0.4), 100, "linear")
        return self

    def rise(self, t, dy=60, dur=30, fade=True, dx=0):
        self.key("p", t, self.at(dx, dy), "out").key("p", t + dur, self.at(), "out")
        if fade:
            self.key("o", t, 0, "linear").key("o", t + min(10, dur * 0.5), 100, "linear")
        return self

    def drop(self, t, dy=-80, dur=26, bounce=10):
        """Falls from above and settles with one small bounce."""
        self.key("p", t, self.at(0, dy), "in").key("p", t + dur * 0.62, self.at(0, 0), "out")
        self.key("p", t + dur * 0.8, self.at(0, -bounce), "inout").key("p", t + dur, self.at(), "inout")
        self.key("o", t, 0, "linear").key("o", t + 6, 100, "linear")
        return self

    def grow_y(self, t, dur=26, over=106):
        """Grows from its anchor vertically (anchor should be at the base)."""
        self.key("s", t, [100, 0], "out").key("s", t + dur * 0.65, [100, over], "inout").key("s", t + dur, [100, 100], "inout")
        return self

    def grow_x(self, t, dur=26, over=104):
        self.key("s", t, [0, 100], "out").key("s", t + dur * 0.65, [over, 100], "inout").key("s", t + dur, [100, 100], "inout")
        return self

    def swing_in(self, t, deg=-24, dur=34):
        """Rotates in from `deg` and settles with a damped wobble."""
        self.key("r", t, deg, "out").key("r", t + dur * 0.55, -deg * 0.18, "inout")
        self.key("r", t + dur * 0.8, deg * 0.05, "inout").key("r", t + dur, 0, "inout")
        return self

    def fade(self, t, dur=14, frm=0, to=100):
        self.key("o", t, frm, "linear").key("o", t + dur, to, "linear")
        return self

    def draw(self, t, dur=22, ease="out"):
        """Draw-on of every stroke in the layer (trim end 0 → 100)."""
        self.trim = [(t, 0, ease), (t + dur, 100, ease)]
        return self

    def burst(self, t, dx, dy, dur=30):
        """Confetti: shoots out from the centre toward its rest place, pops."""
        self.key("p", t, self.at(-dx, -dy), "out").key("p", t + dur, self.at(), "out")
        self.key("s", t, 20, "out").key("s", t + dur * 0.6, 120, "inout").key("s", t + dur, 100, "inout")
        self.key("o", t, 0, "linear").key("o", t + 6, 100, "linear")
        return self

    # ── idle vocabulary (seamless over [INTRO, OP]) ──
    def _periodic(self, prop, fn, n=1, phase=0.0):
        """Seamless loop over [INTRO, OP]: value = fn(theta), theta in [0, 1) per cycle.
        Phase 0: keyframes at the cycle quarter points with sine easing (exact, tiny JSON).
        Otherwise: 16 linear samples per cycle (smooth, and the wrap point never stalls)."""
        I, OP = self.comp.intro, self.comp.op
        if OP <= I:
            return self
        span = OP - I
        if phase % 1 == 0:
            steps = 4 * n
            for k in range(steps + 1):
                self.key(prop, I + span * k / steps, fn((k / 4) % 1), "inout")
        else:
            # ease from the rest value into the shifted loop, so the end of the intro never jumps
            before = [k[0] for k in self.tracks.get(prop, []) if k[0] < I]
            tb = max(max(before, default=0), I - 16)
            if tb < I:
                self.key(prop, tb, fn(0), "inout")
            steps = 16 * n
            for k in range(steps + 1):
                self.key(prop, I + span * k / steps, fn((k / 16 + phase) % 1), "linear")
        return self

    def _cycle(self, prop, rest, peak, n=1, phase=0.0):
        def fn(th):
            w = (1 - math.cos(2 * math.pi * th)) / 2
            return _lerp(rest, peak, w)
        return self._periodic(prop, fn, n, phase)

    def float(self, amp=8, n=1, phase=0.0, dx=0):
        return self._cycle("p", self.at(), self.at(dx, -amp), n, phase)

    def sway(self, deg=3, n=1, phase=0.0):
        return self._periodic("r", lambda th: deg * math.sin(2 * math.pi * th), n, phase)

    def breathe(self, amp=3, n=1, phase=0.0):
        return self._cycle("s", [100, 100], [100 + amp, 100 + amp], n, phase)

    def twinkle(self, lo=55, n=1, phase=0.0):
        return self._cycle("s", [100, 100], [lo, lo], n, phase)

    def blink(self, lo=35, n=1, phase=0.0):
        return self._cycle("o", 100, lo, n, phase)

    def bob(self, amp=8, n=1, phase=0.0, axis="y"):
        """Sine displacement (rest → +amp → rest → −amp): pairs with sway() for linked parts."""
        ax, ay = self.anchor
        if axis == "y":
            return self._periodic("p", lambda th: [ax, ay + amp * math.sin(2 * math.pi * th)], n, phase)
        return self._periodic("p", lambda th: [ax + amp * math.sin(2 * math.pi * th), ay], n, phase)

    def orbit(self, rx=10, ry=6, n=1, phase=0.0):
        """Small elliptical drift around the rest position (search, hover)."""
        ax, ay = self.anchor
        return self._periodic(
            "p",
            lambda th: [ax + rx * math.sin(2 * math.pi * th), ay - ry + ry * math.cos(2 * math.pi * th)],
            n,
            phase if phase else 0.0001,
        )

    def spin_loop(self, turns=1):
        I, OP = self.comp.intro, self.comp.op
        self.key("r", I, 0, "linear").key("r", OP, 360 * turns, "linear")
        return self

    def path_loop(self, pts, fade_ends=True):
        """Travels along a polyline (absolute points) once per idle cycle — for flowing dots."""
        I, OP = self.comp.intro, self.comp.op
        seg = [math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1)]
        tot = sum(seg)
        tt = I
        self.key("p", I, list(pts[0]), "linear")
        acc = 0
        for k, d in enumerate(seg):
            acc += d
            self.key("p", I + (OP - I) * acc / tot, list(pts[k + 1]), "linear")
        if fade_ends:
            span = OP - I
            self.key("o", I, 0, "linear").key("o", I + span * 0.12, 100, "linear")
            self.key("o", OP - span * 0.15, 100, "linear").key("o", OP, 0, "linear")
        return self

    # ── export ──
    def _prop(self, prop, dims):
        tr = self.tracks.get(prop)
        b = self.base[prop]
        if not tr:
            return st(b + [0] if prop in ("p",) else ([*b, 100] if prop == "s" else b))
        tr = sorted(tr, key=lambda k: k[0])
        # drop exact duplicates at same t (keep last)
        dedup = []
        for k in tr:
            if dedup and abs(dedup[-1][0] - k[0]) < 1e-6:
                dedup[-1] = k
            else:
                dedup.append(k)
        kfs = []
        for idx, (t, v, ease) in enumerate(dedup):
            val = v if isinstance(v, list) else [v]
            if prop == "p":
                val = val + [0]
            if prop == "s":
                val = val + [100]
            kf = {"t": t, "s": val}
            if idx < len(dedup) - 1:
                (ox, oy), (ix, iy) = EASES[dedup[idx + 1][2] if False else ease]
                kf["o"] = {"x": [ox], "y": [oy]}
                kf["i"] = {"x": [ix], "y": [iy]}
                if prop == "p":
                    kf["to"] = [0, 0, 0]
                    kf["ti"] = [0, 0, 0]
            kfs.append(kf)
        return {"a": 1, "k": kfs}

    def export(self):
        shapes = list(reversed(self.parts))  # Lottie: first item renders on top
        if self.trim:
            kfs = []
            for idx, (t, v, ease) in enumerate(self.trim):
                kf = {"t": t, "s": [v]}
                if idx < len(self.trim) - 1:
                    (ox, oy), (ix, iy) = EASES[ease]
                    kf["o"] = {"x": [ox], "y": [oy]}
                    kf["i"] = {"x": [ix], "y": [iy]}
                kfs.append(kf)
            shapes.append({"ty": "tm", "s": st(0), "e": {"a": 1, "k": kfs}, "o": st(0), "m": 1, "nm": "draw"})
        ks = {
            "o": self._prop("o", 1),
            "r": self._prop("r", 1),
            "p": self._prop("p", 3),
            "a": st([self.anchor[0], self.anchor[1], 0]),
            "s": self._prop("s", 3),
        }
        lay = {
            "ddd": 0,
            "ind": self.ind,
            "ty": 4,
            "nm": self.name,
            "sr": 1,
            "ks": ks,
            "ao": 0,
            "shapes": shapes,
            "ip": 0,
            "op": self.comp.op,
            "st": 0,
            "bm": 0,
        }
        if self.parent is not None:
            lay["parent"] = self.parent.ind
        return lay


def _lerp(a, b, t):
    if isinstance(a, list):
        return [x + (y - x) * t for x, y in zip(a, b)]
    return a + (b - a) * t


@dataclass
class Comp:
    name: str
    w: int = 1024
    h: int = 1024
    intro: int = 72
    idle: int = 240
    layers: list = field(default_factory=list)

    @property
    def op(self):
        return self.intro + self.idle

    def layer(self, name, parts, anchor=None, parent=None):
        parts = parts if isinstance(parts, list) else [parts]
        L = Layer(self, name, parts, anchor or (self.w / 2, self.h / 2), parent)
        L.ind = len(self.layers) + 1
        self.layers.append(L)
        return L

    def _inherit_opacity(self):
        """Lottie parenting carries transforms but NOT opacity: a child with no fade of its own
        takes its parent's, so assemblies fade in as one piece."""
        def resolved(L):
            if "o" in L.tracks:
                return L.tracks["o"]
            if L.parent is not None:
                return resolved(L.parent)
            return None

        for L in self.layers:
            if "o" not in L.tracks and L.parent is not None:
                tr = resolved(L.parent)
                if tr:
                    L.tracks["o"] = list(tr)

    def export(self):
        self._inherit_opacity()
        out = {
            "v": "5.7.4",
            "fr": FPS,
            "ip": 0,
            "op": self.op if self.idle > 0 else self.intro + 1,
            "w": self.w,
            "h": self.h,
            "nm": self.name,
            "ddd": 0,
            "assets": [],
            "layers": [L.export() for L in reversed(self.layers)],
            "markers": [{"tm": 0, "cm": "intro", "dr": self.intro}],
        }
        if self.idle > 0:
            out["markers"].append({"tm": self.intro, "cm": "idle", "dr": self.idle})
        else:
            for L in out["layers"]:
                L["op"] = out["op"]
        return out

    def dumps(self):
        return json.dumps(_round(self.export()), separators=(",", ":"))


def _round(o):
    if isinstance(o, float):
        r = round(o, 2)
        return int(r) if r == int(r) else r
    if isinstance(o, list):
        return [_round(x) for x in o]
    if isinstance(o, dict):
        return {k: _round(v) for k, v in o.items()}
    return o
