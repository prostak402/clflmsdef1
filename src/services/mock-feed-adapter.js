import { MOCK_CLIPS, MOCK_COMMENTS } from '../data/mock'
import { toClipUiList } from './mappers/clip-mapper'
import { flattenCommentsForModeration, toCommentUiModel, toCommentsMapUiModel } from './mappers/comment-mapper'

export const initialComments = toCommentsMapUiModel(MOCK_COMMENTS)

function simulateNetwork() {
  return Promise.resolve()
}

/** @type {import('./feed-adapter').FeedAdapter} */
export const mockFeedAdapter = {
  getFeed({ selectedGenres = [] } = {}) {
    if (selectedGenres.length === 0) {
      return toClipUiList(MOCK_CLIPS)
    }

    return toClipUiList(MOCK_CLIPS.filter((clip) => clip.genres.some((genre) => selectedGenres.includes(genre))))
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
    return flattenCommentsForModeration(comments, { clips, blockedUsers })
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

    const newComment = toCommentUiModel(
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
    return toClipUiList(MOCK_CLIPS.filter((clip) => bookmarks.includes(clip.id)))
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

  getInitialComments() {
    return initialComments
  },
}
