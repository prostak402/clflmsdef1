const API_PREFIX = '/api/v1'
const DEFAULT_API_ORIGIN = 'http://localhost:8787'

function normalizeBaseUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  const normalized = trimmed || DEFAULT_API_ORIGIN

  return normalized.replace(/\/$/, '')
}

export function getApiBaseUrl() {
  const baseUrl = normalizeBaseUrl(import.meta.env?.VITE_API_BASE_URL)

  if (baseUrl.endsWith(API_PREFIX)) {
    return baseUrl
  }

  return `${baseUrl}${API_PREFIX}`
}

export function buildApiUrl(path, query) {
  const url = new URL(`${getApiBaseUrl()}${path}`)

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          url.searchParams.append(key, String(item))
        })
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

export async function parseJsonResponse(response) {
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

export function resolveApiErrorMessage(payload, fallbackMessage = 'API request failed') {
  const message = payload?.error?.message || payload?.message

  if (typeof message === 'string' && message.trim()) {
    return message.trim()
  }

  return fallbackMessage
}

export function createApiError(message, details = {}) {
  const error = new Error(message)
  Object.assign(error, details)
  return error
}

export async function requestJson(path, { method = 'GET', query, body, headers } = {}) {
  let response

  try {
    response = await fetch(buildApiUrl(path, query), {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw createApiError(`Network request failed for ${method} ${path}`, { cause: error })
  }

  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    throw createApiError(`${resolveApiErrorMessage(payload)} (${response.status})`, {
      status: response.status,
      payload,
    })
  }

  return payload
}

export { API_PREFIX, DEFAULT_API_ORIGIN }
