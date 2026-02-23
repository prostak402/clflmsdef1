import { beforeEach, describe, expect, it, vi } from 'vitest';

import { feedService } from '../services/feed-service';
import { mockFeedAdapter } from '../services/mock-feed-adapter';

describe('TASK-017: standardized API error logging', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs API error shape for sync service failures', () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => feedService.toggleLike({ clipId: '', likes: {} })).toThrow('clipId is required');

    expect(logger).toHaveBeenCalledTimes(1);

    const [prefix, event] = logger.mock.calls[0];
    expect(prefix).toBe('[api-error]');
    expect(event).toEqual(
      expect.objectContaining({
        code: 'API_SERVICE_ERROR',
        endpoint: 'POST /clips/:clipId/like',
        message: 'clipId is required',
      })
    );
    expect(typeof event.requestId).toBe('string');
    expect(event.requestId.length).toBeGreaterThan(0);
  });

  it('uses correlation id from payload when provided', () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      feedService.createComment({
        clipId: '',
        text: '',
        comments: {},
        correlationId: 'corr-42',
      })
    ).toThrow();

    const [, event] = logger.mock.calls[0];
    expect(event.requestId).toBe('corr-42');
  });

  it('logs optimistic persist failures from service layer', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(mockFeedAdapter, 'persistBookmarkToggle').mockRejectedValueOnce(new Error('Network down'));

    const result = await feedService.optimisticToggleBookmark({
      clipId: 'clip_7',
      applyLocal: vi.fn(),
      rollbackLocal: vi.fn(),
      requestId: 'req-123',
    });

    expect(result).toBe(false);
    const [, event] = logger.mock.calls[0];
    expect(event).toEqual(
      expect.objectContaining({
        code: 'API_OPTIMISTIC_PERSIST_ERROR',
        endpoint: 'POST /clips/:clipId/bookmark/persist',
        requestId: 'req-123',
        message: 'Network down',
      })
    );
  });
});
