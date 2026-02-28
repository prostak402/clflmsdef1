import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiFeedAdapter } from '../services/api-feed-adapter'

describe('apiFeedAdapter write contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses canonical GET /feed/clips endpoint for feed request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await apiFeedAdapter.getFeed()

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/feed/clips',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('uses POST /like when clip is currently unliked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await apiFeedAdapter.toggleLike({ clipId: 'clip-1', likes: { 'clip-1': false } })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips/clip-1/like',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('uses DELETE /like when clip is currently liked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await apiFeedAdapter.toggleLike({ clipId: 'clip-1', likes: { 'clip-1': true } })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips/clip-1/like',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('uses POST/DELETE for bookmark toggle based on current local state', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await apiFeedAdapter.toggleBookmark({ clipId: 'clip-1', bookmarks: [] })
    await apiFeedAdapter.toggleBookmark({ clipId: 'clip-1', bookmarks: ['clip-1'] })

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/v1/clips/clip-1/bookmark',
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/v1/clips/clip-1/bookmark',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('sends createComment payload in API contract shape and normalizes response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          comment: {
            id: 'cm_1',
            clipId: ' clip-1 ',
            text: 'Hello',
            authorName: 'Legacy User',
            createdAt: '2026-01-01T00:00:00Z',
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

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips/clip-1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          body: 'Hello',
          userName: 'John',
          authorId: undefined,
        }),
      })
    )
    expect(commentsMap['clip-1'][0]).toEqual(
      expect.objectContaining({
        id: 'cm_1',
        clipId: 'clip-1',
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
