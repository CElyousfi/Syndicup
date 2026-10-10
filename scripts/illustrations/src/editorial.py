"""
Editorial illustrations (painted art, e.g. generated in the approved retro editorial style) →
animated Lottie with IMAGE layers.

The source image is cut into layers by hand-placed rectangles (`cuts`): every opaque pixel belongs
to exactly ONE layer (the last listed rectangle that contains it, else the base), so the rest
frame is pixel-identical to the source. The page background becomes transparent (flood fill from
the border; interiors such as white facades stay opaque) with a soft anti-aliased edge.

Layer kinds
  panel  : a collage panel — assembles in the intro (slides in from outside, fades), then still.
           (Panels touch each other: moving them during idle would open seams.)
  float  : an element standing on the page background — pops in, then bobs gently (it has
           transparent surroundings, so it can move freely).
  pulse  : an element INSIDE a panel — the rectangle is duplicated on top (the panel keeps its own
           copy) and only ever scales UP a little, so the copy always covers the original.
Extras (vector, drawn over the art): e.g. a falling drop sampled from the art's own colour.
"""
from __future__ import annotations

import base64
import io
import math

import numpy as np
from PIL import Image, ImageFilter

from kit import Comp, F, Layer, bez

SIZE = 1024  # comp size; sources are resized to this


def _transparent_bg(im: Image.Image, tol=16, soft=12):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    near = dist <= tol
    # flood fill the background from the border (only regions connected to the outside)
    import cv2

    near_u8 = near.astype(np.uint8)
    n, lab = cv2.connectedComponents(near_u8, connectivity=4)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge_labels)) & near
    alpha = np.where(outside, 0, 255).astype(np.float32)
    # soft edge: background pixels touching the art get partial alpha from their distance
    ring = outside & (cv2.dilate((~outside).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    alpha[ring] = np.clip((dist[ring] - 3) / soft, 0, 1) * 255
    return alpha.astype(np.uint8), bg


def _encode(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=92, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


class ImageLayer(Layer):
    """A Lottie image layer whose transforms use composition coordinates like shape layers."""

    asset_id: str = ""
    origin: tuple = (0, 0)  # top-left of the cropped image in comp coordinates

    def export(self):
        lay = super().export()
        lay["ty"] = 2
        lay["refId"] = self.asset_id
        del lay["shapes"]
        ax, ay = self.anchor
        lay["ks"]["a"] = {"a": 0, "k": [ax - self.origin[0], ay - self.origin[1], 0]}
        return lay


class EditorialComp(Comp):
    def __init__(self, name, intro=84, idle=240):
        super().__init__(name, SIZE, SIZE, intro, idle)
        self.assets = []

    def export(self):
        out = super().export()
        out["assets"] = self.assets
        return out


def build(name, src_path, cuts, extras=None, intro=84, idle=240):
    """cuts: list of (layer_name, (x0, y0, x1, y1) in SOURCE pixels, kind, options)."""
    src = Image.open(src_path).convert("RGB")
    k = SIZE / src.width
    src = src.resize((SIZE, round(src.height * k)), Image.LANCZOS)
    alpha, bg = _transparent_bg(src)
    rgba = np.dstack([np.asarray(src), alpha])
    H, W = alpha.shape
    owner = np.full((H, W), -1, dtype=np.int16)  # -1 = base
    scaled = [(n, tuple(round(v * k) for v in r), kind, opt) for n, r, kind, opt in cuts]
    for idx, (n, (x0, y0, x1, y1), kind, opt) in enumerate(scaled):
        if kind == "pulse":
            continue  # pulses duplicate pixels, they don't own them
        owner[y0:y1, x0:x1] = idx
    c = EditorialComp(name, intro, idle)
    cx0, cy0 = W / 2, H / 2

    def add_image(lname, mask, rect_hint=None):
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            return None
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        part = rgba[y0:y1, x0:x1].copy()
        part[..., 3] = np.where(mask[y0:y1, x0:x1], part[..., 3], 0)
        img = Image.fromarray(part.astype(np.uint8), "RGBA")
        aid = f"img_{len(c.assets)}"
        c.assets.append({"id": aid, "w": int(x1 - x0), "h": int(y1 - y0), "u": "", "p": _encode(img), "e": 1})
        L = ImageLayer(c, lname, [], ((x0 + x1) / 2, (y0 + y1) / 2))
        L.ind = len(c.layers) + 1
        L.asset_id = aid
        L.origin = (int(x0), int(y0))
        c.layers.append(L)
        return L

    opaque = alpha > 0
    base = add_image("base", opaque & (owner == -1))
    if base:
        base.fade(0, 18)
    order = 0
    for idx, (n, (x0, y0, x1, y1), kind, opt) in enumerate(scaled):
        if kind == "pulse":
            m = np.zeros_like(opaque)
            m[y0:y1, x0:x1] = opaque[y0:y1, x0:x1]
        else:
            m = opaque & (owner == idx)
        L = add_image(n, m)
        if L is None:
            continue
        lx, ly = L.anchor
        if kind == "panel":
            t = 4 + order * 5
            order += 1
            dx, dy = lx - cx0, ly - cy0
            d = math.hypot(dx, dy) or 1
            L.rise(t, dy / d * 46, 34, dx=dx / d * 46)
            L.key("s", t, [96, 96], "out").key("s", t + 34, [100, 100], "out")
        elif kind == "float":
            t = opt.get("t", 40)
            L.pop(t, 24, over=opt.get("over", 112))
            amp = opt.get("amp", 6)
            if amp:
                L.float(amp, 1, phase=opt.get("phase", 0.0))
            if opt.get("sway"):
                L.sway(opt["sway"], 1, phase=opt.get("phase", 0.0))
        elif kind == "pulse":
            t = opt.get("t", 46)
            L.pop(t, 22, over=opt.get("over", 110), frm=opt.get("frm", 70))
            if opt.get("amp", 4):
                L._cycle("s", [100, 100], [100 + opt.get("amp", 4)] * 2, 1, opt.get("phase", 0.0))
    for ex in extras or []:
        ex(c, k, rgba)
    return c


# ── extras ─────────────────────────────────────────────────────────────────────────────────────
def falling_drop(x, y_from, y_to, size, sample_at, n=2):
    """A drop (coloured from the art at `sample_at`, source pixels) that keeps falling."""

    def add(c: EditorialComp, k, rgba):
        sx, sy = round(sample_at[0] * k), round(sample_at[1] * k)
        r, g, b = (int(v) for v in rgba[sy, sx, :3])
        col = f"#{r:02x}{g:02x}{b:02x}"
        X, Y0, Y1, s = x * k, y_from * k, y_to * k, size * k
        for j in range(n):
            shape = bez([(X, Y0 - s * 0.62), (X + s * 0.42, Y0 + s * 0.12, 0, -s * 0.3, 0, s * 0.24), (X, Y0 + s * 0.5, s * 0.24, 0, -s * 0.24, 0), (X - s * 0.42, Y0 + s * 0.12, 0, s * 0.24, 0, -s * 0.3)], True)
            L = c.layer(f"drop{j}", [F(shape, col)], (X, Y0))
            I, OP = c.intro, c.op
            span = (OP - I) / n
            b0 = I + j * span
            L.key("p", 0, [X, Y0], "linear").key("o", 0, 0, "linear").key("o", b0, 0, "linear")
            L.key("p", b0, [X, Y0], "in").key("p", b0 + span * 0.75, [X, Y1], "linear")
            L.key("o", b0 + 1, 100, "linear").key("o", b0 + span * 0.6, 100, "linear").key("o", b0 + span * 0.75, 0, "linear")
            L.key("s", b0, [30, 30], "out").key("s", b0 + span * 0.2, [100, 100], "linear")

    return add
