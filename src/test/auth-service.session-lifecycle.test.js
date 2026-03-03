import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTH_SESSION_STORAGE_KEY, authService } from '../services/auth-service'

function buildSession(overrides = {}) {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    user: {
      id: 'usr_1',
      email: 'user@example.com',
      displayName: 'User',
      role: 'user',
      hasCompletedOnboarding: true,
    },
    ...overrides,
  }
}

describe('auth-service session lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('refreshes expired api session and keeps authenticated payload', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')

    const expired = buildSession({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(expired))

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            tokenType: 'Bearer',
            expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
            user: { ...expired.user, role: 'admin' },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...expired.user,
            role: 'admin',
          }),
          { status: 200 }
        )
      )

    const result = await authService.restoreSession()

    expect(result.expired).toBe(false)
    expect(result.session?.accessToken).toBe('new-access')
    expect(result.session?.user?.role).toBe('admin')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('drops api session when refresh fails', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')

    const expired = buildSession({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(expired))

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'INVALID_REFRESH_TOKEN' } }), { status: 401 })
    )

    const result = await authService.restoreSession()

    expect(result).toEqual({ session: null, expired: true })
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })
})
