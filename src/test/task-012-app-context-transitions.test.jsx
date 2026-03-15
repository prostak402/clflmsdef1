import { act, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AppProvider } from '../context/AppContext'
import { useApp } from '../context/useApp'
import { feedService } from '../services/feed-service'
import { persistAuthenticatedState } from './test-session-helpers'

function ContextProbe({ onUpdate }) {
  const app = useApp()

  useEffect(() => {
    onUpdate(app)
  }, [app, onUpdate])

  return null
}

async function renderAppContext() {
  let current

  const view = render(
    <AppProvider>
      <ContextProbe
        onUpdate={(value) => {
          current = value
        }}
      />
    </AppProvider>
  )

  await waitFor(() => {
    expect(current).toBeTruthy()
  })

  return {
    getCurrent: () => current,
    unmount: view.unmount,
  }
}

async function signUpUser(getCurrent, { displayName, email }) {
  await act(async () => {
    await getCurrent().login({
      displayName,
      email,
      password: 'local-password',
      mode: 'signup',
    })
  })
}

describe('TASK-012: AppContext state transitions', () => {
  it('blocks content actions for unauthenticated user', async () => {
    const { getCurrent } = await renderAppContext()

    const likesSnapshot = { ...getCurrent().likes }
    const bookmarksSnapshot = [...getCurrent().bookmarks]
    const commentsSnapshot = { ...getCurrent().comments }

    await expect(getCurrent().toggleLike('1')).resolves.toBe(false)
    await expect(getCurrent().toggleBookmark('1')).resolves.toBe(false)
    await expect(getCurrent().addComment('1', 'Comment without login')).resolves.toEqual({
      ok: false,
      error: 'auth_required',
    })

    expect(getCurrent().isUserCommentBlocked('random')).toBe(false)
    expect(getCurrent().likes).toEqual(likesSnapshot)
    expect(getCurrent().bookmarks).toEqual(bookmarksSnapshot)
    expect(getCurrent().comments).toEqual(commentsSnapshot)
  })

  it('applies like and bookmark transitions and supports repeated toggles', async () => {
    const { getCurrent } = await renderAppContext()

    await signUpUser(getCurrent, {
      displayName: 'State User',
      email: 'state@example.com',
    })

    await act(async () => {
      await getCurrent().toggleLike('1')
      await getCurrent().toggleBookmark('1')
    })

    expect(getCurrent().likes['1']).toBe(true)
    expect(getCurrent().bookmarks).toContain('1')

    await act(async () => {
      await getCurrent().toggleLike('1')
      await getCurrent().toggleBookmark('1')
    })

    expect(getCurrent().likes['1']).toBe(false)
    expect(getCurrent().bookmarks).not.toContain('1')
  })

  it('updates comments and rejects invalid comment payload', async () => {
    const { getCurrent } = await renderAppContext()

    await signUpUser(getCurrent, {
      displayName: 'Test User',
      email: 'test@example.com',
    })

    const beforeCommentsCount = getCurrent().comments['1']?.length ?? 0

    let result
    await act(async () => {
      result = await getCurrent().addComment('1', '  Great pick!  ')
    })

    expect(result).toEqual({ ok: true, error: '' })
    expect(getCurrent().comments['1']).toHaveLength(beforeCommentsCount + 1)
    expect(getCurrent().comments['1'][0].text).toBe('Great pick!')
    expect(getCurrent().comments['1'][0].authorName).toBe('Test User')
    expect(getCurrent().comments['1'][0].authorId).toBe(getCurrent().user.id)
    expect(getCurrent().comments['1'][0].createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/)

    let invalidResult
    await act(async () => {
      invalidResult = await getCurrent().addComment('1', '   ')
    })

    expect(invalidResult.ok).toBe(false)
    expect(getCurrent().comments['1']).toHaveLength(beforeCommentsCount + 1)
  })

  it('toggles comment likes with optimistic state update', async () => {
    const { getCurrent } = await renderAppContext()

    await signUpUser(getCurrent, {
      displayName: 'Comment User',
      email: 'commenter@example.com',
    })

    const initialComment = getCurrent().comments['1'][0]

    await act(async () => {
      await getCurrent().toggleCommentLike('1', initialComment.id)
    })

    expect(getCurrent().comments['1'][0]).toEqual(
      expect.objectContaining({
        id: initialComment.id,
        likedByViewer: true,
        likes: initialComment.likes + 1,
      })
    )

    await act(async () => {
      await getCurrent().toggleCommentLike('1', initialComment.id)
    })

    expect(getCurrent().comments['1'][0]).toEqual(
      expect.objectContaining({
        id: initialComment.id,
        likedByViewer: false,
        likes: initialComment.likes,
      })
    )
  })

  it('returns unauthorized comment error when backend rejects createComment', async () => {
    const { getCurrent } = await renderAppContext()

    await signUpUser(getCurrent, {
      displayName: 'Test User',
      email: 'test@example.com',
    })

    const beforeComments = getCurrent().comments
    const createCommentSpy = vi
      .spyOn(feedService, 'createComment')
      .mockRejectedValueOnce(new Error('Unauthorized (401)'))

    let result
    await act(async () => {
      result = await getCurrent().addComment('1', 'Will fail')
    })

    expect(result).toEqual({ ok: false, error: 'comment_unauthorized' })
    expect(getCurrent().comments).toEqual(beforeComments)

    createCommentSpy.mockRestore()
  })

  it('blocks comments by author and supports delete operations', async () => {
    const { getCurrent } = await renderAppContext()

    await signUpUser(getCurrent, {
      displayName: 'Blocked User',
      email: 'blocked@example.com',
    })

    const currentUserId = getCurrent().user.id

    await act(async () => {
      await getCurrent().blockUserComments(currentUserId)
    })

    expect(getCurrent().isUserCommentBlocked(currentUserId)).toBe(true)

    let blockedResult
    await act(async () => {
      blockedResult = await getCurrent().addComment('1', 'Should not be added')
    })

    expect(blockedResult).toEqual({ ok: false, error: 'comment_blocked' })

    await act(async () => {
      getCurrent().unblockUserComments(currentUserId)
    })

    expect(getCurrent().isUserCommentBlocked(currentUserId)).toBe(false)

    let allowedResult
    await act(async () => {
      allowedResult = await getCurrent().addComment('1', 'Allowed now')
    })

    expect(allowedResult).toEqual({ ok: true, error: '' })

    const createdComment = getCurrent().comments['1'][0]

    await act(async () => {
      await getCurrent().deleteComment({ clipId: '1', commentId: createdComment.id })
    })

    expect(
      getCurrent().comments['1'].find((comment) => comment.id === createdComment.id)
    ).toBeFalsy()

    await act(async () => {
      await getCurrent().addComment('1', 'First by blocked user')
      await getCurrent().addComment('2', 'Second by blocked user')
    })

    await act(async () => {
      await getCurrent().deleteCommentsByUser({ authorId: currentUserId })
    })

    expect(
      (getCurrent().comments['1'] || []).every((comment) => comment.authorId !== currentUserId)
    ).toBe(true)
    expect(
      (getCurrent().comments['2'] || []).every((comment) => comment.authorId !== currentUserId)
    ).toBe(true)
  })

  it('keeps profile metrics consistent between repeated reads and provider remount', async () => {
    const getProfileSpy = vi.spyOn(feedService, 'getProfile').mockReturnValue({
      name: 'Backend Profile',
      email: 'backend@example.com',
      avatar: 'Movie',
      bookmarkCount: 12,
      likeCount: 8,
      watchedCount: 3,
    })

    const firstRender = await renderAppContext()

    await signUpUser(firstRender.getCurrent, {
      displayName: 'Local User',
      email: 'local@example.com',
    })

    await act(async () => {
      await firstRender.getCurrent().toggleBookmark('1')
      await firstRender.getCurrent().toggleLike('1')
    })

    await expect(firstRender.getCurrent().getProfile()).resolves.toMatchObject({
      bookmarkCount: 12,
      likeCount: 8,
      watchedCount: 3,
    })

    firstRender.unmount()

    const secondRender = await renderAppContext()

    await expect(secondRender.getCurrent().getProfile()).resolves.toMatchObject({
      bookmarkCount: 12,
      likeCount: 8,
      watchedCount: 3,
    })

    getProfileSpy.mockRestore()
    secondRender.unmount()
  })

  it('keeps onboarding genres locally, then persists canonical genres after onboarding', async () => {
    const { getCurrent } = await renderAppContext()

    await signUpUser(getCurrent, {
      displayName: 'Genre User',
      email: 'genres@example.com',
    })

    await act(async () => {
      await getCurrent().toggleGenre('action')
      await getCurrent().toggleGenre('sci-fi')
    })

    expect(getCurrent().selectedGenres).toEqual(['action', 'scifi'])

    await act(async () => {
      await getCurrent().setHasCompletedOnboarding(true)
    })

    let session = JSON.parse(window.localStorage.getItem('auth_session_v1'))
    expect(session.user.hasCompletedOnboarding).toBe(true)
    expect(session.user.selectedGenres).toEqual(['action', 'scifi'])

    await act(async () => {
      await getCurrent().toggleGenre('drama')
    })

    session = JSON.parse(window.localStorage.getItem('auth_session_v1'))
    expect(getCurrent().selectedGenres).toEqual(['action', 'scifi', 'drama'])
    expect(session.user.selectedGenres).toEqual(['action', 'scifi', 'drama'])

    await act(async () => {
      await getCurrent().saveProfilePreferences({
        selectedGenres: ['drama'],
        draftPreferences: {
          notificationsEnabled: false,
          autoplayEnabled: false,
          preferredLanguage: 'ru',
        },
      })
    })

    session = JSON.parse(window.localStorage.getItem('auth_session_v1'))
    expect(getCurrent().selectedGenres).toEqual(['drama'])
    expect(getCurrent().draftPreferences).toEqual({
      notificationsEnabled: false,
      autoplayEnabled: false,
      preferredLanguage: 'ru',
    })
    expect(session.user.selectedGenres).toEqual(['drama'])
    expect(session.user.preferences).toEqual({
      notificationsEnabled: false,
      autoplayEnabled: false,
      preferredLanguage: 'ru',
    })
  })

  it('rejects invalid like/bookmark payload and preserves previous state', async () => {
    const { getCurrent } = await renderAppContext()

    await signUpUser(getCurrent, {
      displayName: 'Local User',
      email: 'local@example.com',
    })

    await act(async () => {
      await getCurrent().toggleLike('1')
      await getCurrent().toggleBookmark('1')
    })

    const likesSnapshot = { ...getCurrent().likes }
    const bookmarksSnapshot = [...getCurrent().bookmarks]

    await expect(getCurrent().toggleLike('')).resolves.toBe(false)
    await expect(getCurrent().toggleBookmark('')).resolves.toBe(false)

    expect(getCurrent().likes).toEqual(likesSnapshot)
    expect(getCurrent().bookmarks).toEqual(bookmarksSnapshot)
  })

  it('removes upload and linked catalog movie by movieId', async () => {
    const { getCurrent } = await renderAppContext()

    await act(async () => {
      getCurrent().addAdminClip({
        title: 'Linked Movie',
        description: 'desc',
        genreId: 'drama',
        durationSec: 120,
        duration: '120',
        kinopoiskId: '123',
        watchUrl: 'https://example.com/movie',
        posterFile: null,
        clipFile: null,
      })
    })

    const createdUpload = getCurrent().adminUploads[0]
    expect(createdUpload.movieId).toBeTruthy()

    const createdMovie = getCurrent().adminCatalogMovies.find(
      (movie) => movie.id === createdUpload.movieId
    )
    expect(createdMovie).toBeTruthy()

    await act(async () => {
      const removed = getCurrent().removeAdminUpload(createdUpload.id)
      expect(removed).toBe(true)
    })

    expect(getCurrent().adminUploads.find((upload) => upload.id === createdUpload.id)).toBeFalsy()
    expect(
      getCurrent().adminCatalogMovies.find((movie) => movie.id === createdUpload.movieId)
    ).toBeFalsy()
    await expect(getCurrent().getCatalog()).resolves.not.toContainEqual(
      expect.objectContaining({ id: createdUpload.movieId })
    )
  })

  it('preserves blocked comment users across logout because they live in app UI state', async () => {
    persistAuthenticatedState({
      user: { id: 'usr_local_demo', name: 'Demo User', email: 'user@local.dev', role: 'user' },
      hasCompletedOnboarding: true,
      blockedCommentUsers: { usr_local_demo: true },
    })

    const { getCurrent } = await renderAppContext()

    await waitFor(() => {
      expect(getCurrent().authStatus).toBe('authenticated')
    })

    expect(getCurrent().isUserCommentBlocked('usr_local_demo')).toBe(true)

    await act(async () => {
      await getCurrent().logout()
    })

    expect(getCurrent().authStatus).toBe('anonymous')
    expect(getCurrent().blockedCommentUsers).toEqual({ usr_local_demo: true })
    expect(getCurrent().isUserCommentBlocked('usr_local_demo')).toBe(true)
  })

  it('supports title/genreIds matching and keeps getCatalog consistent after edit/delete', async () => {
    const legacyUploadId = 'upload_legacy_1'
    const legacyMovieId = 'admin_legacy_1'
    window.localStorage.setItem(
      'app_state_v1',
      JSON.stringify({
        version: 1,
        state: {
          user: null,
          hasCompletedOnboarding: false,
          selectedGenres: [],
          bookmarks: [],
          likes: {},
          blockedCommentUsers: {},
          draftPreferences: {
            notificationsEnabled: true,
            autoplayEnabled: true,
            preferredLanguage: 'en',
          },
          adminUploads: [
            {
              id: legacyUploadId,
              title: 'Legacy Movie',
              genreIds: ['drama'],
              status: 'ready',
              createdAt: 'legacy',
            },
          ],
          adminCatalogMovies: [
            {
              id: legacyMovieId,
              title: 'Legacy Movie',
              rating: 0,
              genreIds: ['drama'],
              poster: '',
              watchUrl: '#',
              description: '',
              clipDescription: '',
              duration: '',
              director: '',
              kinopoiskId: '',
              createdAt: 'legacy',
            },
          ],
        },
      })
    )

    const { getCurrent } = await renderAppContext()

    await act(async () => {
      const updated = getCurrent().updateAdminClip(legacyMovieId, {
        title: 'Legacy Movie Edited',
      })
      expect(updated).toBe(true)
    })

    await expect(getCurrent().getCatalog()).resolves.toContainEqual(
      expect.objectContaining({ id: legacyMovieId, title: 'Legacy Movie Edited' })
    )

    await act(async () => {
      const removed = getCurrent().removeAdminUpload(legacyUploadId)
      expect(removed).toBe(true)
    })

    expect(getCurrent().adminCatalogMovies.find((movie) => movie.id === legacyMovieId)).toBeFalsy()
    await expect(getCurrent().getCatalog()).resolves.not.toContainEqual(
      expect.objectContaining({ id: legacyMovieId })
    )
  })
})
