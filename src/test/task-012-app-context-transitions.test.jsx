import { act, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'

import { AppProvider } from '../context/AppContext'
import { useApp } from '../context/useApp'

function ContextProbe({ onUpdate }) {
  const app = useApp()

  useEffect(() => {
    onUpdate(app)
  }, [app, onUpdate])

  return null
}

async function renderAppContext() {
  let current

  render(
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
  }
}

describe('TASK-012: AppContext state transitions', () => {
  it('blocks content actions for unauthenticated user', async () => {
    const { getCurrent } = await renderAppContext()

    const likesSnapshot = { ...getCurrent().likes }
    const bookmarksSnapshot = [...getCurrent().bookmarks]
    const commentsSnapshot = { ...getCurrent().comments }

    await expect(getCurrent().toggleLike('1')).resolves.toBe(false)
    await expect(getCurrent().toggleBookmark('1')).resolves.toBe(false)
    expect(getCurrent().addComment('1', 'Комментарий без логина')).toEqual({
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

    await act(async () => {
      getCurrent().login({ name: 'State User', email: 'state@example.com' })
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

    await act(async () => {
      getCurrent().login({ name: 'Test User', email: 'test@example.com' })
    })

    const beforeCommentsCount = getCurrent().comments['1']?.length ?? 0

    let result
    await act(async () => {
      result = getCurrent().addComment('1', '  Great pick!  ')
    })

    expect(result).toEqual({ ok: true, error: '' })
    expect(getCurrent().comments['1']).toHaveLength(beforeCommentsCount + 1)
    expect(getCurrent().comments['1'][0].text).toBe('Great pick!')
    expect(getCurrent().comments['1'][0].authorName).toBe('Test User')
    expect(getCurrent().comments['1'][0].authorId).toBe('test@example.com')
    expect(getCurrent().comments['1'][0].createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/)

    let invalidResult
    await act(async () => {
      invalidResult = getCurrent().addComment('1', '   ')
    })

    expect(invalidResult.ok).toBe(false)
    expect(getCurrent().comments['1']).toHaveLength(beforeCommentsCount + 1)
  })

  it('blocks comments by author and supports delete operations', async () => {
    const { getCurrent } = await renderAppContext()

    await act(async () => {
      getCurrent().login({ name: 'Blocked User', email: 'blocked@example.com' })
    })

    await act(async () => {
      getCurrent().blockUserComments('blocked@example.com')
    })

    expect(getCurrent().isUserCommentBlocked('blocked@example.com')).toBe(true)

    let blockedResult
    await act(async () => {
      blockedResult = getCurrent().addComment('1', 'Should not be added')
    })

    expect(blockedResult).toEqual({ ok: false, error: 'comment_blocked' })

    await act(async () => {
      getCurrent().unblockUserComments('blocked@example.com')
    })

    expect(getCurrent().isUserCommentBlocked('blocked@example.com')).toBe(false)

    let allowedResult
    await act(async () => {
      allowedResult = getCurrent().addComment('1', 'Allowed now')
    })

    expect(allowedResult).toEqual({ ok: true, error: '' })

    const createdComment = getCurrent().comments['1'][0]

    await act(async () => {
      getCurrent().deleteComment({ clipId: '1', commentId: createdComment.id })
    })

    expect(
      getCurrent().comments['1'].find((comment) => comment.id === createdComment.id)
    ).toBeFalsy()

    await act(async () => {
      getCurrent().addComment('1', 'First by blocked user')
      getCurrent().addComment('2', 'Second by blocked user')
    })

    await act(async () => {
      getCurrent().deleteCommentsByUser({ authorId: 'blocked@example.com' })
    })

    expect(
      (getCurrent().comments['1'] || []).every(
        (comment) => comment.authorId !== 'blocked@example.com'
      )
    ).toBe(true)
    expect(
      (getCurrent().comments['2'] || []).every(
        (comment) => comment.authorId !== 'blocked@example.com'
      )
    ).toBe(true)
  })

  it('toggles genres and keeps state stable on repeated toggle and limit overflow', async () => {
    const { getCurrent } = await renderAppContext()

    await act(async () => {
      getCurrent().toggleGenre('action')
    })
    expect(getCurrent().selectedGenres).toContain('action')

    await act(async () => {
      getCurrent().toggleGenre('action')
    })
    expect(getCurrent().selectedGenres).not.toContain('action')

    await act(async () => {
      getCurrent().toggleGenre('action')
      getCurrent().toggleGenre('drama')
      getCurrent().toggleGenre('comedy')
      getCurrent().toggleGenre('romance')
      getCurrent().toggleGenre('thriller')
      getCurrent().toggleGenre('sci-fi')
    })

    expect(getCurrent().selectedGenres).toHaveLength(5)
    expect(getCurrent().selectedGenres).not.toContain('sci-fi')
  })

  it('rejects invalid like/bookmark payload and preserves previous state', async () => {
    const { getCurrent } = await renderAppContext()

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
        externalUrl: 'https://example.com/movie',
        posterFile: null,
        clipFile: null,
      })
    })

    const createdUpload = getCurrent().adminUploads[0]
    expect(createdUpload.movieId).toBeTruthy()

    const createdMovie = getCurrent().adminCatalogMovies.find((movie) => movie.id === createdUpload.movieId)
    expect(createdMovie).toBeTruthy()

    await act(async () => {
      const removed = getCurrent().removeAdminUpload(createdUpload.id)
      expect(removed).toBe(true)
    })

    expect(getCurrent().adminUploads.find((upload) => upload.id === createdUpload.id)).toBeFalsy()
    expect(getCurrent().adminCatalogMovies.find((movie) => movie.id === createdUpload.movieId)).toBeFalsy()
    await expect(getCurrent().getCatalog()).resolves.not.toContainEqual(expect.objectContaining({ id: createdUpload.movieId }))
  })

  it('supports legacy fallback by title/genreId and keeps getCatalog consistent after edit/delete', async () => {
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
              status: 'ready',
              createdAt: 'legacy',
            },
          ],
          adminCatalogMovies: [
            {
              id: legacyMovieId,
              title: 'Legacy Movie',
              rating: 0,
              genres: [],
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

    await expect(getCurrent().getCatalog()).resolves.toContainEqual(expect.objectContaining({ id: legacyMovieId, title: 'Legacy Movie Edited' }))

    await act(async () => {
      const removed = getCurrent().removeAdminUpload(legacyUploadId)
      expect(removed).toBe(true)
    })

    expect(getCurrent().adminCatalogMovies.find((movie) => movie.id === legacyMovieId)).toBeFalsy()
    await expect(getCurrent().getCatalog()).resolves.not.toContainEqual(expect.objectContaining({ id: legacyMovieId }))
  })

})
