import { mockFeedAdapter, initialComments } from './mock-feed-adapter';

const feedAdapter = mockFeedAdapter;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function performOptimisticUpdate({
  applyLocal,
  rollbackLocal,
  persist,
}) {
  applyLocal();

  try {
    await persist();
    return true;
  } catch {
    rollbackLocal();
    return false;
  }
}

export const feedService = {
  getFeed: feedAdapter.getFeed,
  toggleLike: feedAdapter.toggleLike,
  toggleBookmark: feedAdapter.toggleBookmark,
  createComment: feedAdapter.createComment,
  getBookmarks: feedAdapter.getBookmarks,
  getProfile: feedAdapter.getProfile,
  getInitialComments: () => initialComments,

  async optimisticToggleLike({ clipId, applyLocal, rollbackLocal }) {
    return performOptimisticUpdate({
      applyLocal,
      rollbackLocal,
      persist: () => feedAdapter.persistLikeToggle({ clipId }),
    });
  },

  async optimisticToggleBookmark({ clipId, applyLocal, rollbackLocal }) {
    return performOptimisticUpdate({
      applyLocal,
      rollbackLocal,
      persist: () => feedAdapter.persistBookmarkToggle({ clipId }),
    });
  },

  wait,
};
