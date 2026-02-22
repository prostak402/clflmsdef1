import { MOCK_CLIPS, MOCK_COMMENTS } from '../data/mock';

/** @type {import('./feed-adapter').FeedAdapter} */
export const mockFeedAdapter = {
  getFeed({ selectedGenres = [] } = {}) {
    if (selectedGenres.length === 0) {
      return MOCK_CLIPS;
    }

    return MOCK_CLIPS.filter((clip) =>
      clip.genres.some((genre) => selectedGenres.includes(genre))
    );
  },

  toggleLike({ clipId, likes }) {
    return {
      ...likes,
      [clipId]: !likes[clipId],
    };
  },

  toggleBookmark({ clipId, bookmarks }) {
    return bookmarks.includes(clipId)
      ? bookmarks.filter((id) => id !== clipId)
      : [...bookmarks, clipId];
  },

  createComment({ clipId, text, comments, userName }) {
    const newComment = {
      id: `cm_${Date.now()}`,
      user: userName || 'Anonymous',
      avatar: '👤',
      text,
      time: 'Just now',
      likes: 0,
    };

    return {
      ...comments,
      [clipId]: [newComment, ...(comments[clipId] || [])],
    };
  },

  getBookmarks({ bookmarks }) {
    return MOCK_CLIPS.filter((clip) => bookmarks.includes(clip.id));
  },

  getProfile({ user, bookmarks, likes }) {
    return {
      name: user?.name || 'Movie Explorer',
      email: user?.email || 'hello@movieexplorer.app',
      avatar: user?.avatar || '🎬',
      bookmarkCount: bookmarks.length,
      likeCount: Object.values(likes).filter(Boolean).length,
    };
  },
};

export const initialComments = MOCK_COMMENTS;
