import { afterEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), { status: 200, headers: JSON_HEADERS })
}

describe('task-034 api mode cutover without mock fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('wires createFeedAdapter(api) directly to api adapter', async () => {
    const { createFeedAdapter } = await import('../services/create-feed-adapter')
    const { apiFeedAdapter } = await import('../services/api-feed-adapter')

    const adapter = createFeedAdapter('api')

    expect(adapter).toBe(apiFeedAdapter)
  })

  it('keeps feed/comments/moderation flows on API adapter when VITE_DATA_SOURCE=api', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ id: 'clip_1', title: 'Clip', genreId: 'drama' }] })
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

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/v1/feed/clips?genre=drama',
      expect.objectContaining({ method: 'GET' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/v1/comments',
      expect.objectContaining({ method: 'GET' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      '/api/v1/moderation/comments',
      expect.objectContaining({ method: 'GET' })
    )
  })
})
