import type { CSSAnimationTimingFunction } from 'react-native-reanimated';
import { cubicBezier } from 'react-native-reanimated';

/**
 * Puff's expressions, ported from Morris's rig (morris/puff-animations branch,
 * design/puff-animations/puff-expressions.html). Every move, timing and offset here is
 * copied from that page, so the app matches the GIFs. Distances are in PSD pixels (the
 * 1640×2360 mascot PSD); the component scales them to the size it's drawn at.
 */

/** One keyframe: translate (x, y), rotate (r, degrees), scale (s, or sx/sy), opacity (o). */
export type V = {
  x?: number;
  y?: number;
  r?: number;
  s?: number;
  sx?: number;
  sy?: number;
  o?: number;
  ease?: CSSAnimationTimingFunction;
};
/** Keyframes as [percent(s), values]. */
export type Frames = [number | number[], V][];
export type Anim = {
  f: Frames;
  ms: number;
  ease?: CSSAnimationTimingFunction;
  delay?: number;
  alternate?: boolean;
};
/** A moving part: a looping animation, and/or a pose it holds when not animating. */
export type Part = { still?: V; anim?: Anim | null };

export type Mouth =
  | 'neutral'
  | 'grin'
  | 'frown'
  | 'o'
  | 'tight'
  | 'angry'
  | 'wavy'
  | 'grimace'
  | 'pucker';

export type FxName =
  | 'sparkles'
  | 'tear'
  | 'steam'
  | 'anger'
  | 'bubble'
  | 'dust'
  | 'sweat'
  | 'sweat2'
  | 'speed'
  | 'thought'
  | 'dots'
  | 'air'
  | 'confetti'
  | 'zzz'
  | 'bang'
  | 'boom'
  | 'drawpad';

export type Pose = {
  mouth: Mouth;
  fx?: FxName[];
  mover?: Part;
  squash?: Part;
  /** Where the squash layer pivots (PSD px), if not at Puff's base. */
  squashOrigin?: [number, number];
  /** Pencil held in his mouth (drawing along). */
  pencil?: boolean;
  puffer?: Part;
  spk?: Part;
  /** Orange flush over the body (angry, about to pop). Opacity. */
  flush?: Part;
  /** Pink cheeks. Opacity. */
  blush?: Part;
  /** Both eyes as a group (widen, pop). */
  eyes?: Part;
  pupil?: Part;
  pupilL?: Part;
  pupilR?: Part;
  /** Upper lids: how far down they rest (fraction of the lid), and tilt per eye. */
  lu?: number;
  luL?: number;
  luR?: number;
  lrL?: number;
  lrR?: number;
  /** Lower lids: how far up (negative fraction) — smiling eyes. */
  ll?: number;
  /** Blink loop length in ms; null = no blinking. */
  blink?: number | null;
  /** Custom upper-lid loop, y in fractions of the lid's height (sleepy droop). */
  lidU?: Anim;
  fin?: Part;
  tail?: Part;
  finwrap?: Part;
  tailwrap?: Part;
  beret?: Part;
  brush?: Part;
  glasses?: Part;
  /** Ease static changes (the overtime puff grows every second). */
  smooth?: boolean;
};

export type PuffMood =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'zoning'
  | 'rolling'
  | 'flapping'
  | 'bouncing'
  | 'thinking'
  | 'nervous'
  | 'awkward'
  | 'puffup'
  | 'deflate'
  | 'squint'
  | 'surprised'
  | 'proud'
  | 'sleepy'
  | 'explode'
  | 'overtime'
  | 'drawing';

const a = (ms: number, f: Frames, opts: Omit<Anim, 'f' | 'ms'> = {}): Anim => ({ ms, f, ...opts });

/** Idle life every pose gets unless it says otherwise. */
export const DEFAULTS = {
  blink: 4500,
  fin: a(3000, [
    [[0, 100], { r: 0 }],
    [50, { r: -8 }],
  ]),
  tail: a(2400, [
    [[0, 100], { r: 4 }],
    [50, { r: -6 }],
  ]),
};

const wave = (ms: number, from: number, to: number) =>
  a(ms, [
    [[0, 100], { r: from }],
    [50, { r: to }],
  ]);
const pulse = (ms: number, s: number) =>
  a(ms, [
    [[0, 100], { s: 1 }],
    [50, { s }],
  ]);
const jitter = (ms: number) =>
  a(
    ms,
    [
      [0, { x: 0, y: 0 }],
      [25, { x: -3, y: 2 }],
      [50, { x: 3, y: -2 }],
      [75, { x: -2, y: -3 }],
      [100, { x: 0, y: 0 }],
    ],
    { ease: 'linear' }
  );
/** Parts pushed out while puffed up, held, then back. */
const pushout = (x: number, y: number) =>
  a(3000, [
    [[0, 8], { x: 0, y: 0 }],
    [[22, 70], { x, y }],
    [[85, 100], { x: 0, y: 0 }],
  ]);
const pushin = (x: number, y: number) =>
  a(3000, [
    [[0, 10], { x, y }],
    [[50, 85], { x: 0, y: 0 }],
    [100, { x, y }],
  ]);

/** The pop (5s loop) starts this far in, so it bursts soon after it's switched on. */
export const EXPLODE_OFFSET = -1300;
const ex = (f: Frames, ease: CSSAnimationTimingFunction = 'ease-in-out'): Anim =>
  a(5000, f, { ease, delay: EXPLODE_OFFSET });

export function getPose(mood: PuffMood, inflate = 0): Pose {
  switch (mood) {
    case 'neutral':
      return {
        mouth: 'neutral',
        mover: {
          anim: a(3000, [
            [[0, 100], { y: 0 }],
            [50, { y: -16 }],
          ]),
        },
      };

    case 'happy':
      return {
        mouth: 'grin',
        fx: ['sparkles'],
        mover: {
          anim: a(900, [
            [[0, 100], { y: 0 }],
            [45, { y: -70 }],
          ]),
        },
        squash: {
          anim: a(900, [
            [[0, 100], { sx: 1.07, sy: 0.93 }],
            [20, { s: 1 }],
            [45, { sx: 0.96, sy: 1.05 }],
            [80, { s: 1 }],
          ]),
        },
        ll: -0.58,
        pupil: { still: { y: -30 } },
        fin: { anim: wave(450, 8, -26) },
        tail: { anim: wave(450, 8, -26) },
        beret: {
          anim: a(
            900,
            [
              [[0, 100], { y: 0, r: 0 }],
              [55, { y: -24, r: -6 }],
            ],
            { delay: -750 }
          ),
        },
        blush: { still: { o: 0.85 } },
      };

    case 'sad':
      return {
        mouth: 'frown',
        fx: ['tear'],
        mover: {
          still: { y: 22, r: -3 },
          anim: a(4000, [
            [[0, 100], { y: 22, r: -3 }],
            [50, { y: 32, r: 2 }],
          ]),
        },
        luL: 0.36,
        lrL: -14,
        luR: 0.36,
        lrR: 14,
        blink: 6000,
        pupil: { still: { y: 30 } },
        fin: { still: { r: 26 }, anim: null },
        tail: { anim: { ...DEFAULTS.tail, ms: 5000 } },
        beret: { still: { x: -12, y: 26, r: -12 } },
        spk: { still: { s: 0.95 } },
      };

    case 'angry':
      return {
        mouth: 'angry',
        fx: ['steam', 'anger'],
        mover: {
          anim: a(
            180,
            [
              [[0, 100], { x: 0 }],
              [25, { x: -7 }],
              [75, { x: 7 }],
            ],
            { ease: 'linear' }
          ),
        },
        puffer: { anim: pulse(1000, 1.06) },
        spk: { anim: pulse(1000, 1.1) },
        flush: {
          still: { o: 0.5 },
          anim: a(1000, [
            [[0, 100], { o: 0.35 }],
            [50, { o: 0.75 }],
          ]),
        },
        luL: 0.3,
        lrL: 16,
        luR: 0.3,
        lrR: -16,
        blink: null,
        pupilL: { still: { x: 18, y: 14, s: 0.75 } },
        pupilR: { still: { x: -14, y: 18, s: 0.75 } },
        fin: { anim: wave(250, 0, -14) },
        beret: { still: { y: -16, r: 4 } },
      };

    case 'zoning':
      return {
        mouth: 'o',
        fx: ['bubble'],
        mover: {
          anim: a(5000, [
            [[0, 100], { y: 0, r: -2 }],
            [50, { y: -20, r: 3 }],
          ]),
        },
        lu: 0.46,
        blink: 7000,
        pupilL: {
          still: { x: -30, y: 14 },
          anim: a(5000, [
            [[0, 100], { x: -30, y: 14 }],
            [50, { x: -12, y: 28 }],
          ]),
        },
        pupilR: {
          still: { x: 32, y: 10 },
          anim: a(5000, [
            [[0, 100], { x: 32, y: 10 }],
            [50, { x: 14, y: 26 }],
          ]),
        },
        fin: { anim: { ...DEFAULTS.fin, ms: 6000 } },
        beret: {
          anim: a(6000, [
            [[0, 100], { x: 0, y: 0, r: 0 }],
            [50, { x: -12, y: 20, r: -9 }],
          ]),
        },
      };

    case 'rolling':
      return {
        mouth: 'grin',
        fx: ['dust'],
        mover: {
          anim: a(4000, [
            [0, { x: -150, r: 0 }],
            [[45, 50], { x: 150, r: 360 }],
            [[95, 100], { x: -150, r: 0 }],
          ]),
        },
        eyes: { still: { s: 1.06 } },
      };

    case 'flapping':
      return {
        mouth: 'tight',
        fx: ['sweat', 'speed'],
        mover: {
          anim: a(
            1800,
            [
              [0, { x: -60, r: 6 }],
              [100, { x: 50, r: 6 }],
            ],
            { alternate: true }
          ),
        },
        squash: {
          anim: a(
            140,
            [
              [[0, 100], { y: 0 }],
              [50, { y: -9 }],
            ],
            { ease: 'linear' }
          ),
        },
        fin: { anim: { ...wave(140, 12, -40), ease: 'linear' } },
        tail: { anim: { ...wave(200, 12, -40), ease: 'linear' } },
        lu: 0.3,
        ll: -0.3,
        blink: null,
      };

    case 'bouncing': {
      const up = cubicBezier(0.33, 0.66, 0.66, 1);
      const down = cubicBezier(0.33, 0, 0.66, 0.33);
      return {
        mouth: 'grin',
        mover: {
          anim: a(900, [
            [[0, 100], { y: 0, ease: up }],
            [50, { y: -160, ease: down }],
          ]),
        },
        squash: {
          anim: a(
            900,
            [
              [[0, 100], { sx: 1.14, sy: 0.84 }],
              [12, { sx: 0.94, sy: 1.08 }],
              [50, { s: 1 }],
              [88, { sx: 0.95, sy: 1.06 }],
            ],
            { ease: 'linear' }
          ),
        },
        beret: {
          anim: a(900, [
            [[0, 100], { y: 0, r: 0 }],
            [10, { y: 16, r: 0 }],
            [58, { y: -34, r: -6 }],
          ]),
        },
        fin: { anim: wave(300, 0, -22) },
        eyes: { still: { s: 1.06 } },
      };
    }

    case 'thinking':
      return {
        mouth: 'pucker',
        fx: ['thought'],
        mover: { anim: a(4000, [[[0, 100], { r: -5 }], [50, { r: -1 }]]) },
        pupil: { still: { x: 22, y: -34 } },
        luL: 0.28,
        blink: 5000,
        fin: { anim: wave(600, -34, -24) },
      };

    case 'nervous':
      return {
        mouth: 'wavy',
        fx: ['sweat', 'sweat2'],
        mover: { anim: jitter(90) },
        pupil: {
          still: { s: 0.7 },
          anim: a(
            1200,
            [
              [[0, 20], { x: -26, y: 0, s: 0.7 }],
              [[30, 55], { x: 24, y: -4, s: 0.7 }],
              [[65, 85], { x: -6, y: 6, s: 0.7 }],
              [100, { x: -26, y: 0, s: 0.7 }],
            ],
            { ease: 'step-end' }
          ),
        },
        blink: 1800,
        fin: { anim: wave(200, -4, 7) },
        spk: { anim: jitter(120) },
      };

    case 'awkward':
      return {
        mouth: 'grimace',
        fx: ['sweat', 'dots'],
        mover: { anim: a(3000, [[[0, 100], { r: -3 }], [50, { r: -1.5 }]]) },
        pupil: {
          still: { x: 36, y: 4 },
          anim: a(4000, [
            [[0, 70, 100], { x: 36, y: 4 }],
            [[78, 90], { x: -12, y: 4 }],
          ]),
        },
        lu: 0.16,
        blink: 3000,
        fin: { anim: wave(350, -46, -58) },
        beret: { still: { r: 7 } },
        blush: { still: { o: 0.85 } },
      };

    case 'puffup':
      return {
        mouth: 'o',
        puffer: {
          anim: a(3000, [
            [[0, 8], { s: 1 }],
            [22, { s: 1.33 }],
            [28, { s: 1.24 }],
            [[34, 70], { s: 1.28 }],
            [[85, 100], { s: 1 }],
          ]),
        },
        spk: { anim: pulse(3000, 1.08) },
        eyes: {
          anim: a(3000, [
            [[0, 8], { s: 1 }],
            [[22, 70], { s: 1.12 }],
            [[85, 100], { s: 1 }],
          ]),
        },
        pupil: {
          anim: a(3000, [
            [[0, 8], { s: 1 }],
            [[22, 70], { s: 0.6 }],
            [[85, 100], { s: 1 }],
          ]),
        },
        beret: { anim: pushout(0, -120) },
        brush: { anim: pushout(-50, -70) },
        finwrap: { anim: pushout(-110, 0) },
        tailwrap: { anim: pushout(-80, 80) },
        blink: null,
      };

    case 'deflate':
      return {
        mouth: 'o',
        fx: ['air'],
        mover: {
          anim: a(3000, [
            [[0, 12, 60, 100], { x: 0, y: 0, r: 0 }],
            [22, { x: -30, y: -20, r: -8 }],
            [32, { x: 26, y: -6, r: 7 }],
            [42, { x: -14, y: 8, r: -3 }],
          ]),
        },
        puffer: {
          anim: a(3000, [
            [[0, 10], { s: 1.26 }],
            [20, { sx: 1.1, sy: 1.3 }],
            [28, { sx: 1.25, sy: 1 }],
            [36, { sx: 0.95, sy: 1.12 }],
            [44, { sx: 1.08, sy: 0.92 }],
            [[55, 85], { s: 0.92 }],
            [100, { s: 1.26 }],
          ]),
        },
        beret: { anim: pushin(0, -110) },
        brush: { anim: pushin(-50, -70) },
        finwrap: { anim: pushin(-110, 0) },
        tailwrap: { anim: pushin(-80, 80) },
        lu: 0.38,
        ll: -0.58,
        blink: null,
        blush: {
          still: { o: 0.9 },
          anim: a(3000, [
            [[0, 30], { o: 0 }],
            [[45, 85], { o: 0.9 }],
            [100, { o: 0 }],
          ]),
        },
      };

    case 'squint':
      return {
        mouth: 'pucker',
        mover: {
          still: { x: 10, r: 3 },
          anim: a(3000, [
            [[0, 100], { x: 10, r: 3 }],
            [50, { x: 26, r: 6 }],
          ]),
        },
        lu: 0.42,
        ll: -0.36,
        blink: null,
        pupil: {
          anim: a(1800, [
            [[0, 100], { x: -34 }],
            [50, { x: 34 }],
          ]),
        },
        glasses: {
          anim: a(3000, [
            [[0, 40], { y: 0 }],
            [[60, 82], { y: 34 }],
            [[92, 100], { y: 0 }],
          ]),
        },
      };

    case 'surprised':
      return {
        mouth: 'o',
        fx: ['bang'],
        mover: {
          anim: a(
            2400,
            [
              [[0, 5], { y: 0 }],
              [15, { y: -70 }],
              [30, { y: 0 }],
              [36, { y: -14 }],
              [[42, 100], { y: 0 }],
            ],
            { ease: 'ease-out' }
          ),
        },
        eyes: {
          still: { s: 1.16 },
          anim: a(
            2400,
            [
              [[0, 5], { s: 1 }],
              [[15, 85], { s: 1.16 }],
              [100, { s: 1 }],
            ],
            { ease: 'ease-out' }
          ),
        },
        pupil: {
          still: { s: 0.55 },
          anim: a(
            2400,
            [
              [[0, 5], { s: 1 }],
              [[15, 85], { s: 0.55 }],
              [100, { s: 1 }],
            ],
            { ease: 'ease-out' }
          ),
        },
        spk: {
          anim: a(
            2400,
            [
              [[0, 5], { s: 1 }],
              [[15, 85], { s: 1.14 }],
              [100, { s: 1 }],
            ],
            { ease: 'ease-out' }
          ),
        },
        beret: {
          anim: a(2400, [
            [[0, 5], { x: 0, y: 0, r: 0 }],
            [18, { x: 30, y: -110, r: -28 }],
            [40, { x: 0, y: 0, r: 0 }],
            [46, { x: 0, y: -14, r: 0 }],
            [[52, 100], { x: 0, y: 0, r: 0 }],
          ]),
        },
        fin: {
          anim: a(
            2400,
            [
              [[0, 5, 90, 100], { r: 0 }],
              [[15, 80], { r: -28 }],
            ],
            { ease: 'ease-out' }
          ),
        },
        blink: null,
      };

    case 'proud':
      return {
        mouth: 'grin',
        fx: ['sparkles', 'confetti'],
        mover: {
          anim: a(700, [
            [[0, 100], { y: 0 }],
            [50, { y: -36 }],
          ]),
        },
        puffer: { still: { s: 1.05 } },
        ll: -0.58,
        pupil: { still: { y: -30 } },
        fin: { anim: wave(400, 10, -42) },
        beret: { still: { x: -8, y: -6, r: -12 } },
        blush: { still: { o: 0.85 } },
      };

    case 'drawing':
      // Morris's "Drawing along" (4 s loop): pencil in his mouth, scribbling on a pad while a
      // tiny Puff doodle appears stroke by stroke; near the end he peeks up at you and the
      // page flips. For the sketch timer while there's plenty of time.
      return {
        mouth: 'tight',
        fx: ['drawpad'],
        pencil: true,
        mover: {
          still: { r: 2 },
          anim: a(4000, [
            [[0, 100], { x: 0, r: 2 }],
            [40, { x: 14, r: 4 }],
            [70, { x: -8, r: 1 }],
          ]),
        },
        squashOrigin: [1240, 1280],
        squash: {
          anim: a(
            320,
            [
              [[0, 100], { x: 0, y: 0, r: 0 }],
              [25, { x: 6, y: 3, r: 1.6 }],
              [50, { x: -4, y: 5, r: -0.8 }],
              [75, { x: 3, y: -2, r: 1 }],
            ],
            { ease: 'linear' }
          ),
        },
        pupil: {
          still: { x: 20, y: 30 },
          anim: a(4000, [
            [[0, 74], { x: 20, y: 30 }],
            [[79, 88], { x: 10, y: -6 }],
            [[93, 100], { x: 20, y: 30 }],
          ]),
        },
        lu: 0.22,
        ll: -0.12,
        blink: 4000,
        fin: { anim: wave(500, 0, -14) },
      };

    case 'sleepy':
      return {
        mouth: 'o',
        fx: ['zzz'],
        mover: {
          still: { y: 10, r: 6 },
          anim: a(4000, [
            [[0, 100], { y: 10, r: 6 }],
            [40, { y: 20, r: 9 }],
            [46, { y: 2, r: 2 }],
          ]),
        },
        squash: {
          anim: a(4000, [
            [[0, 100], { s: 1 }],
            [50, { sx: 1.03, sy: 0.98 }],
          ]),
        },
        lu: 0.72,
        lidU: a(4000, [
          [0, { y: 0.72 }],
          [40, { y: 0.97 }],
          [46, { y: 0.55 }],
          [52, { y: 0.62 }],
          [100, { y: 0.72 }],
        ]),
        pupil: { still: { y: 24 } },
        fin: { still: { r: 20 }, anim: null },
        beret: { still: { y: 28, r: -10 } },
      };

    case 'overtime': {
      // Grows a little more every second of overtime (inflate 0 → 1), trembling harder.
      const f = Math.max(0, Math.min(1, inflate));
      const tr = Math.round(3 + 30 * f);
      const fx = -90 * f;
      return {
        mouth: 'tight',
        fx: ['sweat'],
        smooth: true,
        mover: {
          anim: a(
            120,
            [
              [[0, 100], { x: 0 }],
              [25, { x: -tr }],
              [75, { x: tr }],
            ],
            { ease: 'linear' }
          ),
        },
        puffer: { still: { s: 1 + 0.3 * f } },
        flush: { still: { o: 0.7 * f } },
        pupil: { still: { s: 1 - 0.4 * f } },
        finwrap: { still: { x: fx } },
        tailwrap: { still: { x: fx * 0.8, y: -fx * 0.8 } },
        beret: { still: { y: fx * 1.3 } },
        brush: { still: { x: fx * 0.5, y: fx * 0.8 } },
        blink: null,
      };
    }

    case 'explode': {
      // Inflate and tremble, POP (burst, smoke, parts fly off), only the eyes are left
      // (they blink and look around), then Puff puffs back together.
      const popIn = ex(
        [
          [[0, 31], { s: 1 }],
          [[32, 82], { s: 0 }],
          [89, { s: 1.15 }],
          [[94, 100], { s: 1 }],
        ],
        'ease-out'
      );
      return {
        mouth: 'o',
        fx: ['boom'],
        mover: {
          anim: ex(
            [
              [[0, 8], { x: 0 }],
              [12, { x: -3 }],
              [14, { x: 3 }],
              [16, { x: -4 }],
              [18, { x: 4 }],
              [20, { x: -6 }],
              [22, { x: 6 }],
              [24, { x: -8 }],
              [26, { x: 8 }],
              [28, { x: -10 }],
              [30, { x: 10 }],
              [[31, 100], { x: 0 }],
            ],
            'linear'
          ),
        },
        puffer: {
          anim: ex([
            [0, { s: 1 }],
            [25, { s: 1.26 }],
            [28, { s: 1.23 }],
            [31, { s: 1.32 }],
            [[31.5, 80], { s: 0.2 }],
            [87, { s: 1.1 }],
            [91, { s: 0.96 }],
            [[95, 100], { s: 1 }],
          ]),
        },
        squash: {
          anim: ex(
            [
              [[0, 31], { o: 1 }],
              [[31.5, 80], { o: 0 }],
              [[81, 100], { o: 1 }],
            ],
            'linear'
          ),
        },
        tailwrap: { anim: popIn },
        finwrap: { anim: popIn },
        brush: { anim: popIn },
        beret: { anim: popIn },
        eyes: {
          anim: ex([
            [0, { s: 1 }],
            [[25, 31], { s: 1.06 }],
            [[32, 100], { s: 1 }],
          ]),
        },
        pupil: {
          anim: ex([
            [0, { s: 1 }],
            [[25, 31], { s: 0.6 }],
            [[32, 100], { s: 1 }],
          ]),
        },
        flush: {
          still: { o: 0 },
          anim: ex(
            [
              [[0, 8], { o: 0 }],
              [30, { o: 0.65 }],
              [[31.5, 100], { o: 0 }],
            ],
            'linear'
          ),
        },
        blink: null,
      };
    }
  }
}

/** The left-behind eyes during the pop: they drop, blink three times, look around. */
export const GHOST = {
  group: ex([
    [[0, 30.5], { y: 0, o: 0 }],
    [31, { y: 0, o: 1 }],
    [38, { y: 46, o: 1 }],
    [42, { y: 32, o: 1 }],
    [[46, 76], { y: 40, o: 1 }],
    [84, { y: 0, o: 1 }],
    [[86, 100], { y: 0, o: 0 }],
  ]),
  /** y in fractions of the lid's height. */
  lid: ex(
    [
      [[0, 48, 52, 58, 62, 68, 72, 100], { y: 0 }],
      [[50, 60, 70], { y: 1 }],
    ],
    'linear'
  ),
  pupil: ex([
    [[0, 52], { x: 0 }],
    [[55, 62], { x: -26 }],
    [[65, 72], { x: 26 }],
    [[76, 100], { x: 0 }],
  ]),
};

/** The drawing pad: lifts and tilts as the page flips at the end of each loop. */
export const PAD_FLIP = a(4000, [
  // o: 1 throughout: effects start hidden and their animation shows them.
  [[0, 84], { y: 0, r: 0, o: 1 }],
  [88, { y: -8, r: -3, o: 1 }],
  [[93, 100], { y: 0, r: 0, o: 1 }],
]);
/** Doodle stroke i appears in turn, stays, then the page clears (4 s loop, linear). */
export const doodleStroke = (i: number) => {
  const on = 6 + i * 4.2;
  return a(
    4000,
    [
      [[0, on], { o: 0 }],
      [[on + 1.5, 84], { o: 1 }],
      [[87, 100], { o: 0 }],
    ],
    { ease: 'linear' }
  );
};

export const FX_ANIMS = {
  twinkle: (delay: number) =>
    a(
      1600,
      [
        [[0, 100], { o: 0, s: 0.4, r: 0 }],
        [50, { o: 1, s: 1, r: 20 }],
      ],
      { delay }
    ),
  tear: a(
    2200,
    [
      [0, { o: 0, y: -10, s: 0.6 }],
      [15, { o: 1, y: 0, s: 1 }],
      [80, { o: 1, y: 240, s: 1 }],
      [100, { o: 0, y: 280, s: 1 }],
    ],
    { ease: 'ease-in' }
  ),
  steam: (delay: number) =>
    a(
      1400,
      [
        [0, { o: 0, y: 20, s: 0.6 }],
        [30, { o: 1, y: -22, s: 0.78 }],
        [100, { o: 0, y: -120, s: 1.2 }],
      ],
      { ease: 'ease-out', delay }
    ),
  anger: a(500, [
    [[0, 100], { s: 0.85 }],
    [50, { s: 1.1 }],
  ]),
  rise: a(
    3000,
    [
      [0, { o: 0, x: 0, y: 0, s: 0.5 }],
      [20, { o: 1, x: 8, y: -52, s: 0.64 }],
      [100, { o: 0, x: 40, y: -260, s: 1.2 }],
    ],
    { ease: 'ease-out' }
  ),
  dust: (delay: number) =>
    a(
      2000,
      [
        [[0, 40], { o: 0, s: 0.4, y: 0 }],
        [55, { o: 1, s: 0.67, y: -6 }],
        [[90, 100], { o: 0, s: 1.3, y: -20 }],
      ],
      { ease: 'ease-out', delay }
    ),
  sweat: (delay: number) =>
    a(
      1300,
      [
        [0, { o: 0, y: -10 }],
        [20, { o: 1, y: 10 }],
        [100, { o: 0, y: 90 }],
      ],
      { ease: 'ease-in', delay }
    ),
  speed: a(
    450,
    [
      [0, { o: 0, x: 30 }],
      [40, { o: 0.8, x: -10 }],
      [100, { o: 0, x: -70 }],
    ],
    { ease: 'linear' }
  ),
  appear: (delay: number) =>
    a(
      3000,
      [
        [[0, 10], { o: 0, s: 0.3 }],
        [[25, 85], { o: 1, s: 1 }],
        [100, { o: 0, s: 0.3 }],
      ],
      { delay }
    ),
  tdot: (on: number) =>
    a(
      3000,
      [
        [[0, on - 6], { o: 0 }],
        [[on, 80], { o: 1 }],
        [[86, 100], { o: 0 }],
      ],
      { ease: 'linear' }
    ),
  dot: (delay: number) =>
    a(
      2400,
      [
        [0, { o: 0 }],
        [[20, 80], { o: 1 }],
        [100, { o: 0 }],
      ],
      { delay }
    ),
  air: a(
    3000,
    [
      [[0, 15], { o: 0, x: 0, y: 0 }],
      [25, { o: 1, x: 22, y: 6 }],
      [[55, 100], { o: 0, x: 90, y: 24 }],
    ],
    { ease: 'ease-out' }
  ),
  fall: (delay: number, ms: number) =>
    a(
      ms,
      [
        [0, { o: 0, y: -80, r: 0 }],
        [10, { o: 1, y: 4, r: 54 }],
        [100, { o: 0, y: 760, r: 540 }],
      ],
      { ease: 'linear', delay }
    ),
  zfloat: (delay: number) =>
    a(
      3000,
      [
        [0, { o: 0, x: 0, y: 0, s: 0.6 }],
        [20, { o: 1, x: 14, y: -38, s: 0.7 }],
        [100, { o: 0, x: 70, y: -190, s: 1.1 }],
      ],
      { ease: 'ease-out', delay }
    ),
  bang: a(
    2400,
    [
      [[0, 8], { o: 0, s: 0.3 }],
      [[18, 80], { o: 1, s: 1 }],
      [100, { o: 0, s: 1 }],
    ],
    { ease: 'ease-out' }
  ),
  smoke: (delay: number): Anim => ({
    ...ex(
      [
        [[0, 30], { o: 0, s: 0.3, y: 0 }],
        [37, { o: 1, s: 1, y: 0 }],
        [70, { o: 0.9, s: 1.25, y: -30 }],
        [[80, 100], { o: 0, s: 1.4, y: -50 }],
      ],
      'ease-out'
    ),
    delay: EXPLODE_OFFSET + delay,
  }),
  burst: ex(
    [
      [[0, 30], { o: 0, s: 0.2 }],
      [32, { o: 1, s: 1 }],
      [40, { o: 1, s: 1.15 }],
      [[47, 100], { o: 0, s: 1.25 }],
    ],
    'ease-out'
  ),
  flySpikes: ex(
    [
      [[0, 30.5], { o: 0, s: 1, r: 0 }],
      [31, { o: 1, s: 1.5, r: 0 }],
      [[45, 100], { o: 0, s: 2.6, r: 30 }],
    ],
    'ease-out'
  ),
  flyFin: ex(
    [
      [[0, 30.5], { o: 0, x: 0, y: 0, r: 0 }],
      [31, { o: 1, x: 0, y: 0, r: 0 }],
      [[52, 100], { o: 0, x: -300, y: -220, r: -120 }],
    ],
    'ease-out'
  ),
  flyTail: ex(
    [
      [[0, 30.5], { o: 0, x: 0, y: 0, r: 0 }],
      [31, { o: 1, x: 0, y: 0, r: 0 }],
      [[52, 100], { o: 0, x: -240, y: 260, r: 140 }],
    ],
    'ease-out'
  ),
  pop: ex(
    [
      [[0, 30], { o: 0, s: 0.3, r: -8 }],
      [33, { o: 1, s: 1.15, r: -8 }],
      [[38, 44], { o: 1, s: 1, r: -8 }],
      [[50, 100], { o: 0, s: 1, r: -8 }],
    ],
    'ease-out'
  ),
};
