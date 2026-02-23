import { MOCK_CLIPS, MOCK_COMMENTS } from '../data/mock'
import { normalizeComment, normalizeCommentsMap } from './comment-normalizer'

function simulateNetwork() {
  return Promise.resolve()
}

function flattenCommentsForModeration({ commentsMap, clips = [], blockedUsers = {} }) {
  const clipNameById = clips.reduce((acc, clip) => {
    if (clip?.id) {
      acc[clip.id] = clip.title || 'Unknown clip'
    }

    return acc
  }, {})

  let order = 0

  return Object.entries(commentsMap || {})
    .flatMap(([clipId, clipComments]) => {
      if (!Array.isArray(clipComments)) {
        return []
      }

      return clipComments.map((comment) => ({
        ...comment,
        clipId: comment?.clipId || clipId,
        clipTitle: clipNameById[comment?.clipId || clipId] || 'Unknown clip',
        isBlockedAuthor: Boolean(blockedUsers[comment?.authorId || '']),
        __order: order++,
      }))
    })
    .sort((a, b) => {
      const aTime = Date.parse(a?.createdAt || '')
      const bTime = Date.parse(b?.createdAt || '')
      const aTs = Number.isNaN(aTime) ? -Infinity : aTime
      const bTs = Number.isNaN(bTime) ? -Infinity : bTime

      if (bTs !== aTs) {
        return bTs - aTs
      }

      return a.__order - b.__order
    })
    .map((comment) => {
      const normalizedComment = { ...comment }
      delete normalizedComment.__order
      return normalizedComment
    })
}

/** @type {import('./feed-adapter').FeedAdapter} */
export const mockFeedAdapter = {
  getFeed({ selectedGenres = [] } = {}) {
    if (selectedGenres.length === 0) {
      return MOCK_CLIPS
    }

    return MOCK_CLIPS.filter((clip) => clip.genres.some((genre) => selectedGenres.includes(genre)))
  },

  toggleLike({ clipId, likes }) {
    return {
      ...likes,
      [clipId]: !likes[clipId],
    }
  },

  toggleBookmark({ clipId, bookmarks }) {
    return bookmarks.includes(clipId)
      ? bookmarks.filter((id) => id !== clipId)
      : [...bookmarks, clipId]
  },

  async persistLikeToggle() {
    await simulateNetwork()
  },

  async persistBookmarkToggle() {
    await simulateNetwork()
  },

  getAllCommentsForModeration({ comments = {}, clips = MOCK_CLIPS, blockedUsers = {} } = {}) {
    return flattenCommentsForModeration({
      commentsMap: comments,
      clips,
      blockedUsers,
    })
  },

  blockUserComments({ authorId, blockedUsers }) {
    return {
      ...(blockedUsers || {}),
      [authorId]: true,
    }
  },

  deleteComment({ clipId, commentId, comments }) {
    const clipComments = Array.isArray(comments?.[clipId]) ? comments[clipId] : []

    return {
      ...(comments || {}),
      [clipId]: clipComments.filter((comment) => comment.id !== commentId),
    }
  },

  deleteCommentsByUser({ authorId, comments }) {
    return Object.entries(comments || {}).reduce((acc, [clipId, clipComments]) => {
      acc[clipId] = Array.isArray(clipComments)
        ? clipComments.filter((comment) => comment.authorId !== authorId)
        : []
      return acc
    }, {})
  },

  createComment({ clipId, text, comments, userName, authorId }) {
    const nowIso = new Date().toISOString()

    const newComment = normalizeComment(
      {
        id: `cm_${Date.now()}`,
        clipId,
        authorId: authorId || 'anonymous',
        authorName: userName || 'Anonymous',
        avatar: '👤',
        text,
        likes: 0,
        createdAt: nowIso,
        timeLabel: 'Just now',
      },
      clipId
    )

    return {
      ...comments,
      [clipId]: [newComment, ...(comments[clipId] || [])],
    }
  },

  getBookmarks({ bookmarks }) {
    return MOCK_CLIPS.filter((clip) => bookmarks.includes(clip.id))
  },

  getProfile({ user, bookmarks, likes }) {
    return {
      name: user?.name || 'Movie Explorer',
      email: user?.email || 'hello@movieexplorer.app',
      avatar: user?.avatar || '🎬',
      bookmarkCount: bookmarks.length,
      likeCount: Object.values(likes).filter(Boolean).length,
    }
  },
}

export const initialComments = normalizeCommentsMap(MOCK_COMMENTS)
