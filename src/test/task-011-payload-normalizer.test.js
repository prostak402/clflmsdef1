import { describe, expect, it, vi } from 'vitest'

import { feedService } from '../services/feed-service'
import { mockFeedAdapter } from '../services/mock-feed-adapter'
import { BACKEND_CONSTRAINTS, normalizeWritePayload } from '../services/payload-normalizer'

describe('TASK-011: payload normalization for write operations', () => {
  it('exposes mirror backend constraints for write payloads', () => {
    expect(BACKEND_CONSTRAINTS.commentText.maxLength).toBe(500)
    expect(BACKEND_CONSTRAINTS.userName.maxLength).toBe(50)
    expect(BACKEND_CONSTRAINTS.clipId.required).toBe(true)
  })

  it('trims and limits comment payload according to constraints', () => {
    const longText = `${'a'.repeat(510)}   `
    const payload = normalizeWritePayload('createComment', {
      clipId: '  clip-1  ',
      text: longText,
      comments: null,
      userName: '  A  ',
      authorId: '   user-123   ',
    })

    expect(payload.clipId).toBe('clip-1')
    expect(payload.text.length).toBe(BACKEND_CONSTRAINTS.commentText.maxLength)
    expect(payload.comments).toEqual({})
    expect(payload.userName).toBeUndefined()
    expect(payload.authorId).toBe('user-123')
  })

  it('normalizes toggleLike payload before adapter write', () => {
    const spy = vi.spyOn(mockFeedAdapter, 'toggleLike')

    feedService.toggleLike({
      clipId: '  42  ',
      likes: null,
    })

    expect(spy).toHaveBeenCalledWith({
      clipId: '42',
      likes: {},
    })
  })

  it('normalizes persist payload for optimistic writes', async () => {
    const persistSpy = vi.spyOn(mockFeedAdapter, 'persistLikeToggle').mockResolvedValueOnce()

    await feedService.optimisticToggleLike({
      clipId: '  clip-9  ',
      applyLocal: vi.fn(),
      rollbackLocal: vi.fn(),
    })

    expect(persistSpy).toHaveBeenCalledWith({ clipId: 'clip-9' })
  })
})
