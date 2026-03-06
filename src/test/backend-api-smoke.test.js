import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
      const response = await fetch(`${BASE_URL}/feed/clips`)
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

describe('backend API smoke', () => {
  beforeAll(async () => {
    serverProcess = spawn('node', ['backend-server.mjs'], {
      env: {
        ...process.env,
        PORT: String(PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    await waitForServer()
  })

  afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM')
    }
  })

  it('covers read/write for feed, comments, bookmarks, profile and moderation flows', async () => {
    const feedResponse = await fetch(`${BASE_URL}/feed/clips`)
    const feedPayload = await feedResponse.json()
    expect(feedResponse.status).toBe(200)
    expect(Array.isArray(feedPayload.items)).toBe(true)
    expect(feedPayload.items.length).toBeGreaterThan(0)

    const likeResponse = await fetch(`${BASE_URL}/clips/clip_1/like`, { method: 'POST' })
    const likePayload = await likeResponse.json()
    expect(likeResponse.status).toBe(200)
    expect(likePayload.likes).toMatchObject({ clip_1: true })

    const commentCreateResponse = await fetch(`${BASE_URL}/clips/clip_1/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Smoke comment', userName: 'Smoke User' }),
    })
    const commentCreatePayload = await commentCreateResponse.json()
    expect(commentCreateResponse.status).toBe(201)
    expect(commentCreatePayload.comment).toMatchObject({ clipId: 'clip_1', text: 'Smoke comment' })

    const commentsReadResponse = await fetch(`${BASE_URL}/comments`)
    const commentsReadPayload = await commentsReadResponse.json()
    expect(commentsReadResponse.status).toBe(200)
    expect(Array.isArray(commentsReadPayload.items)).toBe(true)
    expect(
      commentsReadPayload.items.some((comment) => comment.id === commentCreatePayload.comment.id)
    ).toBe(true)

    const bookmarkWriteResponse = await fetch(`${BASE_URL}/clips/clip_1/bookmark`, {
      method: 'POST',
    })
    const bookmarkWritePayload = await bookmarkWriteResponse.json()
    expect(bookmarkWriteResponse.status).toBe(200)
    expect(bookmarkWritePayload.bookmarks).toContain('clip_1')

    const bookmarksReadResponse = await fetch(`${BASE_URL}/me/bookmarks`)
    const bookmarksReadPayload = await bookmarksReadResponse.json()
    expect(bookmarksReadResponse.status).toBe(200)
    expect(bookmarksReadPayload.items.map((item) => item.id)).toContain('clip_1')

    const profileReadResponse = await fetch(`${BASE_URL}/me`)
    const profileReadPayload = await profileReadResponse.json()
    expect(profileReadResponse.status).toBe(200)
    expect(profileReadPayload).toMatchObject({ id: 'usr_local_demo', role: 'user' })

    const moderationReadResponse = await fetch(`${BASE_URL}/moderation/comments`)
    const moderationReadPayload = await moderationReadResponse.json()
    expect(moderationReadResponse.status).toBe(200)
    expect(Array.isArray(moderationReadPayload.items)).toBe(true)

    const moderationWriteResponse = await fetch(`${BASE_URL}/moderation/comments/block-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorId: 'usr_local_demo', isBlocked: true }),
    })
    const moderationWritePayload = await moderationWriteResponse.json()
    expect(moderationWriteResponse.status).toBe(200)
    expect(moderationWritePayload.blockedUsers).toMatchObject({ usr_local_demo: true })
  })

  it('returns admin-created multi-genre clip in feed for any selected genre', async () => {
    const adminCreateResponse = await fetch(`${BASE_URL}/admin/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        title: 'Admin upload genre intersection test',
        description: 'Created through admin endpoint',
        clipDescription: 'Genre feed visibility',
        watchUrl: 'https://cinema.example.com/watch/admin-upload',
        objectKey: 'clips/admin-upload.mp4',
        genreIds: ['comedy', 'drama'],
      }),
    })

    const adminCreatePayload = await adminCreateResponse.json()
    expect(adminCreateResponse.status).toBe(201)
    expect(adminCreatePayload.clip).toMatchObject({
      genreId: 'comedy',
      genres: ['comedy', 'drama'],
      title: 'Admin upload genre intersection test',
    })

    const comedyFeedResponse = await fetch(`${BASE_URL}/feed/clips?genreId=comedy`)
    const comedyFeedPayload = await comedyFeedResponse.json()
    expect(comedyFeedResponse.status).toBe(200)
    expect(comedyFeedPayload.items.some((clip) => clip.id === adminCreatePayload.clip.id)).toBe(
      true
    )

    const dramaFeedResponse = await fetch(`${BASE_URL}/feed/clips?genre=drama`)
    const dramaFeedPayload = await dramaFeedResponse.json()
    expect(dramaFeedResponse.status).toBe(200)
    expect(dramaFeedPayload.items.some((clip) => clip.id === adminCreatePayload.clip.id)).toBe(true)

    const clipInDramaFeed = dramaFeedPayload.items.find(
      (clip) => clip.id === adminCreatePayload.clip.id
    )
    expect(clipInDramaFeed).toMatchObject({
      genreId: 'comedy',
      genres: ['comedy', 'drama'],
    })
  })



  it('keeps uploaded clip consistent between admin list and feed after reload-like re-fetch', async () => {
    const createResponse = await fetch(`${BASE_URL}/admin/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        title: 'Persistence clip',
        description: 'Should survive refresh',
        clipDescription: 'Persistent clip',
        watchUrl: 'https://cinema.example.com/watch/persistence-clip',
        objectKey: 'clips/persistence-clip.mp4',
        genreIds: ['drama'],
      }),
    })

    const createPayload = await createResponse.json()
    expect(createResponse.status).toBe(201)

    const createdId = createPayload.clip.id

    const adminListResponse = await fetch(`${BASE_URL}/admin/clips`)
    const adminListPayload = await adminListResponse.json()
    expect(adminListResponse.status).toBe(200)
    expect(adminListPayload.items.some((clip) => clip.id === createdId)).toBe(true)

    const feedResponse = await fetch(`${BASE_URL}/feed/clips`)
    const feedPayload = await feedResponse.json()
    expect(feedResponse.status).toBe(200)
    expect(feedPayload.items.some((clip) => clip.id === createdId)).toBe(true)

    // reload simulation: repeat reads as if page was reopened
    const adminListAfterReload = await fetch(`${BASE_URL}/admin/clips`)
    const adminListAfterReloadPayload = await adminListAfterReload.json()
    const feedAfterReload = await fetch(`${BASE_URL}/feed/clips`)
    const feedAfterReloadPayload = await feedAfterReload.json()

    expect(adminListAfterReload.status).toBe(200)
    expect(feedAfterReload.status).toBe(200)

    const adminClip = adminListAfterReloadPayload.items.find((clip) => clip.id === createdId)
    const feedClip = feedAfterReloadPayload.items.find((clip) => clip.id === createdId)

    expect(adminClip).toBeTruthy()
    expect(feedClip).toBeTruthy()
    expect(feedClip).toMatchObject({
      id: adminClip.id,
      title: adminClip.title,
      clipDescription: adminClip.clipDescription,
    })
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
      'Content-Type, Authorization'
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
})
