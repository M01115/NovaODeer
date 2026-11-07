import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

export const PAPER = '#FFFFFF';

type Props = {
  size: number;
  imageUri?: string;
  /** Shown when there's no image yet (mock data). */
  emoji: string;
  /** Circle on the path, rounded square on detail screens. */
  shape?: 'circle' | 'card';
};

/** A sketch on paper: the uploaded photo, or the prompt's emoji as a stand-in. */
export function SketchThumb({ size, imageUri, emoji, shape = 'circle' }: Props) {
  const radius = shape === 'circle' ? size / 2 : size * 0.08;

  return (
    <View style={[styles.paper, { width: size, height: size, borderRadius: radius }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
