import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import AdminCommentsPage from '../pages/AdminCommentsPage'

const DEFAULT_ROWS = [
  {
    id: 'c1',
    clipId: 'clip1',
    clipTitle: 'Clip #1',
    authorId: 'author-1',
    authorName: 'Author One',
    text: 'Needs moderation',
    createdAt: '2026-01-01T10:00:00.000Z',
    isBlockedAuthor: false,
  },
]

const { mockUseAppState, mockFeedService } = vi.hoisted(() => ({
  mockUseAppState: {
    user: { id: 'admin-1', name: 'Admin', role: 'admin' },
    comments: {
      clip1: [
        {
          id: 'c1',
          clipId: 'clip1',
          authorId: 'author-1',
          authorName: 'Author One',
          text: 'Needs moderation',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
      ],
    },
    blockedCommentUsers: {},
    blockUserComments: vi.fn(),
    deleteComment: vi.fn(),
    deleteCommentsByUser: vi.fn(),
  },
  mockFeedService: {
    getFeed: vi.fn(),
    getAllCommentsForModeration: vi.fn(),
  },
}))

vi.mock('../context/useApp', () => ({
  useApp: () => mockUseAppState,
}))

vi.mock('../services/feed-service', () => ({
  feedService: mockFeedService,
}))

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('TASK-023: admin moderation actions states', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    mockUseAppState.user = { id: 'admin-1', name: 'Admin', role: 'admin' }
    mockUseAppState.comments = {
      clip1: [
        {
          id: 'c1',
          clipId: 'clip1',
          authorId: 'author-1',
          authorName: 'Author One',
          text: 'Needs moderation',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
      ],
    }
    mockUseAppState.blockedCommentUsers = {}
    mockUseAppState.blockUserComments.mockResolvedValue(true)
    mockUseAppState.deleteComment.mockResolvedValue(true)
    mockUseAppState.deleteCommentsByUser.mockResolvedValue(true)

    mockFeedService.getFeed.mockResolvedValue([{ id: 'clip1', title: 'Clip #1' }])
    mockFeedService.getAllCommentsForModeration.mockResolvedValue(DEFAULT_ROWS)
  })

  it('shows loading and empty states for moderation list', async () => {
    mockFeedService.getAllCommentsForModeration.mockResolvedValueOnce([])

    render(
      <MemoryRouter>
        <AdminCommentsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Loading moderation list...')).toBeInTheDocument()
    expect(await screen.findByText('No comments found.')).toBeInTheDocument()
  })

  it('shows loading error and allows retry', async () => {
    mockFeedService.getAllCommentsForModeration
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([])

    render(
      <MemoryRouter>
        <AdminCommentsPage />
      </MemoryRouter>
    )

    expect(
      await screen.findByText('Could not load moderation list. Try again.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No comments found.')).toBeInTheDocument()
  })

  it.each([
    {
      scenario: 'delete comment',
      button: 'Delete',
      pendingLabel: 'Deleting comment...',
      successLabel: 'Comment deleted.',
      action: () => mockUseAppState.deleteComment,
    },
    {
      scenario: 'block author',
      button: 'Block author',
      pendingLabel: 'Blocking author...',
      successLabel: 'Author has been blocked.',
      action: () => mockUseAppState.blockUserComments,
    },
    {
      scenario: 'bulk delete',
      button: 'Delete all',
      pendingLabel: 'Deleting all comments by author...',
      successLabel: 'All author comments deleted.',
      action: () => mockUseAppState.deleteCommentsByUser,
    },
  ])(
    'shows pending and success for $scenario',
    async ({ button, pendingLabel, successLabel, action }) => {
      const pending = deferred()
      action().mockImplementationOnce(() => pending.promise)

      render(
        <MemoryRouter>
          <AdminCommentsPage />
        </MemoryRouter>
      )

      const actionButton = await screen.findByRole('button', { name: button })
      fireEvent.click(actionButton)

      expect(await screen.findByText(pendingLabel)).toBeInTheDocument()
      expect(screen.getByText('In progress')).toBeInTheDocument()
      expect(actionButton).toBeDisabled()

      pending.resolve(true)

      await waitFor(() => {
        expect(screen.getByText(successLabel)).toBeInTheDocument()
      })
      expect(screen.getByText('Done')).toBeInTheDocument()
    }
  )

  it.each([
    {
      scenario: 'delete comment',
      button: 'Delete',
      errorLabel: 'Could not delete comment.',
      action: () => mockUseAppState.deleteComment,
    },
    {
      scenario: 'block author',
      button: 'Block author',
      errorLabel: 'Could not block author.',
      action: () => mockUseAppState.blockUserComments,
    },
    {
      scenario: 'bulk delete',
      button: 'Delete all',
      errorLabel: 'Could not delete author comments.',
      action: () => mockUseAppState.deleteCommentsByUser,
    },
  ])('shows error when $scenario returns false', async ({ button, errorLabel, action }) => {
    action().mockResolvedValueOnce(false)

    render(
      <MemoryRouter>
        <AdminCommentsPage />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: button }))

    await waitFor(() => {
      expect(screen.getByText(errorLabel)).toBeInTheDocument()
    })
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it.each([
    {
      scenario: 'delete comment',
      button: 'Delete',
      errorLabel: 'Could not delete comment.',
      action: () => mockUseAppState.deleteComment,
    },
    {
      scenario: 'block author',
      button: 'Block author',
      errorLabel: 'Could not block author.',
      action: () => mockUseAppState.blockUserComments,
    },
    {
      scenario: 'bulk delete',
      button: 'Delete all',
      errorLabel: 'Could not delete author comments.',
      action: () => mockUseAppState.deleteCommentsByUser,
    },
  ])('shows error when $scenario throws', async ({ button, errorLabel, action }) => {
    action().mockRejectedValueOnce(new Error('boom'))

    render(
      <MemoryRouter>
        <AdminCommentsPage />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: button }))

    await waitFor(() => {
      expect(screen.getByText(errorLabel)).toBeInTheDocument()
    })
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })
})
