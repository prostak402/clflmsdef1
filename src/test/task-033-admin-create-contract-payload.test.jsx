import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { MemoryRouter } from 'react-router-dom'
import AdminPage from '../pages/AdminPage'

const uploadClipWithMetadataMock = vi.fn().mockResolvedValue({ clip: { id: 'clip-1' } })

vi.mock('../context/useApp', () => ({
  useApp: () => ({
    user: { id: 'admin', isAdmin: true },
    adminUploads: [],
    updateAdminClip: vi.fn(),
    removeAdminUpload: vi.fn(),
    setAdminClipsCacheState: vi.fn(),
  }),
}))

vi.mock('../services/admin-upload-service', () => ({
  validateClipFile: () => null,
  uploadClipWithMetadata: (...args) => uploadClipWithMetadataMock(...args),
  fetchAdminClips: vi.fn().mockResolvedValue([]),
  patchAdminClip: vi.fn(),
  deleteAdminClip: vi.fn(),
}))

describe('TASK-033: admin create clip payload matches API contract shape', () => {
  beforeEach(() => {
    uploadClipWithMetadataMock.mockClear()
  })

  it('creates clip with required contract fields on write-path', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /add clip/i }))
    fireEvent.change(screen.getByPlaceholderText('Enter movie title'), {
      target: { value: 'Contract Clip' },
    })
    fireEvent.change(screen.getByPlaceholderText('Full movie description...'), {
      target: { value: 'Contract description' },
    })
    fireEvent.change(screen.getByPlaceholderText('Short clip description...'), {
      target: { value: 'Short contract clip' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://example.com/watch'), {
      target: { value: 'https://cinema.example.com/watch/contract-clip' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Drama' }))

    const videoInput = document.querySelector('input[type="file"]')
    fireEvent.change(videoInput, {
      target: { files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })] },
    })

    fireEvent.click(screen.getByRole('button', { name: /upload clip/i }))

    await waitFor(() => {
      expect(uploadClipWithMetadataMock).toHaveBeenCalledTimes(1)
    })

    const [{ metadata }] = uploadClipWithMetadataMock.mock.calls[0]
    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Contract Clip',
        description: 'Contract description',
        genreId: 'drama',
        clipDescription: 'Short contract clip',
        watchUrl: 'https://cinema.example.com/watch/contract-clip',
        durationSec: 0,
        videoUrl: '',
        thumbnailUrl: '',
        status: 'draft',
      })
    )
    expect(metadata).not.toHaveProperty('year')
    expect(metadata).not.toHaveProperty('director')
    expect(metadata).toHaveProperty('watchUrl')
    expect(metadata).toHaveProperty('clipDescription')

  })
})
