import { requestJson } from './api-client'
import { createFeedAdapter } from './create-feed-adapter'

let genresCache = []
let genresPromise = null

function normalizeGenres(payload) {
  const rows = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []

  return rows
    .map((genre) => ({
      id: typeof genre?.id === 'string' && genre.id.trim() ? genre.id.trim() : '',
      name: typeof genre?.name === 'string' && genre.name.trim() ? genre.name.trim() : 'Unknown',
    }))
    .filter((genre) => genre.id)
}

export const contentService = {
  async getGenres({ force = false } = {}) {
    if (!force && genresCache.length > 0) {
      return genresCache
    }

    if (!force && genresPromise) {
      return genresPromise
    }

    genresPromise = requestJson('/genres')
      .then((payload) => {
        genresCache = normalizeGenres(payload)
        return genresCache
      })
      .finally(() => {
        genresPromise = null
      })

    return genresPromise
  },
  getCachedGenres() {
    return genresCache
  },
  async getCatalog() {
    const adapter = createFeedAdapter()

    if (typeof adapter.getCatalog !== 'function') {
      return []
    }

    return adapter.getCatalog()
  },
}
