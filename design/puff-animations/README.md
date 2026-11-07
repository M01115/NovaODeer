# Puff animations

Puff the pufferfish, rigged from the team's PSD (`Untitled_Artwork.psd`) and animated.

- **`puff-expressions.html`**: open in a browser. 18 expressions plus 4 transition drafts (app opens, streak extended, thinking of feedback, countdown with overtime pop). The "Wearing" switch picks brush, hat, glasses, nothing, or all three.
- **`gifs/`**: every expression as a looping GIF (420×420, 20 fps, paper background), one folder per accessory: `brush/`, `hat/`, `glasses/`, `nothing/`.
- **`lottie/`**: every expression as a Lottie JSON file for `lottie-react-native`, one folder per accessory, plus `puff-overtime-*.json` (60s, plays once). Images are embedded, so each file works alone.
- **`puff.config.json`**: how the app drives Puff: each state's file, length and whether it loops, plus the app moments (app opens, streak extended, feedback, countdown + overtime) as timed steps with Puff's lines.
- **`assets/`**: the PSD split into layers (PNG, half size). `meta.json` has each layer's position and size in original PSD pixels, for rebuilding the rig in the app.

## Using it in the app

```bash
npx expo install lottie-react-native
```

```tsx
import LottieView from "lottie-react-native";
import config from "../design/puff-animations/puff.config.json";

// Metro needs static requires, so list the files you use, e.g.:
const PUFF = {
  hat: {
    neutral: require("../design/puff-animations/lottie/hat/puff-neutral-hat.json"),
    happy: require("../design/puff-animations/lottie/hat/puff-happy-hat.json"),
    // ...
  },
};

export function Puff({ state = "neutral", accessory = "hat", size = 180, onDone }) {
  const s = config.states[state];
  return (
    <LottieView
      key={`${state}-${accessory}`}        // restart when the state changes
      source={PUFF[accessory][state]}
      autoPlay
      loop={s.loop}
      onAnimationFinish={onDone}            // e.g. explode -> awkward
      style={{ width: size, height: size }}
    />
  );
}
```

Run a moment by walking its `steps` with timers: at each `atMs`, set the state and apply any `move`. For the countdown, pick the phase from seconds left; at 0:00 play `overtime`, and at +60s play `explode` starting 1.3s in (`progress` = 1300 / 5000) so it continues from the inflated look.

Not carried into Lottie: Sad's slight color fade (a CSS filter). Everything else matches the HTML; `tools/check_lottie.mjs` renders both side by side to compare.

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

Lottie files (after editing the animation in `puff-expressions.html`):

```bash
python tools/make_render_page.py
node tools/export_lottie.mjs                       # all states x accessories into lottie/
node tools/check_lottie.mjs lottie _check happy:hat:0.4,explode:none:2.4   # side-by-side check images
```

The exporter plays the HTML rig frame by frame (30 fps; overtime 15 fps), reads each part's transform and opacity, and writes them as Lottie layers. Parts that never move inside are flattened into one image; eye masks become track mattes.

## Building it in Expo

Draw the layers with `react-native-svg` at the positions in `meta.json`. Animate with Reanimated, copying the timings from each card in the HTML. Both run in Expo Go.
