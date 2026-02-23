import { MOCK_CLIPS, MOCK_COMMENTS } from '../data/mock'
import { normalizeComment, normalizeCommentsMap } from './comment-normalizer'

function simulateNetwork() {
  return Promise.resolve()
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
