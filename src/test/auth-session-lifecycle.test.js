import { beforeEach, describe, expect, it } from 'vitest'

import { AUTH_SESSION_STORAGE_KEY, authService } from '../services/auth-service'

function saveSession(session) {
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

describe('authService session lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns active session without refresh when token is not expired', async () => {
    saveSession({
      accessToken: 'active-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { id: 'u1', role: 'user' },
    })

    const result = await authService.restoreSession()

    expect(result.expired).toBe(false)
    expect(result.session?.accessToken).toBe('active-token')
  })

  it('renews expired local demo session via refresh token', async () => {
    saveSession({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: 'u1', role: 'user' },
    })

    const result = await authService.restoreSession()

    expect(result.expired).toBe(false)
    expect(result.session?.accessToken).not.toBe('expired-token')
    expect(Date.parse(result.session?.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('drops session when refresh token is missing', async () => {
    saveSession({
      accessToken: 'expired-token',
      refreshToken: '',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: 'u1', role: 'user' },
    })

    const result = await authService.restoreSession()

    expect(result).toEqual({ session: null, expired: true })
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('clears local session on logout', async () => {
    saveSession({
      accessToken: 'active-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { id: 'u1', role: 'admin' },
    })

    await authService.logout()

    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })
})
