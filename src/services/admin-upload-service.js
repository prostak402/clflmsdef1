import { authService } from './auth-service'
import { parseJsonResponse, resolveApiErrorMessage } from './api-client'

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const DEFAULT_MAX_ATTEMPTS = 3

function createUploadError(message, details = {}) {
  const error = new Error(message)
  Object.assign(error, details)
  return error
}

function normalizeRating(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    return null
  }

  return Math.round(parsed * 10) / 10
}

function normalizeGenreId(value) {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  return normalized === 'sci-fi' ? 'scifi' : normalized
}

function normalizeGenreIds(...values) {
  const normalized = []
  const seen = new Set()

  values.flat(Infinity).forEach((value) => {
    const nextGenreId = normalizeGenreId(value)

    if (!nextGenreId || seen.has(nextGenreId)) {
      return
    }

    seen.add(nextGenreId)
    normalized.push(nextGenreId)
  })

  return normalized
}

export function validateClipFile(file) {
  if (!file) {
    return 'Please select a video file'
  }

  const maxSizeMb = Number(import.meta.env?.VITE_UPLOAD_MAX_SIZE_MB || 250)
  const maxSizeBytes = maxSizeMb * 1024 * 1024
  const acceptedMimeTypes = (
    import.meta.env?.VITE_UPLOAD_ALLOWED_MIME_TYPES || 'video/mp4,video/webm,video/quicktime'
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (!acceptedMimeTypes.includes(file.type)) {
    return `Unsupported file type: ${file.type || 'unknown'}`
  }

  if (file.size > maxSizeBytes) {
    return `File is too large. Max size is ${maxSizeMb} MB`
  }

  return null
}

async function requestUploadUrl(file) {
  const response = await authService.fetchWithAuth('/admin/clips/upload-url', {
    method: 'POST',
    body: {
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      contentType: file.type,
      size: file.size,
    },
  })

  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    throw createUploadError(
      resolveApiErrorMessage(payload, `Failed to create upload session (${response.status})`),
      {
        status: response.status,
        stage: 'upload-url',
      }
    )
  }

  return payload
}

async function uploadFile({ file, uploadUrl, requiredHeaders }) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      ...(requiredHeaders || {}),
    },
    body: file,
  })

  if (!response.ok) {
    throw createUploadError(`Upload failed with status ${response.status}`, {
      status: response.status,
      stage: 'upload',
    })
  }
}

async function createClipMetadata(metadata) {
  const response = await authService.fetchWithAuth('/admin/clips', {
    method: 'POST',
    body: metadata,
  })

  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    throw createUploadError(
      resolveApiErrorMessage(payload, `Failed to save clip metadata (${response.status})`),
      {
        status: response.status,
        stage: 'metadata',
      }
    )
  }

  return payload?.clip || null
}

export async function updateClipMetadata(clipId, metadata) {
  const normalizedClipId = typeof clipId === 'string' ? clipId.trim() : ''

  if (!normalizedClipId) {
    throw createUploadError('clipId is required for clip updates', {
      stage: 'metadata',
    })
  }

  const response = await authService.fetchWithAuth(`/admin/clips/${normalizedClipId}`, {
    method: 'PATCH',
    body: toClipContractPayload(metadata),
  })

  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    throw createUploadError(
      resolveApiErrorMessage(payload, `Failed to update clip metadata (${response.status})`),
      {
        status: response.status,
        stage: 'metadata',
      }
    )
  }

  return payload?.clip || null
}

function toClipContractPayload(metadata = {}) {
  const genreIds = normalizeGenreIds(metadata.genreIds)

  return {
    title: metadata.title,
    description: metadata.description,
    clipDescription: metadata.clipDescription || metadata.description || '',
    watchUrl: metadata.watchUrl || '#',
    genreIds,
    rating: normalizeRating(metadata.rating),
    durationSec: Number(metadata.durationSec) || 0,
    videoUrl: metadata.videoUrl,
    thumbnailUrl: metadata.thumbnailUrl,
    status: metadata.status || 'draft',
  }
}

function isRetryableError(error) {
  return RETRYABLE_STATUS_CODES.has(Number(error?.status))
}

export async function uploadClipWithMetadata({ file, metadata, maxAttempts = 3 }) {
  const attemptLimit = Number(maxAttempts) > 0 ? Number(maxAttempts) : DEFAULT_MAX_ATTEMPTS
  const notifyProgress =
    typeof metadata?.onUploadProgress === 'function' ? metadata.onUploadProgress : null
  const uploadUrlPayload = await requestUploadUrl(file)

  let attempt = 0
  let lastError = null

  while (attempt < attemptLimit) {
    attempt += 1

    try {
      notifyProgress?.({ stage: 'uploading', attempt, maxAttempts: attemptLimit })

      await uploadFile({
        file,
        uploadUrl: uploadUrlPayload.uploadUrl,
        requiredHeaders: uploadUrlPayload.requiredHeaders,
      })

      notifyProgress?.({ stage: 'finalizing', attempt, maxAttempts: attemptLimit })

      const clip = await createClipMetadata({
        ...toClipContractPayload(metadata),
        objectKey: uploadUrlPayload.objectKey,
        uploadId: uploadUrlPayload.uploadId,
      })

      notifyProgress?.({ stage: 'done', attempt, maxAttempts: attemptLimit })

      return {
        clip,
        uploadId: uploadUrlPayload.uploadId || null,
        objectKey: uploadUrlPayload.objectKey,
        attemptsUsed: attempt,
      }
    } catch (error) {
      lastError = error

      notifyProgress?.({
        stage: 'retrying',
        attempt,
        maxAttempts: attemptLimit,
        message: error?.message || '',
      })

      if (!isRetryableError(error) || attempt >= attemptLimit) {
        break
      }
    }
  }

  throw new Error(
    lastError?.message
      ? `${lastError.message}. Attempts used: ${attemptLimit}`
      : `Upload failed after ${attemptLimit} attempts`
  )
}
