import { normalizeComment, normalizeCommentsMap } from '../comment-normalizer'

export function toCommentsMapUiModel(commentsByClip = {}) {
  return normalizeCommentsMap(commentsByClip)
}

export function toCommentUiModel(comment, clipId = '') {
  return normalizeComment(comment, clipId)
}

export function toModerationCommentUiList(rows = [], { clips = [], blockedUsers = {} } = {}) {
  const clipNameById = (Array.isArray(clips) ? clips : []).reduce((acc, clip) => {
    if (clip?.id) {
      acc[clip.id] = clip.title || 'Unknown clip'
    }

    return acc
  }, {})

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const normalizedComment = toCommentUiModel(row, row?.clipId)

    return {
      ...normalizedComment,
      clipId: normalizedComment.clipId,
      clipTitle: row?.clipTitle || clipNameById[normalizedComment.clipId] || 'Unknown clip',
      isBlockedAuthor: Boolean(blockedUsers[normalizedComment.authorId] || row?.isBlockedAuthor),
    }
  })
}

export function flattenCommentsForModeration(
  commentsMap = {},
  { clips = [], blockedUsers = {} } = {}
) {
  const clipNameById = (Array.isArray(clips) ? clips : []).reduce((acc, clip) => {
    if (clip?.id) {
      acc[clip.id] = clip.title || 'Unknown clip'
    }

    return acc
  }, {})

  let order = 0

  return Object.entries(commentsMap || {})
    .flatMap(([clipId, clipComments]) => {
      if (!Array.isArray(clipComments)) {
        return []
      }

      return clipComments.map((comment) => ({
        ...toCommentUiModel(comment, clipId),
        clipId: comment?.clipId || clipId,
        clipTitle: clipNameById[comment?.clipId || clipId] || 'Unknown clip',
        isBlockedAuthor: Boolean(blockedUsers[comment?.authorId || '']),
        __order: order++,
      }))
    })
    .sort((a, b) => {
      const aTime = Date.parse(a?.createdAt || '')
      const bTime = Date.parse(b?.createdAt || '')
      const aTs = Number.isNaN(aTime) ? -Infinity : aTime
      const bTs = Number.isNaN(bTime) ? -Infinity : bTime

      if (bTs !== aTs) {
        return bTs - aTs
      }

      return a.__order - b.__order
    })
    .map((comment) => {
      const normalizedComment = { ...comment }
      delete normalizedComment.__order
      return normalizedComment
    })
}
