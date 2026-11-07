# Puff Hand font kit (draft 0.1)

Puff's display font. Heavy and chunky like Duolingo Sans, with Puff's hand-cut gouache edges and letters that roll a little off the baseline. Live specimen: https://claude.ai/artifact/6s6Kaqc8Vdsq6HDvVjMfLS

## What's in here

| File | What it is | Use it for |
|---|---|---|
| `fonts/PuffHand-Regular.ttf` / `.woff2` | One-colour font | Headings, the daily prompt word, buttons. Graphite. |
| `fonts/PuffHandInlay-Regular.ttf` / `.woff2` | Colour font: orange rim, yellow top, cream belly | Logo and celebrations on the web and in design tools. Two palettes inside: Puff (0) and Blush (1). |
| `fonts/layers/PuffHandRim / Top / Belly` | The inlay split into three one-colour fonts | The app. Stack them to get the inlay look where colour fonts don't work. |
| `web/puff-hand.css` | `@font-face` rules and `.puff-ink` / `.puff-inlay` classes | Web pages, the judges' QR room page |
| `react-native/PuffText.tsx` | `usePuffFonts()`, `<PuffText>`, `<PuffInlay>` | The Expo app |
| `puff-tokens.json` | Colours, palettes, metrics, rules | Anyone setting up styles |
| `test/specimen.html` | Test page that loads every font | Check the fonts render |

Characters: a–z, A–Z, 0–9 and `. , ! ? ' : - &`. Anything else falls back to the next font in the stack (Nunito).

## Expo app

1. Copy `fonts/` to `assets/fonts/` and `react-native/PuffText.tsx` to `components/`.
2. `npx expo install expo-font` if the project doesn't have it.
3. In the root layout:

```tsx
const ready = usePuffFonts();
if (!ready) return null;
```

4. Use it:

```tsx
<PuffText size={40}>a spoon</PuffText>
<PuffInlay size={56}>Puff!</PuffInlay>   // on a graphite background
```

## Web

```html
<link rel="stylesheet" href="web/puff-hand.css">
<h1 class="puff-ink">Today everyone draws</h1>
<div class="puff-inlay">Puff!</div>
<div class="puff-inlay blush">Nice one!</div>
```

The inlay colour font works in current Chrome, Edge, Firefox and Safari.

## Figma

Install `PuffHand-Regular.ttf` (and the inlay font if you want it) on your computer, then restart Figma. If the inlay shows as a single orange colour in Figma, use the three layer fonts stacked instead.

## Rules

- Ink style is graphite. On blush buttons the text stays graphite.
- The inlay goes on graphite only. Never yellow text on white.
- One yellow thing per screen.
- Body copy stays in Nunito. Puff Hand is for a few words at a time.
- The letter roll comes from the `calt` feature and is on by default. Turn it off with `font-feature-settings: "calt" 0` when letters must sit still.

## Changing the font

Glyph shapes live in `puff-hand.html` (the specimen). `tools/build_fonts.py` reads them and rebuilds every file in this kit:

```
pip install fonttools shapely brotli numpy
python tools/build_fonts.py
```

Weight, wobble, corner radius and rim width are constants at the top of the script.

