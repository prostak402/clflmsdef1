import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import process from 'node:process'

const PORT = 18787
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`

let serverProcess

async function waitForServer() {
  const timeoutMs = 10_000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/genres`)
      if (response.ok) {
        return
      }
    } catch {
      // ignore until server is up
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw new Error('backend-server.mjs did not start in time')
}

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

describe('backend API smoke', () => {
  beforeAll(async () => {
    globalThis.fetch = globalThis.__REAL_FETCH__ || globalThis.fetch

    serverProcess = spawn('node', ['backend-server.mjs'], {
      env: {
        ...process.env,
        PORT: String(PORT),
        STORAGE_PROVIDER: 'local',
        LOCAL_STORAGE_ROOT: process.env.LOCAL_STORAGE_ROOT || '.clipflow-storage',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    await waitForServer()
  })

  beforeEach(() => {
    globalThis.fetch = globalThis.__REAL_FETCH__ || globalThis.fetch
  })

  afterAll(() => {
    globalThis.fetch = globalThis.__REAL_FETCH__ || globalThis.fetch
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM')
    }
  })

  it('covers auth lifecycle, content reads, comments, bookmarks, moderation and admin upload/create', async () => {
    const patchMeUnauthorizedResponse = await fetch(`${BASE_URL}/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hasCompletedOnboarding: true,
        selectedGenres: ['action', 'drama'],
        preferences: {
          notificationsEnabled: false,
          autoplayEnabled: false,
          preferredLanguage: 'ru',
        },
      }),
    })
    expect(patchMeUnauthorizedResponse.status).toBe(401)

    const loginUserResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@local.dev', password: 'demo-password' }),
    })
    const loginUserPayload = await readJson(loginUserResponse)
    expect(loginUserResponse.status).toBe(200)
    expect(loginUserPayload.user).toMatchObject({
      id: 'usr_local_demo',
      role: 'user',
      selectedGenres: [],
      preferences: {
        notificationsEnabled: true,
        autoplayEnabled: true,
        preferredLanguage: 'en',
      },
    })

    const loginAdminResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@local.dev', password: 'demo-password' }),
    })
    const loginAdminPayload = await readJson(loginAdminResponse)
    expect(loginAdminResponse.status).toBe(200)
    expect(loginAdminPayload.user).toMatchObject({ id: 'usr_local_admin', role: 'admin' })

    const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginUserPayload.refreshToken }),
    })
    const refreshPayload = await readJson(refreshResponse)
    expect(refreshResponse.status).toBe(200)
    expect(refreshPayload.accessToken).toBeTruthy()

    const meResponse = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${refreshPayload.accessToken}` },
    })
    const mePayload = await readJson(meResponse)
    expect(meResponse.status).toBe(200)
    expect(mePayload).toMatchObject({
      id: 'usr_local_demo',
      role: 'user',
      selectedGenres: [],
      preferences: {
        notificationsEnabled: true,
        autoplayEnabled: true,
        preferredLanguage: 'en',
      },
    })

    const invalidPatchMeResponse = await fetch(`${BASE_URL}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshPayload.accessToken}`,
      },
      body: JSON.stringify({ hasCompletedOnboarding: 'yes' }),
    })
    expect(invalidPatchMeResponse.status).toBe(422)

    const invalidGenresPatchResponse = await fetch(`${BASE_URL}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshPayload.accessToken}`,
      },
      body: JSON.stringify({ selectedGenres: ['unknown-genre'] }),
    })
    expect(invalidGenresPatchResponse.status).toBe(422)

    const invalidPreferencesPatchResponse = await fetch(`${BASE_URL}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshPayload.accessToken}`,
      },
      body: JSON.stringify({ preferences: { autoplayEnabled: 'sometimes' } }),
    })
    expect(invalidPreferencesPatchResponse.status).toBe(422)

    const patchMeResponse = await fetch(`${BASE_URL}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshPayload.accessToken}`,
      },
      body: JSON.stringify({
        hasCompletedOnboarding: true,
        selectedGenres: ['action', 'drama'],
        preferences: {
          notificationsEnabled: false,
          autoplayEnabled: false,
          preferredLanguage: 'ru',
        },
      }),
    })
    const patchMePayload = await readJson(patchMeResponse)
    expect(patchMeResponse.status).toBe(200)
    expect(patchMePayload).toMatchObject({
      id: 'usr_local_demo',
      role: 'user',
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama'],
      preferences: {
        notificationsEnabled: false,
        autoplayEnabled: false,
        preferredLanguage: 'ru',
      },
    })

    const refreshedAfterPatchResponse = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshPayload.refreshToken }),
    })
    const refreshedAfterPatchPayload = await readJson(refreshedAfterPatchResponse)
    expect(refreshedAfterPatchResponse.status).toBe(200)
    expect(refreshedAfterPatchPayload.user).toMatchObject({
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama'],
      preferences: {
        notificationsEnabled: false,
        autoplayEnabled: false,
        preferredLanguage: 'ru',
      },
    })

    const genresResponse = await fetch(`${BASE_URL}/genres`)
    const genresPayload = await readJson(genresResponse)
    expect(genresResponse.status).toBe(200)
    expect(genresPayload.items.some((genre) => genre.id === 'scifi')).toBe(true)

    const feedResponse = await fetch(`${BASE_URL}/feed/clips?genreId=scifi`)
    const feedPayload = await readJson(feedResponse)
    expect(feedResponse.status).toBe(200)
    expect(feedPayload.items.length).toBeGreaterThan(0)
    expect(feedPayload.items[0].rating).not.toBeNull()
    expect(Array.isArray(feedPayload.items[0].genreIds)).toBe(true)

    const commentCreateResponse = await fetch(`${BASE_URL}/clips/clip_1/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshPayload.accessToken}`,
      },
      body: JSON.stringify({ body: 'Smoke comment' }),
    })
    const commentCreatePayload = await readJson(commentCreateResponse)
    expect(commentCreateResponse.status).toBe(201)
    expect(commentCreatePayload.comment).toMatchObject({
      clipId: 'clip_1',
      text: 'Smoke comment',
      likedByViewer: false,
    })

    const likeCommentResponse = await fetch(
      `${BASE_URL}/comments/${commentCreatePayload.comment.id}/like`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshPayload.accessToken}` },
      }
    )
    const likeCommentPayload = await readJson(likeCommentResponse)
    expect(likeCommentResponse.status).toBe(200)
    expect(likeCommentPayload.comment).toMatchObject({
      id: commentCreatePayload.comment.id,
      likedByViewer: true,
      likes: 1,
    })

    const bookmarkWriteResponse = await fetch(`${BASE_URL}/clips/clip_1/bookmark`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshPayload.accessToken}` },
    })
    const bookmarkWritePayload = await readJson(bookmarkWriteResponse)
    expect(bookmarkWriteResponse.status).toBe(200)
    expect(bookmarkWritePayload.bookmarks).toContain('clip_1')

    const bookmarksReadResponse = await fetch(`${BASE_URL}/me/bookmarks`, {
      headers: { Authorization: `Bearer ${refreshPayload.accessToken}` },
    })
    const bookmarksReadPayload = await readJson(bookmarksReadResponse)
    expect(bookmarksReadResponse.status).toBe(200)
    expect(bookmarksReadPayload.items.map((item) => item.id)).toContain('clip_1')

    const uploadUrlResponse = await fetch(`${BASE_URL}/admin/clips/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdminPayload.accessToken}`,
      },
      body: JSON.stringify({
        fileName: 'smoke.mp4',
        contentType: 'video/mp4',
        size: 16,
      }),
    })
    const uploadUrlPayload = await readJson(uploadUrlResponse)
    expect(uploadUrlResponse.status).toBe(200)
    expect(uploadUrlPayload).toMatchObject({
      uploadId: expect.any(String),
      objectKey: expect.any(String),
    })

    const uploadPutResponse = await fetch(uploadUrlPayload.uploadUrl, {
      method: 'PUT',
      headers: uploadUrlPayload.requiredHeaders,
      body: new TextEncoder().encode('smoke-video-bytes'),
    })
    expect(uploadPutResponse.status).toBe(204)

    const legacyAdminCreateResponse = await fetch(`${BASE_URL}/admin/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdminPayload.accessToken}`,
      },
      body: JSON.stringify({
        uploadId: uploadUrlPayload.uploadId,
        objectKey: uploadUrlPayload.objectKey,
        title: 'Legacy genre alias create test',
        description: 'Created through admin endpoint',
        clipDescription: 'Genre feed visibility',
        watchUrl: 'https://cinema.example.com/watch/admin-upload',
        genreId: 'comedy',
        rating: 7.8,
      }),
    })
    expect(legacyAdminCreateResponse.status).toBe(422)
    const adminCreateResponse = await fetch(`${BASE_URL}/admin/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdminPayload.accessToken}`,
      },
      body: JSON.stringify({
        uploadId: uploadUrlPayload.uploadId,
        objectKey: uploadUrlPayload.objectKey,
        title: 'Admin upload genre filter test',
        description: 'Created through admin endpoint',
        clipDescription: 'Genre feed visibility',
        watchUrl: 'https://cinema.example.com/watch/admin-upload',
        genreIds: ['comedy', 'thriller'],
        rating: 7.8,
      }),
    })

    const adminCreatePayload = await readJson(adminCreateResponse)
    expect(adminCreateResponse.status).toBe(201)
    expect(adminCreatePayload.clip).toMatchObject({
      genreIds: ['comedy', 'thriller'],
      genreId: 'comedy',
      title: 'Admin upload genre filter test',
      watchUrl: 'https://cinema.example.com/watch/admin-upload',
      rating: 7.8,
    })

    const assetResponse = await fetch(adminCreatePayload.clip.videoUrl)
    expect(assetResponse.status).toBe(200)

    const adminPatchResponse = await fetch(
      `${BASE_URL}/admin/clips/${adminCreatePayload.clip.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginAdminPayload.accessToken}`,
        },
        body: JSON.stringify({
          title: 'Admin upload genre filter test updated',
          watchUrl: 'https://cinema.example.com/watch/admin-upload-updated',
          genreIds: ['thriller', 'fantasy'],
          rating: 8.4,
        }),
      }
    )
    const adminPatchPayload = await readJson(adminPatchResponse)
    expect(adminPatchResponse.status).toBe(200)
    expect(adminPatchPayload.clip).toMatchObject({
      id: adminCreatePayload.clip.id,
      genreIds: ['thriller', 'fantasy'],
      genreId: 'thriller',
      title: 'Admin upload genre filter test updated',
      watchUrl: 'https://cinema.example.com/watch/admin-upload-updated',
      rating: 8.4,
    })

    const legacyAdminPatchResponse = await fetch(
      `${BASE_URL}/admin/clips/${adminCreatePayload.clip.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginAdminPayload.accessToken}`,
        },
        body: JSON.stringify({
          genres: ['action'],
        }),
      }
    )
    expect(legacyAdminPatchResponse.status).toBe(422)
    const feedBySecondaryGenreResponse = await fetch(`${BASE_URL}/feed/clips?genreId=fantasy`)
    const feedBySecondaryGenrePayload = await readJson(feedBySecondaryGenreResponse)
    expect(feedBySecondaryGenreResponse.status).toBe(200)
    expect(
      feedBySecondaryGenrePayload.items.some(
        (clip) =>
          clip.id === adminCreatePayload.clip.id &&
          clip.title === 'Admin upload genre filter test updated' &&
          clip.genreId === 'thriller'
      )
    ).toBe(true)

    const moderationReadResponse = await fetch(`${BASE_URL}/moderation/comments`, {
      headers: { Authorization: `Bearer ${loginAdminPayload.accessToken}` },
    })
    const moderationReadPayload = await readJson(moderationReadResponse)
    expect(moderationReadResponse.status).toBe(200)
    expect(Array.isArray(moderationReadPayload.items)).toBe(true)

    const moderationWriteResponse = await fetch(`${BASE_URL}/moderation/comments/block-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdminPayload.accessToken}`,
      },
      body: JSON.stringify({ authorId: 'usr_local_demo', isBlocked: true }),
    })
    const moderationWritePayload = await readJson(moderationWriteResponse)
    expect(moderationWriteResponse.status).toBe(200)
    expect(moderationWritePayload.blockedUsers).toMatchObject({ usr_local_demo: true })

    const logoutResponse = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdminPayload.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: loginAdminPayload.refreshToken }),
    })
    expect(logoutResponse.status).toBe(204)
  })

  it('handles CORS preflight and exposes CORS headers on API responses', async () => {
    const preflightResponse = await fetch(`${BASE_URL}/admin/clips`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      },
    })

    expect(preflightResponse.status).toBe(204)
    expect(preflightResponse.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173'
    )
    expect(preflightResponse.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,DELETE,PUT,PATCH,OPTIONS'
    )
    expect(preflightResponse.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization, Content-Length'
    )

    const apiResponse = await fetch(`${BASE_URL}/feed/clips`, {
      headers: {
        Origin: 'http://127.0.0.1:5173',
      },
    })

    expect(apiResponse.status).toBe(200)
    expect(apiResponse.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
    expect(apiResponse.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('echoes requested headers for PATCH preflight on dynamic admin clip routes', async () => {
    const preflightResponse = await fetch(`${BASE_URL}/admin/clips/clip_1`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'authorization,content-type',
        'Access-Control-Request-Private-Network': 'true',
      },
    })

    expect(preflightResponse.status).toBe(204)
    expect(preflightResponse.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173'
    )
    expect(preflightResponse.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,DELETE,PUT,PATCH,OPTIONS'
    )
    expect(preflightResponse.headers.get('access-control-allow-headers')).toBe(
      'authorization,content-type'
    )
    expect(preflightResponse.headers.get('access-control-allow-private-network')).toBe('true')
  })
})
