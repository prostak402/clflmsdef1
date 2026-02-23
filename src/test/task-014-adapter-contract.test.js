import { describe, expect, it } from 'vitest'

import { feedService } from '../services/feed-service'

const REQUIRED_CLIP_FIELDS = [
  'id',
  'movieId',
  'title',
  'description',
  'clipDescription',
  'genres',
  'year',
  'rating',
  'director',
  'duration',
  'poster',
  'clipUrl',
  'watchUrl',
  'likes',
  'comments',
  'shares',
  'bookmarks',
]

const REQUIRED_PROFILE_FIELDS = ['name', 'email', 'avatar', 'bookmarkCount', 'likeCount']

describe('TASK-014: feed adapter response contract', () => {
  it('returns feed items with required clip fields and stable primitive shapes', () => {
    const feed = feedService.getFeed()

    expect(Array.isArray(feed)).toBe(true)
    expect(feed.length).toBeGreaterThan(0)

    const firstClip = feed[0]

    expect(firstClip).toEqual(
      expect.objectContaining(
        Object.fromEntries(REQUIRED_CLIP_FIELDS.map((field) => [field, expect.anything()]))
      )
    )
    expect(Array.isArray(firstClip.genres)).toBe(true)
    expect(typeof firstClip.id).toBe('string')
    expect(typeof firstClip.title).toBe('string')
    expect(typeof firstClip.year).toBe('number')
    expect(typeof firstClip.rating).toBe('number')
    expect(typeof firstClip.likes).toBe('number')
    expect(typeof firstClip.comments).toBe('number')
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
