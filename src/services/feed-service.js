import { createFeedAdapter } from './create-feed-adapter'
import { normalizeWritePayload } from './payload-normalizer'

const feedAdapter = createFeedAdapter()
const API_ERROR_CODE = 'API_SERVICE_ERROR'
const REQUEST_PERF_PREFIX = '[api-metric]'
const API_EVENT_PREFIX = '[api-event]'

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
  getFeed(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /feed',
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

  async optimisticToggleLike({ clipId, applyLocal, rollbackLocal, requestId, correlationId }) {
    return performOptimisticUpdate({
      endpoint: 'POST /clips/:clipId/like/persist',
      payload: { clipId, requestId, correlationId },
      applyLocal,
      rollbackLocal,
      persist: () =>
        feedAdapter.persistLikeToggle(normalizeWritePayload('persistLikeToggle', { clipId })),
    })
  },

  async optimisticToggleBookmark({ clipId, applyLocal, rollbackLocal, requestId, correlationId }) {
    return performOptimisticUpdate({
      endpoint: 'POST /clips/:clipId/bookmark/persist',
      payload: { clipId, requestId, correlationId },
      applyLocal,
      rollbackLocal,
      persist: () =>
        feedAdapter.persistBookmarkToggle(
          normalizeWritePayload('persistBookmarkToggle', { clipId })
        ),
    })
  },

  wait,
}
