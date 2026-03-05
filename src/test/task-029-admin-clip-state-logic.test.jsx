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
        description: 'desc 1',
        duration: '100m',
        kinopoiskId: '11',
        status: 'ready',
        createdAt: 't1',
        poster: '',
      },
      {
        id: 'upload_2',
        movieId: 'admin_upload_2',
        title: 'Movie Two',
        description: 'desc 2',
        duration: '90m',
        kinopoiskId: '22',
        status: 'ready',
        createdAt: 't2',
        poster: '',
      },
    ],
    adminCatalogMovies: [
      {
        id: 'admin_upload_1',
        title: 'Movie One',
        rating: 0,
        genreId: 'drama',
        poster: '',
        description: 'desc 1',
        duration: '100m',
        kinopoiskId: '11',
        createdAt: 't1',
      },
      {
        id: 'admin_upload_2',
        title: 'Movie Two',
        rating: 0,
        genreId: 'action',
        poster: '',
        description: 'desc 2',
        duration: '90m',
        kinopoiskId: '22',
        createdAt: 't2',
      },
    ],
  }
}

describe('TASK-029: AppContext admin clip state logic', () => {
  it('creates and edits admin clip using api-contract fields only', async () => {
    const { getCurrent } = await renderAppContextWithState(createBaseState())

    await act(async () => {
      getCurrent().addAdminClip({
        title: 'Contract Clip',
        description: 'contract description',
        genreId: 'comedy',
        durationSec: 90,
        duration: '1m',
        videoUrl: 'https://cdn.example.com/clip.mp4',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        externalUrl: 'https://cinema.example.com/watch/contract',
        watchUrl: 'https://cinema.example.com/watch/contract',
        clipDescription: 'contract clip description',
      })
    })

    const createdUpload = getCurrent().adminUploads.find(
      (upload) => upload.title === 'Contract Clip'
    )
    expect(createdUpload).toBeTruthy()
    expect(createdUpload).toEqual(
      expect.objectContaining({
        genreId: 'comedy',
        durationSec: 90,
        watchUrl: 'https://cinema.example.com/watch/contract',
        clipDescription: 'contract clip description',
      })
    )
    expect(createdUpload).not.toHaveProperty('year')
    expect(createdUpload).not.toHaveProperty('director')
    expect(createdUpload).toHaveProperty('watchUrl')
    expect(createdUpload).toHaveProperty('clipDescription')

    await act(async () => {
      const updated = getCurrent().updateAdminClip(createdUpload.movieId, {
        title: 'Contract Clip Updated',
        genreId: 'drama',
        durationSec: 120,
      })
      expect(updated).toBe(true)
    })

    const editedUpload = getCurrent().adminUploads.find((upload) => upload.id === createdUpload.id)
    expect(editedUpload).toEqual(
      expect.objectContaining({
        title: 'Contract Clip Updated',
        genreId: 'drama',
        durationSec: 120,
      })
    )
  })
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
    expect(
      getCurrent().adminCatalogMovies.find((movie) => movie.id === 'admin_upload_1')
    ).toBeFalsy()
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
