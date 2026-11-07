# A Sketch a Day — iPhone app

Expo (React Native) app. See `../CLAUDE.md` for the product brief.

## Run it on your iPhone

1. Install **Expo Go** from the App Store on your iPhone.
2. On your laptop, from this `mobile/` folder:

   ```bash
   npm install
   npx expo start
   ```

3. Scan the QR code in the terminal with the iPhone Camera app. The app opens in Expo Go and reloads when you save a file.

Your phone and laptop need to be on the same Wi-Fi. If that doesn't work (e.g. campus Wi-Fi blocks it), use `npx expo start --tunnel`.

To preview in a browser instead, run `npm run web`.

## Where things are

| Path | What |
|---|---|
| `src/app/index.tsx` | **Today** tab: streak, today's prompt, submit buttons |
| `src/app/feed.tsx` | **Feed** tab: everyone's sketches, friends first |
| `src/app/collection.tsx` | **Collection** tab: your past sketches |
| `src/components/app-tabs.tsx` | iPhone tab bar (`app-tabs.web.tsx` is the browser version) |
| `src/components/` | Shared UI pieces (`Screen`, `EmptyState`, themed text/views) |
| `src/data/` | Placeholder data: daily prompts, allowed reaction emojis |
| `src/constants/theme.ts` | Colors, spacing |

Every file in `src/app/` is a screen (Expo Router). Keep other code outside it.

## Before you push

```bash
npx tsc --noEmit
npx expo lint
```

Add packages with `npx expo install <package>` (not `npm install <package>`), so versions match the Expo SDK.
