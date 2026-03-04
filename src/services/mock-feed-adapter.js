import { apiFeedAdapter } from './api-feed-adapter'

// Legacy module kept for compatibility with stale imports in external tooling/tests.
// Runtime baseline is API-only; mock dataset and mock-only behavior were removed.
export const mockFeedAdapter = apiFeedAdapter

export const initialComments = {}
