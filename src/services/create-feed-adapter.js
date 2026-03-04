import { apiFeedAdapter } from './api-feed-adapter'

const DEFAULT_DATA_SOURCE = 'api'

function normalizeDataSource(dataSource) {
  if (typeof dataSource !== 'string') {
    return DEFAULT_DATA_SOURCE
  }

  const normalized = dataSource.trim().toLowerCase()
  return normalized || DEFAULT_DATA_SOURCE
}

export function createFeedAdapter(dataSource = import.meta.env?.VITE_DATA_SOURCE) {
  const normalizedDataSource = normalizeDataSource(dataSource)

  if (normalizedDataSource !== 'api') {
    console.warn('[feed-adapter] Unsupported data source, api adapter enforced', {
      requestedDataSource: normalizedDataSource,
    })
  }

  return apiFeedAdapter
}

export { DEFAULT_DATA_SOURCE }
