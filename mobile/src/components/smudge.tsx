import { Image } from 'expo-image';
import { type ReactNode, useMemo } from 'react';
import { type ImageStyle, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

import { type Outfit, useOutfit } from '@/data/outfit';

import {
  type Anim,
  DEFAULTS,
  FX_ANIMS,
  type Frames,
  type FxName,
  getPose,
  GHOST,
  type Mouth,
  type Part,
  type PuffMood,
  type V,
} from './smudge-poses';

/**
 * The mascot: Puff the pufferfish, rigged from the team's PSD by Morris
 * (morris/puff-animations branch). The PSD layers sit in assets/puff; each part moves on
 * its own (body, squash, puff, spikes, fin, tail, beret, brush, glasses, each eye's lids
 * and pupil, mouth), so one drawing gives all 18 expressions in smudge-poses.ts.
 * Animations are Reanimated CSS animations on the UI thread. The component keeps its old
 * code name (Smudge) so every screen keeps working.
 */
export type SmudgeMood = PuffMood;

/** Every artwork layer, for preloading before Puff's first big entrance (puff-intro.tsx). */
export const PUFF_IMAGES = (): number[] => Object.values(IMG);

const IMG = {
  body: require('@/assets/puff/body.png'),
  tail: require('@/assets/puff/tail.png'),
  spikes: require('@/assets/puff/spikes.png'),
  brush: require('@/assets/puff/brush.png'),
  fin: require('@/assets/puff/fin.png'),
  beret: require('@/assets/puff/beret.png'),
  glasses: require('@/assets/puff/glasses.png'),
  eyeL: require('@/assets/puff/eyeL.png'),
  eyeR: require('@/assets/puff/eyeR.png'),
  ringL: require('@/assets/puff/eyeL_ring.png'),
  ringR: require('@/assets/puff/eyeR_ring.png'),
};

// Rig colours (from Morris's page).
const K = '#1A1A1A';
const Y = '#FFE02D';
const CR = '#FFF4B6';
const OR = '#FFA500';
const OD = '#E08600';
const MD = '#6B2412';
const TG = '#FF7A8A';
const TEAR = '#BFE8F5';
const RED = '#E8354E';
const BLUE = '#4F86F7';
const PINK = '#FF8FA3';
const GRAPHITE = '#2B2D33';
const FLUSH = '#FF6A1F';

/** A box on the PSD canvas: x, y, width, height (PSD pixels). */
type R = [number, number, number, number];

// The part of the PSD the component shows: Puff's drawing with a little headroom.
// Width maps to `size`; height is size × 1.12 (same frame as the old mascot).
const X0 = 317;
const CW = 1203;
const CH = CW * 1.12;
const Y0 = 1709 + 0.05 * CW - CH;

const PARTS = {
  body: [484, 685, 912, 835] as R,
  tail: [333, 1378, 352, 315] as R,
  spikes: [448, 620, 736, 964] as R,
  brush: [565, 636, 252, 579] as R,
  fin: [393, 801, 307, 366] as R,
  beret: [643, 629, 385, 293] as R,
  glasses: [1054, 1044, 317, 210] as R,
};

type EyeRig = {
  eye: R;
  clip: R;
  pupil: { cx: number; cy: number; rx: number; ry: number };
  lidU: R;
  lidD: { cx: number; cy: number; rx: number; ry: number };
  origin: [number, number];
  img: number;
  ring: number;
};

/** Pupils and lids are clipped to the inside of each eye; the outline is drawn on top. */
const pad = (r: R, p: number): R => [r[0] - p, r[1] - p, r[2] + 2 * p, r[3] + 2 * p];
const EYES: { L: EyeRig; R: EyeRig } = {
  L: {
    eye: [818, 887, 352, 351],
    clip: pad([844, 913, 286, 303], 10),
    pupil: { cx: 999, cy: 1073, rx: 64, ry: 71 },
    lidU: [788, 605, 397, 302],
    lidD: { cx: 986, cy: 1371, rx: 200, ry: 150 },
    origin: [986, 1064],
    img: IMG.eyeL,
    ring: IMG.ringL,
  },
  R: {
    eye: [1212, 791, 292, 326],
    clip: pad([1240, 817, 241, 267], 10),
    pupil: { cx: 1362, cy: 946, rx: 60, ry: 68 },
    lidU: [1184, 545, 352, 266],
    lidD: { cx: 1360, cy: 1219, rx: 170, ry: 130 },
    origin: [1360, 950],
    img: IMG.eyeR,
    ring: IMG.ringR,
  },
};

// ---------- Style helpers ----------

const hasTransform = (v: V) =>
  v.x !== undefined ||
  v.y !== undefined ||
  v.r !== undefined ||
  v.s !== undefined ||
  v.sx !== undefined ||
  v.sy !== undefined;

/** Values → RN style. Distances are PSD pixels, scaled by k. */
function vStyle(v: V, k: number): ViewStyle {
  const s: { -readonly [P in keyof ViewStyle]: ViewStyle[P] } = {};
  if (hasTransform(v)) {
    s.transform = [
      { translateX: (v.x ?? 0) * k },
      { translateY: (v.y ?? 0) * k },
      { rotate: `${v.r ?? 0}deg` },
      { scaleX: v.sx ?? v.s ?? 1 },
      { scaleY: v.sy ?? v.s ?? 1 },
    ];
  }
  if (v.o !== undefined) s.opacity = v.o;
  return s;
}

const scaleY = (f: Frames, by: number): Frames => f.map(([p, v]) => [p, { ...v, y: (v.y ?? 0) * by }]);

/**
 * A looping Reanimated CSS animation. Typed as ViewStyle because RN's own ViewStyle
 * declares animationTimingFunction as a string, which clashes with Reanimated's easings.
 */
function animStyle(an: Anim, k: number): ViewStyle {
  const keyframes: Record<string, object> = {};
  for (const [at, v] of an.f) {
    for (const p of Array.isArray(at) ? at : [at]) {
      keyframes[`${p}%`] = { ...vStyle(v, k), ...(v.ease ? { animationTimingFunction: v.ease } : null) };
    }
  }
  return {
    animationName: keyframes,
    animationDuration: an.ms,
    animationIterationCount: 'infinite',
    animationTimingFunction: an.ease ?? 'ease-in-out',
    animationDelay: an.delay ?? 0,
    animationDirection: an.alternate ? 'alternate' : 'normal',
  } as unknown as ViewStyle;
}

/** A part's style: its loop when animating, else the pose it holds. */
function partStyle(p: Part | undefined, k: number, live: boolean, fallback?: Anim) {
  const an = p?.anim === null ? undefined : (p?.anim ?? fallback);
  if (live && an) return animStyle(an, k);
  return p?.still ? vStyle(p.still, k) : undefined;
}

const at = (r: R, k: number, ox = X0, oy = Y0) => ({
  position: 'absolute' as const,
  left: (r[0] - ox) * k,
  top: (r[1] - oy) * k,
  width: r[2] * k,
  height: r[3] * k,
});

/** A transform origin given as a point on the PSD, for views that fill the canvas. */
const origin = (x: number, y: number) =>
  `${(((x - X0) / CW) * 100).toFixed(2)}% ${(((y - Y0) / CH) * 100).toFixed(2)}%`;

// ---------- The component ----------

export function Smudge({
  size = 140,
  mood = 'neutral',
  animated = false,
  outfit: outfitProp,
  inflate = 0,
}: {
  size?: number;
  /** Which expression (see smudge-poses.ts). */
  mood?: SmudgeMood;
  /** Play the expression's motion. Off when the user prefers reduced motion. */
  animated?: boolean;
  /** What he's wearing. Defaults to the look chosen on the Profile page. */
  outfit?: Outfit;
  /** For mood "overtime": how puffed up he is, 0 to 1 (pops after that). */
  inflate?: number;
}) {
  const reducedMotion = useReducedMotion();
  const chosen = useOutfit();
  const outfit = outfitProp ?? chosen;
  const live = animated && !reducedMotion;
  const k = size / CW;
  // Steps of 5% so the overtime pose rebuilds about once a second, not every frame.
  const f = Math.round(Math.max(0, Math.min(1, inflate)) * 20) / 20;

  const s = useMemo(() => {
    const pose = getPose(mood, f);
    const smooth: ViewStyle | undefined = pose.smooth
      ? ({ transitionProperty: ['transform', 'opacity'], transitionDuration: 900 } as ViewStyle)
      : undefined;
    const ps = (p: Part | undefined, fallback?: Anim) => partStyle(p, k, live, fallback);

    const eye = (side: 'L' | 'R') => {
      const rig = EYES[side];
      const lidH = rig.lidU[3];
      const lu = (side === 'L' ? pose.luL : pose.luR) ?? pose.lu ?? 0;
      const lr = (side === 'L' ? pose.lrL : pose.lrR) ?? 0;
      const rest: V = { y: lu * lidH, r: lr };
      const blink = pose.blink === undefined ? DEFAULTS.blink : pose.blink;
      let lidU;
      if (live && pose.lidU) lidU = animStyle({ ...pose.lidU, f: scaleY(pose.lidU.f, lidH) }, k);
      else if (live && blink !== null)
        lidU = animStyle(
          {
            ms: blink,
            ease: 'ease',
            f: [
              [[0, 88, 100], rest],
              [92, { y: lidH, r: lr }],
            ],
          },
          k
        );
      else lidU = vStyle(rest, k);
      return {
        pupil: [ps((side === 'L' ? pose.pupilL : pose.pupilR) ?? pose.pupil), smooth],
        lidU,
        lidD: pose.ll ? vStyle({ y: pose.ll * rig.lidD.ry * 2 }, k) : undefined,
      };
    };

    return {
      mouth: pose.mouth,
      mover: ps(pose.mover),
      squash: ps(pose.squash),
      puffer: [ps(pose.puffer), smooth],
      spk: ps(pose.spk),
      flush: pose.flush ? [ps(pose.flush), smooth] : undefined,
      blush: pose.blush ? ps(pose.blush) : undefined,
      eyes: ps(pose.eyes),
      eyeL: eye('L'),
      eyeR: eye('R'),
      fin: ps(pose.fin, DEFAULTS.fin),
      tail: ps(pose.tail, DEFAULTS.tail),
      finwrap: [ps(pose.finwrap), smooth],
      tailwrap: [ps(pose.tailwrap), smooth],
      beret: [ps(pose.beret), smooth],
      brush: [ps(pose.brush), smooth],
      glasses: ps(pose.glasses),
      fx: live
        ? (pose.fx ?? []).flatMap((name) => FX[name].map((item) => ({ item, style: animStyle(item.anim, k) })))
        : [],
      ghost: live && mood === 'explode',
    };
  }, [mood, f, k, live]);

  const canvas: ViewStyle = { position: 'absolute', left: 0, top: 0, width: size, height: size * 1.12 };

  return (
    <View style={{ width: size, height: size * 1.12 }} accessibilityLabel="Mascot">
      <Animated.View style={[canvas, { transformOrigin: origin(930, 1100) }, s.mover]}>
        <Animated.View style={[canvas, { transformOrigin: origin(930, 1525) }, s.squash]}>
          <Animated.View style={[at(PARTS.tail, k), s.tailwrap]}>
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '88% 12%' }, s.tail]}>
              <Layer source={IMG.tail} />
            </Animated.View>
          </Animated.View>

          <Animated.View style={[canvas, { transformOrigin: origin(940, 1102) }, s.puffer]}>
            <Layer source={IMG.body} style={at(PARTS.body, k)} />
            {s.flush && (
              <Animated.View style={[at(PARTS.body, k), { opacity: 0 }, s.flush]}>
                <Layer source={IMG.body} tint={FLUSH} />
              </Animated.View>
            )}

            <Animated.View style={[canvas, { transformOrigin: origin(...EYES.L.origin) }, s.eyes]}>
              <Eye rig={EYES.L} k={k} {...s.eyeL} />
            </Animated.View>
            <Animated.View style={[canvas, { transformOrigin: origin(...EYES.R.origin) }, s.eyes]}>
              <Eye rig={EYES.R} k={k} {...s.eyeR} />
            </Animated.View>

            {s.blush && (
              <>
                <Animated.View style={[blushAt(925, 1262, 58, 28, k), s.blush]} />
                <Animated.View style={[blushAt(1455, 1112, 44, 24, k), s.blush]} />
              </>
            )}

            <MouthView mouth={s.mouth} k={k} />

            {outfit.eyes === 'glasses' && (
              <Animated.View style={[at(PARTS.glasses, k), s.glasses]}>
                <Layer source={IMG.glasses} />
              </Animated.View>
            )}
            <Animated.View style={[canvas, { transformOrigin: origin(940, 1102) }, s.spk]}>
              <Layer source={IMG.spikes} style={at(PARTS.spikes, k)} />
            </Animated.View>
          </Animated.View>

          {outfit.hold === 'brush' && (
            <Animated.View style={[at(PARTS.brush, k), { transformOrigin: '30% 95%' }, s.brush]}>
              <Layer source={IMG.brush} />
            </Animated.View>
          )}
          <Animated.View style={[at(PARTS.fin, k), s.finwrap]}>
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '92% 45%' }, s.fin]}>
              <Layer source={IMG.fin} />
            </Animated.View>
          </Animated.View>
          {outfit.hat === 'beret' && (
            <Animated.View style={[at(PARTS.beret, k), { transformOrigin: '50% 92%' }, s.beret]}>
              <Layer source={IMG.beret} />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>

      {/* Effects: sparkles, tears, sweat, Zzz… They don't move with the body. */}
      {s.fx.map(({ item, style }, i) => (
        <Animated.View key={i} style={[at(item.box, k), { opacity: 0 }, style]}>
          <FxBody item={item} k={k} />
        </Animated.View>
      ))}

      {/* The pop: only the eyes are left behind; they blink and look around. */}
      {s.ghost && <GhostEyes k={k} canvas={canvas} />}
    </View>
  );
}

function Layer({ source, style, tint }: { source: number; style?: ImageStyle; tint?: string }) {
  return (
    <Image
      source={source}
      style={style ?? StyleSheet.absoluteFill}
      contentFit="fill"
      tintColor={tint}
    />
  );
}

const blushAt = (cx: number, cy: number, rx: number, ry: number, k: number): ViewStyle => ({
  ...at([cx - rx, cy - ry, rx * 2, ry * 2], k),
  borderRadius: 999,
  backgroundColor: PINK,
  opacity: 0,
});

type AnyStyle = object | undefined;

/** One eye: the white with the outline, pupil and lids clipped inside it, outline on top. */
function Eye({
  rig,
  k,
  pupil,
  lidU,
  lidD,
}: {
  rig: EyeRig;
  k: number;
  pupil?: AnyStyle | AnyStyle[];
  lidU?: AnyStyle;
  lidD?: AnyStyle;
}) {
  const [cx0, cy0] = [rig.clip[0], rig.clip[1]];
  const p = rig.pupil;
  const d = rig.lidD;
  const u = rig.lidU;
  const lidDBox: R = [d.cx - d.rx - 5, d.cy - d.ry - 5, d.rx * 2 + 10, d.ry * 2 + 10];
  const lidUBox: R = [u[0], u[1], u[2], u[3] + 5];
  return (
    <>
      <Layer source={rig.img} style={at(rig.eye, k)} />
      <View style={[at(rig.clip, k), styles.clip]}>
        <Animated.View style={[at([p.cx - p.rx, p.cy - p.ry, p.rx * 2, p.ry * 2], k, cx0, cy0), pupil]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${p.rx * 2} ${p.ry * 2}`}>
            <Ellipse cx={p.rx} cy={p.ry} rx={p.rx} ry={p.ry} fill={K} />
          </Svg>
        </Animated.View>
        {lidD !== undefined && (
          <Animated.View style={[at(lidDBox, k, cx0, cy0), { transformOrigin: '50% 0%' }, lidD]}>
            <Svg width="100%" height="100%" viewBox={lidDBox.join(' ')}>
              <Ellipse cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry} fill={CR} />
              <Path
                d={`M${d.cx - d.rx} ${d.cy} A${d.rx} ${d.ry} 0 0 1 ${d.cx + d.rx} ${d.cy}`}
                fill="none"
                stroke={K}
                strokeWidth={9}
              />
            </Svg>
          </Animated.View>
        )}
        <Animated.View style={[at(lidUBox, k, cx0, cy0), { transformOrigin: '50% 100%' }, lidU]}>
          <Svg width="100%" height="100%" viewBox={lidUBox.join(' ')}>
            <Rect x={u[0]} y={u[1]} width={u[2]} height={u[3]} fill={Y} />
            <Path d={`M${u[0]} ${u[1] + u[3]} H${u[0] + u[2]}`} stroke={K} strokeWidth={9} />
          </Svg>
        </Animated.View>
      </View>
      <Layer source={rig.ring} style={at(rig.eye, k)} />
    </>
  );
}

function GhostEyes({ k, canvas }: { k: number; canvas: ViewStyle }) {
  const pupil = animStyle(GHOST.pupil, k);
  return (
    <Animated.View style={[canvas, { opacity: 0 }, animStyle(GHOST.group, k)]}>
      {(['L', 'R'] as const).map((side) => (
        <Eye
          key={side}
          rig={EYES[side]}
          k={k}
          pupil={pupil}
          lidU={animStyle({ ...GHOST.lid, f: scaleY(GHOST.lid.f, EYES[side].lidU[3]) }, k)}
        />
      ))}
    </Animated.View>
  );
}

// ---------- Mouths (drawn along the original mouth's tilt) ----------

const OUTLINE = { fill: OR, stroke: OD, strokeWidth: 9 };
const LINE = { stroke: K, strokeWidth: 8, fill: 'none', strokeLinecap: 'round' } as const;
const MOUTHS: Record<Mouth, ReactNode> = {
  neutral: (
    <>
      <Ellipse rx={125} ry={52} {...OUTLINE} />
      <Path d="M-85 4 Q0 14 85 -2" {...LINE} />
    </>
  ),
  grin: (
    <>
      <Path d="M-132 -16 Q0 -38 132 -16 Q112 74 0 86 Q-112 74 -132 -16Z" {...OUTLINE} strokeLinejoin="round" />
      <Path d="M-98 -4 Q0 -20 98 -4 Q80 52 0 60 Q-80 52 -98 -4Z" fill={MD} />
      <Ellipse cy={40} rx={40} ry={15} fill={TG} />
    </>
  ),
  frown: (
    <>
      <Ellipse rx={110} ry={46} {...OUTLINE} />
      <Path d="M-78 16 Q0 -26 78 16" {...LINE} />
    </>
  ),
  o: (
    <>
      <Ellipse rx={62} ry={56} {...OUTLINE} />
      <Ellipse rx={30} ry={28} fill={MD} />
    </>
  ),
  tight: (
    <>
      <Ellipse rx={104} ry={28} {...OUTLINE} />
      <Path d="M-74 0 H74" {...LINE} />
    </>
  ),
  angry: (
    <>
      <Ellipse rx={100} ry={36} {...OUTLINE} />
      <Path d="M-72 14 Q0 -22 72 14" {...LINE} />
    </>
  ),
  wavy: (
    <>
      <Ellipse rx={115} ry={46} {...OUTLINE} />
      <Path d="M-80 0 q20 -14 40 0 t40 0 t40 0 t40 0" {...LINE} />
    </>
  ),
  grimace: (
    <>
      <Rect x={-122} y={-42} width={244} height={84} rx={42} {...OUTLINE} />
      <Rect x={-92} y={-20} width={184} height={40} rx={14} fill="#fff" stroke={K} strokeWidth={6} />
      <Path d="M-46 -20 V20 M0 -20 V20 M46 -20 V20 M-92 0 H92" stroke={K} strokeWidth={5} />
    </>
  ),
  pucker: (
    <>
      <Ellipse cx={45} rx={62} ry={44} {...OUTLINE} />
      <Path d="M14 2 Q45 12 76 0" {...LINE} />
    </>
  ),
};

const MOUTH_AT = { cx: 1214, cy: 1257, half: 170 };
function MouthView({ mouth, k }: { mouth: Mouth; k: number }) {
  const { cx, cy, half } = MOUTH_AT;
  return (
    <View style={at([cx - half, cy - half, half * 2, half * 2], k)} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}>
        <G rotation={-34}>{MOUTHS[mouth]}</G>
      </Svg>
    </View>
  );
}

// ---------- Effects ----------

type FxItem = {
  box: R;
  anim: Anim;
  svg?: ReactNode;
  img?: number;
  text?: { str: string; size: number; color: string };
};

function FxBody({ item, k }: { item: FxItem; k: number }) {
  if (item.img) return <Layer source={item.img} />;
  if (item.text)
    return (
      <Text
        style={[
          styles.fxText,
          {
            fontSize: item.text.size * k,
            lineHeight: item.text.size * k * 1.12,
            color: item.text.color,
            textShadowOffset: { width: 0, height: Math.max(1, 8 * k) },
          },
        ]}>
        {item.text.str}
      </Text>
    );
  return (
    <Svg width="100%" height="100%" viewBox={item.box.join(' ')}>
      {item.svg}
    </Svg>
  );
}

const star = (x: number, y: number, s: number): FxItem['svg'] => (
  <Path
    d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z`}
    fill={Y}
    stroke={K}
    strokeWidth={6}
    strokeLinejoin="round"
  />
);
const starBox = (x: number, y: number, s: number): R => [x - s - 6, y - s - 6, 2 * s + 12, 2 * s + 12];

const drop = (x: number, y: number, s = 1) => (
  <Path
    d={`M${x} ${y} q${-26 * s} ${40 * s} ${-26 * s} ${62 * s} a${26 * s} ${26 * s} 0 0 0 ${52 * s} 0 q0 ${-22 * s} ${-26 * s} ${-62 * s}z`}
    fill={TEAR}
    stroke={K}
    strokeWidth={7}
  />
);
const dropBox = (x: number, y: number, s = 1): R => [x - 26 * s - 6, y - 6, 52 * s + 12, 88 * s + 12];

const puffBall = (x: number, y: number, r: number, fill = '#fff', sw = 7) => (
  <Circle key={`${x},${y}`} cx={x} cy={y} r={r} fill={fill} stroke={K} strokeWidth={sw} />
);

const burstPoints = (cx: number, cy: number, R: number, r: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const ang = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 ? r : R;
    return `${(cx + Math.cos(ang) * rr).toFixed(0)},${(cy + Math.sin(ang) * rr).toFixed(0)}`;
  }).join(' ');

const FX: Record<FxName, FxItem[]> = {
  sparkles: [
    { box: starBox(1500, 720, 46), svg: star(1500, 720, 46), anim: FX_ANIMS.twinkle(0) },
    { box: starBox(420, 760, 36), svg: star(420, 760, 36), anim: FX_ANIMS.twinkle(-500) },
    { box: starBox(1530, 1180, 30), svg: star(1530, 1180, 30), anim: FX_ANIMS.twinkle(-1100) },
  ],
  tear: [{ box: dropBox(910, 1200), svg: drop(910, 1200), anim: FX_ANIMS.tear }],
  steam: [
    { box: [1086, 566, 128, 118], svg: [puffBall(1130, 640, 40), puffBall(1180, 600, 30)], anim: FX_ANIMS.steam(0) },
    { box: [1282, 624, 108, 104], svg: [puffBall(1320, 690, 34), puffBall(1362, 652, 24)], anim: FX_ANIMS.steam(700) },
  ],
  anger: [
    {
      box: [1430, 730, 80, 110],
      svg: (
        <Path
          d="M1440 740 q22 6 26 30 M1500 740 q-22 6 -26 30 M1440 830 q22 -6 26 -30 M1500 830 q-22 -6 -26 -30"
          stroke={RED}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
        />
      ),
      anim: FX_ANIMS.anger,
    },
  ],
  bubble: [
    {
      box: [1300, 1220, 60, 60],
      svg: (
        <>
          {puffBall(1330, 1250, 24, '#fff', 6)}
          <Circle cx={1322} cy={1242} r={6} fill={K} opacity={0.25} />
        </>
      ),
      anim: FX_ANIMS.rise,
    },
  ],
  dust: [
    { box: [552, 1679, 101, 66], svg: [puffBall(620, 1712, 30, '#ECECE6', 5), puffBall(575, 1722, 20, '#ECECE6', 5)], anim: FX_ANIMS.dust(0) },
    { box: [1207, 1679, 101, 66], svg: [puffBall(1240, 1712, 30, '#ECECE6', 5), puffBall(1285, 1722, 20, '#ECECE6', 5)], anim: FX_ANIMS.dust(-1000) },
  ],
  sweat: [{ box: dropBox(1478, 760, 0.9), svg: drop(1478, 760, 0.9), anim: FX_ANIMS.sweat(0) }],
  sweat2: [{ box: dropBox(640, 800, 0.8), svg: drop(640, 800, 0.8), anim: FX_ANIMS.sweat(650) }],
  speed: [
    {
      box: [208, 988, 174, 224],
      svg: (
        <G stroke={GRAPHITE} strokeWidth={12} strokeLinecap="round" opacity={0.7}>
          <Path d="M370 1000 H260" />
          <Path d="M340 1100 H220" />
          <Path d="M370 1200 H270" />
        </G>
      ),
      anim: FX_ANIMS.speed,
    },
  ],
  thought: [
    { box: [1429, 809, 42, 42], svg: puffBall(1450, 830, 18, '#fff', 6), anim: FX_ANIMS.appear(0) },
    { box: [1469, 724, 62, 62], svg: puffBall(1500, 755, 28, '#fff', 6), anim: FX_ANIMS.appear(250) },
    {
      box: [1351, 488, 258, 204],
      svg: <Ellipse cx={1480} cy={590} rx={125} ry={98} fill="#fff" stroke={K} strokeWidth={7} />,
      anim: FX_ANIMS.appear(500),
    },
    ...[1430, 1480, 1530].map((x, i) => ({
      box: [x - 15, 577, 30, 30] as R,
      svg: <Circle cx={x} cy={592} r={15} fill={GRAPHITE} />,
      anim: FX_ANIMS.tdot(42 + i * 10),
    })),
  ],
  dots: [1390, 1440, 1490].map((x, i) => ({
    box: [x - 15, 675, 30, 30] as R,
    svg: <Circle cx={x} cy={690} r={15} fill={GRAPHITE} />,
    anim: FX_ANIMS.dot(i * 300),
  })),
  air: [
    {
      box: [1330, 1220, 108, 135],
      svg: (
        <G stroke={GRAPHITE} strokeWidth={9} fill="none" strokeLinecap="round">
          <Path d="M1350 1290 q30 -12 60 0" />
          <Path d="M1360 1340 q34 -10 68 4" />
          <Path d="M1340 1240 q26 -12 52 -4" />
        </G>
      ),
      anim: FX_ANIMS.air,
    },
  ],
  confetti: Array.from({ length: 14 }, (_, i) => {
    const x = 360 + i * 85 + (i % 3) * 20;
    const y = 470 + (i % 4) * 24;
    return {
      box: [x - 2, y - 2, 30, 18] as R,
      svg: (
        <Rect x={x} y={y} width={26} height={14} rx={3} fill={[RED, BLUE, Y, PINK][i % 4]} stroke={K} strokeWidth={3} />
      ),
      anim: FX_ANIMS.fall(-i * 370, 2000 + (i % 5) * 250),
    };
  }),
  zzz: [80, 100, 120].map((size, i) => ({
    box: [1330, 760 - size, size, size * 1.12] as R,
    text: { str: 'Z', size, color: GRAPHITE },
    anim: FX_ANIMS.zfloat(i * 1000),
  })),
  bang: [{ box: [1410, 560, 120, 246], text: { str: '!', size: 220, color: RED }, anim: FX_ANIMS.bang }],
  boom: [
    {
      box: [606, 756, 668, 638],
      svg: [puffBall(700, 1250, 90, '#ECECE6'), puffBall(1180, 1300, 80, '#ECECE6'), puffBall(940, 860, 100, '#ECECE6')],
      anim: FX_ANIMS.smoke(0),
    },
    {
      box: [546, 906, 823, 553],
      svg: [puffBall(620, 980, 70, '#ECECE6'), puffBall(1280, 1000, 85, '#ECECE6'), puffBall(940, 1380, 75, '#ECECE6')],
      anim: FX_ANIMS.smoke(-100),
    },
    {
      box: [395, 557, 1090, 1090],
      svg: (
        <>
          <Polygon points={burstPoints(940, 1102, 540, 340, 12)} fill={Y} stroke={K} strokeWidth={9} strokeLinejoin="round" />
          <Polygon points={burstPoints(940, 1102, 330, 200, 12)} fill={OR} />
        </>
      ),
      anim: FX_ANIMS.burst,
    },
    { box: PARTS.spikes, img: IMG.spikes, anim: FX_ANIMS.flySpikes },
    { box: PARTS.fin, img: IMG.fin, anim: FX_ANIMS.flyFin },
    { box: PARTS.tail, img: IMG.tail, anim: FX_ANIMS.flyTail },
    { box: [620, 1330, 640, 270], text: { str: 'POP!', size: 230, color: RED }, anim: FX_ANIMS.pop },
  ],
};

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderRadius: 9999,
  },
  fxText: {
    fontFamily: 'PuffHand',
    textAlign: 'center',
    textShadowColor: K,
    textShadowRadius: 0,
  },
});
