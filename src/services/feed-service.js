import { createFeedAdapter } from './create-feed-adapter'
import { normalizeWritePayload } from './payload-normalizer'

const feedAdapter = createFeedAdapter()
const API_ERROR_CODE = 'API_SERVICE_ERROR'
const REQUEST_PERF_PREFIX = '[api-metric]'
const API_EVENT_PREFIX = '[api-event]'
const TRACK_EVENT_PREFIX = '[feed-track-event]'
const EVENT_SCHEMA_VERSION = '1.0.0'
const EVENT_NAMES = {
  CLIP_IMPRESSION: 'clip_impression',
  CLIP_PLAY_STARTED: 'clip_play_started',
  CLIP_VIEW_THRESHOLD: 'clip_view_threshold',
  CLIP_VIEW_ENDED: 'clip_view_ended',
}

let cachedSessionId = null
let analyticsSessionProvider = null
const trackedEventsBuffer = []
const seenClipImpressions = new Set()
const seenClipViewThresholds = new Set()
const EVENTS_REQUIRING_IMPRESSION_ID = new Set([
  EVENT_NAMES.CLIP_PLAY_STARTED,
  EVENT_NAMES.CLIP_VIEW_THRESHOLD,
  EVENT_NAMES.CLIP_VIEW_ENDED,
])

function wait(ms) {
  const timeoutMs =
    typeof globalThis !== 'undefined' && globalThis.process?.env?.NODE_ENV === 'test' ? 0 : ms

  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs)
  })
}

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function createSessionId() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function getNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }

  return Date.now()
}

function resolveRequestId(payload) {
  if (!payload || typeof payload !== 'object') {
    return createRequestId()
  }

  if (typeof payload.requestId === 'string' && payload.requestId.trim()) {
    return payload.requestId.trim()
  }

  if (typeof payload.correlationId === 'string' && payload.correlationId.trim()) {
    return payload.correlationId.trim()
  }

  return createRequestId()
}

function isTestRuntime() {
  return typeof globalThis !== 'undefined' && globalThis.process?.env?.NODE_ENV === 'test'
}

function shouldEmitInfoLogs() {
  if (!isTestRuntime()) {
    return true
  }

  return Boolean(globalThis.__ENABLE_API_INFO_LOGS__)
}

function isDevRuntime() {
  return typeof globalThis !== 'undefined' && globalThis.process?.env?.NODE_ENV !== 'production'
}

function getMissingTrackEventFields(name, payload) {
  const missingFields = []

  if (typeof name !== 'string' || name.trim().length === 0) {
    missingFields.push('name')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    missingFields.push('payload')
  }

  return missingFields
}

function createTrackEventValidationError(name, missingFields) {
  const eventName = typeof name === 'string' && name.trim().length ? name.trim() : '<unknown>'

  return new Error(
    `trackEvent validation failed for "${eventName}": missing fields [${missingFields.join(', ')}]`
  )
}

function ensureImpressionIdForRelatedClipEvents(name, payload) {
  if (!EVENTS_REQUIRING_IMPRESSION_ID.has(name)) {
    return
  }

  if (typeof payload.impressionId === 'string' && payload.impressionId.trim().length > 0) {
    return
  }

  throw new Error(
    `trackEvent validation failed for "${name}": impressionId is required for related clip lifecycle events`
  )
}

function getDeduplicationKey(name, payload) {
  if (name === EVENT_NAMES.CLIP_IMPRESSION) {
    const impressionId = payload.impressionId?.trim?.()

    if (!impressionId) {
      return null
    }

    return {
      cache: seenClipImpressions,
      key: impressionId,
      reason: 'duplicate clip_impression for the same impressionId',
    }
  }

  if (name === EVENT_NAMES.CLIP_VIEW_THRESHOLD) {
    const impressionId = payload.impressionId?.trim?.()
    const threshold = payload.threshold?.trim?.()

    if (!impressionId || !threshold) {
      return null
    }

    return {
      cache: seenClipViewThresholds,
      key: `${impressionId}:${threshold}`,
      reason: 'duplicate clip_view_threshold for the same impressionId + threshold',
    }
  }

  return null
}

function resolveSessionId() {
  if (typeof analyticsSessionProvider === 'function') {
    const providedSessionId = analyticsSessionProvider()

    if (typeof providedSessionId === 'string' && providedSessionId.trim()) {
      cachedSessionId = providedSessionId.trim()
      return cachedSessionId
    }
  }

  if (!cachedSessionId) {
    cachedSessionId = createSessionId()
  }

  return cachedSessionId
}

function resolveUserId(payload) {
  if (typeof payload.userId === 'string' && payload.userId.trim()) {
    return payload.userId.trim()
  }

  return null
}

function logTrackEvent(status, payload) {
  if (!isDevRuntime()) {
    return
  }

  const logger = status === 'rejected' ? console.warn : console.info
  logger(TRACK_EVENT_PREFIX, { status, ...payload })
}

function logApiError({ endpoint, payload, error, code = API_ERROR_CODE }) {
  const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error')
  const event = {
    code,
    endpoint,
    requestId: resolveRequestId(payload),
    message: errorMessage,
  }

  console.error('[api-error]', event)
}

function logApiMetric({ endpoint, payload, durationMs, status }) {
  if (!shouldEmitInfoLogs()) {
    return
  }

  console.info(REQUEST_PERF_PREFIX, {
    endpoint,
    requestId: resolveRequestId(payload),
    status,
    durationMs: Number(durationMs.toFixed(1)),
  })
}

function logApiEvent({ name, payload }) {
  if (!shouldEmitInfoLogs()) {
    return
  }

  console.info(API_EVENT_PREFIX, {
    name,
    at: new Date().toISOString(),
    ...payload,
  })
}

function withRequestTiming({ endpoint, payload, operation }) {
  const startedAt = getNow()

  try {
    const result = operation()

    if (result && typeof result.then === 'function') {
      return result
        .then((value) => {
          logApiMetric({ endpoint, payload, durationMs: getNow() - startedAt, status: 'success' })
          return value
        })
        .catch((error) => {
          logApiMetric({ endpoint, payload, durationMs: getNow() - startedAt, status: 'error' })
          throw error
        })
    }

    logApiMetric({ endpoint, payload, durationMs: getNow() - startedAt, status: 'success' })
    return result
  } catch (error) {
    logApiMetric({ endpoint, payload, durationMs: getNow() - startedAt, status: 'error' })
    throw error
  }
}

async function performOptimisticUpdate({ endpoint, applyLocal, rollbackLocal, persist, payload }) {
  return withRequestTiming({
    endpoint,
    payload,
    operation: async () => {
      applyLocal()

      try {
        await persist()
        return true
      } catch (error) {
        logApiError({ endpoint, payload, error, code: 'API_OPTIMISTIC_PERSIST_ERROR' })
        rollbackLocal()
        return false
      }
    },
  })
}

function runWithApiErrorLogging({ endpoint, payload, operation, eventName, eventPayload }) {
  if (eventName) {
    logApiEvent({ name: eventName, payload: eventPayload })
  }

  return withRequestTiming({
    endpoint,
    payload,
    operation: () => {
      try {
        return operation()
      } catch (error) {
        logApiError({ endpoint, payload, error })
        throw error
      }
    },
  })
}

export const feedService = {
  setSessionProvider(provider) {
    analyticsSessionProvider = typeof provider === 'function' ? provider : null
  },
  trackEvent(name, payload) {
    const missingFields = getMissingTrackEventFields(name, payload)

    if (missingFields.length > 0) {
      const validationError = createTrackEventValidationError(name, missingFields)
      logTrackEvent('rejected', {
        name: typeof name === 'string' ? name : '<unknown>',
        reason: validationError.message,
      })
      throw validationError
    }

    const normalizedName = name.trim()
    ensureImpressionIdForRelatedClipEvents(normalizedName, payload)

    const deduplicationData = getDeduplicationKey(normalizedName, payload)

    if (deduplicationData && deduplicationData.cache.has(deduplicationData.key)) {
      logTrackEvent('dropped', {
        name: normalizedName,
        reason: deduplicationData.reason,
        dedupeKey: deduplicationData.key,
      })

      return null
    }

    deduplicationData?.cache.add(deduplicationData.key)

    const event = {
      ...payload,
      event: normalizedName,
      eventId: createEventId(),
      schemaVersion: EVENT_SCHEMA_VERSION,
      ts: new Date().toISOString(),
      sessionId: resolveSessionId(),
      userId: resolveUserId(payload),
    }

    trackedEventsBuffer.push(event)
    logTrackEvent('accepted', { name: normalizedName, eventId: event.eventId })

    return event
  },
  flush() {
    if (trackedEventsBuffer.length === 0) {
      return []
    }

    const events = [...trackedEventsBuffer]
    trackedEventsBuffer.length = 0
    return events
  },
  getFeed(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /feed/clips',
      payload: params,
      operation: () => feedAdapter.getFeed(params),
      eventName: 'feed.load.requested',
      eventPayload: { selectedGenresCount: params?.selectedGenres?.length ?? 0 },
    })
  },
  toggleLike(params) {
    return runWithApiErrorLogging({
      endpoint: 'POST /clips/:clipId/like',
      payload: params,
      operation: () => feedAdapter.toggleLike(normalizeWritePayload('toggleLike', params)),
    })
  },
  toggleBookmark(params) {
    return runWithApiErrorLogging({
      endpoint: 'POST /clips/:clipId/bookmark',
      payload: params,
      operation: () => feedAdapter.toggleBookmark(normalizeWritePayload('toggleBookmark', params)),
    })
  },
  createComment(params) {
    return runWithApiErrorLogging({
      endpoint: 'POST /clips/:clipId/comments',
      payload: params,
      operation: () => feedAdapter.createComment(normalizeWritePayload('createComment', params)),
      eventName: 'comment.submit.requested',
      eventPayload: { clipId: params?.clipId },
    })
  },
  getAllCommentsForModeration(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /moderation/comments',
      payload: params,
      operation: () => feedAdapter.getAllCommentsForModeration(params),
    })
  },
  blockUserComments(params) {
    return runWithApiErrorLogging({
      endpoint: 'POST /moderation/comments/block-user',
      payload: params,
      operation: () =>
        feedAdapter.blockUserComments(normalizeWritePayload('blockUserComments', params)),
    })
  },
  deleteComment(params) {
    return runWithApiErrorLogging({
      endpoint: 'DELETE /moderation/comments/:commentId',
      payload: params,
      operation: () => feedAdapter.deleteComment(normalizeWritePayload('deleteComment', params)),
    })
  },
  deleteCommentsByUser(params) {
    return runWithApiErrorLogging({
      endpoint: 'DELETE /moderation/comments/by-user/:authorId',
      payload: params,
      operation: () =>
        feedAdapter.deleteCommentsByUser(normalizeWritePayload('deleteCommentsByUser', params)),
    })
  },
  getBookmarks(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /bookmarks',
      payload: params,
      operation: () => feedAdapter.getBookmarks(params),
    })
  },
  getProfile(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /profile',
      payload: params,
      operation: () => feedAdapter.getProfile(params),
    })
  },
  getInitialComments() {
    return feedAdapter.getInitialComments()
  },

  async optimisticToggleLike({
    clipId,
    shouldLike,
    applyLocal,
    rollbackLocal,
    requestId,
    correlationId,
  }) {
    return performOptimisticUpdate({
      endpoint: 'POST /clips/:clipId/like/persist',
      payload: { clipId, requestId, correlationId },
      applyLocal,
      rollbackLocal,
      persist: () =>
        feedAdapter.persistLikeToggle(
          normalizeWritePayload('persistLikeToggle', { clipId, shouldLike })
        ),
    })
  },

  async optimisticToggleBookmark({
    clipId,
    shouldBookmark,
    applyLocal,
    rollbackLocal,
    requestId,
    correlationId,
  }) {
    return performOptimisticUpdate({
      endpoint: 'POST /clips/:clipId/bookmark/persist',
      payload: { clipId, requestId, correlationId },
      applyLocal,
      rollbackLocal,
      persist: () =>
        feedAdapter.persistBookmarkToggle(
          normalizeWritePayload('persistBookmarkToggle', { clipId, shouldBookmark })
        ),
    })
  },

  wait,
}
