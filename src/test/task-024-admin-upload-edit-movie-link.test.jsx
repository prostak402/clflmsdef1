import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminPage from '../pages/AdminPage'

const navigateMock = vi.fn()
const updateAdminClipMock = vi.fn(() => true)

vi.mock('../context/useApp', () => ({
  useApp: () => ({
    user: { id: 'admin', isAdmin: true },
    adminUploads: [
      {
        id: 'upload_1',
        movieId: 'admin_upload_1',
        title: 'Movie 1',
        year: '2024',
        description: 'desc',
        clipDescription: 'clip',
        genres: [],
        director: '',
        duration: '',
        kinopoiskId: '',
        watchUrl: 'https://example.com',
        status: 'ready',
        createdAt: 'now',
      },
    ],
    addAdminClip: vi.fn(),
    updateAdminClip: updateAdminClipMock,
    removeAdminUpload: vi.fn(),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
    useNavigate: () => navigateMock,
  }
})

describe('TASK-024: admin upload edit uses movieId', () => {
  beforeEach(() => {
    updateAdminClipMock.mockClear()
  })

  it('passes movieId to updateAdminClip when editing upload', () => {
    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(updateAdminClipMock).toHaveBeenCalledWith('admin_upload_1', expect.any(Object))
  })
})
