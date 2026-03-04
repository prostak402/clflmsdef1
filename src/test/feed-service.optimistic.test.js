import { beforeEach, describe, expect, it, vi } from 'vitest'

import { feedService } from '../services/feed-service'
import { apiFeedAdapter } from '../services/api-feed-adapter'

describe('TASK-006: centralized optimistic updates', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('applies optimistic like and keeps state on success', async () => {
    const applyLocal = vi.fn()
    const rollbackLocal = vi.fn()

    const persistSpy = vi.spyOn(apiFeedAdapter, 'persistLikeToggle').mockResolvedValueOnce()

    const isSuccess = await feedService.optimisticToggleLike({
      clipId: 'clip_1',
      shouldLike: true,
      applyLocal,
      rollbackLocal,
    })

    expect(isSuccess).toBe(true)
    expect(applyLocal).toHaveBeenCalledTimes(1)
    expect(rollbackLocal).not.toHaveBeenCalled()
    expect(persistSpy).toHaveBeenCalledWith({ clipId: 'clip_1', shouldLike: true })
  })

  it('rolls back optimistic like when persist fails', async () => {
    const applyLocal = vi.fn()
    const rollbackLocal = vi.fn()

    vi.spyOn(apiFeedAdapter, 'persistLikeToggle').mockRejectedValueOnce(new Error('Like error'))

    const isSuccess = await feedService.optimisticToggleLike({
      clipId: 'clip_3',
      shouldLike: false,
      applyLocal,
      rollbackLocal,
    })

    expect(isSuccess).toBe(false)
    expect(applyLocal).toHaveBeenCalledTimes(1)
    expect(rollbackLocal).toHaveBeenCalledTimes(1)
  })

  it('applies optimistic bookmark and keeps state on success', async () => {
    const applyLocal = vi.fn()
    const rollbackLocal = vi.fn()

    const persistSpy = vi.spyOn(apiFeedAdapter, 'persistBookmarkToggle').mockResolvedValueOnce()

    const isSuccess = await feedService.optimisticToggleBookmark({
      clipId: 'clip_2',
      shouldBookmark: true,
      applyLocal,
      rollbackLocal,
    })

    expect(isSuccess).toBe(true)
    expect(applyLocal).toHaveBeenCalledTimes(1)
    expect(rollbackLocal).not.toHaveBeenCalled()
    expect(persistSpy).toHaveBeenCalledWith({ clipId: 'clip_2', shouldBookmark: true })
  })

  it('rolls back optimistic bookmark when persist fails', async () => {
    const applyLocal = vi.fn()
    const rollbackLocal = vi.fn()

    vi.spyOn(apiFeedAdapter, 'persistBookmarkToggle').mockRejectedValueOnce(
      new Error('Network error')
    )

    const isSuccess = await feedService.optimisticToggleBookmark({
      clipId: 'clip_2',
      shouldBookmark: false,
      applyLocal,
      rollbackLocal,
    })

    expect(isSuccess).toBe(false)
    expect(applyLocal).toHaveBeenCalledTimes(1)
    expect(rollbackLocal).toHaveBeenCalledTimes(1)
  })
})
