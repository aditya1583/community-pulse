export const MAX_MESSAGE_LENGTH = 240;

const BANNED_WORDS = ["badword1", "badword2", "badword3"];

export type PulseValidationErrors = {
  mood?: string;
  tag?: string;
  message?: string;
};

export type PulseValidationResult = {
  errors: PulseValidationErrors;
  sanitizedMessage: string;
  isValid: boolean;
};

export function isCleanMessage(text: string): boolean {
  const lowered = text.toLowerCase();
  return !BANNED_WORDS.some((word) => lowered.includes(word));
}

export function isPulseFormComplete(
  mood: string | null,
  tag: string | null,
  message: string
): boolean {
  const trimmed = message.trim();
  return Boolean(mood && tag && trimmed);
}

export function validatePulseInput(input: {
  mood: string | null;
  tag: string | null;
  message: string;
}): PulseValidationResult {
  const errors: PulseValidationErrors = {};
  const sanitizedMessage = (input.message || "").trim();

  if (!input.mood) {
    errors.mood = "Pick a mood so others know how you're feeling.";
  }

  if (!input.tag) {
    errors.tag = "Choose a tag so we can organize your pulse.";
  }

  if (!sanitizedMessage) {
    errors.message = "Add a quick update before posting.";
  } else if (sanitizedMessage.length > MAX_MESSAGE_LENGTH) {
    errors.message = `Please keep it under ${MAX_MESSAGE_LENGTH} characters.`;
  } else if (!isCleanMessage(sanitizedMessage)) {
    errors.message = "Pulse contains disallowed language.";
  }

  return {
    errors,
    sanitizedMessage,
    isValid: Object.keys(errors).length === 0,
  };
}
