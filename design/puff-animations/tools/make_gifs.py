"""Turns recorded frame folders into looping animations.

  python make_gifs.py [framesDir] [outDir] [--format gif|webp|apng]

gif  : paper background, 128-color palette, no dithering (flat art stays clean)
webp : animated WebP with full alpha (record with BG=transparent), small files, works in browsers/Figma/RN
apng : animated PNG with full alpha, largest but lossless
Needs Pillow (pip install pillow).
"""
import os, glob, argparse
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument("frames", nargs="?", default=str(here.parent / "_frames"))
ap.add_argument("out", nargs="?")
ap.add_argument("--format", choices=["gif", "webp", "apng"], default="gif")
a = ap.parse_args()
fmt = a.format
frames_root = Path(a.frames)
out_root = Path(a.out) if a.out else here.parent / ("gifs" if fmt == "gif" else fmt)
FPS = int(os.environ.get("FPS", 20))
NAMES = {"neutral": "neutral", "happy": "happy", "sad": "sad", "angry": "angry", "zoning": "zoning-out", "rolling": "rolling",
         "flapping": "flapping", "bouncing": "bouncing", "thinking": "thinking", "nervous": "nervous", "awkward": "awkward",
         "puffup": "puff-up", "deflate": "deflate", "squint": "looking-closely", "surprised": "surprised", "proud": "proud",
         "sleepy": "sleepy", "explode": "inflate-and-pop"}
SETS = {"brush": "brush", "hat": "hat", "glasses": "glasses", "none": "nothing"}

for d in sorted(glob.glob(str(frames_root / "*__*"))):
    x, v = os.path.basename(d).split("__")
    files = sorted(glob.glob(os.path.join(d, "*.png")))
    if not files or x not in NAMES:
        continue
    sub = out_root / SETS.get(v, v)
    sub.mkdir(parents=True, exist_ok=True)
    name = f"puff-{NAMES[x]}-{SETS.get(v, v)}"
    ms = 1000 // FPS
    if fmt == "gif":
        rgb = [Image.open(f).convert("RGB") for f in files]
        # one shared palette sampled across the loop keeps colors steady between frames
        picks = rgb[::max(1, len(rgb) // 6)][:6]
        sample = Image.new("RGB", (rgb[0].width, rgb[0].height * len(picks)))
        for i, f in enumerate(picks):
            sample.paste(f, (0, i * f.height))
        pal = sample.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in rgb]
        out = sub / f"{name}.gif"
        q[0].save(out, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=True, disposal=1)
    else:
        rgba = [Image.open(f).convert("RGBA") for f in files]
        out = sub / f"{name}.{ 'webp' if fmt == 'webp' else 'png'}"
        kw = dict(save_all=True, append_images=rgba[1:], duration=ms, loop=0)
        if fmt == "webp":
            rgba[0].save(out, format="WEBP", quality=90, method=4, **kw)
        else:
            rgba[0].save(out, format="PNG", disposal=1, blend=0, **kw)
    print(f"{out}  {len(files)} frames  {out.stat().st_size // 1024} KB")
