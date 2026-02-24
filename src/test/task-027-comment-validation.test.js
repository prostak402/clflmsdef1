import { describe, expect, it } from 'vitest'

import { COMMENT_MAX_LENGTH, validateCommentText } from '../services/comment-validation'

describe('TASK-027: comment validation contract', () => {
  it('rejects empty/whitespace-only comments', () => {
    const result = validateCommentText('   ')

    expect(result).toEqual({
      valid: false,
      normalizedText: '',
      error: 'Comment cannot be empty. Please enter at least one visible character.',
    })
  })

  it('trims valid comments and accepts upper boundary length', () => {
    const raw = `   ${'a'.repeat(COMMENT_MAX_LENGTH)}   `
    const result = validateCommentText(raw)

    expect(result.valid).toBe(true)
    expect(result.error).toBe('')
    expect(result.normalizedText).toHaveLength(COMMENT_MAX_LENGTH)
  })

  it('rejects comments above maximum length after normalization', () => {
    const result = validateCommentText('b'.repeat(COMMENT_MAX_LENGTH + 1))

    expect(result.valid).toBe(false)
    expect(result.error).toContain(String(COMMENT_MAX_LENGTH))
  })
})
