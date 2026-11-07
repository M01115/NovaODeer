/** The only reactions people can leave on a sketch: positive emojis, no text comments. */
export const REACTIONS = ['❤️', '🔥', '👏', '😍', '✨', '🎨'] as const;

export type Reaction = (typeof REACTIONS)[number];
