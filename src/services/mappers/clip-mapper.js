const FALLBACK_EXTERNAL_URL = '#'
const FALLBACK_THUMBNAIL = 'https://placehold.co/400x600?text=No+Preview'

function safeString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDurationLabelToSec(value) {
  if (typeof value !== 'string') {
    return 0
  }

  const hoursMatch = value.match(/(\d+)\s*h/i)
  const minutesMatch = value.match(/(\d+)\s*m/i)
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0

  return Math.max(0, hours * 3600 + minutes * 60)
}

function formatDurationLabel(durationSec) {
  const totalSeconds = Math.max(0, safeNumber(durationSec, 0))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m`
  }

  return '—'
}

function resolveGenreId(entity) {
  if (typeof entity?.genreId === 'string' && entity.genreId.trim()) {
    return entity.genreId.trim()
  }

  if (Array.isArray(entity?.genres) && entity.genres.length > 0) {
    const firstGenre = entity.genres.find((genre) => typeof genre === 'string' && genre.trim())
    return firstGenre ? firstGenre.trim() : 'unknown'
  }

  return 'unknown'
}

export function toClipUiModel(entity, genreLookup = {}) {
  const genreId = resolveGenreId(entity)
  const genreMeta = genreLookup[genreId]
  const durationSec = safeNumber(entity?.durationSec, parseDurationLabelToSec(entity?.duration))

  return {
    id: safeString(entity?.id),
    title: safeString(entity?.title, 'Untitled clip'),
    description: safeString(entity?.description || entity?.clipDescription),
    thumbnailUrl: safeString(entity?.thumbnailUrl || entity?.poster, FALLBACK_THUMBNAIL),
    videoUrl: safeString(entity?.videoUrl || entity?.clipUrl),
    externalUrl: safeString(entity?.externalUrl || entity?.watchUrl, FALLBACK_EXTERNAL_URL),
    durationSec,
    durationLabel: formatDurationLabel(durationSec),
    genreId,
    genreName: genreMeta?.name || 'Unknown',
    likesCount: safeNumber(entity?.likesCount, safeNumber(entity?.likes)),
    commentsCount: safeNumber(entity?.commentsCount, safeNumber(entity?.comments)),
    sharesCount: safeNumber(entity?.sharesCount, safeNumber(entity?.shares)),
    bookmarksCount: safeNumber(entity?.bookmarksCount, safeNumber(entity?.bookmarks)),
    status: safeString(entity?.status, 'draft'),
  }
}

export function toClipUiList(items = [], genreLookup = {}) {
  const safeItems = Array.isArray(items) ? items : []
  return safeItems.map((item) => toClipUiModel(item, genreLookup))
}
