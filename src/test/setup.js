import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
})

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: () => {},
})

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: () => {},
})

if (!window.HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(payload, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS }))
}

function createApiTestFetch() {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    const method = (init.method || 'GET').toUpperCase()

    if (url.startsWith('/api/v1/feed/clips')) {
      return jsonResponse({
        items: [
          {
            id: '1',
            title: 'Interstellar',
            description: 'Space mission',
            thumbnailUrl: 'https://example.com/t.jpg',
            videoUrl: 'https://example.com/v.mp4',
            durationSec: 300,
            genreId: 'action',
            likesCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            bookmarksCount: 0,
            externalUrl: 'https://example.com/watch/interstellar',
            status: 'published',
          },
        ],
      })
    }

    if (url === '/api/v1/comments' && method === 'GET') {
      return jsonResponse({ '1': [{ id: 'cm-1', clipId: '1', authorId: 'u-1', authorName: 'Alex', text: 'Great clip!', likes: 2, createdAt: new Date(Date.now()-3600_000).toISOString() }] })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/comments$/.test(url) && method === 'POST') {
      const body = init.body ? JSON.parse(init.body) : {}
      return jsonResponse({
        comment: {
          id: 'cm_test',
          clipId: url.split('/')[4],
          authorId: 'u_test',
          authorName: 'Movie Explorer',
          text: body.body || '',
          likes: 0,
          createdAt: new Date().toISOString(),
        },
      })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/(like|bookmark)$/.test(url)) {
      return jsonResponse({ ok: true })
    }

    if (url === '/api/v1/moderation/comments' && method === 'GET') {
      return jsonResponse({ items: [] })
    }

    if (url === '/api/v1/clips' && method === 'GET') {
      return jsonResponse({ items: [] })
    }

    if (url === '/api/v1/me/bookmarks' && method === 'GET') {
      return jsonResponse({ items: [] })
    }

    if (url === '/api/v1/me' && method === 'GET') {
      return jsonResponse({ name: 'Movie Explorer', email: 'hello@movieexplorer.app', counts: {} })
    }

    return jsonResponse({})
  }
}

beforeEach(() => {
  window.localStorage.clear()
globalThis.fetch = createApiTestFetch()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
