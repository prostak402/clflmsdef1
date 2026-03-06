import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import AdminPage from '../pages/AdminPage'

const updateAdminClipSpy = vi.fn()

const INITIAL_UPLOAD = {
  id: 'upload_1',
  movieId: 'admin_upload_1',
  title: 'Original title',
  description: 'Original movie description',
  genreId: 'drama',
  genreIds: ['drama', 'thriller'],
  genres: ['drama', 'thriller'],
  duration: '120m',
  kinopoiskId: '101',
  status: 'ready',
  createdAt: 'now',
  poster: '',
}

vi.mock('../services/admin-upload-service', () => ({
  fetchAdminClips: vi.fn().mockResolvedValue([{ id: 'upload_1', movieId: 'admin_upload_1', title: 'Original title' }]),
  patchAdminClip: vi.fn().mockResolvedValue({ clip: { id: 'upload_1' } }),
  deleteAdminClip: vi.fn(),
  validateClipFile: vi.fn(() => null),
  uploadClipWithMetadata: vi.fn(),
}))

vi.mock('../context/useApp', async () => {
  const React = await vi.importActual('react')

  return {
    useApp: () => {
      const [adminUploads, setAdminUploads] = React.useState([INITIAL_UPLOAD])

      const updateAdminClip = (clipId, patch) => {
        updateAdminClipSpy(clipId, patch)

        if (typeof clipId !== 'string' || !clipId.trim()) {
          return false
        }

        const trimmedClipId = clipId.trim()
        const targetExists = adminUploads.some(
          (upload) => upload.id === trimmedClipId || upload.movieId === trimmedClipId
        )

        if (!targetExists) {
          return false
        }

        setAdminUploads((prev) =>
          prev.map((upload) => {
            const shouldUpdate = upload.id === trimmedClipId || upload.movieId === trimmedClipId
            return shouldUpdate ? { ...upload, ...patch } : upload
          })
        )

        return true
      }

      return {
        user: { id: 'admin', isAdmin: true },
        adminUploads,
        addAdminClip: vi.fn(),
        updateAdminClip,
        removeAdminUpload: vi.fn(),
        setAdminClipsCacheState: vi.fn(),
      }
    },
  }
})

function renderAdminPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TASK-028: admin clip editing UI', () => {
  beforeEach(() => {
    updateAdminClipSpy.mockClear()
  })

  it('opens edit form with prefilled data', () => {
    renderAdminPage()

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])

    expect(screen.getByRole('heading', { name: 'Edit Clip' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter movie title')).toHaveValue('Original title')
    expect(screen.getByPlaceholderText('Full movie description...')).toHaveValue(
      'Original movie description'
    )
  })

  it('saves edit through updateAdminClip and refreshes upload list', async () => {
    renderAdminPage()

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    fireEvent.change(screen.getByPlaceholderText('Enter movie title'), {
      target: { value: 'Updated title' },
    })

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(updateAdminClipSpy).toHaveBeenCalledWith(
      'admin_upload_1',
      expect.objectContaining({ title: 'Updated title' })
    )

    await waitFor(() => {
      expect(screen.getByText('Updated title')).toBeInTheDocument()
    })

    expect(screen.getByText('Clip updated successfully!')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Edit Clip' })).not.toBeInTheDocument()
  })



  it('restores all selected genres when re-opening edit form after save', async () => {
    renderAdminPage()

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])

    const dramaChip = screen.getByRole('button', { name: 'Drama' })
    const thrillerChip = screen.getByRole('button', { name: 'Thriller' })
    const comedyChip = screen.getByRole('button', { name: 'Comedy' })

    expect(dramaChip).toHaveClass('active')
    expect(thrillerChip).toHaveClass('active')
    expect(comedyChip).not.toHaveClass('active')

    fireEvent.click(thrillerChip)
    fireEvent.click(comedyChip)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateAdminClipSpy).toHaveBeenCalledWith(
        'admin_upload_1',
        expect.objectContaining({
          genreId: 'drama',
          genreIds: ['drama', 'comedy'],
          genres: ['drama', 'comedy'],
        })
      )
    })

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])

    expect(screen.getByRole('button', { name: 'Drama' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Comedy' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Thriller' })).not.toHaveClass('active')
  })

  it('cancels edit and resets form to create-state', async () => {
    renderAdminPage()

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    fireEvent.change(screen.getByPlaceholderText('Enter movie title'), {
      target: { value: 'Changed while editing' },
    })

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    fireEvent.click(screen.getAllByRole('button', { name: /add clip/i })[0])

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByRole('heading', { name: 'Upload New Clip' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter movie title')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Upload Clip' })).toBeInTheDocument()
  })
})
