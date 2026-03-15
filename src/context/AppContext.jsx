import { useCallback, useEffect, useRef, useState } from 'react'
import { authService } from '../services/auth-service'
import { validateCommentText } from '../services/comment-validation'
import { contentService } from '../services/content-service'
import { feedService } from '../services/feed-service'

import { AppContext } from './app-context'

const STORAGE_KEY = 'app_state_v1'
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
  bookmarks: [],
  likes: {},
  blockedCommentUsers: {},
  adminUploads: [],
  adminCatalogMovies: [],
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

function normalizeGenreIds(...values) {
  const normalized = []
  const seen = new Set()

  values.flat(Infinity).forEach((value) => {
    const genreId = normalizeGenreId(value)

    if (!genreId || seen.has(genreId)) {
      return
    }

    seen.add(genreId)
    normalized.push(genreId)
  })

  return normalized
}

function areSameGenreLists(left, right) {
  const leftGenres = normalizeGenreIds(left)
  const rightGenres = normalizeGenreIds(right)

  if (leftGenres.length !== rightGenres.length) {
    return false
  }

  return leftGenres.every((genreId, index) => genreId === rightGenres[index])
}

function normalizeDraftPreferences(value = {}) {
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  return {
    notificationsEnabled:
      typeof safeValue.notificationsEnabled === 'boolean'
        ? safeValue.notificationsEnabled
        : DEFAULT_DRAFT_PREFERENCES.notificationsEnabled,
    autoplayEnabled:
      typeof safeValue.autoplayEnabled === 'boolean'
        ? safeValue.autoplayEnabled
        : DEFAULT_DRAFT_PREFERENCES.autoplayEnabled,
    preferredLanguage:
      typeof safeValue.preferredLanguage === 'string' && safeValue.preferredLanguage.trim()
        ? safeValue.preferredLanguage.trim()
        : DEFAULT_DRAFT_PREFERENCES.preferredLanguage,
  }
}

function areSameDraftPreferences(left, right) {
  const leftPreferences = normalizeDraftPreferences(left)
  const rightPreferences = normalizeDraftPreferences(right)

  return (
    leftPreferences.notificationsEnabled === rightPreferences.notificationsEnabled &&
    leftPreferences.autoplayEnabled === rightPreferences.autoplayEnabled &&
    leftPreferences.preferredLanguage === rightPreferences.preferredLanguage
  )
}

function resolveProfileSyncErrorMessage(error) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to save preferences.'
}

function normalizeWatchUrl(value, fallback = '#') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeRating(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    return null
  }

  return Math.round(parsed * 10) / 10
}

function normalizeUserShape(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const role = value.role || (value.isAdmin ? 'admin' : 'user')

  return {
    ...value,
    role,
    name: value.name || value.displayName || '',
    avatar: value.avatar || value.avatarUrl || null,
  }
}

function normalizeAdminMediaEntry(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const { genreId: _legacyGenreId, genres: _legacyGenres, ...rest } = value
  const genreIds = normalizeGenreIds(rest.genreIds)

  return {
    ...rest,
    genreIds,
    watchUrl: normalizeWatchUrl(rest.watchUrl || rest.externalUrl, '#'),
    rating: normalizeRating(rest.rating),
  }
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
    bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks : [],
    likes: value.likes && typeof value.likes === 'object' ? value.likes : {},
    blockedCommentUsers: sanitizeBlockedCommentUsers(value.blockedCommentUsers),
    adminUploads: Array.isArray(value.adminUploads)
      ? value.adminUploads.map(normalizeAdminMediaEntry).filter(Boolean)
      : [],
    adminCatalogMovies: Array.isArray(value.adminCatalogMovies)
      ? value.adminCatalogMovies.map(normalizeAdminMediaEntry).filter(Boolean)
      : [],
  }
}

function persistStateSnapshot(state) {
  if (typeof window === 'undefined') {
    return
  }

  const snapshotState = {
    bookmarks: Array.isArray(state?.bookmarks) ? state.bookmarks : [],
    likes: state?.likes && typeof state.likes === 'object' ? state.likes : {},
    blockedCommentUsers: sanitizeBlockedCommentUsers(state?.blockedCommentUsers),
    adminUploads: Array.isArray(state?.adminUploads) ? state.adminUploads : [],
    adminCatalogMovies: Array.isArray(state?.adminCatalogMovies) ? state.adminCatalogMovies : [],
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: STATE_VERSION,
      state: snapshotState,
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

function readPersistedState() {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_STATE
    }

    const parsed = parseVersionedState(raw)
    return parsed || DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
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
    areSameGenreLists(left?.genreIds, right?.genreIds)
  )
}

function updateCommentLikeState(commentsByClip, clipId, commentId, shouldLike) {
  const safeComments = commentsByClip && typeof commentsByClip === 'object' ? commentsByClip : {}
  const clipComments = Array.isArray(safeComments[clipId]) ? safeComments[clipId] : []
  let didChange = false

  const nextClipComments = clipComments.map((comment) => {
    if (comment?.id !== commentId) {
      return comment
    }

    didChange = true

    const currentLiked = Boolean(comment.likedByViewer)
    const nextLiked = typeof shouldLike === 'boolean' ? shouldLike : !currentLiked
    const delta = nextLiked === currentLiked ? 0 : nextLiked ? 1 : -1

    return {
      ...comment,
      likedByViewer: nextLiked,
      likes: Math.max(0, (Number(comment.likes) || 0) + delta),
    }
  })

  if (!didChange) {
    return safeComments
  }

  return {
    ...safeComments,
    [clipId]: nextClipComments,
  }
}

export function AppProvider({ children }) {
  const [persistedState] = useState(() => readPersistedState())
  const [user, setUser] = useState(null)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [selectedGenres, setSelectedGenresState] = useState([])
  const selectedGenresRef = useRef([])
  const [bookmarks, setBookmarks] = useState(persistedState.bookmarks)
  const [likes, setLikes] = useState(persistedState.likes)
  const [blockedCommentUsers, setBlockedCommentUsers] = useState(persistedState.blockedCommentUsers)
  const [draftPreferences, setDraftPreferencesState] = useState(DEFAULT_DRAFT_PREFERENCES)
  const [comments, setComments] = useState({})
  const [adminUploads, setAdminUploads] = useState(persistedState.adminUploads)
  const [adminCatalogMovies, setAdminCatalogMovies] = useState(persistedState.adminCatalogMovies)
  const [genres, setGenres] = useState(() => contentService.getCachedGenres())
  const [genresStatus, setGenresStatus] = useState(
    contentService.getCachedGenres().length > 0 ? 'ready' : 'loading'
  )
  const [authStatus, setAuthStatus] = useState('checking')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [isProfileSyncing, setIsProfileSyncing] = useState(false)
  const [profileSyncError, setProfileSyncError] = useState('')

  const replaceSelectedGenres = useCallback((nextValue) => {
    const nextGenres = normalizeGenreIds(nextValue)
    selectedGenresRef.current = nextGenres
    setSelectedGenresState(nextGenres)
    return nextGenres
  }, [])

  const persistCurrentAppState = useCallback(() => {
    persistStateSnapshot({
      bookmarks,
      likes,
      blockedCommentUsers,
      adminUploads,
      adminCatalogMovies,
    })
  }, [adminCatalogMovies, adminUploads, blockedCommentUsers, bookmarks, likes])

  const resetSessionState = useCallback(
    ({ expired = false } = {}) => {
      setUser(null)
      setAuthStatus('anonymous')
      setHasCompletedOnboarding(false)
      replaceSelectedGenres([])
      setBookmarks([])
      setLikes({})
      setDraftPreferencesState(DEFAULT_DRAFT_PREFERENCES)
      setSessionExpired(expired)
      setIsProfileSyncing(false)
      setProfileSyncError('')
    },
    [replaceSelectedGenres]
  )

  const applyAuthenticatedSession = useCallback(
    (sessionOrUser) => {
      const sessionUser = sessionOrUser?.user || sessionOrUser
      const normalizedUser = normalizeUserShape(sessionUser || {})

      setUser(normalizedUser)
      setSessionExpired(false)
      setHasCompletedOnboarding(Boolean(sessionUser?.hasCompletedOnboarding))
      replaceSelectedGenres(sessionUser?.selectedGenres)
      setDraftPreferencesState(normalizeDraftPreferences(sessionUser?.preferences))
      setAuthStatus('authenticated')
      setProfileSyncError('')

      return normalizedUser
    },
    [replaceSelectedGenres]
  )

  const persistUserProfilePatch = useCallback(
    async (patch, { optimisticSelectedGenres, optimisticDraftPreferences } = {}) => {
      if (!user) {
        throw new Error('Authentication required.')
      }

      if (isProfileSyncing) {
        throw new Error('Profile update already in progress.')
      }

      const previousSelectedGenres = selectedGenres
      const previousDraftPreferences = draftPreferences
      const hasOptimisticGenres = optimisticSelectedGenres !== undefined
      const hasOptimisticPreferences = optimisticDraftPreferences !== undefined

      if (hasOptimisticGenres) {
        replaceSelectedGenres(optimisticSelectedGenres)
      }

      if (hasOptimisticPreferences) {
        setDraftPreferencesState(optimisticDraftPreferences)
      }

      setIsProfileSyncing(true)
      setProfileSyncError('')

      try {
        const nextSession = await authService.patchCurrentUser(patch)
        const nextUser = applyAuthenticatedSession(nextSession)
        return nextUser
      } catch (error) {
        if (hasOptimisticGenres) {
          replaceSelectedGenres(previousSelectedGenres)
        }

        if (hasOptimisticPreferences) {
          setDraftPreferencesState(previousDraftPreferences)
        }

        setProfileSyncError(resolveProfileSyncErrorMessage(error))
        throw error
      } finally {
        setIsProfileSyncing(false)
      }
    },
    [
      applyAuthenticatedSession,
      draftPreferences,
      isProfileSyncing,
      replaceSelectedGenres,
      selectedGenres,
      user,
    ]
  )

  const loadGenres = useCallback(async ({ force = false } = {}) => {
    setGenresStatus((current) => (current === 'ready' && !force ? current : 'loading'))

    try {
      const loadedGenres = await contentService.getGenres({ force })
      setGenres(Array.isArray(loadedGenres) ? loadedGenres : [])
      setGenresStatus('ready')
      return loadedGenres
    } catch {
      setGenres((current) => current)
      setGenresStatus('error')
      return []
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    queueMicrotask(() => {
      if (!isCancelled) {
        loadGenres()
      }
    })

    return () => {
      isCancelled = true
    }
  }, [loadGenres])

  useEffect(() => {
    let isMounted = true

    Promise.resolve(feedService.getInitialComments())
      .then((loadedComments) => {
        if (!isMounted) {
          return
        }

        setComments(loadedComments && typeof loadedComments === 'object' ? loadedComments : {})
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setComments({})
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    authService
      .restoreSession()
      .then(({ session, expired }) => {
        if (!isMounted) {
          return
        }

        if (!session?.user) {
          resetSessionState({ expired })
          return
        }

        applyAuthenticatedSession(session)
        setSessionExpired(Boolean(expired))
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        resetSessionState({ expired: true })
      })

    return () => {
      isMounted = false
    }
  }, [applyAuthenticatedSession, resetSessionState])

  useEffect(() => {
    const unsubscribe = authService.subscribeToSessionEnded((reason) => {
      resetSessionState({ expired: reason === 'expired' })
    })

    return unsubscribe
  }, [resetSessionState])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    persistCurrentAppState()
  }, [persistCurrentAppState])

  const login = useCallback(
    async (credentials = {}) => {
      const session =
        credentials?.mode === 'signup'
          ? await authService.signUp(credentials)
          : await authService.signIn(credentials)

      return applyAuthenticatedSession(session)
    },
    [applyAuthenticatedSession]
  )

  const updateOnboardingStatus = useCallback(
    async (nextValue) => {
      if (!user) {
        throw new Error('Authentication required.')
      }

      const resolved =
        typeof nextValue === 'function'
          ? Boolean(nextValue(hasCompletedOnboarding))
          : Boolean(nextValue)

      return persistUserProfilePatch(
        resolved
          ? { hasCompletedOnboarding: resolved, selectedGenres: selectedGenresRef.current }
          : { hasCompletedOnboarding: resolved }
      )
    },
    [hasCompletedOnboarding, persistUserProfilePatch, user]
  )

  const logout = useCallback(async () => {
    await authService.logout()
    resetSessionState()
  }, [resetSessionState])

  const blockUserComments = useCallback(
    async (authorId) => {
      if (typeof authorId !== 'string' || !authorId.trim()) {
        return false
      }

      const normalizedAuthorId = authorId.trim()
      const next = await feedService.blockUserComments({
        authorId: normalizedAuthorId,
        blockedUsers: blockedCommentUsers,
      })

      if (!next || typeof next !== 'object') {
        return false
      }

      setBlockedCommentUsers(next)
      return Boolean(next[normalizedAuthorId])
    },
    [blockedCommentUsers]
  )

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

  const deleteComment = useCallback(
    async ({ clipId, commentId }) => {
      if (!isValidClipId(clipId) || typeof commentId !== 'string' || !commentId.trim()) {
        return false
      }

      const normalizedCommentId = commentId.trim()
      const next = await feedService.deleteComment({
        clipId,
        commentId: normalizedCommentId,
        comments,
      })

      const prevLength = Array.isArray(comments?.[clipId]) ? comments[clipId].length : 0
      const nextLength = Array.isArray(next?.[clipId]) ? next[clipId].length : 0
      const didDelete = nextLength < prevLength

      if (didDelete) {
        setComments(next)
      }

      return didDelete
    },
    [comments]
  )

  const deleteCommentsByUser = useCallback(
    async ({ authorId }) => {
      if (typeof authorId !== 'string' || !authorId.trim()) {
        return false
      }

      const normalizedAuthorId = authorId.trim()
      const next = await feedService.deleteCommentsByUser({
        authorId: normalizedAuthorId,
        comments,
      })

      const prevCount = Object.values(comments).reduce(
        (acc, clipComments) => acc + (clipComments?.length || 0),
        0
      )
      const nextCount = Object.values(next || {}).reduce(
        (acc, clipComments) => acc + (clipComments?.length || 0),
        0
      )
      const didDelete = nextCount < prevCount

      if (didDelete) {
        setComments(next)
      }

      return didDelete
    },
    [comments]
  )

  const setSelectedGenres = useCallback(
    async (nextValue) => {
      const currentSelectedGenres = selectedGenresRef.current
      const nextGenres = normalizeGenreIds(
        typeof nextValue === 'function' ? nextValue(currentSelectedGenres) : nextValue
      )

      if (areSameGenreLists(currentSelectedGenres, nextGenres)) {
        setProfileSyncError('')
        return nextGenres
      }

      if (!user || !hasCompletedOnboarding) {
        replaceSelectedGenres(nextGenres)
        setProfileSyncError('')
        return nextGenres
      }

      try {
        await persistUserProfilePatch(
          { selectedGenres: nextGenres },
          { optimisticSelectedGenres: nextGenres }
        )
        return nextGenres
      } catch {
        return selectedGenresRef.current
      }
    },
    [hasCompletedOnboarding, persistUserProfilePatch, replaceSelectedGenres, user]
  )

  const toggleGenre = useCallback(
    async (genreId) => {
      const normalizedGenreId = normalizeGenreId(genreId)
      if (!normalizedGenreId) {
        return selectedGenresRef.current
      }

      return setSelectedGenres((currentSelectedGenres) =>
        currentSelectedGenres.includes(normalizedGenreId)
          ? currentSelectedGenres.filter((currentGenreId) => currentGenreId !== normalizedGenreId)
          : [...currentSelectedGenres, normalizedGenreId]
      )
    },
    [setSelectedGenres]
  )

  const selectAllGenres = useCallback(async () => {
    const allGenreIds = genres.map((genre) => normalizeGenreId(genre?.id)).filter(Boolean)
    return setSelectedGenres([...new Set(allGenreIds)])
  }, [genres, setSelectedGenres])

  const toggleBookmark = useCallback(
    async (clipId) => {
      if (!user || !isValidClipId(clipId)) {
        return false
      }

      const prevBookmarks = bookmarks
      const shouldBookmark = !bookmarks.includes(clipId)

      try {
        return await feedService.optimisticToggleBookmark({
          clipId,
          shouldBookmark,
          applyLocal: () => {
            setBookmarks((current) =>
              current.includes(clipId)
                ? current.filter((id) => id !== clipId)
                : [...current, clipId]
            )
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
      if (!user || !isValidClipId(clipId)) {
        return false
      }

      const prevLikes = likes
      const shouldLike = !likes[clipId]

      try {
        return await feedService.optimisticToggleLike({
          clipId,
          shouldLike,
          applyLocal: () => {
            setLikes((current) => ({
              ...current,
              [clipId]: !current[clipId],
            }))
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

  const toggleCommentLike = useCallback(
    async (clipId, commentId) => {
      if (!user || !isValidClipId(clipId) || typeof commentId !== 'string' || !commentId.trim()) {
        return false
      }

      const normalizedCommentId = commentId.trim()
      const clipComments = Array.isArray(comments[clipId]) ? comments[clipId] : []
      const targetComment = clipComments.find((comment) => comment.id === normalizedCommentId)

      if (!targetComment) {
        return false
      }

      const prevComments = comments
      const shouldLike = !targetComment.likedByViewer

      try {
        return await feedService.optimisticToggleCommentLike({
          clipId,
          commentId: normalizedCommentId,
          shouldLike,
          applyLocal: () => {
            setComments((current) =>
              updateCommentLikeState(current, clipId, normalizedCommentId, shouldLike)
            )
          },
          rollbackLocal: () => {
            setComments(prevComments)
          },
        })
      } catch {
        setComments(prevComments)
        return false
      }
    },
    [comments, user]
  )

  const addComment = useCallback(
    async (clipId, text) => {
      if (!user) {
        return { ok: false, error: AUTH_REQUIRED_ERROR }
      }

      const currentAuthorId = user?.id || user?.email
      const currentUserEmail = typeof user?.email === 'string' ? user.email : ''
      if (
        isUserCommentBlocked(currentAuthorId) ||
        (currentUserEmail && isUserCommentBlocked(currentUserEmail))
      ) {
        return { ok: false, error: COMMENT_BLOCKED_ERROR }
      }

      const validation = validateCommentText(text)
      if (!validation.valid) {
        return { ok: false, error: validation.error }
      }

      try {
        const nextComments = await feedService.createComment({
          clipId,
          text: validation.normalizedText,
          comments,
        })

        setComments(nextComments)
        return { ok: true, error: '' }
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        const isUnauthorizedError = /\(401\)|\(403\)/.test(message)

        return {
          ok: false,
          error: isUnauthorizedError
            ? COMMENT_UNAUTHORIZED_ERROR
            : message || 'comment_submit_failed',
        }
      }
    },
    [comments, isUserCommentBlocked, user]
  )

  const setDraftPreferences = useCallback((nextValue) => {
    setDraftPreferencesState((prev) =>
      normalizeDraftPreferences(typeof nextValue === 'function' ? nextValue(prev) : nextValue)
    )
    setProfileSyncError('')
  }, [])

  const updateDraftPreferences = useCallback((patch) => {
    setDraftPreferencesState((prev) => normalizeDraftPreferences({ ...prev, ...patch }))
    setProfileSyncError('')
  }, [])

  const saveProfilePreferences = useCallback(
    async ({
      selectedGenres: nextSelectedGenres = selectedGenres,
      draftPreferences: nextDraftPreferences = draftPreferences,
    } = {}) => {
      if (!user) {
        throw new Error('Authentication required.')
      }

      const normalizedGenres = normalizeGenreIds(nextSelectedGenres)
      const normalizedPreferences = normalizeDraftPreferences(nextDraftPreferences)
      const hasChanges =
        !areSameGenreLists(selectedGenres, normalizedGenres) ||
        !areSameDraftPreferences(draftPreferences, normalizedPreferences)

      if (!hasChanges) {
        setProfileSyncError('')
        return user
      }

      return persistUserProfilePatch(
        {
          selectedGenres: normalizedGenres,
          preferences: normalizedPreferences,
        },
        {
          optimisticSelectedGenres: normalizedGenres,
          optimisticDraftPreferences: normalizedPreferences,
        }
      )
    },
    [draftPreferences, persistUserProfilePatch, selectedGenres, user]
  )

  const addAdminClip = useCallback((form) => {
    const uploadId = `upload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const createdAt = new Date().toLocaleString()
    const poster = form.posterFile ? URL.createObjectURL(form.posterFile) : ''
    const watchUrl = normalizeWatchUrl(form.watchUrl || form.externalUrl, '#')
    const normalizedGenreIds = normalizeGenreIds(form.genreIds)
    const normalizedRating = normalizeRating(form.rating)
    const backendClipId = typeof form.id === 'string' && form.id.trim() ? form.id.trim() : ''

    const catalogMovieId = backendClipId ? `admin_${backendClipId}` : `admin_${uploadId}`
    const upload = {
      id: uploadId,
      movieId: backendClipId || catalogMovieId,
      title: form.title,
      description: form.description,
      genreIds: normalizedGenreIds,
      durationSec: form.durationSec,
      duration: form.duration,
      kinopoiskId: form.kinopoiskId,
      thumbnailUrl: form.thumbnailUrl,
      rating: normalizedRating,
      videoUrl: form.videoUrl,
      clipDescription: form.clipDescription || form.description || '',
      watchUrl,
      status: 'processing',
      createdAt,
      poster,
    }

    setAdminUploads((prev) => [upload, ...prev])

    const catalogMovie = {
      id: catalogMovieId,
      title: form.title,
      rating: normalizedRating,
      genreIds: normalizedGenreIds,
      poster,
      description: form.description,
      durationSec: Number(form.durationSec) || 0,
      duration: form.duration,
      kinopoiskId: form.kinopoiskId,
      thumbnailUrl: form.thumbnailUrl || poster,
      videoUrl: form.videoUrl || '',
      clipDescription: form.clipDescription || form.description || '',
      watchUrl,
      createdAt,
    }

    setAdminCatalogMovies((prev) => {
      const existingIndex = prev.findIndex((movie) =>
        areSameMovieByTitleAndGenre(movie, catalogMovie)
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

  const updateAdminClip = useCallback(
    (clipId, patchOrForm) => {
      if (!isValidClipId(clipId)) {
        return false
      }

      const normalizedPatch = normalizeClipPatch(patchOrForm)
      const nextWatchUrl =
        Object.hasOwn(normalizedPatch, 'watchUrl') || Object.hasOwn(normalizedPatch, 'externalUrl')
          ? normalizeWatchUrl(normalizedPatch.watchUrl || normalizedPatch.externalUrl, '')
          : undefined
      const normalizedClipId = clipId.trim()
      const resolvedUploadId = normalizedClipId.startsWith('admin_')
        ? normalizedClipId.slice('admin_'.length)
        : normalizedClipId
      const resolvedCatalogId = normalizedClipId.startsWith('admin_')
        ? normalizedClipId
        : `admin_${normalizedClipId}`
      const existingCatalogMovie = adminCatalogMovies.find(
        (movie) => movie.id === resolvedCatalogId
      )

      if (!existingCatalogMovie) {
        return false
      }

      const hasPosterFile = Boolean(normalizedPatch.posterFile)
      const hasClipFile = Boolean(normalizedPatch.clipFile)
      const hasGenrePatch = Object.hasOwn(normalizedPatch, 'genreIds')
      const nextGenreIds = hasGenrePatch ? normalizeGenreIds(normalizedPatch.genreIds) : undefined
      if (hasGenrePatch && nextGenreIds.length === 0) {
        return false
      }
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
          ...(hasGenrePatch ? { genreIds: nextGenreIds } : {}),
          ...(nextWatchUrl !== undefined ? { watchUrl: nextWatchUrl } : {}),
          ...(Object.hasOwn(normalizedPatch, 'clipDescription')
            ? { clipDescription: normalizedPatch.clipDescription }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'description')
            ? { description: normalizedPatch.description }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'duration')
            ? { duration: normalizedPatch.duration }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'durationSec')
            ? { durationSec: Number(normalizedPatch.durationSec) || 0 }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'kinopoiskId')
            ? { kinopoiskId: normalizedPatch.kinopoiskId }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'rating')
            ? { rating: normalizeRating(normalizedPatch.rating) }
            : {}),
          ...(Object.hasOwn(normalizedPatch, 'status') ? { status: normalizedPatch.status } : {}),
          ...(hasPosterFile || Object.hasOwn(normalizedPatch, 'poster')
            ? { poster: nextPoster }
            : {}),
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
            upload.movieId === normalizedClipId ||
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
            ...(hasGenrePatch ? { genreIds: nextGenreIds } : {}),
            ...(Object.hasOwn(normalizedPatch, 'duration')
              ? { duration: normalizedPatch.duration }
              : {}),
            ...(Object.hasOwn(normalizedPatch, 'durationSec')
              ? { durationSec: Number(normalizedPatch.durationSec) || 0 }
              : {}),
            ...(Object.hasOwn(normalizedPatch, 'kinopoiskId')
              ? { kinopoiskId: normalizedPatch.kinopoiskId }
              : {}),
            ...(Object.hasOwn(normalizedPatch, 'rating')
              ? { rating: normalizeRating(normalizedPatch.rating) }
              : {}),
            ...(nextWatchUrl !== undefined ? { watchUrl: nextWatchUrl } : {}),
            ...(Object.hasOwn(normalizedPatch, 'clipDescription')
              ? { clipDescription: normalizedPatch.clipDescription }
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
          return prevCatalogMovies.filter(
            (movie) => movie.id !== resolvedMovieId && movie.id !== `admin_${resolvedMovieId}`
          )
        }

        return prevCatalogMovies.filter(
          (movie) => !areSameMovieByTitleAndGenre(movie, removedUpload)
        )
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

  const getFilteredClips = useCallback(async () => {
    return feedService.getFeed({ selectedGenres })
  }, [selectedGenres])

  const getBookmarkedClips = useCallback(async () => {
    return feedService.getBookmarks({ bookmarks })
  }, [bookmarks])

  const getProfile = useCallback(async () => {
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
    genres,
    genresStatus,
    isProfileSyncing,
    profileSyncError,
    login,
    logout,
    setHasCompletedOnboarding: updateOnboardingStatus,
    toggleGenre,
    selectAllGenres,
    toggleBookmark,
    toggleLike,
    toggleCommentLike,
    blockUserComments,
    unblockUserComments,
    isUserCommentBlocked,
    addComment,
    deleteComment,
    deleteCommentsByUser,
    getFilteredClips,
    getBookmarkedClips,
    getProfile,
    getCatalog,
    reloadGenres: loadGenres,
    setSelectedGenres,
    setDraftPreferences,
    updateDraftPreferences,
    saveProfilePreferences,
    addAdminClip,
    updateAdminClip,
    removeAdminUpload,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
