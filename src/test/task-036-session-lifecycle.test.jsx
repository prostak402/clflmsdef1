import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import App from '../App'
import { AUTH_SESSION_STORAGE_KEY } from '../services/auth-service'
import { persistAuthenticatedState } from './test-session-helpers'

describe('TASK-036: session lifecycle in app routes', () => {
  beforeEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('drops malformed stored sessions as signed-out state without expiration banner', async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'broken-access',
        refreshToken: 'broken-refresh',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: 'usr_local_demo',
          email: 'user@local.dev',
        },
      })
    )

    window.history.replaceState({}, '', '/feed')
    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
    })

    expect(await screen.findByRole('heading', { name: /ClipFlow/i })).toBeInTheDocument()
    expect(screen.queryByText(/Session expired\. Please sign in again\./i)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('drops to auth page and shows expiration hint when refresh fails', async () => {
    persistAuthenticatedState({
      user: { id: 'usr_local_admin', name: 'Admin User', email: 'admin@local.dev', role: 'admin' },
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
        user: {
          id: 'usr_local_admin',
          email: 'admin@local.dev',
          displayName: 'Admin User',
          role: 'admin',
          hasCompletedOnboarding: true,
        },
      })
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'refresh denied' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    window.history.replaceState({}, '', '/admin')
    render(<App />)

    expect(await screen.findByText(/Session expired\. Please sign in again\./i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('supports explicit logout and clears session banner', async () => {
    persistAuthenticatedState({
      user: { id: 'usr_local_demo', name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })

    window.history.replaceState({}, '', '/profile')
    render(<App />)

    const logoutButton = await screen.findByRole('button', { name: /sign out/i })
    fireEvent.click(logoutButton)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
    })

    expect(await screen.findByRole('heading', { name: /ClipFlow/i })).toBeInTheDocument()
    expect(screen.queryByText(/Session expired\. Please sign in again\./i)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })
})
