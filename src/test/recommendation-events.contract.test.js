import { describe, expect, it } from 'vitest'
import {
  EVENT_NAMES,
  EVENT_SOURCE,
  EVENT_SURFACE,
  VIEW_THRESHOLD,
  validateRecommendationEventPayload,
} from '../services/analytics/events'

describe('recommendation events contract', () => {
  const commonFields = {
    eventId: 'evt-1',
    userId: 'user-1',
    sessionId: 'session-1',
    feedRequestId: 'feed-1',
    ts: '2026-01-01T00:00:00.000Z',
    source: EVENT_SOURCE.CLIENT,
    surface: EVENT_SURFACE.FEED,
  }

  it('has exactly 8 event names', () => {
    expect(Object.values(EVENT_NAMES)).toHaveLength(8)
  })

  it('accepts clip_view_threshold with required fields', () => {
    expect(() =>
      validateRecommendationEventPayload({
        ...commonFields,
        event: EVENT_NAMES.CLIP_VIEW_THRESHOLD,
        clipId: 'clip-1',
        impressionId: 'impression-1',
        position: 1,
        clipDurationMs: 20000,
        watchMs: 10000,
        completionRate: 0.5,
        threshold: VIEW_THRESHOLD.P50,
      })
    ).not.toThrow()
  })

  it('rejects clip_view_threshold without impressionId', () => {
    expect(() =>
      validateRecommendationEventPayload({
        ...commonFields,
        event: EVENT_NAMES.CLIP_VIEW_THRESHOLD,
        clipId: 'clip-1',
        position: 1,
        clipDurationMs: 20000,
        watchMs: 10000,
        completionRate: 0.5,
        threshold: VIEW_THRESHOLD.P50,
      })
    ).toThrow(/impressionId/)
  })

  it('rejects related view events without impressionId', () => {
    expect(() =>
      validateRecommendationEventPayload({
        ...commonFields,
        event: EVENT_NAMES.CLIP_VIEW_ENDED,
        clipId: 'clip-1',
        position: 1,
        clipDurationMs: 20000,
        watchMs: 12000,
        completionRate: 0.6,
        playSequence: 1,
      })
    ).toThrow(/impressionId/)

    expect(() =>
      validateRecommendationEventPayload({
        ...commonFields,
        event: EVENT_NAMES.CLIP_PLAY_STARTED,
        clipId: 'clip-1',
        position: 1,
        clipDurationMs: 20000,
        playSequence: 1,
      })
    ).toThrow(/impressionId/)
  })
})
