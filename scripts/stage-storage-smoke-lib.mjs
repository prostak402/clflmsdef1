import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

export const JSON_HEADERS = { 'Content-Type': 'application/json' }
export const DEFAULT_PREFIX = 'codex-stage-smoke'

export function requireEnv(env, name) {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(name + ' is required')
  }
  return value
}

export function normalizeApiBaseUrl(rawValue) {
  const url = new URL(rawValue)
  const pathname =
    url.pathname.endsWith('/') && url.pathname.length > 1 ? url.pathname.slice(0, -1) : url.pathname

  if (!pathname || pathname === '/') {
    url.pathname = '/api/v1'
  } else if (!pathname.endsWith('/api/v1')) {
    url.pathname = pathname + '/api/v1'
  } else {
    url.pathname = pathname
  }

  return url.toString().replace(/\/$/, '')
}

export function readStageSmokeEnv(env = process.env) {
  const apiBaseUrl = normalizeApiBaseUrl(requireEnv(env, 'STAGE_API_BASE_URL'))
  const token = requireEnv(env, 'STAGE_API_TOKEN')
  const clipPrefix = (env.STAGE_SMOKE_CLIP_PREFIX || DEFAULT_PREFIX).trim() || DEFAULT_PREFIX

  return {
    apiBaseUrl,
    apiUrl: new URL(apiBaseUrl),
    token,
    clipPrefix,
  }
}

export function createStageSmokeRunId({ now = new Date(), createUuid = randomUUID } = {}) {
  return (
    now
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14) +
    '-' +
    createUuid().slice(0, 8)
  )
}

export function buildStageSmokeContext({
  env = process.env,
  now = new Date(),
  createUuid = randomUUID,
} = {}) {
  const { apiBaseUrl, apiUrl, token, clipPrefix } = readStageSmokeEnv(env)
  const runId = createStageSmokeRunId({ now, createUuid })
  const clipSlug = clipPrefix + '-' + runId
  const uploadBytes = Buffer.from('stage-storage-smoke:' + clipSlug)

  return {
    apiBaseUrl,
    apiUrl,
    token,
    clipPrefix,
    runId,
    clipSlug,
    uploadBytes,
  }
}

export function ensureOk(response, message) {
  if (!response.ok) {
    throw new Error(message + ': ' + response.status)
  }
}

export async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function request(
  apiBaseUrl,
  path,
  fetchImpl,
  { method = 'GET', token, body, headers } = {}
) {
  const response = await fetchImpl(apiBaseUrl + path, {
    method,
    headers: {
      ...(body === undefined ? {} : JSON_HEADERS),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return {
    response,
    payload: await readJson(response),
  }
}

export async function runStageStorageSmoke({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
  now = new Date(),
  createUuid = randomUUID,
} = {}) {
  const context = buildStageSmokeContext({ env, now, createUuid })
  const { apiBaseUrl, apiUrl, token, clipSlug, uploadBytes } = context

  let clipId = null
  let failure = null

  try {
    const uploadRequest = await request(apiBaseUrl, '/admin/clips/upload-url', fetchImpl, {
      method: 'POST',
      token,
      body: {
        fileName: clipSlug + '.mp4',
        contentType: 'video/mp4',
        size: uploadBytes.length,
      },
    })
    ensureOk(uploadRequest.response, 'stage upload-url failed')

    if (
      !uploadRequest.payload?.uploadId ||
      !uploadRequest.payload?.objectKey ||
      !uploadRequest.payload?.uploadUrl
    ) {
      throw new Error('stage upload-url response is missing required fields')
    }

    const uploadUrl = new URL(uploadRequest.payload.uploadUrl)
    if (
      uploadUrl.origin === apiUrl.origin &&
      uploadUrl.pathname.startsWith(apiUrl.pathname + '/uploads/')
    ) {
      throw new Error(
        'stage upload-url returned local API upload path instead of presigned storage URL'
      )
    }

    const putResponse = await fetchImpl(uploadRequest.payload.uploadUrl, {
      method: 'PUT',
      headers: uploadRequest.payload.requiredHeaders || { 'Content-Type': 'video/mp4' },
      body: uploadBytes,
    })
    ensureOk(putResponse, 'stage upload PUT failed')

    const createRequest = await request(apiBaseUrl, '/admin/clips', fetchImpl, {
      method: 'POST',
      token,
      body: {
        uploadId: uploadRequest.payload.uploadId,
        objectKey: uploadRequest.payload.objectKey,
        title: clipSlug,
        description: 'Created by stage storage smoke',
        clipDescription: 'Created by stage storage smoke',
        watchUrl: 'https://example.com/watch/' + clipSlug,
        genreIds: ['drama', 'thriller'],
        rating: 7.5,
        durationSec: 15,
        status: 'draft',
      },
    })
    ensureOk(createRequest.response, 'stage clip create failed')

    clipId = createRequest.payload?.clip?.id
    if (!clipId) {
      throw new Error('stage clip create response is missing clip id')
    }

    const videoUrl = createRequest.payload?.clip?.videoUrl
    if (!videoUrl) {
      throw new Error('stage clip create response is missing videoUrl')
    }

    const videoResponse = await fetchImpl(videoUrl)
    ensureOk(videoResponse, 'stage videoUrl read failed')
    const videoBytes = Buffer.from(await videoResponse.arrayBuffer())
    if (!videoBytes.equals(uploadBytes)) {
      throw new Error('stage videoUrl did not return the uploaded bytes')
    }

    logger.info('smoke:stage created clip ' + clipId + ' with title ' + clipSlug)
  } catch (error) {
    failure = error
  } finally {
    if (clipId) {
      try {
        const archiveRequest = await request(apiBaseUrl, '/admin/clips/' + clipId, fetchImpl, {
          method: 'PATCH',
          token,
          body: { status: 'archived' },
        })
        ensureOk(archiveRequest.response, 'stage clip archive failed')

        if (archiveRequest.payload?.clip?.status !== 'archived') {
          throw new Error('stage clip archive response did not preserve archived status')
        }

        logger.info('smoke:stage archived clip ' + clipId)
      } catch (cleanupError) {
        if (failure) {
          failure = new Error(failure.message + '\nCleanup failed: ' + cleanupError.message)
        } else {
          failure = cleanupError
        }
      }
    }
  }

  if (failure) {
    throw failure
  }

  logger.info('smoke:stage passed')
}
