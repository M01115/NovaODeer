import type { SketchFeedback } from '@/data/feedback';

/**
 * DEMO FALLBACK ONLY. A real analysis of a sample sketch (assets/images/demo-sketch.jpg),
 * saved from an earlier run of the feedback pipeline (2 compliments + 1 tip). Shown, clearly
 * labeled as a demo sample, only when the live AI is unavailable. Never shown as feedback
 * on the user's own sketch.
 */
export const DEMO_SKETCH = require('@/assets/images/demo-sketch.jpg');
export const DEMO_SKETCH_ASPECT = 1;
export const DEMO_PROMPT = 'A coffee mug';

export const DEMO_FEEDBACK: SketchFeedback = {
  status: 'ok',
  subject: 'A mug of something hot, with steam rising',
  overallReaction: "Steamy and cozy, this mug looks like it's ready for a sip!",
  annotations: [
    {
      id: 'c0',
      kind: 'compliment',
      feature: 'wavy steam curls',
      comment:
        'The three loose, wiggly steam lines add movement and make the drink feel warm. They look lively without being fussy.',
      x: 0.37,
      y: 0.105,
      width: 0.17,
      height: 0.145,
      confidence: 0.85,
      located: true,
    },
    {
      id: 'c1',
      kind: 'compliment',
      feature: 'diagonal hatched shadow',
      comment:
        "The parallel hatching on the right side gives the mug a sense of roundness and light direction. It's a quick trick that adds real depth.",
      x: 0.56,
      y: 0.37,
      width: 0.105,
      height: 0.27,
      confidence: 0.85,
      located: true,
    },
    {
      id: 'i0',
      kind: 'improvement',
      feature: 'base anchoring line',
      comment:
        'For a fun twist, try a slightly heavier, darker stroke along the bottom curve of the mug so it sits firmly on the surface line. A few quick dark marks there could ground it nicely.',
      x: 0.31,
      y: 0.735,
      width: 0.31,
      height: 0.08,
      confidence: 0.7,
      located: true,
    },
  ],
  model: 'anthropic/claude-haiku-5.5 (saved demo)',
};
