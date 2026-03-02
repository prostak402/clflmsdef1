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
})
