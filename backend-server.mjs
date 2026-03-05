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
const CORS_ALLOWED_ORIGINS = (
  process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const CORS_ALLOW_CREDENTIALS = String(process.env.CORS_ALLOW_CREDENTIALS || 'true') === 'true'
const ALLOWED_VIDEO_TYPES = (
  process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/webm,video/quicktime'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const s3Client = S3_BUCKET
  ? new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: S3_FORCE_PATH_STYLE,
    })
  : null

const now = new Date()
const currentUser = {
  id: 'usr_local_demo',
  email: 'user@local.dev',
  displayName: 'Local User',
  avatarUrl: null,
  role: 'user',
  hasCompletedOnboarding: true,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}

const adminUser = {
  ...currentUser,
  id: 'usr_local_admin',
  email: 'admin@local.dev',
  displayName: 'Local Admin',
  role: 'admin',
}

const clips = [
  {
    id: 'clip_1',
    title: 'Interstellar docking',
    description: 'Docking sequence highlight',
    clipDescription: 'Docking sequence highlight',
    thumbnailUrl: 'https://placehold.co/600x800?text=Interstellar',
    videoUrl: 'https://example.com/video/interstellar',
    watchUrl: 'https://example.com/watch/interstellar',
    durationSec: 180,
    genreId: 'sci-fi',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    bookmarksCount: 0,
    createdAt: new Date(now.getTime() - 3600 * 1000).toISOString(),
  },
  {
    id: 'clip_2',
    title: 'Whiplash rehearsal',
    description: 'Not quite my tempo',
    clipDescription: 'Not quite my tempo',
    thumbnailUrl: 'https://placehold.co/600x800?text=Whiplash',
    videoUrl: 'https://example.com/video/whiplash',
    watchUrl: 'https://example.com/watch/whiplash',
    durationSec: 95,
    genreId: 'drama',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    bookmarksCount: 0,
    createdAt: new Date(now.getTime() - 1800 * 1000).toISOString(),
  },
]

const comments = [
  {
    id: 'cm_1',
    clipId: 'clip_1',
    authorId: 'usr_local_demo',
    authorName: 'Local User',
    avatar: '🎬',
    text: 'Great sequence',
    likes: 0,
    createdAt: new Date(now.getTime() - 300 * 1000).toISOString(),
    moderationStatus: 'approved',
    isHidden: false,
    reportsCount: 0,
  },
]

const likesByUser = {
  [currentUser.id]: new Set(),
  [adminUser.id]: new Set(),
}

const bookmarksByUser = {
  [currentUser.id]: new Set(),
  [adminUser.id]: new Set(),
}

const blockedUsers = {}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

function getCorsOrigin(req) {
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : ''
  if (!requestOrigin) {
    return CORS_ALLOWED_ORIGINS[0] || 'http://localhost:5173'
  }

  if (CORS_ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin
  }

  return null
}

function applyCorsHeaders(req, res) {
  const corsOrigin = getCorsOrigin(req)
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  }
  res.setHeader('Vary', 'Origin')
  if (CORS_ALLOW_CREDENTIALS) {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
}

function sendError(res, statusCode, message, code = 'BAD_REQUEST') {
  sendJson(res, statusCode, {
    error: {
      code,
      message,
      requestId: randomUUID(),
    },
  })
}

function getRequestUser(req) {
  const token = String(req.headers.authorization || '')
  if (token.toLowerCase().includes('admin')) {
    return adminUser
  }

  return currentUser
}

function getSet(map, userId) {
  if (!map[userId]) {
    map[userId] = new Set()
  }

  return map[userId]
}

function summarizeLikes(set) {
  return [...set].reduce((acc, clipId) => {
    acc[clipId] = true
    return acc
  }, {})
}

function hydrateClipCounters() {
  clips.forEach((clip) => {
    clip.likesCount = Object.values(likesByUser).reduce(
      (count, likedClipSet) => count + (likedClipSet.has(clip.id) ? 1 : 0),
      0
    )
    clip.bookmarksCount = Object.values(bookmarksByUser).reduce(
      (count, bookmarkedClipSet) => count + (bookmarkedClipSet.has(clip.id) ? 1 : 0),
      0
    )
    clip.commentsCount = comments.filter(
      (comment) => comment.clipId === clip.id && !comment.isHidden
    ).length
  })
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
  if (!s3Client || !S3_BUCKET) {
    sendError(res, 503, 'Upload storage is not configured', 'SERVICE_UNAVAILABLE')
    return
  }
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
  const normalizedGenreIds = normalizeGenreIds(
    Array.isArray(body?.genreIds) ? body.genreIds : body?.genres
  )

  if (
    (Array.isArray(body?.genreIds) || Array.isArray(body?.genres)) &&
    normalizedGenreIds.length === 0
  ) {
    sendJson(res, 400, {
      error: { message: 'genreIds/genres must be a non-empty array of strings' },
    })
    return
  }

  const fallbackGenreId =
    typeof body?.genreId === 'string' && body.genreId.trim() ? body.genreId.trim() : null
  const genres =
    normalizedGenreIds.length > 0
      ? normalizedGenreIds
      : fallbackGenreId
        ? [fallbackGenreId]
        : ['unknown']
  const genreId = genres[0]

  if (s3Client && S3_BUCKET) {
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
  }

  const clip = {
    id: `clip_${randomUUID()}`,
    title: body.title.trim(),
    description: body.description.trim(),
    clipDescription: body.clipDescription.trim(),
    watchUrl: body.watchUrl.trim(),
    genreId,
    genres,
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

function normalizeGenreIds(values) {
  if (!Array.isArray(values)) {
    return []
  }

  return [
    ...new Set(
      values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
    ),
  ]
}

function resolveClipGenreIds(clip) {
  const normalizedGenres = normalizeGenreIds(clip?.genres)
  if (normalizedGenres.length > 0) {
    return normalizedGenres
  }

  if (typeof clip?.genreId === 'string' && clip.genreId.trim()) {
    return [clip.genreId.trim()]
  }

  return ['unknown']
}


function updateClipById(clipId, patch) {
  const targetIndex = clips.findIndex((clip) => clip.id === clipId)
  if (targetIndex < 0) {
    return null
  }

  const target = clips[targetIndex]
  const genres = normalizeGenreIds(Array.isArray(patch?.genreIds) ? patch.genreIds : patch?.genres)
  const fallbackGenreId =
    typeof patch?.genreId === 'string' && patch.genreId.trim() ? patch.genreId.trim() : ''

  const nextClip = {
    ...target,
    ...(typeof patch?.title === 'string' ? { title: patch.title.trim() } : {}),
    ...(typeof patch?.description === 'string' ? { description: patch.description.trim() } : {}),
    ...(typeof patch?.clipDescription === 'string'
      ? { clipDescription: patch.clipDescription.trim() }
      : {}),
    ...(typeof patch?.watchUrl === 'string' ? { watchUrl: patch.watchUrl.trim() } : {}),
    ...(typeof patch?.externalUrl === 'string' ? { externalUrl: patch.externalUrl.trim() } : {}),
    ...(typeof patch?.thumbnailUrl === 'string' ? { thumbnailUrl: patch.thumbnailUrl.trim() } : {}),
    ...(typeof patch?.videoUrl === 'string' ? { videoUrl: patch.videoUrl.trim() } : {}),
    ...(typeof patch?.duration === 'string' ? { duration: patch.duration.trim() } : {}),
    ...(typeof patch?.kinopoiskId === 'string' ? { kinopoiskId: patch.kinopoiskId.trim() } : {}),
    ...(Number.isFinite(Number(patch?.durationSec))
      ? { durationSec: Number(patch.durationSec) }
      : {}),
  }

  if (genres.length > 0) {
    nextClip.genres = genres
    nextClip.genreId = genres[0]
  } else if (fallbackGenreId) {
    nextClip.genreId = fallbackGenreId
    nextClip.genres = [fallbackGenreId]
  }

  clips[targetIndex] = nextClip
  return nextClip
}

function deleteClipById(clipId) {
  const targetIndex = clips.findIndex((clip) => clip.id === clipId)
  if (targetIndex < 0) {
    return false
  }

  clips.splice(targetIndex, 1)

  comments
    .filter((comment) => comment.clipId === clipId)
    .forEach((comment) => {
      const idx = comments.findIndex((row) => row.id === comment.id)
      if (idx >= 0) {
        comments.splice(idx, 1)
      }
    })

  Object.values(likesByUser).forEach((set) => set.delete(clipId))
  Object.values(bookmarksByUser).forEach((set) => set.delete(clipId))

  return true
}

function handleFeedRead(url, res) {
  const selectedGenreIds = [
    ...url.searchParams.getAll('genreId'),
    ...url.searchParams.getAll('genre'),
  ].filter(Boolean)

  hydrateClipCounters()

  const items = clips
    .filter((clip) => {
      if (selectedGenreIds.length === 0) {
        return true
      }

      const clipGenreIds = resolveClipGenreIds(clip)
      return clipGenreIds.some((genreId) => selectedGenreIds.includes(genreId))
    })
    .map((clip) => {
      const clipGenreIds = resolveClipGenreIds(clip)
      return {
        ...clip,
        genreId: clipGenreIds[0],
        genres: clipGenreIds,
      }
    })

  sendJson(res, 200, { items, nextCursor: null })
}

function handleGlobalCommentsRead(res) {
  const items = comments.filter((comment) => !comment.isHidden)
  sendJson(res, 200, { items })
}

function handleModerationCommentsRead(res) {
  sendJson(res, 200, { items: comments })
}

const server = http.createServer(async (req, res) => {
  try {
    applyCorsHeaders(req, res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const user = getRequestUser(req)

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/feed/clips`) {
      handleFeedRead(url, res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/comments`) {
      handleGlobalCommentsRead(res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/me/bookmarks`) {
      const bookmarkIds = getSet(bookmarksByUser, user.id)
      const items = clips.filter((clip) => bookmarkIds.has(clip.id))
      sendJson(res, 200, { items })
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/me`) {
      sendJson(res, 200, user)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/moderation/comments`) {
      handleModerationCommentsRead(res)
      return
    }

    const likeMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/clips/([^/]+)/like$`))
    if (likeMatch) {
      const clipId = likeMatch[1]
      const likes = getSet(likesByUser, user.id)

      if (req.method === 'POST') {
        likes.add(clipId)
      }

      if (req.method === 'DELETE') {
        likes.delete(clipId)
      }

      if (req.method === 'POST' || req.method === 'DELETE') {
        hydrateClipCounters()
        sendJson(res, 200, { likes: summarizeLikes(likes) })
        return
      }
    }

    const bookmarkMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/clips/([^/]+)/bookmark$`))
    if (bookmarkMatch) {
      const clipId = bookmarkMatch[1]
      const bookmarks = getSet(bookmarksByUser, user.id)

      if (req.method === 'POST') {
        bookmarks.add(clipId)
      }

      if (req.method === 'DELETE') {
        bookmarks.delete(clipId)
      }

      if (req.method === 'POST' || req.method === 'DELETE') {
        hydrateClipCounters()
        sendJson(res, 200, { bookmarks: [...bookmarks] })
        return
      }
    }

    const createCommentMatch = url.pathname.match(
      new RegExp(`^${API_PREFIX}/clips/([^/]+)/comments$`)
    )
    if (req.method === 'POST' && createCommentMatch) {
      const clipId = createCommentMatch[1]
      const body = await readBody(req)
      const text = typeof body?.body === 'string' ? body.body.trim() : ''

      if (!text) {
        sendError(res, 422, 'Comment body is required', 'VALIDATION_ERROR')
        return
      }

      const comment = {
        id: `cm_${randomUUID()}`,
        clipId,
        authorId: user.id,
        authorName:
          typeof body?.userName === 'string' && body.userName.trim()
            ? body.userName.trim()
            : user.displayName,
        avatar: '👤',
        text,
        likes: 0,
        createdAt: new Date().toISOString(),
        moderationStatus: 'approved',
        isHidden: false,
        reportsCount: 0,
      }

      comments.unshift(comment)
      hydrateClipCounters()
      sendJson(res, 201, { comment })
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/moderation/comments/block-user`) {
      const body = await readBody(req)
      const authorId = typeof body?.authorId === 'string' ? body.authorId.trim() : ''

      if (!authorId) {
        sendError(res, 422, 'authorId is required', 'VALIDATION_ERROR')
        return
      }

      blockedUsers[authorId] = Boolean(body?.isBlocked)
      comments.forEach((comment) => {
        if (comment.authorId === authorId) {
          comment.isHidden = Boolean(body?.isBlocked)
          comment.moderationStatus = body?.isBlocked ? 'rejected' : 'approved'
        }
      })
      hydrateClipCounters()
      sendJson(res, 200, { blockedUsers })
      return
    }

    const moderationDeleteCommentMatch = url.pathname.match(
      new RegExp(`^${API_PREFIX}/moderation/comments/([^/]+)$`)
    )
    if (req.method === 'DELETE' && moderationDeleteCommentMatch) {
      const commentId = moderationDeleteCommentMatch[1]
      const targetIndex = comments.findIndex((comment) => comment.id === commentId)

      if (targetIndex < 0) {
        sendError(res, 404, 'Comment not found', 'NOT_FOUND')
        return
      }

      comments.splice(targetIndex, 1)
      hydrateClipCounters()
      sendJson(res, 200, { ok: true })
      return
    }

    const moderationDeleteByUserMatch = url.pathname.match(
      new RegExp(`^${API_PREFIX}/moderation/comments/by-user/([^/]+)$`)
    )
    if (req.method === 'DELETE' && moderationDeleteByUserMatch) {
      const authorId = moderationDeleteByUserMatch[1]
      const filtered = comments.filter((comment) => comment.authorId !== authorId)
      comments.length = 0
      comments.push(...filtered)
      hydrateClipCounters()
      sendJson(res, 200, { ok: true })
      return
    }

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


    const adminClipMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/admin/clips/([^/]+)$`))
    if (adminClipMatch && req.method === 'PATCH') {
      const clipId = adminClipMatch[1]
      const body = await readBody(req)
      const updatedClip = updateClipById(clipId, body)

      if (!updatedClip) {
        sendError(res, 404, 'Clip not found', 'NOT_FOUND')
        return
      }

      sendJson(res, 200, { clip: updatedClip })
      return
    }

    if (adminClipMatch && req.method === 'DELETE') {
      const clipId = adminClipMatch[1]
      const removed = deleteClipById(clipId)

      if (!removed) {
        sendError(res, 404, 'Clip not found', 'NOT_FOUND')
        return
      }

      hydrateClipCounters()
      sendJson(res, 200, { ok: true })
      return
    }

    sendError(res, 404, 'Not found', 'NOT_FOUND')
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : 'Unknown error', 'INTERNAL_ERROR')
  }
})

server.listen(PORT, () => {
  console.info(`Admin upload API is listening on :${PORT}`)
})
