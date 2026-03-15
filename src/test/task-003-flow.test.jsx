import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '../App'
import { COMMENT_MAX_LENGTH } from '../services/comment-validation'
import { persistAuthenticatedState } from './test-session-helpers'

async function waitForFeedReady() {
  await waitFor(() => {
    expect(window.location.pathname).toBe('/feed')
  })

  await waitFor(() => {
    expect(document.querySelectorAll('.clip-actions .clip-action-btn').length).toBeGreaterThan(0)
  })
}

async function openFeed(user) {
  render(<App />)

  await user.click(screen.getByRole('button', { name: /demo account/i }))
  await user.click(await screen.findByRole('button', { name: /Action/i }))
  await user.click(screen.getByRole('button', { name: /Drama/i }))
  await user.click(screen.getByRole('button', { name: /Comedy/i }))
  await user.click(screen.getByRole('button', { name: /Explore clips/i }))

  await waitForFeedReady()
}

describe('TASK-003: feed, reactions, comments and navigation', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('opens feed after auth + onboarding flow', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    expect(screen.getAllByRole('button', { name: /Feed/i })[0]).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('toggles like and bookmark on active clip', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    const likeButton = actionButtons[0]
    const bookmarkButton = actionButtons[2]

    expect(likeButton.className).not.toContain('liked')
    await user.click(likeButton)
    expect(likeButton.className).toContain('liked')

    expect(bookmarkButton.className).not.toContain('bookmarked')
    await user.click(bookmarkButton)
    expect(bookmarkButton.className).toContain('bookmarked')
  })

  it('adds a comment and shows it in UI', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[1])

    await user.type(await screen.findByPlaceholderText(/add a comment/i), 'New comment from test')
    await user.click(document.querySelector('.comments-send'))

    expect(await screen.findByText('New comment from test')).toBeInTheDocument()
  })

  it('blocks empty comment and shows validation message', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[1])

    await user.type(await screen.findByPlaceholderText(/add a comment/i), '     ')
    await user.click(document.querySelector('.comments-send'))

    expect(await screen.findByText(/comment cannot be empty/i)).toBeInTheDocument()
  })

  it('blocks too long comment and shows validation message', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[1])

    const tooLongComment = 'a'.repeat(COMMENT_MAX_LENGTH + 1)
    const commentInput = await screen.findByPlaceholderText(/add a comment/i)

    fireEvent.change(commentInput, { target: { value: tooLongComment } })
    await user.click(document.querySelector('.comments-send'))

    expect(
      await screen.findByText(new RegExp(`maximum length is ${COMMENT_MAX_LENGTH}`, 'i'))
    ).toBeInTheDocument()
  }, 10000)

  it('disables comment input for blocked user and shows explicit blocked message', async () => {
    persistAuthenticatedState({
      user: { id: 'usr_local_demo', name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
      blockedCommentUsers: { usr_local_demo: true },
    })
    window.history.replaceState({}, '', '/feed')

    render(<App />)
    await waitForFeedReady()

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await userEvent.setup().click(actionButtons[1])

    const commentInput = await screen.findByPlaceholderText(/add a comment/i)
    expect(commentInput).toBeDisabled()
    expect(document.querySelector('.comments-send')).toBeDisabled()

    await waitFor(() => {
      expect(document.querySelector('.comments-input-error')?.textContent?.trim()).toBeTruthy()
    })
  })

  it('navigates to Bookmarks and Profile via bottom nav', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[2])

    await user.click(screen.getAllByRole('button', { name: /Saved/i })[0])
    expect(await screen.findByRole('heading', { name: /^Saved Movies$/i })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Profile/i })[0])
    expect(await screen.findByRole('heading', { name: /^Demo User$/i })).toBeInTheDocument()
  }, 30000)

  it('saves backend-backed profile preferences and restores them after re-login', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    await user.click(screen.getAllByRole('button', { name: /Profile/i })[0])
    expect(await screen.findByRole('heading', { name: /^Demo User$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Clear all/i }))
    await user.click(screen.getByRole('button', { name: /^Sci-Fi$/i }))
    await user.click(screen.getByRole('checkbox', { name: /Notifications/i }))
    await user.click(screen.getByRole('checkbox', { name: /Autoplay/i }))
    await user.clear(screen.getByRole('textbox', { name: /Preferred language/i }))
    await user.type(screen.getByRole('textbox', { name: /Preferred language/i }), 'ru')
    await user.click(screen.getByRole('button', { name: /Save preferences/i }))

    await waitFor(() => {
      expect(screen.getByText(/Preferences saved./i)).toBeInTheDocument()
    })

    let session = JSON.parse(window.localStorage.getItem('auth_session_v1'))
    expect(session.user.selectedGenres).toEqual(['scifi'])
    expect(session.user.preferences).toEqual({
      notificationsEnabled: false,
      autoplayEnabled: false,
      preferredLanguage: 'ru',
    })

    await user.click(await screen.findByRole('button', { name: /Sign Out/i }))
    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
    })

    await user.click(screen.getByRole('button', { name: /Demo Account/i }))
    await waitForFeedReady()
    await user.click(screen.getAllByRole('button', { name: /Profile/i })[0])
    expect(await screen.findByRole('heading', { name: /^Demo User$/i })).toBeInTheDocument()

    expect(await screen.findByRole('checkbox', { name: /Notifications/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Autoplay/i })).not.toBeChecked()
    expect(screen.getByRole('textbox', { name: /Preferred language/i })).toHaveValue('ru')
    expect(screen.getByRole('button', { name: /^Sci-Fi$/i }).className).toContain('active')
  }, 30000)
})
