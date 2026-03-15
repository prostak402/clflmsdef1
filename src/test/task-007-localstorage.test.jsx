import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '../App'
import { AUTH_SESSION_STORAGE_KEY } from '../services/auth-service'
import {
  APP_STORAGE_KEY,
  persistAuthenticatedState,
  persistAuthSession,
} from './test-session-helpers'

async function waitForFeedReady() {
  await waitFor(() => {
    expect(window.location.pathname).toBe('/feed')
  })

  await waitFor(() => {
    expect(document.querySelectorAll('.clip-actions .clip-action-btn').length).toBeGreaterThan(0)
  })
}

async function completeAuthAndOnboarding(user) {
  await user.click(screen.getByRole('button', { name: /demo account/i }))
  await user.click(await screen.findByRole('button', { name: /Action/i }))
  await user.click(screen.getByRole('button', { name: /Drama/i }))
  await user.click(screen.getByRole('button', { name: /Comedy/i }))
  await user.click(screen.getByRole('button', { name: /Explore clips/i }))

  await waitForFeedReady()
}

describe('TASK-007: localStorage state persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('persists and restores session, genres, likes and bookmarks after reload', async () => {
    const user = userEvent.setup()
    const firstRender = render(<App />)

    await completeAuthAndOnboarding(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[0])
    await user.click(actionButtons[2])

    const persisted = JSON.parse(window.localStorage.getItem(APP_STORAGE_KEY))
    const session = JSON.parse(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY))

    expect(persisted.version).toBe(1)
    expect(persisted.state.user).toBeUndefined()
    expect(persisted.state.hasCompletedOnboarding).toBeUndefined()
    expect(persisted.state.selectedGenres).toBeUndefined()
    expect(persisted.state.likes['1']).toBe(true)
    expect(persisted.state.bookmarks).toContain('1')
    expect(persisted.state.blockedCommentUsers).toEqual({})
    expect(persisted.state.draftPreferences).toBeUndefined()
    expect(session.user.email).toBe('user@local.dev')
    expect(session.user.hasCompletedOnboarding).toBe(true)
    expect(session.user.selectedGenres.length).toBeGreaterThanOrEqual(3)
    expect(session.user.preferences).toEqual(expect.objectContaining({ preferredLanguage: 'en' }))

    firstRender.unmount()

    render(<App />)
    await waitForFeedReady()

    const reloadedActionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    expect(reloadedActionButtons[0].className).toContain('liked')
    expect(reloadedActionButtons[2].className).toContain('bookmarked')
  })

  it('drops auth-owned fields from app_state_v1 and keeps canonical auth_session_v1 state', async () => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          bookmarks: ['1'],
          likes: { 1: true },
          blockedCommentUsers: { usr_local_demo: true },
          selectedGenres: ['sci-fi', 'comedy'],
          draftPreferences: {
            notificationsEnabled: false,
            autoplayEnabled: false,
            preferredLanguage: 'ru',
          },
        },
      })
    )
    persistAuthSession({
      user: { id: 'usr_local_demo', name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
      draftPreferences: {
        notificationsEnabled: true,
        autoplayEnabled: false,
        preferredLanguage: 'de',
      },
    })
    window.history.replaceState({}, '', '/feed')

    render(<App />)
    await waitForFeedReady()

    const persisted = JSON.parse(window.localStorage.getItem(APP_STORAGE_KEY))
    const session = JSON.parse(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY))

    expect(persisted.version).toBe(1)
    expect(persisted.state.bookmarks).toEqual(['1'])
    expect(persisted.state.likes).toEqual({ 1: true })
    expect(persisted.state.blockedCommentUsers).toEqual({ usr_local_demo: true })
    expect(persisted.state.selectedGenres).toBeUndefined()
    expect(persisted.state.draftPreferences).toBeUndefined()
    expect(session.user.selectedGenres).toEqual(['action', 'drama', 'comedy'])
    expect(session.user.preferences).toEqual({
      notificationsEnabled: true,
      autoplayEnabled: false,
      preferredLanguage: 'de',
    })
  })

  it('hydrates draft preferences from localStorage payload', async () => {
    persistAuthenticatedState({
      user: { id: 'usr_local_demo', name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama', 'comedy'],
      bookmarks: [],
      likes: {},
      blockedCommentUsers: ['usr_local_demo', 'second@clipflow.com'],
      draftPreferences: {
        notificationsEnabled: false,
        autoplayEnabled: false,
        preferredLanguage: 'ru',
      },
    })
    window.history.replaceState({}, '', '/feed')

    render(<App />)
    await waitForFeedReady()

    const persisted = JSON.parse(window.localStorage.getItem(APP_STORAGE_KEY))
    const session = JSON.parse(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY))
    expect(persisted.state.blockedCommentUsers).toEqual({
      usr_local_demo: true,
      'second@clipflow.com': true,
    })
    expect(persisted.state.selectedGenres).toBeUndefined()
    expect(persisted.state.draftPreferences).toBeUndefined()
    expect(session.user.selectedGenres).toEqual(['action', 'drama', 'comedy'])
    expect(session.user.preferences).toEqual({
      notificationsEnabled: false,
      autoplayEnabled: false,
      preferredLanguage: 'ru',
    })
  })
})
