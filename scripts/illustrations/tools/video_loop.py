"""
Turn a generated clip into an app-ready seamless loop.

    python3 video_loop.py in.mp4 out.mp4 out-poster.png [--fade 12] [--size 720] [--erase x0,y0,x1,y1 ...]

- Seamless loop: the last `fade` frames are cross-faded into the first ones, so the clip ends
  exactly where it starts (no jump on repeat). Output length = input − fade frames.
- --erase: boxes (source pixels) where hallucinated lettering on a button must disappear: inside
  each box, light pixels sitting between button-coloured pixels on the same row are repainted with
  that row's button colour (clean pills, no fake text).
- Output: H.264 (yuv420p, +faststart, no audio), square `size`; poster = first output frame.
"""
from __future__ import annotations

import argparse
import subprocess

import numpy as np
from PIL import Image


def read_frames(path):
    probe = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", path]).decode().strip().split(",")
    w, h = int(probe[0]), int(probe[1])
    num, den = probe[2].split("/")
    fps = float(num) / float(den)
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).copy()
    return frames, fps


def erase_text(frame, box, rng=np.random.default_rng(1)):
    """Repaint the inside of each button found in `box` with its own colour (+ a touch of grain):
    hallucinated lettering disappears, the pill keeps its soft anti-aliased edge."""
    import cv2

    x0, y0, x1, y1 = box
    reg = frame[y0:y1, x0:x1].astype(np.int16)
    lum = reg.mean(axis=2)
    sat = reg.max(axis=2) - reg.min(axis=2)
    btn = ((lum < 205) & (sat > 18)).astype(np.uint8)
    pill = cv2.morphologyEx(btn, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)), iterations=2)
    cnts, _ = cv2.findContours(pill, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sub = reg.astype(np.float32)
    for c in cnts:
        if cv2.contourArea(c) < 150:
            continue
        m = np.zeros(btn.shape, np.uint8)
        cv2.drawContours(m, [c], -1, 1, -1)
        inner = cv2.erode(m, np.ones((3, 3), np.uint8), iterations=2).astype(bool)
        colour = np.median(reg[(m == 1) & (btn == 1)], axis=0)
        sub[inner] = colour + rng.normal(0, 2.5, (int(inner.sum()), 1))
    frame[y0:y1, x0:x1] = sub.clip(0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("poster")
    ap.add_argument("--fade", type=int, default=12)
    ap.add_argument("--size", type=int, default=720)
    ap.add_argument("--crf", type=int, default=28)
    ap.add_argument("--erase", nargs="*", default=[])
    a = ap.parse_args()

    frames, fps = read_frames(a.src)
    boxes = [tuple(int(v) for v in b.split(",")) for b in a.erase]
    for f in frames:
        for b in boxes:
            erase_text(f, b)

    n, k = len(frames), a.fade
    body = frames[: n - k].astype(np.float32)
    tail = frames[n - k :].astype(np.float32)
    for j in range(k):
        t = (j + 1) / (k + 1)  # 0 → mostly the tail, 1 → mostly the head
        body[j] = tail[j] * (1 - t) + body[j] * t
    out = body.clip(0, 255).astype(np.uint8)

    Image.fromarray(out[0]).resize((a.size, a.size), Image.LANCZOS).save(a.poster, optimize=True)
    h, w = out.shape[1:3]
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", f"{fps}", "-i", "-",
         "-vf", f"scale={a.size}:{a.size}:flags=lanczos", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf),
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", a.out],
        stdin=subprocess.PIPE,
    )
    enc.stdin.write(out.tobytes())
    enc.stdin.close()
    enc.wait()


if __name__ == "__main__":
    main()
