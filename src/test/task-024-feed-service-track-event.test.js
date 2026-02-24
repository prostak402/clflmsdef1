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
    feedService.trackEvent('clip_play_started', { clipId: 'clip-1', impressionId: 'imp-play-1' })

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


  it('drops duplicate clip_impression and clip_view_threshold events', () => {
    const firstImpression = feedService.trackEvent('clip_impression', {
      clipId: 'clip-1',
      impressionId: 'imp-1',
    })
    const duplicateImpression = feedService.trackEvent('clip_impression', {
      clipId: 'clip-1',
      impressionId: 'imp-1',
    })

    const firstThreshold = feedService.trackEvent('clip_view_threshold', {
      clipId: 'clip-1',
      impressionId: 'imp-1',
      threshold: 'p50',
    })
    const duplicateThreshold = feedService.trackEvent('clip_view_threshold', {
      clipId: 'clip-1',
      impressionId: 'imp-1',
      threshold: 'p50',
    })

    const nonDuplicateThreshold = feedService.trackEvent('clip_view_threshold', {
      clipId: 'clip-1',
      impressionId: 'imp-1',
      threshold: 'p75',
    })

    expect(firstImpression?.event).toBe('clip_impression')
    expect(duplicateImpression).toBeNull()
    expect(firstThreshold?.event).toBe('clip_view_threshold')
    expect(duplicateThreshold).toBeNull()
    expect(nonDuplicateThreshold?.event).toBe('clip_view_threshold')

    const flushed = feedService.flush()
    expect(flushed).toHaveLength(3)
  })

  it('rejects related clip lifecycle events without impressionId', () => {
    expect(() =>
      feedService.trackEvent('clip_play_started', {
        clipId: 'clip-1',
      })
    ).toThrow(/impressionId/)

    expect(() =>
      feedService.trackEvent('clip_view_threshold', {
        clipId: 'clip-1',
        threshold: 'p50',
      })
    ).toThrow(/impressionId/)

    expect(() =>
      feedService.trackEvent('clip_view_ended', {
        clipId: 'clip-1',
      })
    ).toThrow(/impressionId/)
  })

  it('logs accepted/rejected/dropped events in development runtime', () => {
    const infoLogger = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnLogger = vi.spyOn(console, 'warn').mockImplementation(() => {})

    feedService.trackEvent('bookmark_set', { clipId: 'clip-2', userId: 'user-5' })
    feedService.trackEvent('clip_impression', { clipId: 'clip-2', impressionId: 'imp-42' })
    feedService.trackEvent('clip_impression', { clipId: 'clip-2', impressionId: 'imp-42' })
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
    expect(
      infoLogger.mock.calls.some(
        ([prefix, payload]) =>
          prefix === '[feed-track-event]' &&
          payload?.status === 'dropped' &&
          /duplicate clip_impression/.test(payload?.reason)
      )
    ).toBe(true)
  })
})
