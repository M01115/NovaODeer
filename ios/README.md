# A Sketch a Day — native iPhone app (SwiftUI)

A native Swift/SwiftUI version of the Expo app in `../mobile/`. Same screens, same
placeholder data, same paper-and-ink look. See `../CLAUDE.md` for the product brief.

## Run it

Needs a Mac with **Xcode 16 or newer**.

1. Open `SketchADay.xcodeproj` in Xcode.
2. Pick an iPhone simulator (or your own iPhone) in the toolbar and press **Run** (⌘R).
3. To run on your own iPhone, select the **SketchADay** target → *Signing & Capabilities*
   and choose your Apple ID team.

Every `#Preview` at the bottom of a screen file shows that screen live in Xcode's canvas.

## Where things are

| Path | What | Expo original |
|---|---|---|
| `SketchADay/SketchADayApp.swift` | App entry and tab bar (Today / Feed / Collection) | `app/_layout.tsx`, `components/app-tabs.tsx` |
| `SketchADay/Screens/HomeView.swift` | **Today**: streak, prompt, Smudge, pull down for archive | `app/(tabs)/index.tsx` |
| `SketchADay/Screens/SessionView.swift` | Sketch timer: 2/5/10 min, moods, haptics, overtime | `app/session.tsx` |
| `SketchADay/Screens/StreakView.swift` | Streak celebration shown on launch | `app/streak.tsx` |
| `SketchADay/Screens/ArchiveView.swift` | Diagonal card stack of past sketches | `app/archive.tsx` |
| `SketchADay/Screens/JourneyView.swift` | Winding sketch path + past sketch detail | `app/journey.tsx`, `components/sketch-path.tsx`, `app/sketch/[date].tsx` |
| `SketchADay/Screens/TabScreens.swift` | Feed and Collection (empty states for now) | `app/(tabs)/feed.tsx`, `collection.tsx` |
| `SketchADay/Components/Smudge.swift` | Smudge the mascot, with moods and breathing/blinking | `components/smudge.tsx` |
| `SketchADay/Components/Common.swift` | Buttons, speech bubble, empty state, sketch thumbnail, haptics | `components/*` |
| `SketchADay/Data/SketchData.swift` | Prompts, reactions, mock history, streak math | `data/*` |
| `SketchADay/Theme/Theme.swift` | Colors, spacing, text styles | `constants/theme.ts` |

New `.swift` files you add inside `SketchADay/` are picked up by Xcode automatically.

## Not built yet (same as the Expo app)

Scanning the paper, picking from photos, AI feedback, the feed and collection, and a backend.
