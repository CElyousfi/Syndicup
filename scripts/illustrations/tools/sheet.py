"""Contact sheet of PNGs (on white): python3 sheet.py out.png cols cell file1.png …"""
import os
import sys

from PIL import Image, ImageDraw

out, cols, cell = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
fs = sys.argv[4:]
rows = (len(fs) + cols - 1) // cols
cw = cell
ims = []
for f in fs:
    im = Image.open(f).convert("RGBA")
    im.thumbnail((cw, cw))
    ims.append(im)
ch = max(im.height for im in ims)
sheet = Image.new("RGB", (cols * cw, rows * (ch + 18)), "white")
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * cw, (i // cols) * (ch + 18)
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    sheet.paste(bg.convert("RGB"), (x + (cw - im.width) // 2, y))
    d.rectangle([x, y, x + cw - 1, y + ch - 1], outline=(235, 235, 235))
    d.text((x + 4, y + ch + 3), os.path.basename(f), fill="black")
sheet.save(out)
