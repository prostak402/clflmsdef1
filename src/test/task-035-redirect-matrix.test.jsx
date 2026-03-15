import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

import App from '../App'
import { persistAuthenticatedState } from './test-session-helpers'

async function expectFeedRoute() {
  await waitFor(() => {
    expect(window.location.pathname).toBe('/feed')
  })

  const feedButtons = await screen.findAllByRole('button', { name: /Feed/i })
  expect(feedButtons[0]).toHaveAttribute('aria-current', 'page')
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
    persistAuthenticatedState({
      user: { name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })

    window.history.replaceState({}, '', '/admin/comments')
    render(<App />)

    await expectFeedRoute()
  })

  it('enforces matrix for onboarded admin user', async () => {
    persistAuthenticatedState({
      user: { name: 'Admin User', email: 'admin@local.dev', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })

    window.history.replaceState({}, '', '/admin/comments')
    render(<App />)

    expect(await screen.findByText(/Comment Moderation/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/comments')
  })
})
