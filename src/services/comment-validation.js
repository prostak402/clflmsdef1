export const COMMENT_MAX_LENGTH = 280;

export function normalizeCommentText(value) {
  return String(value ?? '').trim();
}

export function validateCommentText(value) {
  const normalizedText = normalizeCommentText(value);

  if (!normalizedText) {
    return {
      valid: false,
      normalizedText,
      error: 'Comment cannot be empty. Please enter at least one visible character.',
    };
  }

  if (normalizedText.length > COMMENT_MAX_LENGTH) {
    return {
      valid: false,
      normalizedText,
      error: `Comment is too long. Maximum length is ${COMMENT_MAX_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    normalizedText,
    error: '',
  };
}
