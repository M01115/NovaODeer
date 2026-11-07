# Puff animations

Puff the pufferfish, rigged from the team's PSD (`Untitled_Artwork.psd`) and animated.

- **`puff-expressions.html`**: open in a browser. 18 expressions plus 4 transition drafts (app opens, streak extended, thinking of feedback, countdown with overtime pop). The "Wearing" switch picks brush, hat, glasses, nothing, or all three.
- **`gifs/`**: every expression as a looping GIF (420×420, 20 fps, paper background), one folder per accessory: `brush/`, `hat/`, `glasses/`, `nothing/`.
- **`assets/`**: the PSD split into layers (PNG, half size). `meta.json` has each layer's position and size in original PSD pixels, for rebuilding the rig in the app.

## Changes from the drawing

- The mouth was painted into the body layer. It's removed from `body.png` so mouths can change.
- Pupils are removed from `eyeL.png` / `eyeR.png` so they can move. `eye*_mask.png` is the inside of each eye, used to clip pupils and eyelids.

## Building it in Expo

Draw the layers with `react-native-svg` at the positions in `meta.json`. Animate with Reanimated, copying the timings from each card in the HTML. Both run in Expo Go.
