import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import App from '../App'
import { AUTH_SESSION_STORAGE_KEY } from '../services/auth-service'

const APP_STORAGE_KEY = 'app_state_v1'

function setPersistedState(state) {
  window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ version: 1, state }))
}

describe('TASK-036: session lifecycle in app routes', () => {
  beforeEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('drops to auth page and shows expiration hint when refresh fails', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')

    setPersistedState({
      user: { name: 'Admin User', email: 'admin@clipflow.com', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })

    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'expired',
        refreshToken: 'broken-refresh',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() - 30_000).toISOString(),
        user: { id: 'admin-1', email: 'admin@clipflow.com', role: 'admin' },
      })
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'refresh denied' }), { status: 401 }))
    )

    window.history.replaceState({}, '', '/admin')
    render(<App />)

    expect(await screen.findByText(/Session expired\. Please sign in again\./i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('supports explicit logout and clears session banner', async () => {
    setPersistedState({
      user: { name: 'Demo User', email: 'demo@clipflow.com', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })

    window.history.replaceState({}, '', '/profile')
    render(<App />)

    const logoutButton = await screen.findByRole('button', { name: /sign out/i })
    fireEvent.click(logoutButton)

    expect(await screen.findByRole('heading', { name: /ClipFlow/i })).toBeInTheDocument()
    expect(screen.queryByText(/Session expired\. Please sign in again\./i)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })
})
