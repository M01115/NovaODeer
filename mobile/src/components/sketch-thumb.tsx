import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

export const PAPER = '#FFFFFF';

type Props = {
  size: number;
  /** A bundled image (require()), or a URI: a scanned/uploaded sketch or one drawn in the app. */
  image?: number | string;
  /** Shown when there's no image yet (mock data). */
  emoji: string;
  /** Circle on the path, rounded square on detail screens. */
  shape?: 'circle' | 'card';
};

/** A sketch on paper: the uploaded photo, or the prompt's emoji as a stand-in. */
export function SketchThumb({ size, image, emoji, shape = 'circle' }: Props) {
  const radius = shape === 'circle' ? size / 2 : size * 0.08;

  return (
    <View style={[styles.paper, { width: size, height: size, borderRadius: radius }]}>
      {image ? (
        // Whole drawing visible: pencil sketches have white paper around them anyway.
        <Image
          source={typeof image === 'string' ? { uri: image } : image}
          style={[StyleSheet.absoluteFill, { margin: size * 0.04 }]}
          contentFit="contain"
        />
      ) : (
        <Text style={{ fontSize: size * 0.46, lineHeight: size * 0.6 }}>{emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: PAPER,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D4D0C6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
