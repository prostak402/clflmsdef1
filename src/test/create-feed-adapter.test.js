import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiFeedAdapter } from '../services/api-feed-adapter'
import { createFeedAdapter } from '../services/create-feed-adapter'

describe('createFeedAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns the api adapter', () => {
    expect(createFeedAdapter()).toBe(apiFeedAdapter)
  })

  it('does not depend on VITE_DATA_SOURCE', () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'mock')

    expect(createFeedAdapter()).toBe(apiFeedAdapter)
  })

  it('propagates network layer errors for api adapter', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('socket hang up'))

    await expect(createFeedAdapter().getFeed()).rejects.toThrowError(
      'Network request failed for GET /feed/clips'
    )
  })
})
