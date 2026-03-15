import os from 'node:os'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStorageAdapter } from '../../storage/create-storage-adapter.mjs'
import { startMockS3Server } from './mock-s3-server'

function createOrigin() {
  return 'http://localhost:8787'
}

describe('storage adapters', () => {
  let tempDir = ''
  let mockS3 = null

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'clipflow-storage-'))
  })

  afterEach(async () => {
    if (mockS3) {
      await mockS3.close()
      mockS3 = null
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = ''
    }
  })

  it('stores local uploads on disk and resolves backend asset URLs', async () => {
    const adapter = createStorageAdapter({
      env: {
        STORAGE_PROVIDER: 'local',
        LOCAL_STORAGE_ROOT: tempDir,
        STORAGE_UPLOAD_EXPIRES_IN: '900',
      },
      apiPrefix: '/api/v1',
      getOrigin: createOrigin,
    })

    const session = {
      id: 'upl_local_1',
      objectKey: 'clips/2026-03-08/local.mp4',
      contentType: 'video/mp4',
    }

    const upload = await adapter.createUploadSession({
      contentType: session.contentType,
      objectKey: session.objectKey,
      req: { headers: {} },
      uploadId: session.id,
    })

    expect(upload.uploadUrl).toBe('http://localhost:8787/api/v1/uploads/upl_local_1')
    expect(upload.requiredHeaders).toEqual({ 'Content-Type': 'video/mp4' })

    const request = Readable.from([Buffer.from('local-video-bytes')])
    await adapter.finalizeUploadedObject({
      maxSizeBytes: 1024,
      req: request,
      session,
    })

    await expect(adapter.assertObjectExists({ session })).resolves.toBe(true)
    await expect(
      readFile(path.join(tempDir, 'clips', '2026-03-08', 'local.mp4'), 'utf8')
    ).resolves.toBe('local-video-bytes')
    expect(adapter.getPublicAssetUrl({ req: { headers: {} }, session })).toBe(
      'http://localhost:8787/api/v1/assets/upl_local_1'
    )
  })

  it('creates presigned s3 uploads and verifies object existence through head requests', async () => {
    globalThis.fetch = globalThis.__REAL_FETCH__ || globalThis.fetch
    mockS3 = await startMockS3Server()

    const adapter = createStorageAdapter({
      env: {
        STORAGE_PROVIDER: 's3',
        STORAGE_UPLOAD_EXPIRES_IN: '600',
        S3_BUCKET: 'clipflow-test',
        S3_REGION: 'us-east-1',
        S3_ENDPOINT: mockS3.url,
        S3_ACCESS_KEY_ID: 'test-key',
        S3_SECRET_ACCESS_KEY: 'test-secret',
        S3_FORCE_PATH_STYLE: 'true',
        S3_PUBLIC_BASE_URL: `${mockS3.url}/public/clipflow-test`,
      },
      apiPrefix: '/api/v1',
      getOrigin: createOrigin,
    })

    const session = {
      id: 'upl_s3_1',
      objectKey: 'clips/2026-03-08/s3.mp4',
      contentType: 'video/mp4',
    }

    const upload = await adapter.createUploadSession({
      contentType: session.contentType,
      objectKey: session.objectKey,
      req: { headers: {} },
      uploadId: session.id,
    })

    expect(upload.uploadUrl).toContain(mockS3.url)
    expect(upload.requiredHeaders).toEqual({ 'Content-Type': 'video/mp4' })
    await expect(adapter.assertObjectExists({ session })).resolves.toBe(false)

    const uploadResponse = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: upload.requiredHeaders,
      body: Buffer.from('s3-video-bytes'),
    })
    expect(uploadResponse.status).toBe(200)

    await expect(adapter.assertObjectExists({ session })).resolves.toBe(true)
    expect(adapter.getPublicAssetUrl({ req: { headers: {} }, session })).toBe(
      `${mockS3.url}/public/clipflow-test/clips/2026-03-08/s3.mp4`
    )
  })
})
