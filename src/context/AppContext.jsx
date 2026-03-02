import { useState, useCallback, useEffect } from 'react'
import { GENRE_SELECTION_MAX } from '../constants/onboarding'
import { feedService } from '../services/feed-service'
import { authService } from '../services/auth-service'
import { validateCommentText } from '../services/comment-validation'
import { contentService } from '../services/content-service'

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
const COMMENT_UNAUTHORIZED_ERROR = 'comment_unauthorized'

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

function normalizeMovieTitle(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function areSameMovieByTitleAndGenre(left, right) {
  return (
    normalizeMovieTitle(left?.title) === normalizeMovieTitle(right?.title) &&
    String(left?.genreId || '').trim() === String(right?.genreId || '').trim()
  )
}

export function AppProvider({ children }) {
  const [persistedState] = useState(() => readPersistedState())

  const persistedUser = persistedState.user
  const persistedOnboarding = persistedState.hasCompletedOnboarding

  const [user, setUser] = useState(persistedUser)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    persistedOnboarding
  )
  const [selectedGenres, setSelectedGenres] = useState(persistedState.selectedGenres)
  const [bookmarks, setBookmarks] = useState(persistedState.bookmarks)
  const [likes, setLikes] = useState(persistedState.likes)
  const [blockedCommentUsers, setBlockedCommentUsers] = useState(persistedState.blockedCommentUsers)
  const [draftPreferences, setDraftPreferences] = useState(persistedState.draftPreferences)
  const [comments, setComments] = useState(feedService.getInitialComments())
  const [adminUploads, setAdminUploads] = useState(persistedState.adminUploads)
  const [adminCatalogMovies, setAdminCatalogMovies] = useState(persistedState.adminCatalogMovies)
  const [authStatus, setAuthStatus] = useState('checking')
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    let isMounted = true

    authService
      .restoreSession()
      .then(({ session, expired }) => {
        if (!isMounted) {
          return
        }

        setSessionExpired(Boolean(expired))

        if (!session?.user) {
          if (persistedUser) {
            const persistedRole = persistedUser.role || (persistedUser.isAdmin ? 'admin' : 'user')
            setUser({ ...persistedUser, role: persistedRole })
            setHasCompletedOnboarding(Boolean(persistedOnboarding))
            setAuthStatus('authenticated')
            return
          }

          setUser(null)
          setHasCompletedOnboarding(false)
          setAuthStatus('anonymous')
          return
        }

        const normalizedUser = {
          ...session.user,
          name: session.user?.displayName || session.user?.name,
          avatar: session.user?.avatarUrl || session.user?.avatar || null,
        }

        setUser(normalizedUser)
        setHasCompletedOnboarding(Boolean(session.user?.hasCompletedOnboarding))
        setAuthStatus('authenticated')
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setUser(null)
        setSessionExpired(true)
        setAuthStatus('anonymous')
      })

    return () => {
      isMounted = false
    }
  }, [persistedOnboarding, persistedUser])

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

  const login = useCallback(async (credentials = {}) => {
    if (credentials && (credentials.name || credentials.isAdmin !== undefined) && !credentials.mode) {
      const legacyRole = credentials.role || (credentials.isAdmin ? 'admin' : 'user')
      const legacyUser = {
        ...credentials,
        role: legacyRole,
      }
      setUser(legacyUser)
      setSessionExpired(false)
      setAuthStatus('authenticated')
      return legacyUser
    }

    const session = credentials?.mode === 'signup'
      ? await authService.signUp(credentials)
      : await authService.signIn(credentials)

    const sessionUser = session?.user || {}
    const normalizedUser = {
      ...sessionUser,
      name: sessionUser?.displayName || sessionUser?.name,
      avatar: sessionUser?.avatarUrl || sessionUser?.avatar || null,
    }

    setUser(normalizedUser)
    setSessionExpired(false)
    setHasCompletedOnboarding(Boolean(sessionUser?.hasCompletedOnboarding))
    setAuthStatus('authenticated')

    return normalizedUser
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
    setAuthStatus('anonymous')
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
      const shouldBookmark = !bookmarks.includes(clipId)

      try {
        return await feedService.optimisticToggleBookmark({
          clipId,
          shouldBookmark,
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
      const shouldLike = !likes[clipId]

      try {
        return await feedService.optimisticToggleLike({
          clipId,
          shouldLike,
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
    async (clipId, text) => {
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

      try {
        const nextComments = await feedService.createComment({
          clipId,
          text: validation.normalizedText,
          comments,
          userName: user?.name,
          authorId: currentAuthorId,
        })

        setComments(nextComments)

        return {
          ok: true,
          error: '',
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        const isUnauthorizedError = /\(401\)|\(403\)/.test(message)

        return {
          ok: false,
          error: isUnauthorizedError ? COMMENT_UNAUTHORIZED_ERROR : message || 'comment_submit_failed',
        }
      }
    },
    [comments, isUserCommentBlocked, user]
  )

  const updateDraftPreferences = useCallback((patch) => {
    setDraftPreferences((prev) => ({ ...prev, ...patch }))
  }, [])

  const addAdminClip = useCallback((form) => {
    const uploadId = `upload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const createdAt = new Date().toLocaleString()
    const poster = form.posterFile ? URL.createObjectURL(form.posterFile) : ''

    const catalogMovieId = `admin_${uploadId}`
    const upload = {
      id: uploadId,
      movieId: catalogMovieId,
      title: form.title,
      description: form.description,
      genreId: form.genreId,
      durationSec: form.durationSec,
      duration: form.duration,
      kinopoiskId: form.kinopoiskId,
      thumbnailUrl: form.thumbnailUrl,
      videoUrl: form.videoUrl,
      externalUrl: form.externalUrl || '#',
      status: 'processing',
      createdAt,
      poster,
    }

    setAdminUploads((prev) => [upload, ...prev])

    const catalogMovie = {
      id: catalogMovieId,
      title: form.title,
      rating: 0,
      genreId: form.genreId || 'unknown',
      poster,
      externalUrl: form.externalUrl || '#',
      description: form.description,
      durationSec: Number(form.durationSec) || 0,
      duration: form.duration,
      kinopoiskId: form.kinopoiskId,
      thumbnailUrl: form.thumbnailUrl || poster,
      videoUrl: form.videoUrl || '',
      createdAt,
    }

    setAdminCatalogMovies((prev) => {
      const existingIndex = prev.findIndex((movie) => areSameMovieByTitleAndGenre(movie, catalogMovie))

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

  const updateAdminClip = useCallback(
    (clipId, patchOrForm) => {
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
      const existingCatalogMovie = adminCatalogMovies.find((movie) => movie.id === resolvedCatalogId)
      if (!existingCatalogMovie) {
        return false
      }

      const hasPosterFile = Boolean(normalizedPatch.posterFile)
      const hasClipFile = Boolean(normalizedPatch.clipFile)
      const shouldRefreshCreatedAt = hasPosterFile || hasClipFile
      const nextCreatedAt = shouldRefreshCreatedAt ? new Date().toLocaleString() : undefined

      let previousPoster = ''
      let nextPoster = ''

      setAdminCatalogMovies((prev) => {
        const existingIndex = prev.findIndex((movie) => movie.id === resolvedCatalogId)
        if (existingIndex === -1) {
          return prev
        }

        const prevItem = prev[existingIndex]
        previousPoster = prevItem.poster || ''

        const shouldUsePatchPoster =
          typeof normalizedPatch.poster === 'string' && normalizedPatch.poster.trim()
        nextPoster = hasPosterFile
          ? URL.createObjectURL(normalizedPatch.posterFile)
          : shouldUsePatchPoster || normalizedPatch.poster === ''
            ? normalizedPatch.poster
            : prevItem.poster || ''

        const catalogPatch = {
          ...(Object.hasOwn(normalizedPatch, 'title') ? { title: normalizedPatch.title } : {}),
          ...(Object.hasOwn(normalizedPatch, 'genreId') ? { genreId: normalizedPatch.genreId } : {}),
          ...(Object.hasOwn(normalizedPatch, 'externalUrl')
            ? { externalUrl: normalizedPatch.externalUrl }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'description')
            ? { description: normalizedPatch.description }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'duration') ? { duration: normalizedPatch.duration } : {}),
          ...(Object.hasOwn(normalizedPatch, 'durationSec')
            ? { durationSec: Number(normalizedPatch.durationSec) || 0 }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'kinopoiskId')
            ? { kinopoiskId: normalizedPatch.kinopoiskId }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'status') ? { status: normalizedPatch.status } : {}),
          ...(hasPosterFile || Object.hasOwn(normalizedPatch, 'poster') ? { poster: nextPoster } : {}),
          ...(shouldRefreshCreatedAt ? { createdAt: nextCreatedAt } : {}),
        }

        const next = [...prev]
        next[existingIndex] = { ...prevItem, ...catalogPatch }
        return next
      })

      setAdminUploads((prev) =>
        prev.map((upload) => {
          const shouldUpdateUpload =
            upload.id === resolvedUploadId ||
            upload.movieId === resolvedCatalogId ||
            (!upload.movieId &&
              normalizedClipId.startsWith('admin_') &&
              areSameMovieByTitleAndGenre(upload, existingCatalogMovie))

          if (!shouldUpdateUpload) {
            return upload
          }

          const uploadPatch = {
            ...(Object.hasOwn(normalizedPatch, 'title') ? { title: normalizedPatch.title } : {}),
            ...(Object.hasOwn(normalizedPatch, 'description')
              ? { description: normalizedPatch.description }
              : {}),
            ...(Object.hasOwn(normalizedPatch, 'genreId') ? { genreId: normalizedPatch.genreId } : {}),
            ...(Object.hasOwn(normalizedPatch, 'duration') ? { duration: normalizedPatch.duration } : {}),
            ...(Object.hasOwn(normalizedPatch, 'durationSec')
              ? { durationSec: Number(normalizedPatch.durationSec) || 0 }
              : {}),
            ...(Object.hasOwn(normalizedPatch, 'kinopoiskId')
              ? { kinopoiskId: normalizedPatch.kinopoiskId }
              : {}),
            ...(Object.hasOwn(normalizedPatch, 'externalUrl')
              ? { externalUrl: normalizedPatch.externalUrl }
              : {}),
            ...(Object.hasOwn(normalizedPatch, 'status')
              ? { status: normalizedPatch.status }
              : shouldRefreshCreatedAt
                ? { status: 'ready' }
                : {}),
            ...(hasPosterFile || Object.hasOwn(normalizedPatch, 'poster')
              ? { poster: nextPoster }
              : {}),
            ...(shouldRefreshCreatedAt ? { createdAt: nextCreatedAt } : {}),
          }

          return { ...upload, ...uploadPatch }
        })
      )

      if (hasPosterFile && isBlobUrl(previousPoster) && previousPoster !== nextPoster) {
        URL.revokeObjectURL(previousPoster)
      }

      return true
    },
    [adminCatalogMovies]
  )

  const removeAdminUpload = useCallback(
    (uploadId) => {
      if (!isValidClipId(uploadId)) {
        return false
      }

      const normalizedUploadId = uploadId.trim()
      const removedUpload = adminUploads.find((upload) => upload.id === normalizedUploadId)
      if (!removedUpload) {
        return false
      }

      setAdminUploads((prevUploads) =>
        prevUploads.filter((upload) => upload.id !== normalizedUploadId)
      )

      const resolvedMovieId =
        typeof removedUpload.movieId === 'string' && removedUpload.movieId.trim()
          ? removedUpload.movieId.trim()
          : ''

      setAdminCatalogMovies((prevCatalogMovies) => {
        if (resolvedMovieId) {
          return prevCatalogMovies.filter((movie) => movie.id !== resolvedMovieId)
        }

        return prevCatalogMovies.filter((movie) => !areSameMovieByTitleAndGenre(movie, removedUpload))
      })

      return true
    },
    [adminUploads]
  )

  const getCatalog = useCallback(async () => {
    const adapterCatalog = await contentService.getCatalog()
    const safeCatalog = Array.isArray(adapterCatalog) ? adapterCatalog : []

    return [...adminCatalogMovies, ...safeCatalog]
  }, [adminCatalogMovies])

  const getFilteredClips = useCallback(() => {
    return feedService.getFeed({ selectedGenres })
  }, [selectedGenres])

  const getBookmarkedClips = useCallback(() => {
    return feedService.getBookmarks({ bookmarks })
  }, [bookmarks])

  const getProfile = useCallback(() => {
    return feedService.getProfile({ user })
  }, [user])

  const value = {
    user,
    authStatus,
    sessionExpired,
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
