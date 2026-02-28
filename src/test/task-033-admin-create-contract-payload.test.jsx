import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { MemoryRouter } from 'react-router-dom'
import AdminPage from '../pages/AdminPage'

const addAdminClipMock = vi.fn()
const uploadClipWithMetadataMock = vi.fn().mockResolvedValue({ clip: { id: 'clip-1' } })

vi.mock('../context/useApp', () => ({
  useApp: () => ({
    user: { id: 'admin', isAdmin: true },
    adminUploads: [],
    addAdminClip: addAdminClipMock,
    updateAdminClip: vi.fn(),
    removeAdminUpload: vi.fn(),
  }),
}))

vi.mock('../services/admin-upload-service', () => ({
  validateClipFile: () => null,
  uploadClipWithMetadata: (...args) => uploadClipWithMetadataMock(...args),
}))

describe('TASK-033: admin create clip payload matches API contract shape', () => {
  beforeEach(() => {
    addAdminClipMock.mockClear()
    uploadClipWithMetadataMock.mockClear()
  })

  it('creates clip without legacy fields on write-path', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Drama' }))

    const videoInput = document.querySelector('input[type="file"]')
    fireEvent.change(videoInput, {
      target: { files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })] },
    })

    fireEvent.click(screen.getByRole('button', { name: /upload clip/i }))

    await waitFor(() => {
      expect(uploadClipWithMetadataMock).toHaveBeenCalledTimes(1)
      expect(addAdminClipMock).toHaveBeenCalledTimes(1)
    })

    const [{ metadata }] = uploadClipWithMetadataMock.mock.calls[0]
    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Contract Clip',
        description: 'Contract description',
        genreId: 'drama',
        durationSec: 0,
        videoUrl: '',
        thumbnailUrl: '',
        status: 'draft',
      })
    )
    expect(metadata).not.toHaveProperty('year')
    expect(metadata).not.toHaveProperty('director')
    expect(metadata).not.toHaveProperty('watchUrl')
    expect(metadata).not.toHaveProperty('clipDescription')

    const createdPayload = addAdminClipMock.mock.calls[0][0]
    expect(createdPayload).toEqual(expect.objectContaining({ genreId: 'drama' }))
    expect(createdPayload).not.toHaveProperty('year')
    expect(createdPayload).not.toHaveProperty('director')
    expect(createdPayload).not.toHaveProperty('watchUrl')
    expect(createdPayload).not.toHaveProperty('clipDescription')
  })
})
