import { GENRES } from '../data/mock'
import { createFeedAdapter } from './create-feed-adapter'

export const contentService = {
  getGenres() {
    return GENRES
  },
  async getCatalog() {
    const adapter = createFeedAdapter()

    if (typeof adapter.getCatalog !== 'function') {
      return []
    }

    return adapter.getCatalog()
  },
}
