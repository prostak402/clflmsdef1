import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import App from '../App'

const STORAGE_KEY = 'app_state_v1'

function setPersistedState(state) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      state,
    })
  )
}

describe('TASK-035: route redirect matrix', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('enforces matrix for unauthenticated users', async () => {
    const protectedPaths = ['/genres', '/feed', '/bookmarks', '/catalog', '/profile', '/admin']

    for (const path of protectedPaths) {
      window.history.replaceState({}, '', path)
      render(<App />)
      expect(await screen.findByRole('heading', { name: /ClipFlow/i })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/')
      cleanup()
    }
  })

  it('enforces matrix for onboarded non-admin user', async () => {
    setPersistedState({
      user: { name: 'Demo User', email: 'demo@clipflow.com', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })

    window.history.replaceState({}, '', '/admin/comments')
    render(<App />)

    expect(await screen.findByText(/Loading clips/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/feed')
  })

  it('enforces matrix for onboarded admin user', async () => {
    setPersistedState({
      user: { name: 'Admin User', email: 'admin@clipflow.com', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })

    window.history.replaceState({}, '', '/admin/comments')
    render(<App />)

    expect(await screen.findByText(/Comment Moderation/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/comments')
  })
})
