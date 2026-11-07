# Puff animations

Puff the pufferfish, rigged from the team's PSD (`Untitled_Artwork.psd`) and animated.

- **`puff-expressions.html`**: open in a browser. 18 expressions plus 4 transition drafts (app opens, streak extended, thinking of feedback, countdown with overtime pop). The "Wearing" switch picks brush, hat, glasses, nothing, or all three.
- **`gifs/`**: every expression as a looping GIF (420×420, 20 fps, paper background), one folder per accessory: `brush/`, `hat/`, `glasses/`, `nothing/`.
- **`assets/`**: the PSD split into layers (PNG, half size). `meta.json` has each layer's position and size in original PSD pixels, for rebuilding the rig in the app.

## Changes from the drawing

- The mouth was painted into the body layer. It's removed from `body.png` so mouths can change.
- Pupils are removed from `eyeL.png` / `eyeR.png` so they can move. `eye*_mask.png` is the inside of each eye, used to clip pupils and eyelids.

## Re-rendering at any size, background or format (`tools/`)

The animation is independent of the app layout: Puff is one character that takes a state, an accessory and a size. If the app's background or sizes change, re-render the files instead of redrawing anything.

Needs Node 22+, Python with Pillow (`pip install pillow`), and Edge or Chrome.

```bash
cd design/puff-animations
python tools/make_render_page.py                   # builds _render.html from puff-expressions.html
node tools/record.mjs                              # PNG frames of every state x accessory into _frames/
python tools/make_gifs.py                          # GIFs into gifs/
```

Options (environment variables for `record.mjs`):

| Setting | Default | Example |
|---|---|---|
| `SIZE` | 420 | `SIZE=800` for sharper output |
| `BG` | `#FAFAF7` (app paper) | `BG=transparent` for alpha, `BG=#15213B` for a dark screen |
| `FPS` | 20 | `FPS=30` |
| `SETS` | `brush,hat,glasses,none` | `SETS=hat` |
| `BROWSER` | auto (Edge/Chrome) | path to the browser |

Pick states with a second argument: `node tools/record.mjs _frames happy,thinking`.

Transparent formats (record with `BG=transparent` first):

```bash
python tools/make_gifs.py --format webp            # animated WebP with alpha: small, works in browsers, Figma, React Native
python tools/make_gifs.py --format apng            # animated PNG with alpha: lossless, larger
```

GIF can't do soft transparency, so keep GIFs on a solid background.

## Building it in Expo

Draw the layers with `react-native-svg` at the positions in `meta.json`. Animate with Reanimated, copying the timings from each card in the HTML. Both run in Expo Go.
