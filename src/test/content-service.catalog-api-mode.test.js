import { describe, expect, it, vi, beforeEach } from 'vitest'

const getCatalogMock = vi.fn()

vi.mock('../services/create-feed-adapter', () => ({
  createFeedAdapter: vi.fn(() => ({
    getCatalog: getCatalogMock,
  })),
}))

import { contentService } from '../services/content-service'

describe('contentService catalog in api mode', () => {
  beforeEach(() => {
    getCatalogMock.mockReset()
  })

  it('returns catalog items when adapter resolves data', async () => {
    const payload = [{ id: 'clip-1', title: 'API Catalog Item' }]
    getCatalogMock.mockResolvedValueOnce(payload)

    await expect(contentService.getCatalog()).resolves.toEqual(payload)
  })

  it('returns empty array when adapter resolves empty list', async () => {
    getCatalogMock.mockResolvedValueOnce([])

    await expect(contentService.getCatalog()).resolves.toEqual([])
  })

  it('propagates adapter error for catalog loading', async () => {
    getCatalogMock.mockRejectedValueOnce(new Error('Catalog failed'))

    await expect(contentService.getCatalog()).rejects.toThrow('Catalog failed')
  })
})
