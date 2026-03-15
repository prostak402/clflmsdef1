import { afterEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathnames(fetchSpy) {
  return fetchSpy.mock.calls.map(([url]) => new URL(url).pathname + new URL(url).search)
}

describe('task-034 api-only cutover without mock fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('wires createFeedAdapter directly to the api adapter regardless of env', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'mock')

    const { createFeedAdapter } = await import('../services/create-feed-adapter')
    const { apiFeedAdapter } = await import('../services/api-feed-adapter')

    expect(createFeedAdapter()).toBe(apiFeedAdapter)
  })

  it('keeps feed/comments/moderation flows on the api adapter', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'clip_1',
              title: 'Clip',
              genreId: 'drama',
              watchUrl: 'https://example.com/watch',
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))

    const { feedService } = await import('../services/feed-service')

    await expect(feedService.getFeed({ selectedGenres: ['drama'] })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'clip_1' })])
    )
    await expect(feedService.getInitialComments()).resolves.toEqual(expect.any(Object))
    await expect(
      feedService.getAllCommentsForModeration({ clips: [], blockedUsers: {} })
    ).resolves.toEqual([])

    expect(pathnames(fetchSpy)).toEqual([
      '/api/v1/feed/clips?genreId=drama',
      '/api/v1/comments',
      '/api/v1/moderation/comments',
    ])
  })
})
