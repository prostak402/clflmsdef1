import { beforeEach, describe, expect, it, vi } from 'vitest';

import { feedService } from '../services/feed-service';
import { mockFeedAdapter } from '../services/mock-feed-adapter';

describe('TASK-006: centralized optimistic updates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies optimistic like and keeps state on success', async () => {
    const applyLocal = vi.fn();
    const rollbackLocal = vi.fn();

    vi.spyOn(mockFeedAdapter, 'persistLikeToggle').mockResolvedValueOnce();

    const isSuccess = await feedService.optimisticToggleLike({
      clipId: 'clip_1',
      applyLocal,
      rollbackLocal,
    });

    expect(isSuccess).toBe(true);
    expect(applyLocal).toHaveBeenCalledTimes(1);
    expect(rollbackLocal).not.toHaveBeenCalled();
  });

  it('rolls back optimistic bookmark when persist fails', async () => {
    const applyLocal = vi.fn();
    const rollbackLocal = vi.fn();

    vi.spyOn(mockFeedAdapter, 'persistBookmarkToggle').mockRejectedValueOnce(new Error('Network error'));

    const isSuccess = await feedService.optimisticToggleBookmark({
      clipId: 'clip_2',
      applyLocal,
      rollbackLocal,
    });

    expect(isSuccess).toBe(false);
    expect(applyLocal).toHaveBeenCalledTimes(1);
    expect(rollbackLocal).toHaveBeenCalledTimes(1);
  });
});
