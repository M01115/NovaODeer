# A Sketch a Day — project brief

Read this before working on the code. It describes what we're building and the rules the product must follow.

## What it is

A phone app that builds a daily drawing habit (Duolingo-style, but for sketching). Every day the user picks a medium, gets a prompt, sketches it, submits it, and gets encouraging AI feedback. Friends can see each other's sketches and react with emojis.

**The goal is to keep people practicing, not to grade them.** Every feature is judged by whether it makes someone more likely to come back tomorrow.

## Brand pillars
- **Easy** — low effort to start and finish a day's sketch.
- **Quirky** — playful tone, a mascot with personality (Duolingo-style), fun prompts.
- **Feels improvement** — users should see and feel themselves getting better over time.

## Core flow (from the team wireframe)

```
Select medium → Get prompt → Sketch → Submit → Feedback → Feed / Profile
                                 ├─ paper (main): photo with the iPhone camera
                                 ├─ upload: an existing image from photos/files
                                 └─ draw in app: on the iPhone
```

### 1. Select medium
**v1 targets iPhone only.** iPad support comes later. Supported ways to sketch, in priority order:
1. **Hand sketch on paper → photo with the iPhone camera** (main path). Feels more intentional. Build and polish this first.
2. **Upload an image** — a drawing made elsewhere (e.g. on an iPad or in another drawing app), picked from photos/files.
3. **Draw directly in the app** — a simple drawing canvas on the iPhone (later also iPad with Apple Pencil).

### 2. Daily prompt
- One prompt per day (e.g. "a coffee mug", "your left hand", "a tree in wind").
- Shown right after choosing a medium.
- The user has until the end of their local day to submit.

### 3. Sketch & submit
- Paper: take a photo in the app; ideally crop/straighten it like a document scan.
- Upload: pick an image from photos/files.
- Draw in app: the finished canvas is saved as the image.
- One submission per prompt per day; saved to the user's collection.

### 4. AI feedback (style- and drawing-aware)
- After submitting, an AI vision model looks at the sketch, the prompt and the medium, and returns short feedback.
- **Style- and drawing-aware:** comment on what's actually in this drawing (line quality, shading, composition, the user's own style), not generic praise.
- **Tone: warm, encouraging, a bit quirky** — mostly praise. Name something specific they did well, plus at most one gentle, concrete tip framed positively.
- Never harsh, never a numeric score that feels like a failing grade, never mocking.
- Short: 2–4 sentences, readable in a few seconds. Ideally delivered "by" the mascot.
- If the image isn't a sketch or doesn't match the prompt, respond kindly and still encourage them.
- Over time, reference past sketches so the user *feels improvement* ("your shading is much more confident than last week").

### 5. After submitting
1. **Community feed** — sketches from **everyone** for the same prompt, with **friends' sketches shown first**, then everyone else. People react with emojis from a fixed positive set (e.g. ❤️ 🔥 👏 😍 ✨ 🎨). No free-text comments.
2. **Collection of work** — the user's gallery of every past sketch, so they can look back and see progress.
3. **Style & drawing-aware analysis** — the feedback above, plus longer-term insights about their style.
4. **Streaks & streak freezes** — consecutive-day streak, shown prominently; milestones (3, 7, 30 days) are celebrated. Freezes protect a streak on a missed day. A reset should never feel punishing.
5. **Minutes count** — track time spent sketching (e.g. a timer while drawing) and show totals.

### 6. Extra modes (stretch goals — after the core loop works)
6. **Speed sketch** — short timed sketches.
7. **Sketch-a-thon** — a longer challenge/event, many prompts in a row.

## Product rules (always follow)
- **Positivity first.** All AI text and all community interactions must be encouraging. When in doubt, choose the kinder option.
- **Low friction.** Opening the app → sketching → submitting → feedback should take as few taps as possible.
- **iPhone first.** v1 is designed and built for iPhone only. Don't spend time on iPad layouts until the iPhone app works.

## Team & ownership
- 4-person team. `main` stays working; each person works on `<name>/<feature>` branches and merges via pull request with one teammate's review (see README.md).
- Workstreams:
  - **UI/UX design** — user flow from the wireframe.
  - **Mascot design** — Duolingo-style character.
  - **AI image recognition / feedback interface.**
  - **Backend** — built with Claude Code.

## Tech stack
- **App:** Expo (React Native, TypeScript, Expo Router) in `mobile/`. Expo SDK 58. Run instructions are in `mobile/README.md`; Expo-specific coding rules are in `mobile/AGENTS.md` (check the versioned Expo docs, don't rely on memory).
- Team members test on their own iPhones with Expo Go. No Mac needed.
- The backend will live next to the app (e.g. `backend/`) once chosen.

## Open decisions (fill in as the team decides)
- **Backend & storage** (accounts, images, friends, feed, reactions): _TBD_
- **AI model for feedback:** _TBD_
- **Accounts & friends:** how people sign in and add friends: _TBD_
- **Prompts:** one shared prompt for everyone, or different prompts per medium; hand-written vs AI-generated: _TBD_
- **Mascot:** character and name: _TBD_
