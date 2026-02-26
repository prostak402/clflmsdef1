import { useState, useCallback, useEffect } from 'react'
import { GENRE_SELECTION_MAX } from '../constants/onboarding'
import { feedService } from '../services/feed-service'
import { validateCommentText } from '../services/comment-validation'
import { MOCK_CATALOG } from '../data/mock'

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
  adminUploads: [],
  adminCatalogMovies: [],
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
    adminUploads: Array.isArray(value.adminUploads) ? value.adminUploads : [],
    adminCatalogMovies: Array.isArray(value.adminCatalogMovies) ? value.adminCatalogMovies : [],
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

function normalizeClipPatch(patchOrForm) {
  if (!patchOrForm) {
    return {}
  }

  if (typeof FormData !== 'undefined' && patchOrForm instanceof FormData) {
    return Object.fromEntries(patchOrForm.entries())
  }

  return typeof patchOrForm === 'object' ? patchOrForm : {}
}

function isBlobUrl(value) {
  return typeof value === 'string' && value.startsWith('blob:')
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
  const [adminUploads, setAdminUploads] = useState(persistedState.adminUploads)
  const [adminCatalogMovies, setAdminCatalogMovies] = useState(persistedState.adminCatalogMovies)

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
      adminUploads,
      adminCatalogMovies,
    })
  }, [
    user,
    hasCompletedOnboarding,
    selectedGenres,
    bookmarks,
    likes,
    blockedCommentUsers,
    draftPreferences,
    adminUploads,
    adminCatalogMovies,
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

  const addAdminClip = useCallback((form) => {
    const uploadId = `upload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const createdAt = new Date().toLocaleString()
    const poster = form.posterFile ? URL.createObjectURL(form.posterFile) : ''

    const upload = {
      id: uploadId,
      title: form.title,
      year: form.year,
      description: form.description,
      clipDescription: form.clipDescription,
      genres: form.genres,
      director: form.director,
      duration: form.duration,
      kinopoiskId: form.kinopoiskId,
      watchUrl: form.watchUrl,
      status: 'processing',
      createdAt,
      poster,
    }

    setAdminUploads((prev) => [upload, ...prev])

    const catalogMovie = {
      id: `admin_${uploadId}`,
      title: form.title,
      year: Number(form.year) || new Date().getFullYear(),
      rating: 0,
      genres: form.genres,
      poster,
      watchUrl: form.watchUrl || '#',
      description: form.description,
      clipDescription: form.clipDescription,
      duration: form.duration,
      director: form.director,
      kinopoiskId: form.kinopoiskId,
      createdAt,
    }

    setAdminCatalogMovies((prev) => {
      const existingIndex = prev.findIndex(
        (movie) =>
          movie.title.trim().toLowerCase() === form.title.trim().toLowerCase() &&
          Number(movie.year) === Number(catalogMovie.year)
      )

      if (existingIndex === -1) {
        return [catalogMovie, ...prev]
      }

      const next = [...prev]
      next[existingIndex] = { ...next[existingIndex], ...catalogMovie }
      return next
    })

    setTimeout(() => {
      setAdminUploads((prev) =>
        prev.map((item) => (item.id === uploadId ? { ...item, status: 'ready' } : item))
      )
    }, 2000)
  }, [])

  const updateAdminClip = useCallback((clipId, patchOrForm) => {
    if (!isValidClipId(clipId)) {
      return false
    }

    const normalizedPatch = normalizeClipPatch(patchOrForm)
    const normalizedClipId = clipId.trim()
    const resolvedUploadId = normalizedClipId.startsWith('admin_')
      ? normalizedClipId.slice('admin_'.length)
      : normalizedClipId
    const resolvedCatalogId = normalizedClipId.startsWith('admin_')
      ? normalizedClipId
      : `admin_${normalizedClipId}`
    const hasPosterFile = Boolean(normalizedPatch.posterFile)
    const hasClipFile = Boolean(normalizedPatch.clipFile)
    const shouldRefreshCreatedAt = hasPosterFile || hasClipFile
    const nextCreatedAt = shouldRefreshCreatedAt ? new Date().toLocaleString() : undefined

    let previousPoster = ''
    let nextPoster = ''
    let didUpdateCatalog = false

    setAdminCatalogMovies((prev) => {
      const existingIndex = prev.findIndex((movie) => movie.id === resolvedCatalogId)
      if (existingIndex === -1) {
        return prev
      }

      didUpdateCatalog = true
      const prevItem = prev[existingIndex]
      previousPoster = prevItem.poster || ''

      const shouldUsePatchPoster = typeof normalizedPatch.poster === 'string' && normalizedPatch.poster.trim()
      nextPoster = hasPosterFile
        ? URL.createObjectURL(normalizedPatch.posterFile)
        : shouldUsePatchPoster || normalizedPatch.poster === ''
          ? normalizedPatch.poster
          : prevItem.poster || ''

      const catalogPatch = {
        ...(Object.hasOwn(normalizedPatch, 'title') ? { title: normalizedPatch.title } : {}),
        ...(Object.hasOwn(normalizedPatch, 'genres') ? { genres: normalizedPatch.genres } : {}),
        ...(Object.hasOwn(normalizedPatch, 'watchUrl') ? { watchUrl: normalizedPatch.watchUrl } : {}),
        ...(Object.hasOwn(normalizedPatch, 'description')
          ? { description: normalizedPatch.description }
          : {}),
        ...(Object.hasOwn(normalizedPatch, 'clipDescription')
          ? { clipDescription: normalizedPatch.clipDescription }
          : {}),
        ...(Object.hasOwn(normalizedPatch, 'duration') ? { duration: normalizedPatch.duration } : {}),
        ...(Object.hasOwn(normalizedPatch, 'director') ? { director: normalizedPatch.director } : {}),
        ...(Object.hasOwn(normalizedPatch, 'kinopoiskId')
          ? { kinopoiskId: normalizedPatch.kinopoiskId }
          : {}),
        ...(Object.hasOwn(normalizedPatch, 'status') ? { status: normalizedPatch.status } : {}),
        ...(Object.hasOwn(normalizedPatch, 'year')
          ? {
              year:
                Number(normalizedPatch.year) || Number(prevItem.year) || new Date().getFullYear(),
            }
          : {}),
        ...(hasPosterFile || Object.hasOwn(normalizedPatch, 'poster') ? { poster: nextPoster } : {}),
        ...(shouldRefreshCreatedAt ? { createdAt: nextCreatedAt } : {}),
      }

      const next = [...prev]
      next[existingIndex] = { ...prevItem, ...catalogPatch }
      return next
    })

    if (!didUpdateCatalog) {
      return false
    }

    setAdminUploads((prev) =>
      prev.map((upload) => {
        if (upload.id !== resolvedUploadId) {
          return upload
        }

        const uploadPatch = {
          ...(Object.hasOwn(normalizedPatch, 'title') ? { title: normalizedPatch.title } : {}),
          ...(Object.hasOwn(normalizedPatch, 'year') ? { year: normalizedPatch.year } : {}),
          ...(Object.hasOwn(normalizedPatch, 'description')
            ? { description: normalizedPatch.description }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'clipDescription')
            ? { clipDescription: normalizedPatch.clipDescription }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'genres') ? { genres: normalizedPatch.genres } : {}),
          ...(Object.hasOwn(normalizedPatch, 'director') ? { director: normalizedPatch.director } : {}),
          ...(Object.hasOwn(normalizedPatch, 'duration') ? { duration: normalizedPatch.duration } : {}),
          ...(Object.hasOwn(normalizedPatch, 'kinopoiskId')
            ? { kinopoiskId: normalizedPatch.kinopoiskId }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'watchUrl') ? { watchUrl: normalizedPatch.watchUrl } : {}),
          ...(Object.hasOwn(normalizedPatch, 'status')
            ? { status: normalizedPatch.status }
            : shouldRefreshCreatedAt
              ? { status: 'ready' }
              : {}),
          ...(hasPosterFile || Object.hasOwn(normalizedPatch, 'poster') ? { poster: nextPoster } : {}),
          ...(shouldRefreshCreatedAt ? { createdAt: nextCreatedAt } : {}),
        }

        return { ...upload, ...uploadPatch }
      })
    )

    if (hasPosterFile && isBlobUrl(previousPoster) && previousPoster !== nextPoster) {
      URL.revokeObjectURL(previousPoster)
    }

    return true
  }, [])

  const removeAdminUpload = useCallback((uploadId) => {
    setAdminUploads((prev) => prev.filter((upload) => upload.id !== uploadId))
  }, [])

  const getCatalog = useCallback(() => {
    return [...adminCatalogMovies, ...MOCK_CATALOG]
  }, [adminCatalogMovies])

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
    adminUploads,
    adminCatalogMovies,
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
    addAdminClip,
    updateAdminClip,
    removeAdminUpload,
    getCatalog,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
