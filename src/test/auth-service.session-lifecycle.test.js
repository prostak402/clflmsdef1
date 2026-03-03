import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authService, AUTH_SESSION_STORAGE_KEY } from '../services/auth-service'

function setStoredSession(session) {
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

describe('authService session lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('refreshes expired API session and stores updated user/token pair', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')

    setStoredSession({
      accessToken: 'expired-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: 'u-1', email: 'user@example.com', role: 'user' },
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
          }),
          { status: 200 }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await authService.restoreSession()

    expect(result.expired).toBe(false)
    expect(result.session?.accessToken).toBe('new-token')
    expect(result.session?.user?.hasCompletedOnboarding).toBe(true)

    const persisted = authService.readStoredSession()
    expect(persisted?.refreshToken).toBe('refresh-2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('notifies subscribers and clears session when refresh fails', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')

    setStoredSession({
      accessToken: 'expired-token',
      refreshToken: 'refresh-fail',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: 'u-2', email: 'user2@example.com', role: 'user' },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'invalid token' }), { status: 401 }))
    )

    const listener = vi.fn()
    const unsubscribe = authService.subscribeToSessionEnded(listener)

    const result = await authService.restoreSession()

    unsubscribe()

    expect(result).toEqual({ session: null, expired: true })
    expect(authService.readStoredSession()).toBeNull()
    expect(listener).toHaveBeenCalledWith('expired')
  })
})
