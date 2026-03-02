import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiFeedAdapter } from '../services/api-feed-adapter'

describe('apiFeedAdapter write contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
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

  it('loads catalog from GET /clips in api mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'clip-1',
              title: 'Catalog Item',
              genreId: 'drama',
              durationSec: 5400,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const catalog = await apiFeedAdapter.getCatalog()

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips',
      expect.objectContaining({ method: 'GET' })
    )
    expect(catalog).toEqual([
      expect.objectContaining({
        id: 'clip-1',
        title: 'Catalog Item',
      }),
    ])
  })

  it('returns empty list when api catalog response has no items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(apiFeedAdapter.getCatalog()).resolves.toEqual([])
  })

  it('throws normalized error when catalog request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: 'Catalog unavailable',
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await expect(apiFeedAdapter.getCatalog()).rejects.toThrowError('Catalog unavailable (503)')
  })

  it('uses POST /like when clip is currently unliked', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await apiFeedAdapter.toggleLike({ clipId: 'clip-1', likes: { 'clip-1': false } })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips/clip-1/like',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('uses DELETE /like when clip is currently liked', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await apiFeedAdapter.toggleLike({ clipId: 'clip-1', likes: { 'clip-1': true } })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips/clip-1/like',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('uses POST/DELETE for bookmark toggle based on current local state', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
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

  it('sends createComment payload without client author fields and uses backend author from response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          comment: {
            id: 'cm_1',
            clipId: ' clip-1 ',
            text: 'Hello',
            authorName: 'Backend User',
            authorId: 'author-from-backend',
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
      authorId: 'local-author',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips/clip-1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          body: 'Hello',
        }),
      })
    )
    expect(commentsMap['clip-1'][0]).toEqual(
      expect.objectContaining({
        id: 'cm_1',
        clipId: 'clip-1',
        text: 'Hello',
        authorName: 'Backend User',
        authorId: 'author-from-backend',
      })
    )
  })

  it('supports temporary legacy createComment payload mode via explicit env flag', async () => {
    vi.stubEnv('VITE_API_CREATE_COMMENT_LEGACY_AUTHOR_PAYLOAD', 'true')

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          comment: {
            id: 'cm_legacy',
            clipId: 'clip-1',
            text: 'Legacy payload mode',
            authorName: 'Backend User',
            authorId: 'backend-author',
            createdAt: '2026-01-01T00:00:00Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await apiFeedAdapter.createComment({
      clipId: 'clip-1',
      text: 'Legacy payload mode',
      comments: { 'clip-1': [] },
      userName: 'Legacy User',
      authorId: 'legacy-author-id',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/clips/clip-1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          body: 'Legacy payload mode',
          userName: 'Legacy User',
          authorId: 'legacy-author-id',
        }),
      })
    )
  })

  it('maps profile counts from backend payload and ignores local likes/bookmarks state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          displayName: 'API User',
          email: 'api@example.com',
          counts: {
            bookmarks: 11,
            likes: 7,
            watched: 5,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const profile = await apiFeedAdapter.getProfile({
      user: { name: 'Local User', email: 'local@example.com' },
      bookmarks: ['clip-1'],
      likes: { 'clip-1': true, 'clip-2': true },
    })

    expect(profile).toEqual({
      name: 'API User',
      email: 'api@example.com',
      avatar: '🎬',
      bookmarkCount: 11,
      likeCount: 7,
      watchedCount: 5,
    })
  })

  it('returns safe profile defaults when backend payload is partial', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ email: null, counts: { likes: -4 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const profile = await apiFeedAdapter.getProfile({ user: null })

    expect(profile).toEqual({
      name: 'Movie Explorer',
      email: 'hello@movieexplorer.app',
      avatar: '🎬',
      bookmarkCount: 0,
      likeCount: 0,
      watchedCount: 0,
    })
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
