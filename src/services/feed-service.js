import { mockFeedAdapter, initialComments } from './mock-feed-adapter';

const feedAdapter = mockFeedAdapter;

export const feedService = {
  getFeed: feedAdapter.getFeed,
  toggleLike: feedAdapter.toggleLike,
  toggleBookmark: feedAdapter.toggleBookmark,
  createComment: feedAdapter.createComment,
  getBookmarks: feedAdapter.getBookmarks,
  getProfile: feedAdapter.getProfile,
  getInitialComments: () => initialComments,
};
