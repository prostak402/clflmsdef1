const BACKEND_CONSTRAINTS = Object.freeze({
  clipId: Object.freeze({
    required: true,
    minLength: 1,
    maxLength: 64,
  }),
  commentText: Object.freeze({
    required: true,
    minLength: 1,
    maxLength: 500,
    trim: true,
  }),
  userName: Object.freeze({
    required: false,
    minLength: 2,
    maxLength: 50,
    trim: true,
  }),
  authorId: Object.freeze({
    required: false,
    minLength: 2,
    maxLength: 120,
    trim: true,
  }),
  commentId: Object.freeze({
    required: true,
    minLength: 1,
    maxLength: 120,
    trim: true,
  }),
})

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeClipId(value) {
  const clipId = normalizeString(value)
  const { minLength, maxLength, required } = BACKEND_CONSTRAINTS.clipId

  if (required && clipId.length < minLength) {
    throw new Error('clipId is required')
  }

  if (clipId.length > maxLength) {
    throw new Error('clipId exceeds max length')
  }

  return clipId
}

function normalizeCommentText(value) {
  const text = normalizeString(value)
  const { minLength, maxLength } = BACKEND_CONSTRAINTS.commentText

  if (text.length < minLength) {
    throw new Error('comment text is required')
  }

  return text.slice(0, maxLength)
}

function normalizeUserName(value) {
  const userName = normalizeString(value)

  if (!userName) {
    return undefined
  }

  const { minLength, maxLength } = BACKEND_CONSTRAINTS.userName

  if (userName.length < minLength) {
    return undefined
  }

  return userName.slice(0, maxLength)
}


function normalizeCommentId(value) {
  const commentId = normalizeString(value)
  const { minLength, maxLength, required } = BACKEND_CONSTRAINTS.commentId

  if (required && commentId.length < minLength) {
    throw new Error('commentId is required')
  }

  if (commentId.length > maxLength) {
    throw new Error('commentId exceeds max length')
  }

  return commentId
}

function normalizeAuthorId(value) {
  const authorId = normalizeString(value)

  if (!authorId) {
    return undefined
  }

  const { minLength, maxLength } = BACKEND_CONSTRAINTS.authorId

  if (authorId.length < minLength) {
    return undefined
  }

  return authorId.slice(0, maxLength)
}

export function normalizeWritePayload(operation, payload = {}) {
  switch (operation) {
    case 'toggleLike':
      return {
        clipId: normalizeClipId(payload.clipId),
        likes: payload.likes && typeof payload.likes === 'object' ? payload.likes : {},
      }

    case 'persistLikeToggle':
    case 'persistBookmarkToggle':
      return {
        clipId: normalizeClipId(payload.clipId),
      }

    case 'toggleBookmark':
      return {
        clipId: normalizeClipId(payload.clipId),
        bookmarks: Array.isArray(payload.bookmarks) ? payload.bookmarks : [],
      }

    case 'createComment':
      return {
        clipId: normalizeClipId(payload.clipId),
        text: normalizeCommentText(payload.text),
        comments: payload.comments && typeof payload.comments === 'object' ? payload.comments : {},
        userName: normalizeUserName(payload.userName),
        authorId: normalizeAuthorId(payload.authorId),
      }

    case 'blockUserComments': {
      const authorId = normalizeAuthorId(payload.authorId)

      if (!authorId) {
        throw new Error('authorId is required')
      }

      return {
        authorId,
        blockedUsers:
          payload.blockedUsers && typeof payload.blockedUsers === 'object' ? payload.blockedUsers : {},
      }
    }

    case 'deleteComment':
      return {
        clipId: normalizeClipId(payload.clipId),
        commentId: normalizeCommentId(payload.commentId),
        comments: payload.comments && typeof payload.comments === 'object' ? payload.comments : {},
      }

    case 'deleteCommentsByUser': {
      const authorId = normalizeAuthorId(payload.authorId)

      if (!authorId) {
        throw new Error('authorId is required')
      }

      return {
        authorId,
        comments: payload.comments && typeof payload.comments === 'object' ? payload.comments : {},
      }
    }

    default:
      throw new Error(`Unsupported write operation: ${operation}`)
  }
}

export { BACKEND_CONSTRAINTS }
