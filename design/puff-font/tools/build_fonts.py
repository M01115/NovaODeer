"""Build the Puff Hand font kit from the glyph table in ../puff-hand.html.

Outputs (in ../fonts):
  PuffHand-Regular        one-colour font (Ink style)
  PuffHandInlay-Regular   colour font (COLRv0): orange rim, yellow top, cream belly; palette 0 Puff, 1 Blush
  layers/PuffHandRim|Top|Belly   one-colour layer fonts to stack where colour fonts are not supported (React Native)

Each glyph is the specimen's centerline stroked at weight 13 with square ends, then given a fixed
hand-cut wobble and softened corners. Three rotated variants per glyph cycle through `calt`, which
reproduces the "roll" from the specimen.

Run:  python build_fonts.py
"""
import re, hashlib
from pathlib import Path
import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity
from shapely.geometry.polygon import orient
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "puff-hand.html"
OUT = HERE.parent / "fonts"

# Look settings, matching the specimen defaults.
W = 13.0          # stroke weight
WOBBLE = 3.0      # hand-cut edge amplitude (svg units, peak to peak)
FREQ = 0.022      # hand-cut edge wave frequency
CORNER = 2.0      # convex corner radius
RIM = 1.7         # orange rim width around the inlay
SPLIT_Y = 74.75   # belly line (svg y, down)
TRACK = 1
SPACE = 24
SCALE = 10        # svg unit -> font unit (UPM 1000)
VARIANTS = [("", -0.5, 0.0), (".r1", 1.6, -0.6), (".r2", -1.8, 0.5)]  # suffix, degrees, dy

PALETTES = {
    "Puff":  {"rim": "#F2A21B", "top": "#FFC53D", "belly": "#FFE7A1"},
    "Blush": {"rim": "#E0507A", "top": "#FF9DB0", "belly": "#FFD9E0"},
}

# ---------- read glyph table from the specimen ----------
html = SRC.read_text(encoding="utf-8")
O_PATH = re.search(r'const O="([^"]+)"', html).group(1)
GLYPHS = {}
for m in re.finditer(r'g\("(.{1,2}?)",(\d+),\[(.*?)\](?:,(\d+))?\);', html):
    ch, w, body, dot = m.group(1), int(m.group(2)), m.group(3), m.group(4)
    paths = [O_PATH if tok.strip() == "O" else tok.strip().strip('"')
             for tok in re.findall(r'"[^"]*"|\bO\b', body)]
    GLYPHS[ch] = {"w": w, "p": paths, "dot": int(dot) if dot else None}
assert len(GLYPHS) == 70, f"expected 70 glyphs, found {len(GLYPHS)}"

# ---------- path flattening ----------
def parse(d):
    toks = re.findall(r"[MLCQ]|-?\d*\.?\d+", d)
    subs, cur, i, cmd = [], None, 0, None
    while i < len(toks):
        if toks[i] in "MLCQ":
            cmd = toks[i]; i += 1
        n = {"M": 2, "L": 2, "C": 6, "Q": 4}[cmd]
        v = list(map(float, toks[i:i + n])); i += n
        if cmd == "M":
            cur = [(v[0], v[1])]; subs.append(cur)
        elif cmd == "L":
            cur.append((v[0], v[1]))
        else:
            p0 = np.array(cur[-1]); pts = np.array(v).reshape(-1, 2)
            for t in np.linspace(0, 1, 18)[1:]:
                if cmd == "C":
                    p = ((1-t)**3)*p0 + 3*((1-t)**2)*t*pts[0] + 3*(1-t)*t*t*pts[1] + t**3*pts[2]
                else:
                    p = ((1-t)**2)*p0 + 2*(1-t)*t*pts[0] + t*t*pts[1]
                cur.append(tuple(p))
    return subs

def stroke(paths, half):
    parts = []
    for d in paths:
        for pts in parse(d):
            if all(np.allclose(pts[0], p) for p in pts):
                parts.append(Point(pts[0]).buffer(half, cap_style="square"))
                continue
            closed = np.allclose(pts[0], pts[-1])
            line = [pts[-2]] + pts + [pts[1]] if closed else pts
            parts.append(LineString(line).buffer(half, cap_style="square", join_style="mitre", mitre_limit=2.0))
    return unary_union(parts)

def wedge(cx, cy=35):
    P = lambda x, y: (cx + x, cy + y)
    d = f"M{P(-6,6)[0]} {P(-6,6)[1]} Q{P(-1,-1)[0]} {P(-1,-1)[1]} {P(5,-12)[0]} {P(5,-12)[1]} Q{P(7,-1)[0]} {P(7,-1)[1]} {P(5,6)[0]} {P(5,6)[1]}"
    return Polygon(parse(d)[0]).buffer(1.25)

# ---------- hand-cut edge: smooth value noise ----------
_rng = np.random.default_rng(7)
_grid = _rng.random((256, 256, 2))

def noise(xy, ofs):
    x = xy[:, 0] * FREQ + ofs; y = xy[:, 1] * FREQ + ofs * 0.37
    xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
    xf, yf = x - xi, y - yi
    sx, sy = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    g = lambda a, b: _grid[a % 256, b % 256]
    top = g(xi, yi) * (1 - sx)[:, None] + g(xi + 1, yi) * sx[:, None]
    bot = g(xi, yi + 1) * (1 - sx)[:, None] + g(xi + 1, yi + 1) * sx[:, None]
    return top * (1 - sy)[:, None] + bot * sy[:, None]

def finish(geom, ofs):
    if geom.is_empty:
        return geom
    geom = shapely.segmentize(geom, 1.2)
    geom = shapely.transform(geom, lambda xy: xy + (noise(xy, ofs) - 0.5) * WOBBLE)
    geom = geom.buffer(0)
    geom = geom.buffer(-CORNER).buffer(CORNER)   # soften convex corners
    geom = geom.buffer(0.8).buffer(-0.8)         # soften inside corners a touch
    return geom.simplify(0.12)

def seed_of(name):
    return int(hashlib.md5(name.encode()).hexdigest()[:6], 16) % 1000

# ---------- build every variant's shapes ----------
def shapes(ch, suffix, rot, dy):
    gl = GLYPHS[ch]
    origin = (gl["w"] / 2, 80)
    place = lambda g: affinity.translate(affinity.rotate(g, rot, origin=origin), 0, dy)
    ofs = seed_of(ch + suffix)
    ink = finish(place(stroke(gl["p"], W / 2)), ofs)
    wdg = finish(place(wedge(gl["dot"])), ofs) if gl["dot"] is not None else Polygon()
    belly_zone = place(box(-60, SPLIT_Y, 200, 200))
    rim = unary_union([ink.buffer(RIM), wdg])
    return {
        "ink": unary_union([ink, wdg]),
        "rim": rim,
        "top": ink.difference(belly_zone),
        "belly": ink.intersection(belly_zone),
    }

def to_font(geom):
    return affinity.affine_transform(geom, [SCALE, 0, 0, -SCALE, 0, 100 * SCALE])

def draw(geom):
    pen = TTGlyphPen(None)
    if geom is not None and not geom.is_empty:
        polys = [g for g in getattr(geom, "geoms", [geom]) if isinstance(g, Polygon)]
        for poly in polys:
            poly = orient(to_font(poly), sign=-1.0)  # TrueType: outer clockwise
            for ring in [poly.exterior, *poly.interiors]:
                pts, last = [], None
                for x, y in list(ring.coords)[:-1]:
                    p = (round(x), round(y))
                    if p != last:
                        pts.append(p); last = p
                if len(pts) > 1 and pts[0] == pts[-1]:
                    pts.pop()
                if len(pts) < 3:
                    continue
                pen.moveTo(pts[0])
                for p in pts[1:]:
                    pen.lineTo(p)
                pen.closePath()
    return pen.glyph()

def gname(ch):
    return f"uni{ord(ch):04X}"

print("Outlining glyphs...")
SHAPES = {}
for ch in GLYPHS:
    for suffix, rot, dy in VARIANTS:
        SHAPES[gname(ch) + suffix] = (ch, shapes(ch, suffix, rot, dy))

def notdef():
    pen = TTGlyphPen(None)
    for r in [(60, 0, 440, 700), (110, 50, 390, 650)]:
        x0, y0, x1, y1 = r
        pts = [(x0, y0), (x0, y1), (x1, y1), (x1, y0)] if r[0] == 60 else [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        pen.moveTo(pts[0]); [pen.lineTo(p) for p in pts[1:]]; pen.closePath()
    return pen.glyph()

FEA_TEMPLATE = """
languagesystem DFLT dflt;
languagesystem latn dflt;
@def = [{d}];
@r1 = [{r1}];
@r2 = [{r2}];
feature calt {{
  sub @r1 @def' by @r2;
  sub @def @def' by @r1;
}} calt;
"""
BASE = [gname(c) for c in GLYPHS]
FEA = FEA_TEMPLATE.format(d=" ".join(BASE), r1=" ".join(b + ".r1" for b in BASE), r2=" ".join(b + ".r2" for b in BASE))

def build(family, layer, file_stem, colr=False, version="0.1"):
    """layer: which shape draws the main glyphs ('ink', 'rim', 'top', 'belly')."""
    names = [".notdef", "space"] + list(SHAPES)
    glyphs = {".notdef": notdef(), "space": TTGlyphPen(None).glyph()}
    metrics = {".notdef": (500, 60), "space": (SPACE * SCALE, 0)}
    for n, (ch, s) in SHAPES.items():
        glyphs[n] = draw(s[layer])
        metrics[n] = ((GLYPHS[ch]["w"] + TRACK) * SCALE, 0)
    layer_map = {}
    if colr:
        for n, (ch, s) in SHAPES.items():
            for i, part in enumerate(["rim", "top", "belly"]):
                ln = f"{n}.{part}"
                names.append(ln)
                glyphs[ln] = draw(s[part])
                metrics[ln] = metrics[n]
            layer_map[n] = [(f"{n}.rim", 0), (f"{n}.top", 1), (f"{n}.belly", 2)]

    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(names)
    cmap = {ord(c): gname(c) for c in GLYPHS}
    cmap[32] = "space"
    cmap[160] = "space"
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    # left side bearing from glyph bounds
    glyf = fb.font["glyf"]
    hm = {}
    for n in names:
        g = glyf[n]
        g.recalcBounds(glyf)
        hm[n] = (metrics[n][0], getattr(g, "xMin", 0) if g.numberOfContours else 0)
    fb.setupHorizontalMetrics(hm)
    fb.setupHorizontalHeader(ascent=860, descent=-260)
    ps = family.replace(" ", "") + "-Regular"
    fb.setupNameTable({
        "familyName": family, "styleName": "Regular",
        "uniqueFontIdentifier": f"{ps};{version}", "fullName": f"{family} Regular",
        "psName": ps, "version": f"Version {version}",
        "copyright": "Draft for the Puff sketch app team, 2026.",
    })
    fb.setupOS2(sTypoAscender=860, sTypoDescender=-260, sTypoLineGap=0,
                usWinAscent=900, usWinDescent=300, sxHeight=540, sCapHeight=740,
                fsSelection=0x40 | 0x80, achVendID="PUFF", usWeightClass=400, version=4)
    fb.setupPost()
    import time
    from fontTools.misc.timeTools import timestampSinceEpoch
    fb.font["head"].created = fb.font["head"].modified = timestampSinceEpoch(time.time())
    font = fb.font
    addOpenTypeFeaturesFromString(font, FEA)
    if colr:
        font["COLR"] = buildCOLR(layer_map, version=0)
        def rgba(h):
            h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
        font["CPAL"] = buildCPAL([[rgba(p[k]) for k in ("rim", "top", "belly")] for p in PALETTES.values()])
    OUT.joinpath(Path(file_stem).parent).mkdir(parents=True, exist_ok=True)
    ttf = OUT / f"{file_stem}.ttf"
    font.save(ttf)
    w2 = TTFont(ttf); w2.flavor = "woff2"; w2.save(OUT / f"{file_stem}.woff2")
    print(f"  {ttf.relative_to(OUT.parent)}  ({len(names)} glyphs)")

print("Writing fonts...")
build("Puff Hand", "ink", "PuffHand-Regular")
build("Puff Hand Inlay", "rim", "PuffHandInlay-Regular", colr=True)
build("Puff Hand Rim", "rim", "layers/PuffHandRim-Regular")
build("Puff Hand Top", "top", "layers/PuffHandTop-Regular")
build("Puff Hand Belly", "belly", "layers/PuffHandBelly-Regular")
print("Done.")

