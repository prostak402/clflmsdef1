import { beforeEach, describe, expect, it } from 'vitest'

import { feedService } from '../services/feed-service'
import {
  EVENT_NAMES,
  EVENT_SOURCE,
  EVENT_SURFACE,
  VIEW_THRESHOLD,
  validateRecommendationEventPayload,
} from '../services/analytics/events'

const BASE_COMMON_FIELDS = {
  eventId: 'evt-1',
  userId: 'user-1',
  sessionId: 'session-1',
  feedRequestId: 'feed-1',
  ts: '2026-01-01T00:00:00.000Z',
  source: EVENT_SOURCE.CLIENT,
  surface: EVENT_SURFACE.FEED,
}

const VALID_PAYLOAD_BY_EVENT = {
  [EVENT_NAMES.FEED_OPENED]: {
    selectedGenresCount: 2,
  },
  [EVENT_NAMES.CLIP_IMPRESSION]: {
    clipId: 'clip-1',
    impressionId: 'imp-1',
    position: 1,
  },
  [EVENT_NAMES.CLIP_PLAY_STARTED]: {
    clipId: 'clip-1',
    impressionId: 'imp-1',
    position: 1,
    clipDurationMs: 10000,
    playSequence: 1,
  },
  [EVENT_NAMES.CLIP_VIEW_THRESHOLD]: {
    clipId: 'clip-1',
    impressionId: 'imp-1',
    position: 1,
    clipDurationMs: 10000,
    watchMs: 5000,
    completionRate: 0.5,
    threshold: VIEW_THRESHOLD.P50,
  },
  [EVENT_NAMES.CLIP_VIEW_ENDED]: {
    clipId: 'clip-1',
    impressionId: 'imp-1',
    position: 1,
    clipDurationMs: 10000,
    watchMs: 8000,
    completionRate: 0.8,
    playSequence: 1,
    endReason: 'completed',
  },
  [EVENT_NAMES.LIKE_SET]: {
    clipId: 'clip-1',
    impressionId: 'imp-1',
    position: 1,
    value: true,
  },
  [EVENT_NAMES.BOOKMARK_SET]: {
    clipId: 'clip-1',
    impressionId: 'imp-1',
    position: 1,
    value: false,
  },
  [EVENT_NAMES.COMMENT_CREATED]: {
    clipId: 'clip-1',
    impressionId: 'imp-1',
    position: 1,
  },
}

const REQUIRED_FIELDS_BY_EVENT = {
  [EVENT_NAMES.FEED_OPENED]: ['selectedGenresCount', 'source', 'surface'],
  [EVENT_NAMES.CLIP_IMPRESSION]: ['clipId', 'impressionId', 'position', 'source', 'surface'],
  [EVENT_NAMES.CLIP_PLAY_STARTED]: [
    'clipId',
    'impressionId',
    'position',
    'clipDurationMs',
    'playSequence',
    'source',
    'surface',
  ],
  [EVENT_NAMES.CLIP_VIEW_THRESHOLD]: [
    'clipId',
    'impressionId',
    'position',
    'clipDurationMs',
    'watchMs',
    'completionRate',
    'threshold',
    'source',
    'surface',
  ],
  [EVENT_NAMES.CLIP_VIEW_ENDED]: [
    'clipId',
    'impressionId',
    'position',
    'clipDurationMs',
    'watchMs',
    'completionRate',
    'playSequence',
    'endReason',
    'source',
    'surface',
  ],
  [EVENT_NAMES.LIKE_SET]: ['clipId', 'impressionId', 'position', 'value', 'source', 'surface'],
  [EVENT_NAMES.BOOKMARK_SET]: ['clipId', 'impressionId', 'position', 'value', 'source', 'surface'],
  [EVENT_NAMES.COMMENT_CREATED]: ['clipId', 'impressionId', 'position', 'source', 'surface'],
}

function makeValidEvent(eventName) {
  return {
    ...BASE_COMMON_FIELDS,
    event: eventName,
    ...VALID_PAYLOAD_BY_EVENT[eventName],
  }
}

describe('TASK-025: trackEvent/event-schema contract', () => {
  beforeEach(() => {
    feedService.setSessionProvider(null)
    feedService.flush()
  })

  it('auto-fills helper fields and keeps userId nullable', () => {
    feedService.setSessionProvider(() => 'sess-provider')

    const event = feedService.trackEvent('feed_opened', {
      source: 'client',
      surface: 'feed',
      userId: null,
    })

    expect(event).toEqual(
      expect.objectContaining({
        event: 'feed_opened',
        schemaVersion: '1.0.0',
        sessionId: 'sess-provider',
        userId: null,
      })
    )
    expect(typeof event.eventId).toBe('string')
    expect(typeof event.ts).toBe('string')
    expect(new Date(event.ts).toString()).not.toBe('Invalid Date')
  })

  it('flush returns all buffered events, clears them, then returns empty on repeated flush', () => {
    feedService.trackEvent('feed_opened', { source: 'client', surface: 'feed' })
    feedService.trackEvent('clip_impression', { clipId: 'clip-1', impressionId: 'imp-1' })

    const firstFlush = feedService.flush()
    const secondFlush = feedService.flush()

    expect(firstFlush).toHaveLength(2)
    expect(firstFlush.map((item) => item.event)).toEqual(['feed_opened', 'clip_impression'])
    expect(secondFlush).toEqual([])
  })

  it.each(Object.values(EVENT_NAMES))(
    'accepts valid shape and required fields for %s',
    (eventName) => {
      expect(() => validateRecommendationEventPayload(makeValidEvent(eventName))).not.toThrow()
    }
  )

  it.each(Object.entries(REQUIRED_FIELDS_BY_EVENT))(
    'rejects missing required fields for %s',
    (eventName, requiredFields) => {
      for (const field of requiredFields) {
        const candidate = makeValidEvent(eventName)
        delete candidate[field]

        expect(() => validateRecommendationEventPayload(candidate)).toThrow(field)
      }
    }
  )

  it('rejects invalid enum values for source/surface/threshold', () => {
    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.CLIP_IMPRESSION),
        source: 'mobile-app',
      })
    ).toThrow(/Unsupported source/)

    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.CLIP_IMPRESSION),
        surface: 'stories',
      })
    ).toThrow(/Unsupported surface/)

    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.CLIP_VIEW_THRESHOLD),
        threshold: 'p100',
      })
    ).toThrow(/Unsupported threshold/)
  })

  it('enforces impression linkage for clip lifecycle events', () => {
    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.CLIP_VIEW_THRESHOLD),
        impressionId: '',
      })
    ).toThrow(/impressionId/)

    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.CLIP_PLAY_STARTED),
        impressionId: '',
      })
    ).toThrow(/impressionId/)

    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.CLIP_VIEW_ENDED),
        impressionId: '',
      })
    ).toThrow(/impressionId/)
  })

  it('requires boolean value for like_set and bookmark_set', () => {
    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.LIKE_SET),
        value: 'yes',
      })
    ).toThrow(/value/)

    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.BOOKMARK_SET),
        value: 1,
      })
    ).toThrow(/value/)

    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.LIKE_SET),
        value: true,
      })
    ).not.toThrow()

    expect(() =>
      validateRecommendationEventPayload({
        ...makeValidEvent(EVENT_NAMES.BOOKMARK_SET),
        value: false,
      })
    ).not.toThrow()
  })
})
