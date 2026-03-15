import { spawn } from 'node:child_process'
import process from 'node:process'

const PORT = Number(process.env.SMOKE_LOCAL_PORT || 18787)
const BASE_URL = process.env.SMOKE_API_BASE_URL || `http://127.0.0.1:${PORT}/api/v1`
const JSON_HEADERS = { 'Content-Type': 'application/json' }

let serverProcess = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  const timeoutMs = 10000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/genres`)
      if (response.ok) {
        return
      }
    } catch {
      // wait for boot
    }

    await sleep(150)
  }

  throw new Error(`Local backend did not start in time at ${BASE_URL}`)
}

function ensureOk(response, message) {
  if (!response.ok) {
    throw new Error(`${message}: ${response.status}`)
  }
}

function ensureStatus(response, expectedStatus, message) {
  if (response.status !== expectedStatus) {
    throw new Error(`${message}: expected ${expectedStatus}, received ${response.status}`)
  }
}

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function request(path, { method = 'GET', body, token, headers } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : JSON_HEADERS),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return {
    response,
    payload: await readJson(response),
  }
}

async function login(email) {
  const { response, payload } = await request('/auth/login', {
    method: 'POST',
    body: { email, password: 'demo-password' },
  })
  ensureOk(response, `login failed for ${email}`)
  return payload
}

async function createUploadedAsset(token, fileName) {
  const uploadUrl = await request('/admin/clips/upload-url', {
    method: 'POST',
    token,
    body: {
      fileName,
      contentType: 'video/mp4',
      size: 16,
    },
  })
  ensureOk(uploadUrl.response, `upload-url failed for ${fileName}`)

  const uploadPutResponse = await fetch(uploadUrl.payload.uploadUrl, {
    method: 'PUT',
    headers: uploadUrl.payload.requiredHeaders,
    body: Buffer.from(`asset:${fileName}`),
  })
  ensureOk(uploadPutResponse, `upload PUT failed for ${fileName}`)

  return uploadUrl.payload
}

async function main() {
  if (!process.env.SMOKE_API_BASE_URL) {
    serverProcess = spawn('node', ['backend-server.mjs'], {
      env: {
        ...process.env,
        PORT: String(PORT),
        STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
        LOCAL_STORAGE_ROOT: process.env.LOCAL_STORAGE_ROOT || '.clipflow-storage',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    serverProcess.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
    })
    serverProcess.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
    })

    await waitForServer()
  }

  const unauthorizedMe = await request('/me')
  ensureStatus(unauthorizedMe.response, 401, 'unauthorized /me must be rejected')

  const userSession = await login('user@local.dev')
  const adminSession = await login('admin@local.dev')

  const nonAdminUploadAttempt = await request('/admin/clips/upload-url', {
    method: 'POST',
    token: userSession.accessToken,
    body: {
      fileName: 'user-forbidden.mp4',
      contentType: 'video/mp4',
      size: 16,
    },
  })
  ensureStatus(nonAdminUploadAttempt.response, 403, 'non-admin upload-url must be forbidden')

  const refreshed = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: userSession.refreshToken },
  })
  ensureOk(refreshed.response, 'refresh failed')

  const me = await request('/me', { token: refreshed.payload.accessToken })
  ensureOk(me.response, 'me failed')

  const invalidGenresPatch = await request('/me', {
    method: 'PATCH',
    token: refreshed.payload.accessToken,
    body: { selectedGenres: ['unknown-genre'] },
  })
  ensureStatus(invalidGenresPatch.response, 422, 'PATCH /me must reject unknown genre ids')

  const invalidPreferencesPatch = await request('/me', {
    method: 'PATCH',
    token: refreshed.payload.accessToken,
    body: { preferences: { autoplayEnabled: 'sometimes' } },
  })
  ensureStatus(
    invalidPreferencesPatch.response,
    422,
    'PATCH /me must reject invalid preference types'
  )

  const patchMe = await request('/me', {
    method: 'PATCH',
    token: refreshed.payload.accessToken,
    body: {
      hasCompletedOnboarding: true,
      selectedGenres: ['action', 'drama'],
      preferences: {
        notificationsEnabled: false,
        autoplayEnabled: false,
        preferredLanguage: 'ru',
      },
    },
  })
  ensureOk(patchMe.response, 'PATCH /me failed')
  if (patchMe.payload?.hasCompletedOnboarding !== true) {
    throw new Error('PATCH /me did not return updated onboarding state')
  }
  if (
    JSON.stringify(patchMe.payload?.selectedGenres || []) !== JSON.stringify(['action', 'drama'])
  ) {
    throw new Error('PATCH /me did not persist selectedGenres')
  }
  if (patchMe.payload?.preferences?.preferredLanguage !== 'ru') {
    throw new Error('PATCH /me did not persist preferences')
  }

  const refreshedAfterPatch = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: refreshed.payload.refreshToken },
  })
  ensureOk(refreshedAfterPatch.response, 'refresh after PATCH /me failed')
  if (refreshedAfterPatch.payload?.user?.hasCompletedOnboarding !== true) {
    throw new Error('refresh after PATCH /me did not preserve onboarding state')
  }
  if (refreshedAfterPatch.payload?.user?.preferences?.preferredLanguage !== 'ru') {
    throw new Error('refresh after PATCH /me did not preserve user preferences')
  }

  const genres = await request('/genres')
  ensureOk(genres.response, 'genres failed')
  if (
    !Array.isArray(genres.payload?.items) ||
    !genres.payload.items.some((genre) => genre.id === 'scifi')
  ) {
    throw new Error('genres response does not include canonical scifi slug')
  }

  const catalog = await request('/clips')
  ensureOk(catalog.response, 'clips failed')
  if (!catalog.payload.items.every((clip) => typeof clip.rating === 'number')) {
    throw new Error('catalog clips do not expose numeric ratings')
  }
  if (
    !catalog.payload.items.every((clip) => Array.isArray(clip.genreIds) && clip.genreIds.length > 0)
  ) {
    throw new Error('catalog clips do not expose canonical genreIds arrays')
  }

  const feed = await request('/feed/clips?genreId=scifi')
  ensureOk(feed.response, 'feed failed')

  const unauthorizedCommentLike = await request('/comments/cm_seed_1/like', {
    method: 'POST',
  })
  ensureStatus(unauthorizedCommentLike.response, 401, 'unauthorized comment like must be rejected')

  const invalidClipUpload = await createUploadedAsset(
    adminSession.accessToken,
    'invalid-metadata.mp4'
  )

  const missingGenres = await request('/admin/clips', {
    method: 'POST',
    token: adminSession.accessToken,
    body: {
      uploadId: invalidClipUpload.uploadId,
      objectKey: invalidClipUpload.objectKey,
      title: 'Missing genres clip',
      description: 'invalid clip',
      clipDescription: 'invalid clip',
      watchUrl: 'https://example.com/watch/missing-genres',
      rating: 7.1,
      durationSec: 42,
      status: 'draft',
    },
  })
  ensureStatus(missingGenres.response, 422, 'admin clip create without genreIds must be rejected')

  const invalidRating = await request('/admin/clips', {
    method: 'POST',
    token: adminSession.accessToken,
    body: {
      uploadId: invalidClipUpload.uploadId,
      objectKey: invalidClipUpload.objectKey,
      title: 'Invalid rating clip',
      description: 'invalid clip',
      clipDescription: 'invalid clip',
      watchUrl: 'https://example.com/watch/invalid-rating',
      genreIds: ['drama'],
      rating: 11,
      durationSec: 42,
      status: 'draft',
    },
  })
  ensureStatus(
    invalidRating.response,
    422,
    'admin clip create with invalid rating must be rejected'
  )

  const createdComment = await request('/clips/clip_1/comments', {
    method: 'POST',
    token: refreshed.payload.accessToken,
    body: { body: 'Smoke comment from local API' },
  })
  ensureOk(createdComment.response, 'create comment failed')

  const comments = await request('/comments', {
    token: refreshed.payload.accessToken,
  })
  ensureOk(comments.response, 'comments failed')
  if (!Array.isArray(comments.payload?.items)) {
    throw new Error('comments response is not a list')
  }

  const likedComment = await request(`/comments/${createdComment.payload.comment.id}/like`, {
    method: 'POST',
    token: refreshed.payload.accessToken,
  })
  ensureOk(likedComment.response, 'comment like failed')
  if (!likedComment.payload?.comment?.likedByViewer || likedComment.payload.comment.likes < 1) {
    throw new Error('comment like payload is missing viewer like state')
  }

  const unlikedComment = await request(`/comments/${createdComment.payload.comment.id}/like`, {
    method: 'DELETE',
    token: refreshed.payload.accessToken,
  })
  ensureOk(unlikedComment.response, 'comment unlike failed')
  if (
    unlikedComment.payload?.comment?.likedByViewer ||
    unlikedComment.payload.comment.likes !== 0
  ) {
    throw new Error('comment unlike payload did not reset like state')
  }

  const liked = await request('/clips/clip_1/like', {
    method: 'POST',
    token: refreshed.payload.accessToken,
  })
  ensureOk(liked.response, 'like failed')

  const bookmarked = await request('/clips/clip_1/bookmark', {
    method: 'POST',
    token: refreshed.payload.accessToken,
  })
  ensureOk(bookmarked.response, 'bookmark failed')

  const bookmarkList = await request('/me/bookmarks', {
    token: refreshed.payload.accessToken,
  })
  ensureOk(bookmarkList.response, 'bookmark list failed')

  const validClipUpload = await createUploadedAsset(adminSession.accessToken, 'local-smoke.mp4')

  const createdClip = await request('/admin/clips', {
    method: 'POST',
    token: adminSession.accessToken,
    body: {
      uploadId: validClipUpload.uploadId,
      objectKey: validClipUpload.objectKey,
      title: 'Local smoke clip',
      description: 'Created by smoke:local',
      clipDescription: 'Smoke flow clip',
      watchUrl: 'https://example.com/watch/local-smoke',
      genreIds: ['drama', 'thriller'],
      rating: 7.8,
      durationSec: 42,
      status: 'draft',
    },
  })
  ensureOk(createdClip.response, 'admin clip create failed')
  if (createdClip.payload?.clip?.rating !== 7.8) {
    throw new Error('created clip rating is missing from response')
  }
  if (
    JSON.stringify(createdClip.payload?.clip?.genreIds) !== JSON.stringify(['drama', 'thriller'])
  ) {
    throw new Error('created clip genreIds are missing from response')
  }
  if (createdClip.payload?.clip?.genreId !== 'drama') {
    throw new Error('created clip primary genreId is not derived from genreIds')
  }

  const updatedClip = await request(`/admin/clips/${createdClip.payload.clip.id}`, {
    method: 'PATCH',
    token: adminSession.accessToken,
    body: {
      title: 'Local smoke clip updated',
      clipDescription: 'Smoke flow clip updated',
      watchUrl: 'https://example.com/watch/local-smoke-updated',
      genreIds: ['thriller', 'fantasy'],
      rating: 8.2,
      durationSec: 50,
      status: 'published',
    },
  })
  ensureOk(updatedClip.response, 'admin clip update failed')
  if (updatedClip.payload?.clip?.title !== 'Local smoke clip updated') {
    throw new Error('updated clip title is missing from PATCH response')
  }
  if (updatedClip.payload?.clip?.rating !== 8.2) {
    throw new Error('updated clip rating is missing from PATCH response')
  }
  if (
    JSON.stringify(updatedClip.payload?.clip?.genreIds) !== JSON.stringify(['thriller', 'fantasy'])
  ) {
    throw new Error('updated clip genreIds are missing from PATCH response')
  }
  if (updatedClip.payload?.clip?.genreId !== 'thriller') {
    throw new Error('updated clip primary genreId is not derived from PATCH genreIds')
  }
  if (updatedClip.payload?.clip?.watchUrl !== 'https://example.com/watch/local-smoke-updated') {
    throw new Error('updated clip watchUrl is missing from PATCH response')
  }

  const filteredFeed = await request('/feed/clips?genreId=fantasy')
  ensureOk(filteredFeed.response, 'filtered feed failed')
  if (
    !filteredFeed.payload.items.some(
      (clip) =>
        clip.id === createdClip.payload.clip.id &&
        clip.title === 'Local smoke clip updated' &&
        clip.genreId === 'thriller'
    )
  ) {
    throw new Error('updated clip is not returned from secondary-genre feed filter')
  }

  const moderation = await request('/moderation/comments', {
    token: adminSession.accessToken,
  })
  ensureOk(moderation.response, 'moderation list failed')

  const blockUser = await request('/moderation/comments/block-user', {
    method: 'POST',
    token: adminSession.accessToken,
    body: {
      authorId: userSession.user.id,
      isBlocked: true,
    },
  })
  ensureOk(blockUser.response, 'block user failed')

  const blockedCommentAttempt = await request('/clips/clip_1/comments', {
    method: 'POST',
    token: refreshed.payload.accessToken,
    body: { body: 'Blocked user comment should fail' },
  })
  ensureStatus(blockedCommentAttempt.response, 403, 'blocked user comment create must be rejected')

  const deleteComment = await request(`/moderation/comments/${createdComment.payload.comment.id}`, {
    method: 'DELETE',
    token: adminSession.accessToken,
  })
  ensureOk(deleteComment.response, 'delete comment failed')

  const logout = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${adminSession.accessToken}`,
    },
    body: JSON.stringify({ refreshToken: adminSession.refreshToken }),
  })
  ensureStatus(logout, 204, 'logout failed')

  console.info('smoke:local passed')
}

try {
  await main()
} finally {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
  }
}
