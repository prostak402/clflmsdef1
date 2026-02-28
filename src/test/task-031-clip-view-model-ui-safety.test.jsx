import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ClipCard from '../components/ClipCard'
import BookmarksPage from '../pages/BookmarksPage'
import CatalogPage from '../pages/CatalogPage'
import { feedService } from '../services/feed-service'

const mockUseApp = vi.fn()

vi.mock('../context/useApp', () => ({
  useApp: () => mockUseApp(),
}))

beforeEach(() => {
  mockUseApp.mockReset()
  vi.spyOn(feedService, 'wait').mockResolvedValue(undefined)

  if (!HTMLMediaElement.prototype.play) {
    HTMLMediaElement.prototype.play = () => Promise.resolve()
  }
  if (!HTMLMediaElement.prototype.pause) {
    HTMLMediaElement.prototype.pause = () => {}
  }
})

describe('TASK-031: UI safety with API-contract clip view-model', () => {
  it('renders ClipCard without mock-only fields', () => {
    mockUseApp.mockReturnValue({
      likes: {},
      toggleLike: vi.fn(),
      bookmarks: [],
      toggleBookmark: vi.fn(),
    })

    render(
      <ClipCard
        clip={{
          id: 'api-clip-1',
          title: 'API Clip',
          description: 'Description',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          videoUrl: 'https://example.com/video.mp4',
          externalUrl: 'https://example.com/watch',
          durationSec: 140,
          durationLabel: '2m',
          genreId: 'action',
          genreName: 'Action',
          likesCount: 1,
          commentsCount: 2,
          sharesCount: 0,
          bookmarksCount: 3,
        }}
        isActive={false}
        onOpenComments={vi.fn()}
        position={0}
        feedRequestId="feed-1"
        impressionId="impr-1"
      />
    )

    expect(screen.getByText('API Clip')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getAllByText('2m').length).toBeGreaterThan(0)
  })

  it('renders BookmarksPage without legacy fields and does not crash', async () => {
    mockUseApp.mockReturnValue({
      getBookmarkedClips: () => [
        {
          id: 'api-bm-1',
          title: 'Saved API Clip',
          description: 'Saved description',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          externalUrl: 'https://example.com/watch',
          videoUrl: 'https://example.com/video.mp4',
          durationSec: 61,
          genreId: 'drama',
          likesCount: 1,
          commentsCount: 1,
          bookmarksCount: 1,
        },
      ],
      toggleBookmark: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <BookmarksPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Saved API Clip')).toBeInTheDocument()
    })
  })

  it('filters CatalogPage by genreId lookup', async () => {
    mockUseApp.mockReturnValue({
      getCatalog: async () => [
        {
          id: 'cat-1',
          title: 'Catalog API Clip',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          externalUrl: 'https://example.com/watch',
          videoUrl: 'https://example.com/video.mp4',
          durationSec: 120,
          genreId: 'comedy',
          likesCount: 0,
          commentsCount: 0,
          bookmarksCount: 0,
        },
      ],
    })

    render(<CatalogPage />)

    expect(await screen.findByText('Catalog API Clip')).toBeInTheDocument()
    expect(screen.getAllByText('2m').length).toBeGreaterThan(0)
  })
})
