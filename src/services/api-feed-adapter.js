import { authService } from './auth-service'
import { createApiError, parseJsonResponse, resolveApiErrorMessage } from './api-client'
import { normalizeWritePayload } from './payload-normalizer'
import {
  toCommentUiModel,
  toCommentsMapUiModel,
  toModerationCommentUiList,
} from './mappers/comment-mapper'
import { toClipUiList } from './mappers/clip-mapper'

async function requestJsonWithAuth(path, { method = 'GET', query, body } = {}) {
  let response

  try {
    response = await authService.fetchWithAuth(path, {
      method,
      query,
      body,
    })
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw createApiError(`Network request failed for ${method} ${path}`, { cause: error })
  }

  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    throw createApiError(`${resolveApiErrorMessage(payload)} (${response.status})`, {
      status: response.status,
      payload,
    })
  }

  return payload
}

function toggleBooleanMapEntry(map, key) {
  return {
    ...(map || {}),
    [key]: !map?.[key],
  }
}

function shouldCreateToggleEntity(currentValue) {
  return !currentValue
}

function toggleArrayEntry(list, value) {
  const safeList = Array.isArray(list) ? list : []

  return safeList.includes(value) ? safeList.filter((item) => item !== value) : [...safeList, value]
}

function groupCommentsByClip(comments = []) {
  return comments.reduce((acc, comment) => {
    const normalized = toCommentUiModel(comment, comment?.clipId)
    const clipId = normalized.clipId

    if (!Array.isArray(acc[clipId])) {
      acc[clipId] = []
    }

    acc[clipId].push(normalized)
    return acc
  }, {})
}

function replaceCommentInMap(commentsMap = {}, clipId, nextComment) {
  const normalizedComment = toCommentUiModel(nextComment, clipId)
  const safeComments = commentsMap && typeof commentsMap === 'object' ? commentsMap : {}
  const clipComments = Array.isArray(safeComments[clipId]) ? safeComments[clipId] : []

  return {
    ...safeComments,
    [clipId]: clipComments.map((comment) =>
      comment.id === normalizedComment.id ? normalizedComment : toCommentUiModel(comment, clipId)
    ),
  }
}

function toggleCommentLikeInMap(commentsMap = {}, clipId, commentId, shouldLike) {
  const safeComments = commentsMap && typeof commentsMap === 'object' ? commentsMap : {}
  const clipComments = Array.isArray(safeComments[clipId]) ? safeComments[clipId] : []

  return {
    ...safeComments,
    [clipId]: clipComments.map((comment) => {
      const normalizedComment = toCommentUiModel(comment, clipId)

      if (normalizedComment.id !== commentId) {
        return normalizedComment
      }

      const currentLiked = Boolean(normalizedComment.likedByViewer)
      const nextLiked = typeof shouldLike === 'boolean' ? shouldLike : !currentLiked
      const delta = nextLiked === currentLiked ? 0 : nextLiked ? 1 : -1

      return {
        ...normalizedComment,
        likedByViewer: nextLiked,
        likes: Math.max(0, normalizedComment.likes + delta),
      }
    }),
  }
}

function toSafeProfileCount(value) {
  const normalized = Number(value)

  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0
  }

  return Math.trunc(normalized)
}

function resolveProfileCount(payload, keys = []) {
  for (const key of keys) {
    if (payload && Object.hasOwn(payload, key)) {
      return toSafeProfileCount(payload[key])
    }
  }

  return 0
}

function normalizeSelectedGenres(value) {
  const normalized = []
  const seen = new Set()

  ;(Array.isArray(value) ? value : []).forEach((entry) => {
    if (typeof entry !== 'string') {
      return
    }

    const normalizedEntry = entry.trim().toLowerCase()
    const genreId = normalizedEntry === 'sci-fi' ? 'scifi' : normalizedEntry

    if (!genreId || seen.has(genreId)) {
      return
    }

    seen.add(genreId)
    normalized.push(genreId)
  })

  return normalized
}

function normalizeDraftPreferences(value = {}) {
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  return {
    notificationsEnabled:
      typeof safeValue.notificationsEnabled === 'boolean' ? safeValue.notificationsEnabled : true,
    autoplayEnabled:
      typeof safeValue.autoplayEnabled === 'boolean' ? safeValue.autoplayEnabled : true,
    preferredLanguage:
      typeof safeValue.preferredLanguage === 'string' && safeValue.preferredLanguage.trim()
        ? safeValue.preferredLanguage.trim()
        : 'en',
  }
}

/** @type {import('./feed-adapter').FeedAdapter} */
export const apiFeedAdapter = {
  async getFeed({ selectedGenres = [] } = {}) {
    const payload = await requestJsonWithAuth('/feed/clips', {
      query: selectedGenres.length > 0 ? { genreId: selectedGenres } : undefined,
    })

    if (Array.isArray(payload)) {
      return toClipUiList(payload)
    }

    return toClipUiList(Array.isArray(payload?.items) ? payload.items : [])
  },

  async toggleLike(params) {
    const payload = normalizeWritePayload('toggleLike', params)
    const method = shouldCreateToggleEntity(payload.likes[payload.clipId]) ? 'POST' : 'DELETE'

    const response = await requestJsonWithAuth(`/clips/${payload.clipId}/like`, {
      method,
    })

    if (response?.likes && typeof response.likes === 'object') {
      return response.likes
    }

    return toggleBooleanMapEntry(payload.likes, payload.clipId)
  },

  async toggleBookmark(params) {
    const payload = normalizeWritePayload('toggleBookmark', params)
    const method = shouldCreateToggleEntity(payload.bookmarks.includes(payload.clipId))
      ? 'POST'
      : 'DELETE'

    const response = await requestJsonWithAuth(`/clips/${payload.clipId}/bookmark`, {
      method,
    })

    if (Array.isArray(response?.bookmarks)) {
      return response.bookmarks
    }

    return toggleArrayEntry(payload.bookmarks, payload.clipId)
  },

  async toggleCommentLike(params) {
    const payload = normalizeWritePayload('toggleCommentLike', params)
    const clipComments = Array.isArray(payload.comments[payload.clipId])
      ? payload.comments[payload.clipId].map((comment) => toCommentUiModel(comment, payload.clipId))
      : []
    const targetComment = clipComments.find((comment) => comment.id === payload.commentId)
    const method = shouldCreateToggleEntity(targetComment?.likedByViewer) ? 'POST' : 'DELETE'

    const response = await requestJsonWithAuth(`/comments/${payload.commentId}/like`, {
      method,
    })

    if (response?.comment) {
      return replaceCommentInMap(payload.comments, payload.clipId, response.comment)
    }

    return toggleCommentLikeInMap(
      payload.comments,
      payload.clipId,
      payload.commentId,
      method === 'POST'
    )
  },

  async persistLikeToggle(params) {
    const payload = normalizeWritePayload('persistLikeToggle', params)
    const method = payload.shouldLike === false ? 'DELETE' : 'POST'

    await requestJsonWithAuth(`/clips/${payload.clipId}/like`, {
      method,
    })
  },

  async persistBookmarkToggle(params) {
    const payload = normalizeWritePayload('persistBookmarkToggle', params)
    const method = payload.shouldBookmark === false ? 'DELETE' : 'POST'

    await requestJsonWithAuth(`/clips/${payload.clipId}/bookmark`, {
      method,
    })
  },

  async persistCommentLikeToggle(params) {
    const payload = normalizeWritePayload('persistCommentLikeToggle', params)
    const method = payload.shouldLike === false ? 'DELETE' : 'POST'

    await requestJsonWithAuth(`/comments/${payload.commentId}/like`, {
      method,
    })
  },

  async createComment(params) {
    const payload = normalizeWritePayload('createComment', params)

    const response = await requestJsonWithAuth(`/clips/${payload.clipId}/comments`, {
      method: 'POST',
      body: {
        body: payload.text,
      },
    })

    const commentData = response?.comment || response
    const normalizedComment = toCommentUiModel(commentData, payload.clipId)

    return {
      ...payload.comments,
      [payload.clipId]: [normalizedComment, ...(payload.comments[payload.clipId] || [])],
    }
  },

  async getAllCommentsForModeration({ clips = [], blockedUsers = {} } = {}) {
    const payload = await requestJsonWithAuth('/moderation/comments')
    const rows = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : []

    return toModerationCommentUiList(rows, { clips, blockedUsers })
  },

  async blockUserComments(params) {
    const payload = normalizeWritePayload('blockUserComments', params)

    await requestJsonWithAuth('/moderation/comments/block-user', {
      method: 'POST',
      body: { authorId: payload.authorId, isBlocked: true },
    })

    return {
      ...payload.blockedUsers,
      [payload.authorId]: true,
    }
  },

  async deleteComment(params) {
    const payload = normalizeWritePayload('deleteComment', params)

    await requestJsonWithAuth(`/moderation/comments/${payload.commentId}`, {
      method: 'DELETE',
    })

    return {
      ...payload.comments,
      [payload.clipId]: (payload.comments[payload.clipId] || [])
        .map((comment) => toCommentUiModel(comment, payload.clipId))
        .filter((comment) => comment.id !== payload.commentId),
    }
  },

  async deleteCommentsByUser(params) {
    const payload = normalizeWritePayload('deleteCommentsByUser', params)

    await requestJsonWithAuth(`/moderation/comments/by-user/${payload.authorId}`, {
      method: 'DELETE',
    })

    return Object.entries(payload.comments).reduce((acc, [clipId, clipComments]) => {
      const normalizedComments = Array.isArray(clipComments)
        ? clipComments.map((comment) => toCommentUiModel(comment, clipId))
        : []

      acc[clipId] = normalizedComments.filter((comment) => comment.authorId !== payload.authorId)
      return acc
    }, {})
  },

  async getCatalog() {
    const payload = await requestJsonWithAuth('/clips')

    if (Array.isArray(payload)) {
      return toClipUiList(payload)
    }

    return toClipUiList(Array.isArray(payload?.items) ? payload.items : [])
  },

  async getBookmarks() {
    const payload = await requestJsonWithAuth('/me/bookmarks')

    if (Array.isArray(payload)) {
      return toClipUiList(payload)
    }

    return toClipUiList(Array.isArray(payload?.items) ? payload.items : [])
  },

  async getProfile({ user } = {}) {
    const payload = await requestJsonWithAuth('/me')

    const counts = payload?.counts && typeof payload.counts === 'object' ? payload.counts : {}
    const watched =
      payload?.activity && typeof payload.activity === 'object' ? payload.activity : {}

    return {
      name: payload?.displayName || payload?.name || user?.name || 'Movie Explorer',
      email: payload?.email || user?.email || 'hello@movieexplorer.app',
      avatar: payload?.avatarUrl || payload?.avatar || user?.avatar || 'Movie',
      bookmarkCount:
        resolveProfileCount(payload, ['bookmarkCount', 'bookmarksCount']) ||
        resolveProfileCount(counts, ['bookmarks', 'bookmarkCount']),
      likeCount:
        resolveProfileCount(payload, ['likeCount', 'likesCount']) ||
        resolveProfileCount(counts, ['likes', 'likeCount']),
      watchedCount:
        resolveProfileCount(payload, ['watchedCount']) ||
        resolveProfileCount(counts, ['watched', 'watchedCount']) ||
        resolveProfileCount(watched, ['watched', 'clips']),
      selectedGenres: normalizeSelectedGenres(payload?.selectedGenres || user?.selectedGenres),
      draftPreferences: normalizeDraftPreferences(payload?.preferences || user?.preferences),
    }
  },

  async getInitialComments() {
    const payload = await requestJsonWithAuth('/comments')

    if (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      !Array.isArray(payload?.items)
    ) {
      return toCommentsMapUiModel(payload)
    }

    const rows = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : []
    return toCommentsMapUiModel(groupCommentsByClip(rows))
  },
}
