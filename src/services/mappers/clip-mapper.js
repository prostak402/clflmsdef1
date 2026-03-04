const FALLBACK_EXTERNAL_URL = '#'
const FALLBACK_THUMBNAIL = 'https://placehold.co/400x600?text=No+Preview'

function safeString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

  return 'unknown'
}

export function toClipUiModel(entity, genreLookup = {}) {
  const genreId = resolveGenreId(entity)
  const genreMeta = genreLookup[genreId]
  const durationSec = safeNumber(entity?.durationSec, 0)

  return {
    id: safeString(entity?.id),
    title: safeString(entity?.title, 'Untitled clip'),
    description: safeString(entity?.description),
    thumbnailUrl: safeString(entity?.thumbnailUrl, FALLBACK_THUMBNAIL),
    videoUrl: safeString(entity?.videoUrl),
    externalUrl: safeString(entity?.externalUrl, FALLBACK_EXTERNAL_URL),
    durationSec,
    durationLabel: formatDurationLabel(durationSec),
    genreId,
    genreName: genreMeta?.name || 'Unknown',
    likesCount: safeNumber(entity?.likesCount, 0),
    commentsCount: safeNumber(entity?.commentsCount, 0),
    sharesCount: safeNumber(entity?.sharesCount, 0),
    bookmarksCount: safeNumber(entity?.bookmarksCount, 0),
    status: safeString(entity?.status, 'draft'),
  }
}

export function toClipUiList(items = [], genreLookup = {}) {
  const safeItems = Array.isArray(items) ? items : []
  return safeItems.map((item) => toClipUiModel(item, genreLookup))
}
