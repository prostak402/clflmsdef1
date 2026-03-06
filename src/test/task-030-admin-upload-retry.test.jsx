import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminPage from '../pages/AdminPage'

const uploadClipWithMetadataMock = vi.fn()
const fetchAdminClipsMock = vi.fn()

vi.mock('../services/admin-upload-service', () => ({
  validateClipFile: () => null,
  uploadClipWithMetadata: (...args) => uploadClipWithMetadataMock(...args),
  fetchAdminClips: (...args) => fetchAdminClipsMock(...args),
  patchAdminClip: vi.fn(),
  deleteAdminClip: vi.fn(),
}))

vi.mock('../context/useApp', () => ({
  useApp: () => ({
    user: { id: 'admin', isAdmin: true },
    adminUploads: [],
    updateAdminClip: vi.fn(() => true),
    removeAdminUpload: vi.fn(),
    setAdminClipsCacheState: vi.fn(),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
  }
})

describe('TASK-030: admin upload retry UX', () => {
  beforeEach(() => {
    uploadClipWithMetadataMock.mockReset()
    fetchAdminClipsMock.mockReset().mockResolvedValue([])
  })

  it('shows error and retries failed upload', async () => {
    uploadClipWithMetadataMock
      .mockRejectedValueOnce(new Error('Upload failed with status 503. Attempts used: 3'))
      .mockResolvedValueOnce({ clip: { id: 'clip_1' } })

    fetchAdminClipsMock.mockResolvedValue([{ id: 'clip_1', title: 'Movie', status: 'ready' }])

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /add clip/i }))

    fireEvent.change(screen.getByPlaceholderText('Enter movie title'), {
      target: { value: 'Movie' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Drama' }))

    const videoUploadZone = screen.getByText('Choose video file').closest('.admin-upload-zone')
    const videoInput = videoUploadZone?.querySelector('input[type="file"]')
    expect(videoInput).toBeTruthy()

    fireEvent.change(videoInput, {
      target: {
        files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })],
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /upload clip/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Upload failed with status 503')
      expect(screen.getByRole('status')).toHaveTextContent('Upload failed.')
    })

    fireEvent.click(screen.getByRole('button', { name: /retry upload/i }))

    await waitFor(() => {
      expect(uploadClipWithMetadataMock).toHaveBeenCalledTimes(2)
    })
  })
})
