# Puff sounds

28 sea-themed UI sounds for the app, all synthesized from code (no samples, no licensing).
Bubbles, a shell marimba, a glass bell, sonar pings and Puff's rubbery skin, all in D major pentatonic.
Rules: rising pitch = good, a soft blub = "not yet", nothing ever sounds like a buzzer.

Listen: open `board.html` in a browser (or the artifact link Morris shares). Each section has a demo button.

## Use in the app

- Files: `wav/<id>.wav`, 44.1 kHz 16-bit mono. `sounds.json` lists every id, when it plays, length, and whether it loops.
- `app-open` and `streak` are timed to the animations in `design/puff-animations` (app open, streak extended). Start them on the same frame as the animation.
- `thinking-loop` loops seamlessly while waiting for the AI.
- `overtime-creak`: play every ~6 s in overtime, raising playback rate from 1.0 to 1.6. Start `inflate` at +0:57, `pop` at +1:00, then `reform`.
- `type-blip`: once per word as Puff's note types out, rate randomized 0.9 to 1.2.
- `notify` is the push-notification sound.

## Change a sound

Edit its recipe in `puff-sounds.js`, then:

```
node render.js        # rewrites wav/ and sounds.json
node build-board.js   # rebuilds board.html
```
