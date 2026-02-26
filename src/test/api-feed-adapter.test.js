import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiFeedAdapter } from '../services/api-feed-adapter'

describe('apiFeedAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes createComment response to UI-compatible comments map', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          comment: {
            id: 'cm_1',
            user: 'Legacy User',
            clipId: ' clip-1 ',
            text: 'Hello',
            time: 'a moment ago',
            likes: 1,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const commentsMap = await apiFeedAdapter.createComment({
      clipId: ' clip-1 ',
      text: '  Hello  ',
      comments: { 'clip-1': [] },
      userName: '  John  ',
    })

    expect(commentsMap['clip-1']).toHaveLength(1)
    expect(commentsMap['clip-1'][0]).toEqual(
      expect.objectContaining({
        id: 'cm_1',
        clipId: 'clip-1',
        authorName: 'Legacy User',
        avatar: '👤',
        text: 'Hello',
      })
    )
  })

  it('throws normalized api error when server returns non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: 'Validation failed',
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await expect(
      apiFeedAdapter.deleteComment({
        clipId: 'clip-1',
        commentId: 'comment-1',
        comments: { 'clip-1': [] },
      })
    ).rejects.toThrowError('Validation failed (422)')
  })
})
