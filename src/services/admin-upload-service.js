const API_PREFIX = '/api/v1'
const DEFAULT_API_BASE_URL = API_PREFIX
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const DEFAULT_MAX_ATTEMPTS = 3

function getApiBaseUrl() {
  const raw = import.meta.env?.VITE_API_BASE_URL

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return DEFAULT_API_BASE_URL
  }

  const normalizedBaseUrl = raw.trim().replace(/\/$/, '')

  if (normalizedBaseUrl.endsWith(API_PREFIX)) {
    return normalizedBaseUrl
  }

  return `${normalizedBaseUrl}${API_PREFIX}`
}

function buildApiUrl(path) {
  return `${getApiBaseUrl()}${path}`
}

async function parseJsonSafe(response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function parseErrorMessage(payload, fallbackMessage) {
  return payload?.error?.message || payload?.message || fallbackMessage
}

function createUploadError(message, details = {}) {
  const error = new Error(message)
  Object.assign(error, details)
  return error
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
  const response = await fetch(buildApiUrl('/admin/clips/upload-url'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      contentType: file.type,
      size: file.size,
    }),
  })

  const payload = await parseJsonSafe(response)

  if (!response.ok) {
    throw createUploadError(
      parseErrorMessage(payload, `Failed to create upload session (${response.status})`),
      {
        status: response.status,
        stage: 'initiate',
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
  const response = await fetch(buildApiUrl('/admin/clips'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })

  const payload = await parseJsonSafe(response)

  if (!response.ok) {
    throw createUploadError(
      parseErrorMessage(payload, `Failed to save clip metadata (${response.status})`),
      {
        status: response.status,
        stage: 'metadata',
      }
    )
  }

  return payload?.clip || null
}

function toClipContractPayload(metadata = {}) {
  return {
    title: metadata.title,
    description: metadata.description,
    clipDescription: metadata.clipDescription || metadata.description || '',
    watchUrl: metadata.watchUrl || metadata.externalUrl || '#',
    genreId: metadata.genreId,
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
        uploadToken: uploadUrlPayload.uploadToken,
        uploadId: uploadUrlPayload.uploadId,
      })

      notifyProgress?.({ stage: 'done', attempt, maxAttempts: attemptLimit })

      return {
        clip,
        uploadId: uploadUrlPayload.uploadId || uploadUrlPayload.uploadToken || null,
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
