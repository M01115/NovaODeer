import { useState } from 'react';
import { type GestureResponderEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Ink } from '@/constants/theme';

/**
 * A colour wheel for the drawing screen: hue around the wheel, saturation from the centre
 * (white) out to the rim, and a brightness bar underneath. Tap or drag on either one.
 * Touches land on a transparent layer on top, so positions are always measured relative
 * to the wheel itself (on iPhone and on the web).
 */
const HUE_STEPS = 48;
const RINGS = 6;

type HSV = { h: number; s: number; v: number };

export function hsvToHex({ h, s, v }: HSV) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`.toUpperCase();
}

export function hexToHsv(hex: string): HSV {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

/** A ring wedge from radius r0 to r1, angles a0..a1 (degrees, 0 = up, clockwise). */
function wedge(c: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(rad)).toFixed(2)} ${(c + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

export function ColorWheel({
  value,
  onChange,
  size = 168,
}: {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const c = size / 2;
  const R = c - 2;
  const barH = 22;

  const update = (next: HSV) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };

  const pickWheel = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.locationX - c;
    const dy = e.nativeEvent.locationY - c;
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / R);
    // Coming from a near-black colour, give the colour you tapped (full brightness);
    // otherwise keep the brightness you set on the bar.
    update({ h, s, v: hsv.v < 0.35 ? 1 : hsv.v });
  };
  const pickBar = (e: GestureResponderEvent) => {
    const v = Math.max(0, Math.min(1, e.nativeEvent.locationX / size));
    update({ ...hsv, v });
  };

  // Touch handlers for a transparent layer (tap and drag).
  const touch = (pick: (e: GestureResponderEvent) => void) => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: pick,
    onResponderMove: pick,
  });

  // The selected point on the wheel.
  const rad = ((hsv.h - 90) * Math.PI) / 180;
  const dotX = c + hsv.s * R * Math.cos(rad);
  const dotY = c + hsv.s * R * Math.sin(rad);
  const step = 360 / HUE_STEPS;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {Array.from({ length: RINGS }, (_, ring) =>
            Array.from({ length: HUE_STEPS }, (_, i) => (
              <Path
                key={`${ring}-${i}`}
                d={wedge(c, (R * ring) / RINGS, (R * (ring + 1)) / RINGS, i * step, (i + 1) * step + 0.6)}
                // Always vivid, so the wheel reads as colours; the bar below sets how dark.
                fill={hsvToHex({ h: i * step + step / 2, s: (ring + 0.5) / RINGS, v: 1 })}
              />
            ))
          )}
          <Circle cx={dotX} cy={dotY} r={9} fill={hsvToHex(hsv)} stroke="#FFFFFF" strokeWidth={3} />
          <Circle cx={dotX} cy={dotY} r={10.5} fill="none" stroke={Ink.ink} strokeWidth={1.5} />
        </Svg>
        <View style={StyleSheet.absoluteFill} {...touch(pickWheel)} />
      </View>

      {/* Brightness: dark to the full colour */}
      <View style={{ width: size, height: barH }}>
        <Svg width={size} height={barH}>
          <Defs>
            <LinearGradient id="bright" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#000000" />
              <Stop offset="1" stopColor={hsvToHex({ ...hsv, v: 1 })} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size} height={barH} rx={barH / 2} fill="url(#bright)" />
          <Circle
            cx={Math.max(barH / 2, Math.min(size - barH / 2, hsv.v * size))}
            cy={barH / 2}
            r={barH / 2 - 3}
            fill={hsvToHex(hsv)}
            stroke="#FFFFFF"
            strokeWidth={3}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill} {...touch(pickBar)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
  },
});
