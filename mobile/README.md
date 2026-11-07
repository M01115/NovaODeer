# Puffolio — iPhone app

One sketch a day, with Puff the pufferfish. Expo (React Native, Expo Router, TypeScript),
Expo SDK 58. See `../CLAUDE.md` for the product brief.

## Run it on your iPhone

1. Install **Expo Go** from the App Store on your iPhone.
2. On your laptop, from this `mobile/` folder:

   ```bash
   npm install
   npx expo start
   ```

3. Scan the QR code in the terminal with the iPhone Camera app. The app opens in Expo Go and
   reloads when you save a file.

Your phone and laptop need to be on the same Wi-Fi. If that doesn't work (e.g. campus Wi-Fi
blocks it), use `npx expo start --tunnel`.

To preview in a browser instead, run `npm run web` (wide screens show an iPhone frame).

## Puff's AI feedback (needs a key)

After you post a sketch, Puff looks at it with a vision model through OpenRouter. The call runs
on the Expo dev server (`src/app/api/feedback+api.ts`), so the key never ships in the app.

1. Create `mobile/.env.local` (git ignores it; never commit a key):

   ```bash
   OPENROUTER_API_KEY=sk-or-...
   # Optional, blank = defaults:
   OPENROUTER_MODEL=            # default anthropic/claude-haiku-5.5
   OPENROUTER_FALLBACK_MODEL=   # default google/gemini-3.8-flash, or "none"
   ```

2. Restart `npx expo start`.

Without a key everything else works; the feedback screen offers a clearly labelled demo sample
instead. Keys: https://openrouter.ai/keys

## The flow

Home (today's prompt) → timer (Puff draws along, then counts down; overtime puffs him up until
he pops) → **Scan my sketch** (camera), **Choose from photos**, or **Draw on my phone** → the
sketch is posted → streak celebration (today's shrimp cooks) → Puff's AI feedback → friends'
feed. The sketch archive sits above Home (pull down or tap "Sketch archive").

## Where things are

| Path | What |
|---|---|
| `src/app/index.tsx` | Home: today's prompt before posting, the friends' feed after |
| `src/app/session.tsx` | Timer, with Puff's moods and sound cues; scan / photos / draw |
| `src/app/draw.tsx` | Draw on the phone: colours, colour wheel, eraser, undo |
| `src/app/complete.tsx` | Streak celebration (shrimp cooking, flame, sounds) |
| `src/app/feedback.tsx` | Puff's AI feedback with circles on the sketch |
| `src/app/streak.tsx`, `profile.tsx` | Launch streak screen; Profile and Puff's wardrobe |
| `src/app/api/` | Server routes: sketch feedback, weekly reflection (OpenRouter) |
| `src/components/smudge.tsx` | Puff, the mascot rig (`Smudge` is his old code name) |
| `src/components/smudge-poses.ts` | Puff's 20 expressions (Morris's animation rig) |
| `src/components/puff-intro.tsx` | App-open roll-in |
| `src/components/archive-view.tsx` | Sketch archive: S path with weekly stats squares |
| `src/components/feed-view.tsx` | Feed: your sketch, Puff's note, friends' sketches |
| `src/components/streak-shrimp.tsx`, `streak-flame.tsx` | Streak days as shrimp; animated flame |
| `src/lib/sounds.ts` | Sound kit (expo-audio) |
| `src/data/` | Mock data: prompts (today is pinned in `prompts.ts`), history, friends, posting |
| `src/server/` | Server-only AI code (never import from screens) |
| `assets/` | `puff/` mascot layers, `shrimp/`, `sounds/`, `fonts/` (Puff Hand), `sketches/`, `friends/` |

Every file in `src/app/` is a screen (Expo Router). Keep other code outside it.

## Credits

- Puff: the team's PSD; rig, expressions, Puff Hand font and sound kit by Morris
  (`morris/puff-animations`, `morris/puff-font`, `morris/puff-sounds`).
- Scan, photo pick and AI feedback by Lukas (`lukas/dev`).
- Friends' sketches in `assets/friends` and most of `assets/sketches` are AI-generated sample
  drawings by fictional "friends", not real users' work. Four archive sketches are real scans.

## Before you push

On a fresh clone, run `npx expo start` once first: it generates `expo-env.d.ts` (git-ignored),
which the type check needs.

```bash
npx tsc --noEmit
npx expo lint
npm test        # AI feedback unit tests (no network)
```

Add packages with `npx expo install <package>` (not `npm install <package>`), so versions match
the Expo SDK.
