import { mockFeedAdapter } from './mock-feed-adapter'
import { apiFeedAdapter } from './api-feed-adapter'

const DEFAULT_DATA_SOURCE = 'mock'
const API_ADAPTER_ERROR_MESSAGE = 'API adapter not configured'

function normalizeDataSource(dataSource) {
  if (typeof dataSource !== 'string') {
    return DEFAULT_DATA_SOURCE
  }

  const normalized = dataSource.trim().toLowerCase()
  return normalized || DEFAULT_DATA_SOURCE
}

export function createFeedAdapter(dataSource = import.meta.env?.VITE_DATA_SOURCE) {
  const normalizedDataSource = normalizeDataSource(dataSource)

  if (normalizedDataSource === 'api') {
    return apiFeedAdapter
  }

  return mockFeedAdapter
}

export { API_ADAPTER_ERROR_MESSAGE, DEFAULT_DATA_SOURCE }
