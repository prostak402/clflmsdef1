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
    persistAuthenticatedState({
      user: { name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: false,
    })
    window.history.replaceState({}, '', '/catalog')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /What do you like\?/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/genres')
  })

  it('redirects onboarded users away from /genres to /feed', async () => {
    persistAuthenticatedState({
      user: { name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/genres')

    render(<App />)

    await expectFeedRoute()
  })

  it('redirects admin user without onboarding from /admin to /genres', async () => {
    persistAuthenticatedState({
      user: { name: 'Admin User', email: 'admin@local.dev', role: 'admin' },
      hasCompletedOnboarding: false,
    })
    window.history.replaceState({}, '', '/admin')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /What do you like\?/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/genres')
  })

  it('redirects non-admin users away from /admin to /feed', async () => {
    persistAuthenticatedState({
      user: { name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin')

    render(<App />)

    await expectFeedRoute()
  })

  it('allows admin users with completed onboarding to access /admin', async () => {
    persistAuthenticatedState({
      user: { name: 'Admin User', email: 'admin@local.dev', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Admin Panel/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin')
  })

  it('redirects non-admin users away from /admin/comments to /feed', async () => {
    persistAuthenticatedState({
      user: { name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin/comments')

    render(<App />)

    await expectFeedRoute()
  })

  it('allows admin users with completed onboarding to access /admin/comments', async () => {
    persistAuthenticatedState({
      user: { name: 'Admin User', email: 'admin@local.dev', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin/comments')

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Comment Moderation/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/comments')
  })
})
