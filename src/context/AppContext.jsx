import { useState, useCallback, useEffect } from 'react'
import { GENRE_SELECTION_MAX } from '../constants/onboarding'
import { feedService } from '../services/feed-service'
import { validateCommentText } from '../services/comment-validation'

import { AppContext } from './app-context'

const STORAGE_KEY = 'app_state_v1'
const LEGACY_STORAGE_KEY = 'clipflow.app-state'
const STATE_VERSION = 1

const DEFAULT_DRAFT_PREFERENCES = {
  notificationsEnabled: true,
  autoplayEnabled: true,
  preferredLanguage: 'en',
}

const AUTH_REQUIRED_ERROR = 'auth_required'
const COMMENT_BLOCKED_ERROR = 'comment_blocked'

const DEFAULT_STATE = {
  user: null,
  hasCompletedOnboarding: false,
  selectedGenres: [],
  bookmarks: [],
  likes: {},
  blockedCommentUsers: {},
  draftPreferences: DEFAULT_DRAFT_PREFERENCES,
}

function sanitizeBlockedCommentUsers(value) {
  if (Array.isArray(value)) {
    return value.reduce((acc, authorId) => {
      if (typeof authorId === 'string' && authorId.trim()) {
        acc[authorId.trim()] = true
      }
      return acc
    }, {})
  }

  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.entries(value).reduce((acc, [authorId, isBlocked]) => {
    if (typeof authorId === 'string' && authorId.trim() && Boolean(isBlocked)) {
      acc[authorId.trim()] = true
    }
    return acc
  }, {})
}

function sanitizeState(value) {
  if (!value || typeof value !== 'object') {
    return DEFAULT_STATE
  }

  return {
    user: value.user && typeof value.user === 'object' ? value.user : null,
    hasCompletedOnboarding: Boolean(value.hasCompletedOnboarding),
    selectedGenres: Array.isArray(value.selectedGenres) ? value.selectedGenres : [],
    bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks : [],
    likes: value.likes && typeof value.likes === 'object' ? value.likes : {},
    blockedCommentUsers: sanitizeBlockedCommentUsers(value.blockedCommentUsers),
    draftPreferences:
      value.draftPreferences && typeof value.draftPreferences === 'object'
        ? { ...DEFAULT_DRAFT_PREFERENCES, ...value.draftPreferences }
        : DEFAULT_DRAFT_PREFERENCES,
  }
}

function persistStateSnapshot(state) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: STATE_VERSION,
      state,
    })
  )
}

function parseVersionedState(raw) {
  const parsed = JSON.parse(raw)

  if (parsed?.version === STATE_VERSION) {
    return sanitizeState(parsed.state)
  }

  if (typeof parsed === 'object' && parsed !== null && !('version' in parsed)) {
    return sanitizeState(parsed)
  }

  return null
}

function migrateFromLegacyState() {
  const rawLegacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!rawLegacy) return DEFAULT_STATE

  try {
    const migrated = sanitizeState(JSON.parse(rawLegacy))
    persistStateSnapshot(migrated)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return migrated
  } catch {
    return DEFAULT_STATE
  }
}

function readPersistedState() {
  if (typeof window === 'undefined') return DEFAULT_STATE

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return migrateFromLegacyState()
    }

    const parsed = parseVersionedState(raw)
    if (parsed) return parsed

    return migrateFromLegacyState()
  } catch {
    return migrateFromLegacyState()
  }
}

function isValidClipId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 64
}

export function AppProvider({ children }) {
  const [persistedState] = useState(() => readPersistedState())

  const [user, setUser] = useState(persistedState.user)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    persistedState.hasCompletedOnboarding
  )
  const [selectedGenres, setSelectedGenres] = useState(persistedState.selectedGenres)
  const [bookmarks, setBookmarks] = useState(persistedState.bookmarks)
  const [likes, setLikes] = useState(persistedState.likes)
  const [blockedCommentUsers, setBlockedCommentUsers] = useState(persistedState.blockedCommentUsers)
  const [draftPreferences, setDraftPreferences] = useState(persistedState.draftPreferences)
  const [comments, setComments] = useState(feedService.getInitialComments())

  useEffect(() => {
    if (typeof window === 'undefined') return

    persistStateSnapshot({
      user,
      hasCompletedOnboarding,
      selectedGenres,
      bookmarks,
      likes,
      blockedCommentUsers,
      draftPreferences,
    })
  }, [
    user,
    hasCompletedOnboarding,
    selectedGenres,
    bookmarks,
    likes,
    blockedCommentUsers,
    draftPreferences,
  ])

  const login = useCallback((userData) => {
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setHasCompletedOnboarding(false)
    setSelectedGenres([])
    setBookmarks([])
    setLikes({})
    setBlockedCommentUsers({})
    setDraftPreferences(DEFAULT_DRAFT_PREFERENCES)
  }, [])

  const blockUserComments = useCallback((authorId) => {
    if (typeof authorId !== 'string' || !authorId.trim()) {
      return false
    }

    const normalizedAuthorId = authorId.trim()
    let didUpdate = false

    setBlockedCommentUsers((prev) => {
      const next = feedService.blockUserComments({ authorId: normalizedAuthorId, blockedUsers: prev })
      didUpdate = Boolean(next?.[normalizedAuthorId])
      return next
    })

    return didUpdate
  }, [])

  const unblockUserComments = useCallback((authorId) => {
    if (typeof authorId !== 'string' || !authorId.trim()) {
      return false
    }

    const normalizedAuthorId = authorId.trim()

    setBlockedCommentUsers((prev) => {
      if (!prev[normalizedAuthorId]) {
        return prev
      }

      const next = { ...prev }
      delete next[normalizedAuthorId]
      return next
    })
    return true
  }, [])

  const isUserCommentBlocked = useCallback(
    (authorId) => {
      if (typeof authorId !== 'string' || !authorId.trim()) {
        return false
      }

      return Boolean(blockedCommentUsers[authorId.trim()])
    },
    [blockedCommentUsers]
  )

  const deleteComment = useCallback(({ clipId, commentId }) => {
    if (!isValidClipId(clipId) || typeof commentId !== 'string' || !commentId.trim()) {
      return false
    }

    const normalizedCommentId = commentId.trim()
    let didDelete = false

    setComments((prev) => {
      const next = feedService.deleteComment({ clipId, commentId: normalizedCommentId, comments: prev })
      const prevLength = Array.isArray(prev?.[clipId]) ? prev[clipId].length : 0
      const nextLength = Array.isArray(next?.[clipId]) ? next[clipId].length : 0
      didDelete = nextLength < prevLength
      return didDelete ? next : prev
    })

    return didDelete
  }, [])

  const deleteCommentsByUser = useCallback(({ authorId }) => {
    if (typeof authorId !== 'string' || !authorId.trim()) {
      return false
    }

    const normalizedAuthorId = authorId.trim()
    let didDelete = false

    setComments((prev) => {
      const next = feedService.deleteCommentsByUser({ authorId: normalizedAuthorId, comments: prev })
      const prevCount = Object.values(prev).reduce((acc, clipComments) => acc + (clipComments?.length || 0), 0)
      const nextCount = Object.values(next).reduce((acc, clipComments) => acc + (clipComments?.length || 0), 0)
      didDelete = nextCount < prevCount
      return didDelete ? next : prev
    })

    return didDelete
  }, [])

  const toggleGenre = useCallback((genreId) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genreId)) {
        return prev.filter((g) => g !== genreId)
      }

      if (prev.length >= GENRE_SELECTION_MAX) {
        return prev
      }

      return [...prev, genreId]
    })
  }, [])

  const toggleBookmark = useCallback(
    async (clipId) => {
      if (!user) {
        return false
      }

      if (!isValidClipId(clipId)) {
        return false
      }

      const prevBookmarks = bookmarks

      try {
        return await feedService.optimisticToggleBookmark({
          clipId,
          applyLocal: () => {
            setBookmarks((current) => feedService.toggleBookmark({ clipId, bookmarks: current }))
          },
          rollbackLocal: () => {
            setBookmarks(prevBookmarks)
          },
        })
      } catch {
        setBookmarks(prevBookmarks)
        return false
      }
    },
    [bookmarks, user]
  )

  const toggleLike = useCallback(
    async (clipId) => {
      if (!user) {
        return false
      }

      if (!isValidClipId(clipId)) {
        return false
      }

      const prevLikes = likes

      try {
        return await feedService.optimisticToggleLike({
          clipId,
          applyLocal: () => {
            setLikes((current) => feedService.toggleLike({ clipId, likes: current }))
          },
          rollbackLocal: () => {
            setLikes(prevLikes)
          },
        })
      } catch {
        setLikes(prevLikes)
        return false
      }
    },
    [likes, user]
  )

  const addComment = useCallback(
    (clipId, text) => {
      if (!user) {
        return {
          ok: false,
          error: AUTH_REQUIRED_ERROR,
        }
      }

      const currentAuthorId = user?.id || user?.email
      if (isUserCommentBlocked(currentAuthorId)) {
        return {
          ok: false,
          error: COMMENT_BLOCKED_ERROR,
        }
      }

      const validation = validateCommentText(text)
      if (!validation.valid) {
        return {
          ok: false,
          error: validation.error,
        }
      }

      setComments((prev) =>
        feedService.createComment({
          clipId,
          text: validation.normalizedText,
          comments: prev,
          userName: user?.name,
          authorId: currentAuthorId,
        })
      )

      return {
        ok: true,
        error: '',
      }
    },
    [isUserCommentBlocked, user]
  )

  const updateDraftPreferences = useCallback((patch) => {
    setDraftPreferences((prev) => ({ ...prev, ...patch }))
  }, [])

  const getFilteredClips = useCallback(() => {
    return feedService.getFeed({ selectedGenres })
  }, [selectedGenres])

  const getBookmarkedClips = useCallback(() => {
    return feedService.getBookmarks({ bookmarks })
  }, [bookmarks])

  const getProfile = useCallback(() => {
    return feedService.getProfile({ user, bookmarks, likes })
  }, [bookmarks, likes, user])

  const value = {
    user,
    hasCompletedOnboarding,
    selectedGenres,
    bookmarks,
    likes,
    blockedCommentUsers,
    comments,
    draftPreferences,
    login,
    logout,
    setHasCompletedOnboarding,
    toggleGenre,
    toggleBookmark,
    toggleLike,
    blockUserComments,
    unblockUserComments,
    isUserCommentBlocked,
    addComment,
    deleteComment,
    deleteCommentsByUser,
    getFilteredClips,
    getBookmarkedClips,
    getProfile,
    setSelectedGenres,
    setDraftPreferences,
    updateDraftPreferences,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
