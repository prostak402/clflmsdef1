import { beforeEach, describe, expect, it, vi } from 'vitest'

import { feedService } from '../services/feed-service'

describe('TASK-024: feedService.trackEvent and flush', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    feedService.setSessionProvider(null)
    feedService.flush()
  })

  it('adds required envelope fields and keeps userId nullable', () => {
    feedService.setSessionProvider(() => 'session-provider-1')

    const event = feedService.trackEvent('feed_opened', {
      source: 'web',
      userId: '',
    })

    expect(event).toEqual(
      expect.objectContaining({
        event: 'feed_opened',
        source: 'web',
        schemaVersion: '1.0.0',
        sessionId: 'session-provider-1',
        userId: null,
      })
    )
    expect(typeof event.eventId).toBe('string')
    expect(typeof event.ts).toBe('string')
    expect(new Date(event.ts).toString()).not.toBe('Invalid Date')
  })

  it('returns buffered events and clears buffer on flush', () => {
    feedService.trackEvent('clip_impression', { clipId: 'clip-1' })
    feedService.trackEvent('clip_play_started', { clipId: 'clip-1' })

    const flushed = feedService.flush()

    expect(flushed).toHaveLength(2)
    expect(flushed.map((event) => event.event)).toEqual(['clip_impression', 'clip_play_started'])
    expect(feedService.flush()).toEqual([])
  })

  it('throws diagnosable validation error with missing fields', () => {
    expect(() => feedService.trackEvent('', null)).toThrow(
      'trackEvent validation failed for "<unknown>": missing fields [name, payload]'
    )
  })

  it('logs accepted and rejected events in development runtime', () => {
    const infoLogger = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnLogger = vi.spyOn(console, 'warn').mockImplementation(() => {})

    feedService.trackEvent('bookmark_set', { clipId: 'clip-2', userId: 'user-5' })
    expect(() => feedService.trackEvent('', {})).toThrow()

    expect(
      infoLogger.mock.calls.some(
        ([prefix, payload]) =>
          prefix === '[feed-track-event]' && payload?.status === 'accepted' && payload?.name
      )
    ).toBe(true)
    expect(
      warnLogger.mock.calls.some(
        ([prefix, payload]) => prefix === '[feed-track-event]' && payload?.status === 'rejected'
      )
    ).toBe(true)
  })
})
