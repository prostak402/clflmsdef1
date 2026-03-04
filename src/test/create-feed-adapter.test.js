import { describe, expect, it, vi, afterEach } from 'vitest'

import { apiFeedAdapter } from '../services/api-feed-adapter'
import { createFeedAdapter, DEFAULT_DATA_SOURCE } from '../services/create-feed-adapter'

describe('createFeedAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses api adapter by default', () => {
    const adapter = createFeedAdapter(undefined)

    expect(DEFAULT_DATA_SOURCE).toBe('api')
    expect(adapter).toBe(apiFeedAdapter)
  })

  it('returns apiFeedAdapter when data source is api', () => {
    const adapter = createFeedAdapter('api')

    expect(adapter).toBe(apiFeedAdapter)
  })

  it('propagates network layer errors for api adapter', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('socket hang up'))

    const adapter = createFeedAdapter('api')

    await expect(adapter.getFeed()).rejects.toThrowError(
      'Network request failed for GET /feed/clips'
    )
  })

  it('keeps api adapter for unknown data source and logs warning', () => {
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const adapter = createFeedAdapter('legacy')

    expect(adapter).toBe(apiFeedAdapter)
    expect(warningSpy).toHaveBeenCalledOnce()
  })
})
