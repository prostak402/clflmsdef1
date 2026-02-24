import { describe, expect, it } from 'vitest'

import {
  API_ADAPTER_ERROR_MESSAGE,
  createFeedAdapter,
  DEFAULT_DATA_SOURCE,
} from '../services/create-feed-adapter'

describe('createFeedAdapter', () => {
  it('uses mock adapter by default', () => {
    const adapter = createFeedAdapter(undefined)

    expect(DEFAULT_DATA_SOURCE).toBe('mock')
    expect(Array.isArray(adapter.getFeed())).toBe(true)
    expect(() => adapter.getInitialComments()).not.toThrow()
  })

  it('returns API stub when data source is api', () => {
    const adapter = createFeedAdapter('api')

    expect(() => adapter.getFeed()).toThrowError(API_ADAPTER_ERROR_MESSAGE)
    expect(() => adapter.getInitialComments()).toThrowError(API_ADAPTER_ERROR_MESSAGE)
  })

  it('falls back to mock for unknown data source', () => {
    const adapter = createFeedAdapter('legacy')

    expect(Array.isArray(adapter.getFeed())).toBe(true)
  })
})
