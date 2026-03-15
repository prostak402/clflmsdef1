import path from 'node:path'

import { createLocalStorageAdapter } from './local-storage-adapter.mjs'
import { createS3StorageAdapter } from './s3-storage-adapter.mjs'

const DEFAULT_UPLOAD_EXPIRES_IN = 900

function normalizeProvider(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 's3' ? 's3' : 'local'
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

export function resolveStorageConfig(env = process.env) {
  const provider = normalizeProvider(env.STORAGE_PROVIDER)
  const uploadExpiresIn = normalizePositiveInteger(
    env.STORAGE_UPLOAD_EXPIRES_IN,
    DEFAULT_UPLOAD_EXPIRES_IN
  )

  return {
    provider,
    uploadExpiresIn,
    localRootDir: path.resolve(env.LOCAL_STORAGE_ROOT || '.clipflow-storage'),
    s3: {
      bucket: typeof env.S3_BUCKET === 'string' ? env.S3_BUCKET.trim() : '',
      region:
        typeof env.S3_REGION === 'string' && env.S3_REGION.trim()
          ? env.S3_REGION.trim()
          : 'us-east-1',
      endpoint: typeof env.S3_ENDPOINT === 'string' ? env.S3_ENDPOINT.trim() : '',
      accessKeyId: typeof env.S3_ACCESS_KEY_ID === 'string' ? env.S3_ACCESS_KEY_ID.trim() : '',
      secretAccessKey:
        typeof env.S3_SECRET_ACCESS_KEY === 'string' ? env.S3_SECRET_ACCESS_KEY.trim() : '',
      sessionToken: typeof env.S3_SESSION_TOKEN === 'string' ? env.S3_SESSION_TOKEN.trim() : '',
      publicBaseUrl:
        typeof env.S3_PUBLIC_BASE_URL === 'string' ? env.S3_PUBLIC_BASE_URL.trim() : '',
      forcePathStyle: normalizeBoolean(env.S3_FORCE_PATH_STYLE, false),
    },
  }
}

export function createStorageAdapter({ env = process.env, apiPrefix, getOrigin }) {
  const config = resolveStorageConfig(env)

  if (config.provider === 's3') {
    return createS3StorageAdapter({
      apiPrefix,
      config,
      getOrigin,
    })
  }

  return createLocalStorageAdapter({
    apiPrefix,
    config,
    getOrigin,
  })
}
