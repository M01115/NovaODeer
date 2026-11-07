import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  ACCEPTED_IMAGE_TYPES,
  type FeedbackError,
  type FeedbackRequest,
  type SketchFeedback,
} from '@/data/feedback';
import { getPromptForDate } from '@/data/prompts';

/**
 * Today's submitted sketch, handed from the session screen to the feedback screen.
 * Kept in memory until the backend exists (image data is too big for route params).
 */
export type Submission = {
  /** Shrunk JPEG as a data URI: shown on screen and sent to the AI. */
  image: string;
  width: number;
  height: number;
  medium: FeedbackRequest['medium'];
  seconds: number;
  prompt: string;
};

let current: Submission | null = null;

export function getSubmission() {
  return current;
}

/** Longest side sent to the AI. Plenty for a sketch, small enough to upload fast. */
const MAX_SIDE = 1280;
/** Refuse absurdly large files before trying to decode them. */
const MAX_FILE_BYTES = 30 * 1024 * 1024;

export type PickResult =
  | { ok: true; submission: Submission }
  | { ok: false; reason: 'cancelled' | 'permission' | 'unsupported' | 'too_large' | 'failed' };

/**
 * Opens the camera (paper sketch) or the photo library (drawn elsewhere), checks the
 * file, then shrinks it to a JPEG. Orientation from the camera is applied while
 * re-encoding, so sideways phone photos come out upright.
 */
export async function pickSketch(
  source: 'camera' | 'library',
  seconds: number,
): Promise<PickResult> {
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'permission' };
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return { ok: false, reason: 'cancelled' };

  const asset = result.assets[0];
  const mime = asset.mimeType?.toLowerCase();
  if (mime && !ACCEPTED_IMAGE_TYPES.includes(mime)) return { ok: false, reason: 'unsupported' };
  if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) return { ok: false, reason: 'too_large' };

  try {
    const longest = Math.max(asset.width, asset.height);
    const context = ImageManipulator.manipulate(asset.uri);
    if (longest > MAX_SIDE) {
      context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.85,
      base64: true,
    });
    if (!saved.base64) return { ok: false, reason: 'failed' };

    current = {
      image: `data:image/jpeg;base64,${saved.base64}`,
      width: saved.width,
      height: saved.height,
      medium: source === 'camera' ? 'paper' : 'upload',
      seconds,
      prompt: getPromptForDate().text,
    };
    return { ok: true, submission: current };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export const PICK_ERRORS: Record<Exclude<PickResult, { ok: true }>['reason'], string | null> = {
  cancelled: null,
  permission: 'Puff needs the camera to scan your sketch. You can allow it in Settings.',
  unsupported: 'Puff can read JPG, PNG, WebP and iPhone photos. Try another picture?',
  too_large: 'That picture is huge! Try a smaller photo.',
  failed: 'That picture didn’t come through. Want to try again?',
};

/**
 * Asks Smudge (via our server route, which holds the API key) for feedback.
 * Never throws: network problems come back as a FeedbackError.
 */
export async function requestFeedback(
  submission: Submission,
  mascotName?: string,
): Promise<SketchFeedback | FeedbackError> {
  const body: FeedbackRequest = {
    image: submission.image,
    prompt: submission.prompt,
    medium: submission.medium,
    seconds: submission.seconds,
    mascotName,
  };
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data && (data.status === 'ok' || data.status === 'unclear' || data.error)) return data;
    return { error: { code: 'malformed', message: 'Puff got a confusing answer.' } };
  } catch {
    return {
      error: {
        code: 'upstream',
        message: 'Couldn’t reach Puff’s server. Check your connection.',
      },
    };
  }
}

/** Errors where the live AI itself is down, so offering the labeled demo sample makes sense. */
export const AI_UNAVAILABLE = new Set([
  'not_configured',
  'no_credits',
  'model_unavailable',
  'upstream',
  'timeout',
  'rate_limited',
]);
