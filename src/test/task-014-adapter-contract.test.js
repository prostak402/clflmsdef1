import { describe, expect, it } from 'vitest'

import { feedService } from '../services/feed-service'
import { contentService } from '../services/content-service'
import { createGenreLookup, toClipViewModel } from '../services/clip-view-model'

const REQUIRED_CLIP_VM_FIELDS = [
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

const REQUIRED_PROFILE_FIELDS = ['name', 'email', 'avatar', 'bookmarkCount', 'likeCount']
const GENRE_LOOKUP = createGenreLookup(contentService.getGenres())

describe('TASK-014: feed adapter response contract', () => {
  it('maps feed items to clip view-model with stable API-compatible fields', () => {
    const feed = feedService.getFeed()

    expect(Array.isArray(feed)).toBe(true)
    expect(feed.length).toBeGreaterThan(0)

    const firstClipVm = toClipViewModel(feed[0], GENRE_LOOKUP)

    expect(firstClipVm).toEqual(
      expect.objectContaining(
        Object.fromEntries(REQUIRED_CLIP_VM_FIELDS.map((field) => [field, expect.anything()]))
      )
    )
    expect(typeof firstClipVm.id).toBe('string')
    expect(typeof firstClipVm.title).toBe('string')
    expect(typeof firstClipVm.durationSec).toBe('number')
    expect(typeof firstClipVm.likesCount).toBe('number')
    expect(typeof firstClipVm.commentsCount).toBe('number')
    expect(typeof firstClipVm.bookmarksCount).toBe('number')
  })

  it('returns profile with required fields and numeric counters', () => {
    const profile = feedService.getProfile({
      user: null,
      bookmarks: ['clip-1', 'clip-2'],
      likes: { 'clip-1': true, 'clip-2': false },
    })

    expect(profile).toEqual(
      expect.objectContaining(
        Object.fromEntries(REQUIRED_PROFILE_FIELDS.map((field) => [field, expect.anything()]))
      )
    )
    expect(typeof profile.name).toBe('string')
    expect(typeof profile.email).toBe('string')
    expect(typeof profile.avatar).toBe('string')
    expect(typeof profile.bookmarkCount).toBe('number')
    expect(typeof profile.likeCount).toBe('number')
  })
})
