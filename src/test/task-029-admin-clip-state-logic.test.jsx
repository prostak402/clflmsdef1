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

async function renderAppContextWithState(state) {
  if (state) {
    window.localStorage.setItem(
      'app_state_v1',
      JSON.stringify({
        version: 1,
        state,
      })
    )
  }

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

function createBaseState() {
  return {
    user: { id: 'admin', isAdmin: true },
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
        id: 'upload_1',
        movieId: 'admin_upload_1',
        title: 'Movie One',
        year: '2021',
        description: 'desc 1',
        clipDescription: 'clip 1',
        genres: ['drama'],
        director: 'Dir 1',
        duration: '100m',
        kinopoiskId: '11',
        watchUrl: 'https://example.com/one',
        status: 'ready',
        createdAt: 't1',
        poster: '',
      },
      {
        id: 'upload_2',
        movieId: 'admin_upload_2',
        title: 'Movie Two',
        year: '2022',
        description: 'desc 2',
        clipDescription: 'clip 2',
        genres: ['action'],
        director: 'Dir 2',
        duration: '90m',
        kinopoiskId: '22',
        watchUrl: 'https://example.com/two',
        status: 'ready',
        createdAt: 't2',
        poster: '',
      },
    ],
    adminCatalogMovies: [
      {
        id: 'admin_upload_1',
        title: 'Movie One',
        year: 2021,
        rating: 0,
        genres: ['drama'],
        poster: '',
        watchUrl: 'https://example.com/one',
        description: 'desc 1',
        clipDescription: 'clip 1',
        duration: '100m',
        director: 'Dir 1',
        kinopoiskId: '11',
        createdAt: 't1',
      },
      {
        id: 'admin_upload_2',
        title: 'Movie Two',
        year: 2022,
        rating: 0,
        genres: ['action'],
        poster: '',
        watchUrl: 'https://example.com/two',
        description: 'desc 2',
        clipDescription: 'clip 2',
        duration: '90m',
        director: 'Dir 2',
        kinopoiskId: '22',
        createdAt: 't2',
      },
    ],
  }
}

describe('TASK-029: AppContext admin clip state logic', () => {
  it('updateAdminClip updates only target clip', async () => {
    const { getCurrent } = await renderAppContextWithState(createBaseState())

    await act(async () => {
      const updated = getCurrent().updateAdminClip('admin_upload_1', { title: 'Movie One Updated' })
      expect(updated).toBe(true)
    })

    const updatedUpload = getCurrent().adminUploads.find((upload) => upload.id === 'upload_1')
    const untouchedUpload = getCurrent().adminUploads.find((upload) => upload.id === 'upload_2')
    const updatedCatalogMovie = getCurrent().adminCatalogMovies.find(
      (movie) => movie.id === 'admin_upload_1'
    )
    const untouchedCatalogMovie = getCurrent().adminCatalogMovies.find(
      (movie) => movie.id === 'admin_upload_2'
    )

    expect(updatedUpload?.title).toBe('Movie One Updated')
    expect(updatedCatalogMovie?.title).toBe('Movie One Updated')
    expect(untouchedUpload?.title).toBe('Movie Two')
    expect(untouchedCatalogMovie?.title).toBe('Movie Two')
  })

  it('removeAdminUpload removes upload and related catalog movie', async () => {
    const { getCurrent } = await renderAppContextWithState(createBaseState())

    await act(async () => {
      const removed = getCurrent().removeAdminUpload('upload_1')
      expect(removed).toBe(true)
    })

    expect(getCurrent().adminUploads.find((upload) => upload.id === 'upload_1')).toBeFalsy()
    expect(getCurrent().adminCatalogMovies.find((movie) => movie.id === 'admin_upload_1')).toBeFalsy()
  })

  it('rejects invalid id, empty patch edge case, and edit for missing clip', async () => {
    const { getCurrent } = await renderAppContextWithState(createBaseState())

    await act(async () => {
      const invalidIdResult = getCurrent().updateAdminClip('', { title: 'Nope' })
      expect(invalidIdResult).toBe(false)
    })

    const uploadsBeforeEmptyPatch = JSON.stringify(getCurrent().adminUploads)
    const catalogBeforeEmptyPatch = JSON.stringify(getCurrent().adminCatalogMovies)

    await act(async () => {
      const emptyPatchResult = getCurrent().updateAdminClip('admin_upload_1', null)
      expect(emptyPatchResult).toBe(true)
    })

    expect(JSON.stringify(getCurrent().adminUploads)).toBe(uploadsBeforeEmptyPatch)
    expect(JSON.stringify(getCurrent().adminCatalogMovies)).toBe(catalogBeforeEmptyPatch)

    await act(async () => {
      const missingClipResult = getCurrent().updateAdminClip('admin_not_existing', {
        title: 'Ghost movie',
      })
      expect(missingClipResult).toBe(false)
    })
  })
})
