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
  'externalUrl',
  'durationSec',
  'durationLabel',
  'genreId',
  'genreName',
  'likesCount',
  'commentsCount',
  'sharesCount',
  'bookmarksCount',
]

describe('TASK-032: mappers api->ui contract', () => {
  it('maps API clip payload to stable UI clip object with defaults', () => {
    const genreLookup = createGenreLookup([{ id: 'scifi', name: 'Sci-Fi' }])
    const apiPayload = {
      id: 'clip-42',
      title: 'Arrival',
      description: 'First contact scene',
      thumbnailUrl: 'https://cdn.example/poster.jpg',
      videoUrl: 'https://cdn.example/clip.mp4',
      externalUrl: 'https://movie.example/arrival',
      durationSec: 125,
      genreId: 'scifi',
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
    expect(uiClip.genreName).toBe('Sci-Fi')
    expect(uiClip.likesCount).toBe(21)
  })

  it('maps legacy/mock clip payload to the same UI clip shape', () => {
    const uiClip = toClipUiModel({
      id: '1',
      clipDescription: 'Legacy shape',
      poster: 'https://example.com/poster.jpg',
      clipUrl: 'https://example.com/clip.mp4',
      watchUrl: 'https://example.com/watch',
      duration: '2h 5m',
      genres: ['drama'],
      likes: 7,
      comments: 2,
      shares: 1,
      bookmarks: 5,
    })

    expect(uiClip.durationSec).toBe(7500)
    expect(uiClip.genreId).toBe('drama')
    expect(uiClip.likesCount).toBe(7)
    expect(uiClip.sharesCount).toBe(1)
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
      })
    )
  })
})
