# Puff animations

Puff the pufferfish, A Sketch a Day's mascot, rigged from the team's PSD (`Untitled_Artwork.psd`) and animated. Colors follow the app's Explicai palette; text uses the Puff Hand font (`design/puff-font`).

- **`puff-expressions.html`**: open in a browser. 19 expressions plus 4 transition drafts (app opens, streak extended, thinking of feedback, countdown with drawing-along and the overtime pop). The outfit toggles mix hat, glasses and brush freely, like the profile wardrobe.
- **`lottie/`**: one Lottie JSON file per state for `lottie-react-native` (`puff-<state>.json`), plus `puff-overtime.json` (60s, plays once). Each file holds all three accessories; **`lottie/withOutfit.ts`** hides the ones the user's outfit leaves out. Images are embedded, so each file works alone.
- **`puff.config.json`**: how the app drives Puff: each state's file, length and whether it loops; the outfit slots; the app moments (app opens, streak extended, feedback, countdown + overtime) as timed steps with Puff's lines; fonts and colors.
- **`gifs/`**: every expression as a looping GIF (420×420, 20 fps, app cream background) in five looks: `all/`, `hat/`, `glasses/`, `brush/`, `nothing/`. For decks, FigJam and Slack, not the app.
- **`assets/`**: the PSD split into layers (PNG, half size) and `PuffHand-Regular.woff2`. `meta.json` has each layer's position and size in original PSD pixels.

## Using it in the app

```bash
npx expo install lottie-react-native
```

```tsx
import { useMemo } from "react";
import LottieView from "lottie-react-native";
import config from "../design/puff-animations/puff.config.json";
import { withOutfit, type Outfit } from "../design/puff-animations/lottie/withOutfit";

// Metro needs static requires, so list the files you use:
const PUFF = {
  neutral: require("../design/puff-animations/lottie/puff-neutral.json"),
  happy: require("../design/puff-animations/lottie/puff-happy.json"),
  drawing: require("../design/puff-animations/lottie/puff-drawing.json"),
  // ...
};

export function Puff({ state = "neutral", outfit, size = 180, onDone }:
  { state?: keyof typeof PUFF; outfit: Outfit; size?: number; onDone?: () => void }) {
  const source = useMemo(() => withOutfit(PUFF[state], outfit), [state, outfit]);
  return (
    <LottieView
      key={state}                          // restart when the state changes
      source={source}
      autoPlay
      loop={config.states[state].loop}
      onAnimationFinish={onDone}            // e.g. explode -> awkward
      style={{ width: size, height: size }}
    />
  );
}
```

Pass the outfit from `useOutfit()` (`mobile/src/data/outfit.ts`); the shapes match.

Run a moment by walking its `steps` with timers: at each `atMs`, set the state and apply any `move`. For the countdown, pick the phase from seconds left (Puff draws along while more than a minute is left); at 0:00 play `overtime`, and at +60s play `explode` starting 1.3s in (`progress` = 1300 / 5000) so it continues from the inflated look.

Not carried into Lottie: Sad's slight color fade (a CSS filter). Everything else matches the HTML; `tools/check_lottie.mjs` renders both side by side to compare.

## Changes from the drawing

- The mouth was painted into the body layer. It's removed from `body.png` so mouths can change.
- Pupils are removed from `eyeL.png` / `eyeR.png` so they can move. `eye*_mask.png` is the inside of each eye, used to clip pupils and eyelids.
- The drawing state adds a pencil (yellow, pink eraser) and a sketchpad, drawn in Explicai colors.

## Re-rendering at any size, background or format (`tools/`)

The animation is independent of the app layout: Puff is one character that takes a state, an outfit and a size. If the app's background or sizes change, re-render the files instead of redrawing anything.

Needs Node 22+, Python with Pillow (`pip install pillow`), and Edge or Chrome.

```bash
cd design/puff-animations
python tools/make_render_page.py                   # builds _render.html from puff-expressions.html
node tools/record.mjs                              # PNG frames of every state x look into _frames/
python tools/make_gifs.py                          # GIFs into gifs/
```

Options (environment variables for `record.mjs`):

| Setting | Default | Example |
|---|---|---|
| `SIZE` | 420 | `SIZE=800` for sharper output |
| `BG` | `#F6EFE4` (app cream) | `BG=transparent` for alpha |
| `FPS` | 20 | `FPS=30` |
| `SETS` | `brush,hat,glasses,none` | `SETS=all,hat+glasses` (any mix with `+`) |
| `BROWSER` | auto (Edge/Chrome) | path to the browser |

Pick states with a second argument: `node tools/record.mjs _frames happy,drawing`.

Transparent formats (record with `BG=transparent` first):

```bash
python tools/make_gifs.py --format webp            # animated WebP with alpha: small, works in browsers, Figma, React Native
python tools/make_gifs.py --format apng            # animated PNG with alpha: lossless, larger
```

GIF can't do soft transparency, so keep GIFs on a solid background.

Lottie files (after editing the animation in `puff-expressions.html`):

```bash
python tools/make_render_page.py
node tools/export_lottie.mjs                       # one file per state into lottie/
node tools/check_lottie.mjs lottie _check happy:all:0.4,drawing:hat+glasses:2,explode:none:2.4   # side-by-side check images
```

The exporter plays the HTML rig frame by frame (30 fps; overtime 15 fps), reads each part's transform and opacity, and writes them as Lottie layers. Parts that never move inside are flattened into one image; eye masks become track mattes; accessory layers are named `acc:hat`, `acc:glasses`, `acc:brush`.
