import { mockFeedAdapter, initialComments } from './mock-feed-adapter';
import { normalizeWritePayload } from './payload-normalizer';

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
  toggleLike(params) {
    return feedAdapter.toggleLike(normalizeWritePayload('toggleLike', params));
  },
  toggleBookmark(params) {
    return feedAdapter.toggleBookmark(normalizeWritePayload('toggleBookmark', params));
  },
  createComment(params) {
    return feedAdapter.createComment(normalizeWritePayload('createComment', params));
  },
  getBookmarks: feedAdapter.getBookmarks,
  getProfile: feedAdapter.getProfile,
  getInitialComments: () => initialComments,

  async optimisticToggleLike({ clipId, applyLocal, rollbackLocal }) {
    return performOptimisticUpdate({
      applyLocal,
      rollbackLocal,
      persist: () => feedAdapter.persistLikeToggle(normalizeWritePayload('persistLikeToggle', { clipId })),
    });
  },

  async optimisticToggleBookmark({ clipId, applyLocal, rollbackLocal }) {
    return performOptimisticUpdate({
      applyLocal,
      rollbackLocal,
      persist: () =>
        feedAdapter.persistBookmarkToggle(normalizeWritePayload('persistBookmarkToggle', { clipId })),
    });
  },

  wait,
};
