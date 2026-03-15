import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import App from '../App'
import { persistAuthenticatedState } from './test-session-helpers'

describe('TASK-021: admin comments navigation links', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('shows a quick access link from admin panel to comments moderation', async () => {
    persistAuthenticatedState({
      user: { name: 'Admin User', email: 'admin@local.dev', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin')

    render(<App />)

    const commentsLink = await screen.findByRole('link', { name: /go to comments moderation/i })
    expect(commentsLink).toHaveAttribute('href', '/admin/comments')
  })

  it('marks comments moderation item as active in side nav on /admin/comments', async () => {
    persistAuthenticatedState({
      user: { name: 'Admin User', email: 'admin@local.dev', role: 'admin' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
    })
    window.history.replaceState({}, '', '/admin/comments')

    render(<App />)

    const activeItem = await screen.findByRole('button', { name: /comments mod/i })
    expect(activeItem).toHaveAttribute('aria-current', 'page')
    expect(window.location.pathname).toBe('/admin/comments')
  })
})
