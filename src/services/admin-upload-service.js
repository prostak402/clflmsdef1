const DEFAULT_API_BASE_URL = '/api/v1'
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

function getApiBaseUrl() {
  const raw = import.meta.env?.VITE_API_BASE_URL

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return DEFAULT_API_BASE_URL
  }

  return raw.trim().replace(/\/$/, '')
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
      contentType: file.type,
      size: file.size,
    }),
  })

  const payload = await parseJsonSafe(response)

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, `Failed to create upload URL (${response.status})`))
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
    const error = new Error(`Upload failed with status ${response.status}`)
    error.status = response.status
    throw error
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
    throw new Error(parseErrorMessage(payload, `Failed to save clip metadata (${response.status})`))
  }

  return payload?.clip || null
}

function isRetryableError(error) {
  return RETRYABLE_STATUS_CODES.has(Number(error?.status))
}

export async function uploadClipWithMetadata({ file, metadata, maxAttempts = 3 }) {
  const uploadUrlPayload = await requestUploadUrl(file)

  let attempt = 0
  let lastError = null

  while (attempt < maxAttempts) {
    attempt += 1

    try {
      await uploadFile({
        file,
        uploadUrl: uploadUrlPayload.uploadUrl,
        requiredHeaders: uploadUrlPayload.requiredHeaders,
      })

      const clip = await createClipMetadata({
        ...metadata,
        objectKey: uploadUrlPayload.objectKey,
      })

      return {
        clip,
        objectKey: uploadUrlPayload.objectKey,
        attemptsUsed: attempt,
      }
    } catch (error) {
      lastError = error

      if (!isRetryableError(error) || attempt >= maxAttempts) {
        break
      }
    }
  }

  throw new Error(
    lastError?.message
      ? `${lastError.message}. Attempts used: ${maxAttempts}`
      : `Upload failed after ${maxAttempts} attempts`
  )
}
