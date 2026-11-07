/**
 * Puff's Lottie files contain all three accessories. This hides the ones an outfit leaves out,
 * so any mix from the profile wardrobe works with one file per state.
 *
 * Accessory layers are named "acc:hat:…", "acc:glasses:…" and "acc:brush:…" by tools/export_lottie.mjs.
 * The Outfit shape matches mobile/src/data/outfit.ts.
 *
 *   const source = useMemo(() => withOutfit(PUFF.happy, outfit), [outfit]);
 *   <LottieView source={source} autoPlay loop />
 */
export type Outfit = {
  hat: 'none' | 'beret';
  eyes: 'none' | 'glasses';
  hold: 'none' | 'brush';
};

type Layer = { nm?: string; hd?: boolean; ks?: Record<string, unknown> };
type LottieJSON = { layers: Layer[] } & Record<string, unknown>;

export function withOutfit<T extends LottieJSON>(animation: T, outfit: Outfit): T {
  const hide: Record<string, boolean> = {
    hat: outfit.hat === 'none',
    glasses: outfit.eyes === 'none',
    brush: outfit.hold === 'none',
  };
  return {
    ...animation,
    layers: animation.layers.map((layer) => {
      const item = /^acc:([a-z]+):/.exec(layer.nm ?? '')?.[1];
      if (!item || !hide[item]) return layer;
      // hidden flag plus zero opacity, so every Lottie player drops it
      return { ...layer, hd: true, ks: { ...layer.ks, o: { a: 0, k: 0 } } };
    }),
  };
}
