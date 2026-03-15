import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTH_SESSION_STORAGE_KEY, authService } from '../services/auth-service'

function setStoredSession(session) {
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

function getPathname(mockCall) {
  return new URL(mockCall[0]).pathname
}

describe('authService session lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('drops malformed stored sessions without attempting refresh', async () => {
    setStoredSession({
      accessToken: 'broken-access',
      refreshToken: 'broken-refresh',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: 'u-1',
        email: 'user@example.com',
      },
    })

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await authService.restoreSession()

    expect(result).toEqual({ session: null, expired: false })
    expect(authService.readStoredSession()).toBeNull()
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes expired session and stores updated user/token pair', async () => {
    setStoredSession({
      accessToken: 'expired-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: {
        id: 'u-1',
        email: 'user@example.com',
        role: 'user',
        selectedGenres: ['action'],
        preferences: { preferredLanguage: 'en' },
      },
    })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'new-token',
            refreshToken: 'refresh-2',
            tokenType: 'Bearer',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            user: {
              id: 'u-1',
              email: 'user@example.com',
              displayName: 'User',
              role: 'user',
              hasCompletedOnboarding: true,
              selectedGenres: ['action', 'drama'],
              preferences: {
                notificationsEnabled: false,
                autoplayEnabled: true,
                preferredLanguage: 'ru',
              },
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'u-1',
            email: 'user@example.com',
            displayName: 'User',
            role: 'user',
            hasCompletedOnboarding: true,
            selectedGenres: ['action', 'drama'],
            preferences: {
              notificationsEnabled: false,
              autoplayEnabled: true,
              preferredLanguage: 'ru',
            },
          }),
          { status: 200 }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await authService.restoreSession()

    expect(result.expired).toBe(false)
    expect(result.session?.accessToken).toBe('new-token')
    expect(result.session?.user?.hasCompletedOnboarding).toBe(true)
    expect(result.session?.user?.selectedGenres).toEqual(['action', 'drama'])
    expect(result.session?.user?.preferences).toEqual({
      notificationsEnabled: false,
      autoplayEnabled: true,
      preferredLanguage: 'ru',
    })
    expect(getPathname(fetchMock.mock.calls[0])).toBe('/api/v1/auth/refresh')
    expect(getPathname(fetchMock.mock.calls[1])).toBe('/api/v1/me')

    const persisted = authService.readStoredSession()
    expect(persisted?.refreshToken).toBe('refresh-2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('clears session and emits expired when refresh payload is invalid', async () => {
    setStoredSession({
      accessToken: 'expired-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: {
        id: 'u-1',
        email: 'user@example.com',
        role: 'user',
      },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          refreshToken: 'refresh-2',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          user: {
            id: 'u-1',
            email: 'user@example.com',
            role: 'user',
          },
        }),
        { status: 200 }
      )
    )

    vi.stubGlobal('fetch', fetchMock)

    const listener = vi.fn()
    const unsubscribe = authService.subscribeToSessionEnded(listener)

    const result = await authService.restoreSession()

    unsubscribe()

    expect(result).toEqual({ session: null, expired: true })
    expect(authService.readStoredSession()).toBeNull()
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
    expect(getPathname(fetchMock.mock.calls[0])).toBe('/api/v1/auth/refresh')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('expired')
  })

  it('patches onboarding status through /me and persists the updated session user', async () => {
    setStoredSession({
      accessToken: 'valid-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: 'u-1',
        email: 'user@example.com',
        displayName: 'User',
        role: 'user',
        hasCompletedOnboarding: false,
        selectedGenres: [],
        preferences: {
          notificationsEnabled: true,
          autoplayEnabled: true,
          preferredLanguage: 'en',
        },
      },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'u-1',
          email: 'user@example.com',
          displayName: 'User',
          role: 'user',
          hasCompletedOnboarding: true,
          selectedGenres: ['action', 'drama'],
          preferences: {
            notificationsEnabled: true,
            autoplayEnabled: false,
            preferredLanguage: 'ru',
          },
        }),
        { status: 200 }
      )
    )

    vi.stubGlobal('fetch', fetchMock)

    const nextSession = await authService.patchCurrentUser({
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama'],
      preferences: { autoplayEnabled: false, preferredLanguage: 'ru' },
    })

    expect(getPathname(fetchMock.mock.calls[0])).toBe('/api/v1/me')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama'],
      preferences: { autoplayEnabled: false, preferredLanguage: 'ru' },
    })
    expect(nextSession.user.hasCompletedOnboarding).toBe(true)
    expect(nextSession.user.selectedGenres).toEqual(['action', 'drama'])
    expect(nextSession.user.preferences).toEqual({
      notificationsEnabled: true,
      autoplayEnabled: false,
      preferredLanguage: 'ru',
    })
    expect(authService.readStoredSession()?.user?.hasCompletedOnboarding).toBe(true)
  })

  it('notifies subscribers and clears session when refresh fails', async () => {
    setStoredSession({
      accessToken: 'expired-token',
      refreshToken: 'refresh-fail',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: 'u-2', email: 'user2@example.com', role: 'user' },
    })

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'invalid token' }), { status: 401 })
        )
    )

    const listener = vi.fn()
    const unsubscribe = authService.subscribeToSessionEnded(listener)

    const result = await authService.restoreSession()

    unsubscribe()

    expect(result).toEqual({ session: null, expired: true })
    expect(authService.readStoredSession()).toBeNull()
    expect(listener).toHaveBeenCalledWith('expired')
  })

  it('clears storage and emits logged_out even when logout request fails', async () => {
    setStoredSession({
      accessToken: 'valid-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { id: 'u-1', email: 'user@example.com', role: 'user' },
    })

    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    const listener = vi.fn()
    const unsubscribe = authService.subscribeToSessionEnded(listener)

    await authService.logout()

    unsubscribe()

    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('logged_out')
  })
})
