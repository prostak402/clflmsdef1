function isIsoDateString(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return false
  }

  return !Number.isNaN(Date.parse(value))
}

function formatTimeLabel(createdAt, fallbackTimeLabel = 'Just now') {
  if (!isIsoDateString(createdAt)) {
    return fallbackTimeLabel
  }

  const diffMs = Date.now() - new Date(createdAt).getTime()

  if (diffMs <= 0) {
    return fallbackTimeLabel
  }

  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.floor(diffMs / minuteMs))
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(diffMs / dayMs)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function toSafeLikeCount(value) {
  const normalized = Number(value)

  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0
  }

  return Math.trunc(normalized)
}

export function normalizeComment(comment = {}, clipId = '') {
  const hasValidCreatedAt = isIsoDateString(comment.createdAt)
  const resolvedCreatedAt = hasValidCreatedAt ? comment.createdAt : new Date().toISOString()

  const authorName =
    typeof comment.authorName === 'string' && comment.authorName.trim()
      ? comment.authorName.trim()
      : 'Anonymous'

  const normalizedClipId =
    typeof comment.clipId === 'string' && comment.clipId.trim()
      ? comment.clipId.trim()
      : String(clipId)

  const fallbackTimeLabel =
    typeof comment.timeLabel === 'string' && comment.timeLabel.trim()
      ? comment.timeLabel.trim()
      : 'Just now'

  return {
    id: String(comment.id ?? `cm_${Date.now().toString(36)}`),
    clipId: normalizedClipId,
    authorId:
      typeof comment.authorId === 'string' && comment.authorId.trim()
        ? comment.authorId.trim()
        : 'anonymous',
    authorName,
    avatar:
      typeof comment.avatar === 'string' && comment.avatar.trim() ? comment.avatar.trim() : 'Movie',
    text: typeof comment.text === 'string' ? comment.text : '',
    likes: toSafeLikeCount(comment.likes),
    likedByViewer: Boolean(comment.likedByViewer),
    createdAt: resolvedCreatedAt,
    timeLabel: hasValidCreatedAt
      ? formatTimeLabel(resolvedCreatedAt, fallbackTimeLabel)
      : fallbackTimeLabel,
  }
}

export function normalizeCommentsMap(commentsByClip = {}) {
  return Object.entries(commentsByClip).reduce((acc, [clipId, comments]) => {
    const safeComments = Array.isArray(comments) ? comments : []
    acc[clipId] = safeComments.map((comment) => normalizeComment(comment, clipId))
    return acc
  }, {})
}
