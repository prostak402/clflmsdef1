import { mockFeedAdapter, initialComments } from './mock-feed-adapter';
import { normalizeWritePayload } from './payload-normalizer';

const feedAdapter = mockFeedAdapter;
const API_ERROR_CODE = 'API_SERVICE_ERROR';

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveRequestId(payload) {
  if (!payload || typeof payload !== 'object') {
    return createRequestId();
  }

  if (typeof payload.requestId === 'string' && payload.requestId.trim()) {
    return payload.requestId.trim();
  }

  if (typeof payload.correlationId === 'string' && payload.correlationId.trim()) {
    return payload.correlationId.trim();
  }

  return createRequestId();
}

function logApiError({ endpoint, payload, error, code = API_ERROR_CODE }) {
  const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const event = {
    code,
    endpoint,
    requestId: resolveRequestId(payload),
    message: errorMessage,
  };

  console.error('[api-error]', event);
}

async function performOptimisticUpdate({
  endpoint,
  applyLocal,
  rollbackLocal,
  persist,
  payload,
}) {
  applyLocal();

  try {
    await persist();
    return true;
  } catch (error) {
    logApiError({ endpoint, payload, error, code: 'API_OPTIMISTIC_PERSIST_ERROR' });
    rollbackLocal();
    return false;
  }
}

function runWithApiErrorLogging({ endpoint, payload, operation }) {
  try {
    return operation();
  } catch (error) {
    logApiError({ endpoint, payload, error });
    throw error;
  }
}

export const feedService = {
  getFeed(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /feed',
      payload: params,
      operation: () => feedAdapter.getFeed(params),
    });
  },
  toggleLike(params) {
    return runWithApiErrorLogging({
      endpoint: 'POST /clips/:clipId/like',
      payload: params,
      operation: () => feedAdapter.toggleLike(normalizeWritePayload('toggleLike', params)),
    });
  },
  toggleBookmark(params) {
    return runWithApiErrorLogging({
      endpoint: 'POST /clips/:clipId/bookmark',
      payload: params,
      operation: () => feedAdapter.toggleBookmark(normalizeWritePayload('toggleBookmark', params)),
    });
  },
  createComment(params) {
    return runWithApiErrorLogging({
      endpoint: 'POST /clips/:clipId/comments',
      payload: params,
      operation: () => feedAdapter.createComment(normalizeWritePayload('createComment', params)),
    });
  },
  getBookmarks(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /bookmarks',
      payload: params,
      operation: () => feedAdapter.getBookmarks(params),
    });
  },
  getProfile(params) {
    return runWithApiErrorLogging({
      endpoint: 'GET /profile',
      payload: params,
      operation: () => feedAdapter.getProfile(params),
    });
  },
  getInitialComments: () => initialComments,

  async optimisticToggleLike({ clipId, applyLocal, rollbackLocal, requestId, correlationId }) {
    return performOptimisticUpdate({
      endpoint: 'POST /clips/:clipId/like/persist',
      payload: { clipId, requestId, correlationId },
      applyLocal,
      rollbackLocal,
      persist: () => feedAdapter.persistLikeToggle(normalizeWritePayload('persistLikeToggle', { clipId })),
    });
  },

  async optimisticToggleBookmark({ clipId, applyLocal, rollbackLocal, requestId, correlationId }) {
    return performOptimisticUpdate({
      endpoint: 'POST /clips/:clipId/bookmark/persist',
      payload: { clipId, requestId, correlationId },
      applyLocal,
      rollbackLocal,
      persist: () =>
        feedAdapter.persistBookmarkToggle(normalizeWritePayload('persistBookmarkToggle', { clipId })),
    });
  },

  wait,
};
