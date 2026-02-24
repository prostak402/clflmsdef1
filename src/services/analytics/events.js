export const EVENT_NAMES = {
  FEED_OPENED: 'feed_opened',
  CLIP_IMPRESSION: 'clip_impression',
  CLIP_PLAY_STARTED: 'clip_play_started',
  CLIP_VIEW_THRESHOLD: 'clip_view_threshold',
  CLIP_VIEW_ENDED: 'clip_view_ended',
  LIKE_SET: 'like_set',
  BOOKMARK_SET: 'bookmark_set',
  COMMENT_CREATED: 'comment_created',
}

/** @typedef {typeof EVENT_NAMES[keyof typeof EVENT_NAMES]} EventName */

export const EVENT_SOURCE = {
  CLIENT: 'client',
  SERVER: 'server',
}

/** @typedef {typeof EVENT_SOURCE[keyof typeof EVENT_SOURCE]} EventSource */

export const EVENT_SURFACE = {
  FEED: 'feed',
  BOOKMARKS: 'bookmarks',
  PROFILE: 'profile',
}

/** @typedef {typeof EVENT_SURFACE[keyof typeof EVENT_SURFACE]} EventSurface */

export const VIEW_THRESHOLD = {
  P25: 'p25',
  P50: 'p50',
  P75: 'p75',
  P95: 'p95',
}

/** @typedef {typeof VIEW_THRESHOLD[keyof typeof VIEW_THRESHOLD]} ViewThreshold */

const VIEW_EVENTS_REQUIRING_IMPRESSION = new Set([
  EVENT_NAMES.CLIP_IMPRESSION,
  EVENT_NAMES.CLIP_PLAY_STARTED,
  EVENT_NAMES.CLIP_VIEW_THRESHOLD,
  EVENT_NAMES.CLIP_VIEW_ENDED,
])

const ACTION_EVENTS = new Set([
  EVENT_NAMES.LIKE_SET,
  EVENT_NAMES.BOOKMARK_SET,
  EVENT_NAMES.COMMENT_CREATED,
])

/**
 * @typedef EventCommonFields
 * @property {string} eventId
 * @property {string} userId
 * @property {string} sessionId
 * @property {string} feedRequestId
 * @property {string} ts
 * @property {EventName} event
 * @property {EventSource} source
 * @property {EventSurface} surface
 */

/**
 * @typedef FeedOpenedPayload
 * @property {number} selectedGenresCount
 */

/**
 * @typedef ClipImpressionPayload
 * @property {string} clipId
 * @property {string} impressionId
 * @property {number} position
 */

/**
 * @typedef ClipPlayStartedPayload
 * @property {string} clipId
 * @property {string} impressionId
 * @property {number} position
 * @property {number} clipDurationMs
 * @property {number} playSequence
 */

/**
 * @typedef ClipViewThresholdPayload
 * @property {string} clipId
 * @property {string} impressionId
 * @property {number} position
 * @property {number} clipDurationMs
 * @property {number} watchMs
 * @property {number} completionRate
 * @property {ViewThreshold} threshold
 */

/**
 * @typedef ClipViewEndedPayload
 * @property {string} clipId
 * @property {string} impressionId
 * @property {number} position
 * @property {number} clipDurationMs
 * @property {number} watchMs
 * @property {number} completionRate
 * @property {number} playSequence
 */

/**
 * @typedef ActionPayload
 * @property {string} clipId
 * @property {string} impressionId
 * @property {number} position
 */

const REQUIRED_COMMON_FIELDS = ['eventId', 'userId', 'sessionId', 'feedRequestId', 'ts', 'event']

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
    'source',
    'surface',
  ],
  [EVENT_NAMES.LIKE_SET]: ['clipId', 'impressionId', 'position', 'source', 'surface'],
  [EVENT_NAMES.BOOKMARK_SET]: ['clipId', 'impressionId', 'position', 'source', 'surface'],
  [EVENT_NAMES.COMMENT_CREATED]: ['clipId', 'impressionId', 'position', 'source', 'surface'],
}

function ensureObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Event payload must be an object')
  }
}

function ensureNonEmptyField(eventPayload, fieldName) {
  const value = eventPayload[fieldName]

  if (value === undefined || value === null) {
    throw new Error(`Event field "${fieldName}" is required`)
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    throw new Error(`Event field "${fieldName}" must be a non-empty string`)
  }
}

export function validateRecommendationEventPayload(eventPayload) {
  ensureObject(eventPayload)

  for (const requiredCommonField of REQUIRED_COMMON_FIELDS) {
    ensureNonEmptyField(eventPayload, requiredCommonField)
  }

  const { event } = eventPayload

  if (!Object.values(EVENT_NAMES).includes(event)) {
    throw new Error(`Unknown recommendation event "${event}"`)
  }

  const requiredEventFields = REQUIRED_FIELDS_BY_EVENT[event]

  for (const requiredField of requiredEventFields) {
    ensureNonEmptyField(eventPayload, requiredField)
  }

  if (!Object.values(EVENT_SOURCE).includes(eventPayload.source)) {
    throw new Error(`Unsupported source "${eventPayload.source}"`)
  }

  if (!Object.values(EVENT_SURFACE).includes(eventPayload.surface)) {
    throw new Error(`Unsupported surface "${eventPayload.surface}"`)
  }

  if (
    event === EVENT_NAMES.CLIP_VIEW_THRESHOLD &&
    !Object.values(VIEW_THRESHOLD).includes(eventPayload.threshold)
  ) {
    throw new Error(`Unsupported threshold "${eventPayload.threshold}"`)
  }

  if (VIEW_EVENTS_REQUIRING_IMPRESSION.has(event) && !eventPayload.impressionId) {
    throw new Error(`Event "${event}" requires non-empty impressionId`)
  }

  if (ACTION_EVENTS.has(event) && !eventPayload.impressionId) {
    throw new Error(`Action event "${event}" must reference impressionId`)
  }

  return eventPayload
}
