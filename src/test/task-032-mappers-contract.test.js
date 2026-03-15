import { describe, expect, it } from 'vitest'

import { toClipUiModel } from '../services/mappers/clip-mapper'
import { toCommentUiModel, toModerationCommentUiList } from '../services/mappers/comment-mapper'
import { createGenreLookup } from '../services/mappers/genre-mapper'

const REQUIRED_CLIP_FIELDS = [
  'id',
  'title',
  'description',
  'thumbnailUrl',
  'videoUrl',
  'watchUrl',
  'durationSec',
  'durationLabel',
  'rating',
  'genreIds',
  'genreId',
  'genreNames',
  'genreName',
  'genreLabel',
  'likesCount',
  'commentsCount',
  'sharesCount',
  'bookmarksCount',
]

describe('TASK-032: mappers api->ui contract', () => {
  it('maps API clip payload to stable UI clip object with defaults', () => {
    const genreLookup = createGenreLookup([
      { id: 'scifi', name: 'Sci-Fi' },
      { id: 'drama', name: 'Drama' },
    ])
    const apiPayload = {
      id: 'clip-42',
      title: 'Arrival',
      description: 'First contact scene',
      thumbnailUrl: 'https://cdn.example/poster.jpg',
      videoUrl: 'https://cdn.example/clip.mp4',
      watchUrl: 'https://movie.example/arrival',
      durationSec: 125,
      rating: 8.1,
      genreIds: ['scifi', 'drama'],
      likesCount: 21,
      commentsCount: 4,
      sharesCount: 3,
      bookmarksCount: 8,
    }

    const uiClip = toClipUiModel(apiPayload, genreLookup)

    expect(uiClip).toEqual(
      expect.objectContaining(
        Object.fromEntries(REQUIRED_CLIP_FIELDS.map((field) => [field, expect.anything()]))
      )
    )
    expect(uiClip.durationLabel).toBe('2m')
    expect(uiClip.genreId).toBe('scifi')
    expect(uiClip.genreName).toBe('Sci-Fi')
    expect(uiClip.genreNames).toEqual(['Sci-Fi', 'Drama'])
    expect(uiClip.genreLabel).toBe('Sci-Fi, Drama')
    expect(uiClip.likesCount).toBe(21)
    expect(uiClip.rating).toBe(8.1)
  })

  it('uses strict API defaults when required clip fields are missing', () => {
    const uiClip = toClipUiModel({ id: '1' })

    expect(uiClip.description).toBe('')
    expect(uiClip.videoUrl).toBe('')
    expect(uiClip.watchUrl).toBe('#')
    expect(uiClip.durationSec).toBe(0)
    expect(uiClip.rating).toBe(null)
    expect(uiClip.genreIds).toEqual([])
    expect(uiClip.genreId).toBe('unknown')
    expect(uiClip.genreNames).toEqual([])
    expect(uiClip.genreLabel).toBe('Unknown')
    expect(uiClip.likesCount).toBe(0)
    expect(uiClip.sharesCount).toBe(0)
  })

  it('maps API comment payload to stable UI comment object and moderation form', () => {
    const apiComment = {
      id: 'cm-1',
      clipId: 'clip-1',
      authorId: 'u-1',
      authorName: 'Alex',
      text: 'Nice scene',
      createdAt: '2025-01-01T00:00:00.000Z',
      likes: 12,
      likedByViewer: true,
    }

    const uiComment = toCommentUiModel(apiComment, 'clip-1')
    expect(uiComment).toEqual(
      expect.objectContaining({
        id: 'cm-1',
        clipId: 'clip-1',
        authorId: 'u-1',
        authorName: 'Alex',
        text: 'Nice scene',
        likes: 12,
        likedByViewer: true,
      })
    )

    const moderationRows = toModerationCommentUiList([apiComment], {
      clips: [{ id: 'clip-1', title: 'Arrival' }],
      blockedUsers: { 'u-1': true },
    })

    expect(moderationRows[0]).toEqual(
      expect.objectContaining({
        clipTitle: 'Arrival',
        isBlockedAuthor: true,
        likedByViewer: true,
      })
    )
  })
})
