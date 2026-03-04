import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { uploadClipWithMetadata, validateClipFile } from '../services/admin-upload-service'

describe('admin-upload-service', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('validates mime type and file size', () => {
    const invalidTypeError = validateClipFile({ type: 'image/png', size: 1024 })
    expect(invalidTypeError).toMatch(/unsupported file type/i)

    const invalidSizeError = validateClipFile({ type: 'video/mp4', size: 9999999999 })
    expect(invalidSizeError).toMatch(/file is too large/i)
  })

  it('retries upload for retryable errors, confirms upload and stores metadata', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            uploadId: 'upload_1',
            objectKey: 'clips/obj.mp4',
            uploadUrl: 'https://storage/upload',
            requiredHeaders: { 'Content-Type': 'video/mp4' },
          }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ status: 'confirmed' }) })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ clip: { id: 'clip_1' } }),
      })

    const onUploadProgress = vi.fn()
    const result = await uploadClipWithMetadata({
      file: { name: 'clip.mp4', type: 'video/mp4', size: 1024 },
      metadata: {
        title: 'Movie',
        description: 'd',
        genreId: 'drama',
        durationSec: 60,
        videoUrl: 'https://cdn/video.mp4',
        thumbnailUrl: 'https://cdn/thumb.jpg',
        onUploadProgress,
      },
      maxAttempts: 3,
    })

    expect(result.clip).toEqual({ id: 'clip_1' })
    expect(result.uploadId).toBe('upload_1')
    expect(result.attemptsUsed).toBe(2)
    expect(globalThis.fetch).toHaveBeenCalledTimes(5)
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/admin\/uploads\/initiate$/)
    expect(globalThis.fetch.mock.calls[3][0]).toMatch(/\/admin\/uploads\/upload_1\/complete$/)
    expect(onUploadProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'uploading', attempt: 1 })
    )
  })

  it('rolls back upload session when metadata save fails', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            uploadId: 'upload_2',
            objectKey: 'clips/rollback.mp4',
            uploadUrl: 'https://storage/upload',
            requiredHeaders: { 'Content-Type': 'video/mp4' },
          }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ status: 'confirmed' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ error: { message: 'Invalid metadata' } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' })

    await expect(
      uploadClipWithMetadata({
        file: { name: 'clip.mp4', type: 'video/mp4', size: 1024 },
        metadata: {
          title: 'Movie',
          genreId: 'drama',
        },
        maxAttempts: 1,
      })
    ).rejects.toThrow(/invalid metadata/i)

    expect(globalThis.fetch.mock.calls[4][0]).toMatch(/\/admin\/uploads\/upload_2\/rollback$/)
  })
})
