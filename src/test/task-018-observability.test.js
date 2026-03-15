import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { feedService } from '../services/feed-service'

describe('TASK-018: request metrics and key events', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    globalThis.__ENABLE_API_INFO_LOGS__ = true
  })

  afterEach(() => {
    delete globalThis.__ENABLE_API_INFO_LOGS__
  })

  it('logs feed load event and successful request timing metric', async () => {
    const logger = vi.spyOn(console, 'info').mockImplementation(() => {})

    const result = await feedService.getFeed({ selectedGenres: ['comedy'] })

    expect(Array.isArray(result)).toBe(true)

    const eventLog = logger.mock.calls.find(
      ([prefix, event]) => prefix === '[api-event]' && event?.name === 'feed.load.requested'
    )
    expect(eventLog).toBeTruthy()

    const metricLog = logger.mock.calls.find(
      ([prefix, event]) => prefix === '[api-metric]' && event?.endpoint === 'GET /feed/clips'
    )

    expect(metricLog).toBeTruthy()
    expect(metricLog[1]).toEqual(expect.objectContaining({ status: 'success' }))
    expect(typeof metricLog[1].durationMs).toBe('number')
  })

  it('logs comment submit event payload', async () => {
    const logger = vi.spyOn(console, 'info').mockImplementation(() => {})

    await feedService.createComment({
      clipId: 'clip_1',
      text: 'Great!',
      comments: { clip_1: [] },
    })

    const eventLog = logger.mock.calls.find(
      ([prefix, event]) => prefix === '[api-event]' && event?.name === 'comment.submit.requested'
    )

    expect(eventLog).toBeTruthy()
    expect(eventLog[1]).toEqual(expect.objectContaining({ clipId: 'clip_1' }))
  })

  it('logs error timing metric on validation failures', () => {
    const logger = vi.spyOn(console, 'info').mockImplementation(() => {})

    expect(() => feedService.toggleLike({ clipId: '', likes: {} })).toThrow('clipId is required')

    const metricLog = logger.mock.calls.find(
      ([prefix, event]) =>
        prefix === '[api-metric]' && event?.endpoint === 'POST /clips/:clipId/like'
    )

    expect(metricLog).toBeTruthy()
    expect(metricLog[1]).toEqual(expect.objectContaining({ status: 'error' }))
  })
})
