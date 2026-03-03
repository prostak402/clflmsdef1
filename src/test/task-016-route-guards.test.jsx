import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import App from '../App'

const STORAGE_KEY = 'app_state_v1'
const AUTH_SESSION_STORAGE_KEY = 'auth_session_v1'

function setPersistedState(state) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      state,
    })
  )
  const now = Date.now()
  if (state?.user) {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        tokenType: 'Bearer',
        expiresAt: new Date(now + 60_000).toISOString(),
        user: { ...state.user, hasCompletedOnboarding: Boolean(state?.hasCompletedOnboarding) },
      })
    )
  }
}


describe('TASK-016: route guard behavior', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('redirects unauthenticated user from protected routes to auth page', async () => {
    window.history.replaceState({}, '', '/feed')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /ClipFlow/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('redirects authenticated user without completed onboarding to /genres', async () => {
    setPersistedState({
      user: { name: 'Demo User', email: 'demo@clipflow.com', isAdmin: false },
      hasCompletedOnboarding: false,
    })
    window.history.replaceState({}, '', '/catalog')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /What do you like\?/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/genres')
  })

  it('redirects onboarded users away from /genres to /feed', async () => {
    setPersistedState({
      user: { name: 'Demo User', email: 'demo@clipflow.com', isAdmin: false },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/genres')

    render(<App />)

    expect(await screen.findByText(/Loading clips/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/feed')
  })

  it('redirects admin user without onboarding from /admin to /genres', async () => {
    setPersistedState({
      user: { name: 'Admin User', email: 'admin@clipflow.com', isAdmin: true },
      hasCompletedOnboarding: false,
      selectedGenres: [],
    })
    window.history.replaceState({}, '', '/admin')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /What do you like\?/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/genres')
  })

  it('redirects non-admin users away from /admin to /feed', async () => {
    setPersistedState({
      user: { name: 'Demo User', email: 'demo@clipflow.com', isAdmin: false },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin')

    render(<App />)

    expect(await screen.findByText(/Loading clips/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/feed')
  })

  it('allows admin users with completed onboarding to access /admin', async () => {
    setPersistedState({
      user: { name: 'Admin User', email: 'admin@clipflow.com', isAdmin: true },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Admin Panel/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin')
  })

  it('redirects non-admin users away from /admin/comments to /feed', async () => {
    setPersistedState({
      user: { name: 'Demo User', email: 'demo@clipflow.com', isAdmin: false },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin/comments')

    render(<App />)

    expect(await screen.findByText(/Loading clips/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/feed')
  })

  it('allows admin users with completed onboarding to access /admin/comments', async () => {
    setPersistedState({
      user: { name: 'Admin User', email: 'admin@clipflow.com', isAdmin: true },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin/comments')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Comment Moderation/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/comments')
  })
})
