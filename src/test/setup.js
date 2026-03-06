import { beforeEach, afterEach } from 'vitest'
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
const realFetch = globalThis.fetch.bind(globalThis)

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS })
}

function parseBody(body) {
  if (!body) {
    return {}
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }

  return body
}

function createApiTestFetch() {
  const state = {
    sessionUser: {
      id: 'usr_local_demo',
      email: 'demo@example.com',
      displayName: 'Demo User',
      role: 'user',
      hasCompletedOnboarding: false,
    },
    likes: {},
    bookmarks: [],
    blockedUsers: {},
    comments: [
      {
        id: 'cm_seed_1',
        clipId: '1',
        authorId: 'usr_local_demo',
        authorName: 'Movie Explorer',
        text: 'Great clip!',
        likes: 2,
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
      },
    ],
  }

  state.feedItems = [
    {
      id: '1',
      title: 'Interstellar',
      description: 'Space mission',
      thumbnailUrl: 'https://example.com/t.jpg',
      videoUrl: 'https://example.com/v.mp4',
      externalUrl: 'https://example.com/watch/interstellar',
      durationSec: 300,
      genreId: 'action',
      likesCount: 0,
      commentsCount: 1,
      sharesCount: 0,
      bookmarksCount: 0,
      status: 'published',
    },
  ]

  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    const method = (init.method || 'GET').toUpperCase()

    if (/^https?:\/\//.test(url)) {
      return realFetch(input, init)
    }

    if (url === '/api/v1/auth/login' && method === 'POST') {
      const body = parseBody(init.body)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      state.sessionUser = {
        id: email ? `usr_${email}` : 'usr_local_demo',
        email: email || 'demo@clipflow.com',
        displayName: body.displayName || body.name || 'Movie Explorer',
        role: email === 'admin@clipflow.com' ? 'admin' : 'user',
        hasCompletedOnboarding: false,
      }

      return jsonResponse({
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user: state.sessionUser,
      })
    }

    if (url === '/api/v1/auth/signup' && method === 'POST') {
      const body = parseBody(init.body)
      return jsonResponse({
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user: {
          id: `usr_${(body.email || 'new').toLowerCase()}`,
          email: body.email,
          displayName: body.displayName || 'Movie Explorer',
          role: 'user',
          hasCompletedOnboarding: false,
        },
      })
    }

    if (url === '/api/v1/auth/refresh' && method === 'POST') {
      return jsonResponse({
        accessToken: 'test_access_token_refreshed',
        refreshToken: 'test_refresh_token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user: state.sessionUser,
      })
    }

    if (url.startsWith('/api/v1/feed/clips') && method === 'GET') {
      return jsonResponse({ items: state.feedItems })
    }

    if (url === '/api/v1/comments' && method === 'GET') {
      return jsonResponse({ items: state.comments })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/comments$/.test(url) && method === 'POST') {
      const clipId = url.split('/')[4]
      const body = parseBody(init.body)
      const created = {
        id: `cm_${Date.now()}`,
        clipId,
        authorId: state.sessionUser.email || state.sessionUser.id,
        authorName: state.sessionUser.displayName || 'Movie Explorer',
        text: body.body || '',
        likes: 0,
        createdAt: new Date().toISOString(),
      }
      state.comments.unshift(created)
      return jsonResponse({ comment: created }, 201)
    }

    if (/^\/api\/v1\/clips\/[^/]+\/like$/.test(url)) {
      const clipId = url.split('/')[4]
      if (method === 'POST') {
        state.likes[clipId] = true
      }
      if (method === 'DELETE') {
        state.likes[clipId] = false
      }
      return jsonResponse({ likes: { ...state.likes } })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/bookmark$/.test(url)) {
      const clipId = url.split('/')[4]
      if (method === 'POST' && !state.bookmarks.includes(clipId)) {
        state.bookmarks.push(clipId)
      }
      if (method === 'DELETE') {
        state.bookmarks = state.bookmarks.filter((id) => id !== clipId)
      }
      return jsonResponse({ bookmarks: [...state.bookmarks] })
    }

    if (url === '/api/v1/moderation/comments' && method === 'GET') {
      return jsonResponse({ items: state.comments })
    }

    if (url === '/api/v1/moderation/comments/block-user' && method === 'POST') {
      const body = parseBody(init.body)
      if (body?.authorId) {
        state.blockedUsers[body.authorId] = body.isBlocked !== false
      }

      return jsonResponse({ blockedUsers: { ...state.blockedUsers } })
    }

    if (/^\/api\/v1\/moderation\/comments\//.test(url) && method === 'DELETE') {
      const parts = url.split('/')
      if (url.includes('/by-user/')) {
        const authorId = parts[parts.length - 1]
        state.comments = state.comments.filter((comment) => comment.authorId !== authorId)
      } else {
        const commentId = parts[parts.length - 1]
        state.comments = state.comments.filter((comment) => comment.id !== commentId)
      }

      return jsonResponse({ ok: true })
    }



    if (url === '/api/v1/admin/clips' && method === 'GET') {
      return jsonResponse({ items: state.feedItems })
    }

    if (url === '/api/v1/admin/clips' && method === 'POST') {
      const body = parseBody(init.body)
      const created = {
        id: `clip_${Date.now()}`,
        title: body.title || 'Untitled',
        description: body.description || '',
        clipDescription: body.clipDescription || body.description || '',
        thumbnailUrl: body.thumbnailUrl || '',
        videoUrl: body.videoUrl || '',
        watchUrl: body.watchUrl || body.externalUrl || '#',
        durationSec: Number(body.durationSec) || 0,
        genreId: body.genreId || 'unknown',
        genres: Array.isArray(body.genreIds) ? body.genreIds : [body.genreId || 'unknown'],
        status: body.status || 'draft',
        createdAt: new Date().toISOString(),
      }
      state.feedItems.unshift(created)
      return jsonResponse({ clip: created }, 201)
    }

    if (/^\/api\/v1\/admin\/clips\/[^/]+$/.test(url) && method === 'PATCH') {
      const clipId = url.split('/')[5]
      const body = parseBody(init.body)
      const index = state.feedItems.findIndex((item) => item.id === clipId)
      if (index < 0) {
        return jsonResponse({ error: { message: 'Clip not found' } }, 404)
      }

      state.feedItems[index] = { ...state.feedItems[index], ...body }
      return jsonResponse({ clip: state.feedItems[index] })
    }

    if (/^\/api\/v1\/admin\/clips\/[^/]+$/.test(url) && method === 'DELETE') {
      const clipId = url.split('/')[5]
      state.feedItems = state.feedItems.filter((item) => item.id !== clipId)
      return jsonResponse({ ok: true })
    }

    if (url === '/api/v1/clips' && method === 'GET') {
      return jsonResponse({ items: state.feedItems })
    }

    if (url === '/api/v1/me/bookmarks' && method === 'GET') {
      return jsonResponse({ items: state.feedItems.filter((item) => state.bookmarks.includes(item.id)) })
    }

    if (url === '/api/v1/me' && method === 'GET') {
      return jsonResponse({
        id: state.sessionUser.id,
        role: state.sessionUser.role,
        displayName: state.sessionUser.displayName,
        email: state.sessionUser.email,
        counts: {
          bookmarks: state.bookmarks.length,
          likes: Object.values(state.likes).filter(Boolean).length,
        },
      })
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
})
