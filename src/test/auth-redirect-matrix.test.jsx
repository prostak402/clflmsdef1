import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

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

  if (state?.user) {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: { ...state.user, hasCompletedOnboarding: Boolean(state?.hasCompletedOnboarding) },
      })
    )
  }
}

describe('auth redirect matrix', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('redirects to auth with session-expired reason when protected route opens with expired auth session', async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'expired',
        refreshToken: '',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        user: { id: 'u1', role: 'user' },
      })
    )

    window.history.replaceState({}, '', '/catalog')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /ClipFlow/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('?reason=session-expired')
  })

  it('keeps admin on /admin and redirects non-admin to /feed', async () => {
    setPersistedState({
      user: { name: 'Admin User', email: 'admin@clipflow.com', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin')
    render(<App />)
    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin')
    })

    cleanup()
    window.localStorage.clear()

    setPersistedState({
      user: { name: 'User', email: 'user@clipflow.com', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin')
    render(<App />)

    expect(await screen.findByText(/Loading clips/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/feed')
  })
})
