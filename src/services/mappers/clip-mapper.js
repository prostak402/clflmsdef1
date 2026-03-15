const FALLBACK_WATCH_URL = '#'
const FALLBACK_THUMBNAIL = 'https://placehold.co/400x600?text=No+Preview'

function safeString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeRating(value, fallback = null) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    return fallback
  }

  return Math.round(parsed * 10) / 10
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

  return '-'
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

function resolveGenreIds(entity) {
  const values = Array.isArray(entity?.genreIds)
    ? entity.genreIds
    : Array.isArray(entity?.genres)
      ? entity.genres
      : [entity?.genreId]

  const normalized = []
  const seen = new Set()

  values.forEach((value) => {
    const genreId = normalizeGenreId(value)
    if (!genreId || seen.has(genreId)) {
      return
    }

    seen.add(genreId)
    normalized.push(genreId)
  })

  return normalized
}

function resolveGenreNames(genreIds, genreLookup) {
  return genreIds.map((genreId) => genreLookup[genreId]?.name || genreId || 'Unknown')
}

export function toClipUiModel(entity, genreLookup = {}) {
  const genreIds = resolveGenreIds(entity)
  const genreId = genreIds[0] || 'unknown'
  const genreNames = resolveGenreNames(genreIds, genreLookup)
  const genreName = genreNames[0] || 'Unknown'
  const genreLabel = genreNames.length > 0 ? genreNames.join(', ') : genreName
  const durationSec = safeNumber(entity?.durationSec, 0)

  return {
    id: safeString(entity?.id),
    title: safeString(entity?.title, 'Untitled clip'),
    description: safeString(entity?.description),
    thumbnailUrl: safeString(entity?.thumbnailUrl, FALLBACK_THUMBNAIL),
    videoUrl: safeString(entity?.videoUrl),
    watchUrl: safeString(entity?.watchUrl, safeString(entity?.externalUrl, FALLBACK_WATCH_URL)),
    durationSec,
    durationLabel: formatDurationLabel(durationSec),
    rating: safeRating(entity?.rating),
    genreIds,
    genreId,
    genreNames,
    genreName,
    genreLabel,
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
