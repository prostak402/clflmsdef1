import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const PORT = Number(process.env.PORT || 8787)
const API_PREFIX = process.env.API_PREFIX || '/api/v1'
const S3_BUCKET = process.env.S3_BUCKET
const S3_REGION = process.env.S3_REGION || 'us-east-1'
const S3_ENDPOINT = process.env.S3_ENDPOINT
const S3_FORCE_PATH_STYLE = String(process.env.S3_FORCE_PATH_STYLE || 'true') === 'true'
const MAX_CLIP_SIZE_BYTES = Number(process.env.MAX_CLIP_SIZE_BYTES || 250 * 1024 * 1024)
const ALLOWED_VIDEO_TYPES = (
  process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/webm,video/quicktime'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (!S3_BUCKET) {
  throw new Error('Missing required env: S3_BUCKET')
}

const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT || undefined,
  forcePathStyle: S3_FORCE_PATH_STYLE,
})

const clips = []

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(new Error('Invalid JSON body', { cause: error }))
      }
    })
    req.on('error', reject)
  })
}

function validateClipFile({ contentType, size }) {
  if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
    return `Unsupported file type: ${contentType}`
  }

  if (!Number.isFinite(size) || size <= 0) {
    return 'File size must be a positive number'
  }

  if (size > MAX_CLIP_SIZE_BYTES) {
    return `File is too large. Max allowed size is ${MAX_CLIP_SIZE_BYTES} bytes`
  }

  return null
}

async function handleCreatePresignedUpload(body, res) {
  const fileName =
    typeof body?.fileName === 'string' && body.fileName.trim() ? body.fileName.trim() : ''
  const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : ''
  const size = Number(body?.size)

  const validationError = validateClipFile({ contentType, size })
  if (validationError) {
    sendJson(res, 400, { error: { message: validationError } })
    return
  }

  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''
  const objectKey = `clips/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: size,
    Metadata: {
      'max-size': String(MAX_CLIP_SIZE_BYTES),
    },
  })

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 })

  sendJson(res, 200, {
    objectKey,
    uploadUrl,
    expiresIn: 900,
    requiredHeaders: {
      'Content-Type': contentType,
    },
  })
}

async function handleCreateClipMetadata(body, res) {
  const requiredFields = ['title', 'description', 'clipDescription', 'watchUrl', 'objectKey']
  const missing = requiredFields.filter((field) => {
    const value = body?.[field]
    return typeof value !== 'string' || !value.trim()
  })

  if (missing.length > 0) {
    sendJson(res, 400, { error: { message: `Missing fields: ${missing.join(', ')}` } })
    return
  }

  const objectKey = body.objectKey.trim()

  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: objectKey,
      })
    )
  } catch {
    sendJson(res, 400, { error: { message: 'Uploaded object is not found in storage' } })
    return
  }

  const clip = {
    id: `clip_${randomUUID()}`,
    title: body.title.trim(),
    description: body.description.trim(),
    clipDescription: body.clipDescription.trim(),
    watchUrl: body.watchUrl.trim(),
    genres: Array.isArray(body.genres) ? body.genres : [],
    director: typeof body.director === 'string' ? body.director.trim() : '',
    duration: typeof body.duration === 'string' ? body.duration.trim() : '',
    year: typeof body.year === 'string' ? body.year.trim() : '',
    kinopoiskId: typeof body.kinopoiskId === 'string' ? body.kinopoiskId.trim() : '',
    objectKey,
    createdAt: new Date().toISOString(),
  }

  clips.unshift(clip)
  sendJson(res, 201, { clip })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/admin/clips/upload-url`) {
      const body = await readBody(req)
      await handleCreatePresignedUpload(body, res)
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/admin/clips`) {
      const body = await readBody(req)
      await handleCreateClipMetadata(body, res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/admin/clips`) {
      sendJson(res, 200, { items: clips })
      return
    }

    sendJson(res, 404, { error: { message: 'Not found' } })
  } catch (error) {
    sendJson(res, 500, {
      error: { message: error instanceof Error ? error.message : 'Unknown error' },
    })
  }
})

server.listen(PORT, () => {
  console.info(`Admin upload API is listening on :${PORT}`)
})
