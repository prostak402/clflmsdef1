import { Buffer } from 'node:buffer'

import { describe, expect, it, vi } from 'vitest'

import {
  buildStageSmokeContext,
  normalizeApiBaseUrl,
  readStageSmokeEnv,
  runStageStorageSmoke,
} from '../../scripts/stage-storage-smoke-lib.mjs'

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createFetchStub(handlers) {
  return vi.fn(async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    const method = (init.method || 'GET').toUpperCase()
    const handler = handlers.find((candidate) => {
      const urlMatches =
        typeof candidate.url === 'string' ? candidate.url === url : candidate.url.test(url)
      const methodMatches = !candidate.method || candidate.method === method
      return urlMatches && methodMatches
    })

    if (!handler) {
      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }

    return handler.respond({ url, method, init })
  })
}

const FIXED_NOW = new Date('2026-03-09T12:34:56.000Z')
const FIXED_UUID = '12345678-aaaa-bbbb-cccc-1234567890ab'
const DEFAULT_ENV = {
  STAGE_API_BASE_URL: 'https://stage.example.com',
  STAGE_API_TOKEN: 'stage-token',
  STAGE_SMOKE_CLIP_PREFIX: 'clipflow-stage',
}

describe('stage storage smoke helpers', () => {
  it('requires mandatory stage env vars', () => {
    expect(() => readStageSmokeEnv({ STAGE_API_TOKEN: 'token' })).toThrow(
      'STAGE_API_BASE_URL is required'
    )
    expect(() => readStageSmokeEnv({ STAGE_API_BASE_URL: 'https://stage.example.com' })).toThrow(
      'STAGE_API_TOKEN is required'
    )
  })

  it('normalizes stage base URLs to /api/v1', () => {
    expect(normalizeApiBaseUrl('https://stage.example.com')).toBe(
      'https://stage.example.com/api/v1'
    )
    expect(normalizeApiBaseUrl('https://stage.example.com/')).toBe(
      'https://stage.example.com/api/v1'
    )
    expect(normalizeApiBaseUrl('https://stage.example.com/custom')).toBe(
      'https://stage.example.com/custom/api/v1'
    )
    expect(normalizeApiBaseUrl('https://stage.example.com/custom/api/v1/')).toBe(
      'https://stage.example.com/custom/api/v1'
    )
  })

  it('rejects local API fallback upload URLs instead of presigned storage URLs', async () => {
    const fetchImpl = createFetchStub([
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips/upload-url',
        respond: () =>
          createJsonResponse({
            uploadId: 'upl_1',
            objectKey: 'clips/test.mp4',
            uploadUrl: 'https://stage.example.com/api/v1/uploads/upl_1',
          }),
      },
    ])

    await expect(
      runStageStorageSmoke({
        env: DEFAULT_ENV,
        fetchImpl,
        logger: { info: vi.fn() },
        now: FIXED_NOW,
        createUuid: () => FIXED_UUID,
      })
    ).rejects.toThrow(
      'stage upload-url returned local API upload path instead of presigned storage URL'
    )
  })

  it('rejects missing upload response fields', async () => {
    const fetchImpl = createFetchStub([
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips/upload-url',
        respond: () => createJsonResponse({ uploadId: 'upl_1' }),
      },
    ])

    await expect(
      runStageStorageSmoke({
        env: DEFAULT_ENV,
        fetchImpl,
        logger: { info: vi.fn() },
        now: FIXED_NOW,
        createUuid: () => FIXED_UUID,
      })
    ).rejects.toThrow('stage upload-url response is missing required fields')
  })

  it('rejects missing clip id and skips archive cleanup when no clip was created', async () => {
    const logger = { info: vi.fn() }
    const fetchImpl = createFetchStub([
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips/upload-url',
        respond: () =>
          createJsonResponse({
            uploadId: 'upl_1',
            objectKey: 'clips/test.mp4',
            uploadUrl: 'https://uploads.example.com/clips/test.mp4',
            requiredHeaders: { 'Content-Type': 'video/mp4' },
          }),
      },
      {
        method: 'PUT',
        url: 'https://uploads.example.com/clips/test.mp4',
        respond: () => new Response(null, { status: 200 }),
      },
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips',
        respond: () =>
          createJsonResponse({ clip: { videoUrl: 'https://cdn.example.com/clips/test.mp4' } }, 201),
      },
    ])

    await expect(
      runStageStorageSmoke({
        env: DEFAULT_ENV,
        fetchImpl,
        logger,
        now: FIXED_NOW,
        createUuid: () => FIXED_UUID,
      })
    ).rejects.toThrow('stage clip create response is missing clip id')
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('archived clip'))
  })

  it('rejects missing videoUrl after clip creation and appends cleanup failures to the primary error', async () => {
    const logger = { info: vi.fn() }
    const fetchImpl = createFetchStub([
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips/upload-url',
        respond: () =>
          createJsonResponse({
            uploadId: 'upl_1',
            objectKey: 'clips/test.mp4',
            uploadUrl: 'https://uploads.example.com/clips/test.mp4',
            requiredHeaders: { 'Content-Type': 'video/mp4' },
          }),
      },
      {
        method: 'PUT',
        url: 'https://uploads.example.com/clips/test.mp4',
        respond: () => new Response(null, { status: 200 }),
      },
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips',
        respond: () => createJsonResponse({ clip: { id: 'clip_1' } }, 201),
      },
      {
        method: 'PATCH',
        url: 'https://stage.example.com/api/v1/admin/clips/clip_1',
        respond: () => createJsonResponse({ error: { message: 'cleanup failed' } }, 500),
      },
    ])

    await expect(
      runStageStorageSmoke({
        env: DEFAULT_ENV,
        fetchImpl,
        logger,
        now: FIXED_NOW,
        createUuid: () => FIXED_UUID,
      })
    ).rejects.toThrow(
      'stage clip create response is missing videoUrl\nCleanup failed: stage clip archive failed: 500'
    )
  })

  it('archives created clips after a successful stage smoke run', async () => {
    const logger = { info: vi.fn() }
    const context = buildStageSmokeContext({
      env: DEFAULT_ENV,
      now: FIXED_NOW,
      createUuid: () => FIXED_UUID,
    })

    const fetchImpl = createFetchStub([
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips/upload-url',
        respond: () =>
          createJsonResponse({
            uploadId: 'upl_1',
            objectKey: 'clips/test.mp4',
            uploadUrl: 'https://uploads.example.com/clips/test.mp4',
            requiredHeaders: { 'Content-Type': 'video/mp4' },
          }),
      },
      {
        method: 'PUT',
        url: 'https://uploads.example.com/clips/test.mp4',
        respond: ({ init }) => {
          const uploadedBytes = Buffer.from(init.body)
          expect(uploadedBytes.equals(context.uploadBytes)).toBe(true)
          return new Response(null, { status: 200 })
        },
      },
      {
        method: 'POST',
        url: 'https://stage.example.com/api/v1/admin/clips',
        respond: () =>
          createJsonResponse(
            { clip: { id: 'clip_1', videoUrl: 'https://cdn.example.com/clips/test.mp4' } },
            201
          ),
      },
      {
        method: 'GET',
        url: 'https://cdn.example.com/clips/test.mp4',
        respond: () => new Response(context.uploadBytes, { status: 200 }),
      },
      {
        method: 'PATCH',
        url: 'https://stage.example.com/api/v1/admin/clips/clip_1',
        respond: () => createJsonResponse({ clip: { status: 'archived' } }),
      },
    ])

    await expect(
      runStageStorageSmoke({
        env: DEFAULT_ENV,
        fetchImpl,
        logger,
        now: FIXED_NOW,
        createUuid: () => FIXED_UUID,
      })
    ).resolves.toBeUndefined()

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://stage.example.com/api/v1/admin/clips/clip_1',
      expect.objectContaining({ method: 'PATCH' })
    )
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('created clip clip_1'))
    expect(logger.info).toHaveBeenCalledWith('smoke:stage archived clip clip_1')
    expect(logger.info).toHaveBeenCalledWith('smoke:stage passed')
  })
})
