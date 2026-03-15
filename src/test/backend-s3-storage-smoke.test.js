import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import process from 'node:process'

import { startMockS3Server } from './mock-s3-server'

const PORT = 18788
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`

let serverProcess
let mockS3

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
      // wait until server is ready
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw new Error('backend-server.mjs did not start in time for s3 smoke')
}

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

describe('backend API s3 storage smoke', () => {
  beforeAll(async () => {
    globalThis.fetch = globalThis.__REAL_FETCH__ || globalThis.fetch
    mockS3 = await startMockS3Server()

    serverProcess = spawn('node', ['backend-server.mjs'], {
      env: {
        ...process.env,
        PORT: String(PORT),
        STORAGE_PROVIDER: 's3',
        STORAGE_UPLOAD_EXPIRES_IN: '900',
        S3_BUCKET: 'clipflow-smoke',
        S3_REGION: 'us-east-1',
        S3_ENDPOINT: mockS3.url,
        S3_ACCESS_KEY_ID: 'smoke-key',
        S3_SECRET_ACCESS_KEY: 'smoke-secret',
        S3_FORCE_PATH_STYLE: 'true',
        S3_PUBLIC_BASE_URL: `${mockS3.url}/public/clipflow-smoke`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    await waitForServer()
  })

  beforeEach(() => {
    globalThis.fetch = globalThis.__REAL_FETCH__ || globalThis.fetch
  })

  afterAll(async () => {
    globalThis.fetch = globalThis.__REAL_FETCH__ || globalThis.fetch

    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM')
    }

    if (mockS3) {
      await mockS3.close()
      mockS3 = null
    }
  })

  it('creates admin upload sessions against s3-compatible storage without changing frontend payloads', async () => {
    const loginAdminResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@local.dev', password: 'demo-password' }),
    })
    const loginAdminPayload = await readJson(loginAdminResponse)
    expect(loginAdminResponse.status).toBe(200)

    const uploadUrlResponse = await fetch(`${BASE_URL}/admin/clips/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdminPayload.accessToken}`,
      },
      body: JSON.stringify({
        fileName: 's3-smoke.mp4',
        contentType: 'video/mp4',
        size: 14,
      }),
    })
    const uploadUrlPayload = await readJson(uploadUrlResponse)
    expect(uploadUrlResponse.status).toBe(200)
    expect(uploadUrlPayload.uploadUrl.startsWith(mockS3.url)).toBe(true)
    expect(uploadUrlPayload.uploadUrl.includes('/uploads/')).toBe(false)
    expect(uploadUrlPayload.requiredHeaders).toEqual({ 'Content-Type': 'video/mp4' })

    const uploadPutResponse = await fetch(uploadUrlPayload.uploadUrl, {
      method: 'PUT',
      headers: uploadUrlPayload.requiredHeaders,
      body: Buffer.from('s3-smoke-bytes'),
    })
    expect(uploadPutResponse.status).toBe(200)

    const adminCreateResponse = await fetch(`${BASE_URL}/admin/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdminPayload.accessToken}`,
      },
      body: JSON.stringify({
        uploadId: uploadUrlPayload.uploadId,
        objectKey: uploadUrlPayload.objectKey,
        title: 'S3 smoke clip',
        description: 'Created through s3-compatible upload smoke',
        clipDescription: 'S3 upload flow',
        watchUrl: 'https://example.com/watch/s3-smoke',
        genreIds: ['drama', 'thriller'],
        rating: 8.1,
        durationSec: 45,
        status: 'draft',
      }),
    })
    const adminCreatePayload = await readJson(adminCreateResponse)
    expect(adminCreateResponse.status).toBe(201)
    expect(adminCreatePayload.clip).toMatchObject({
      title: 'S3 smoke clip',
      genreIds: ['drama', 'thriller'],
      genreId: 'drama',
      videoUrl: `${mockS3.url}/public/clipflow-smoke/${uploadUrlPayload.objectKey}`,
    })

    const objectResponse = await fetch(adminCreatePayload.clip.videoUrl)
    expect(objectResponse.status).toBe(200)
    expect(await objectResponse.text()).toBe('s3-smoke-bytes')

    const filteredFeedResponse = await fetch(`${BASE_URL}/feed/clips?genreId=thriller`)
    const filteredFeedPayload = await readJson(filteredFeedResponse)
    expect(filteredFeedResponse.status).toBe(200)
    expect(filteredFeedPayload.items.some((clip) => clip.id === adminCreatePayload.clip.id)).toBe(
      true
    )
  })
})
