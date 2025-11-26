export const BANNED_WORDS = ["badword1", "badword2", "badword3"];

export function isCleanText(text: string) {
  const lowered = text.toLowerCase();
  return !BANNED_WORDS.some((word) => lowered.includes(word));
}
