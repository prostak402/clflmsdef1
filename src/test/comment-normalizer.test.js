import { describe, expect, it } from 'vitest'

import { normalizeComment, normalizeCommentsMap } from '../services/comment-normalizer'

describe('comment normalizer', () => {
  it('maps API comment shape to unified comment schema', () => {
    const normalized = normalizeComment(
      {
        id: 'cm_legacy',
        authorName: 'Alex',
        avatar: '🎬',
        text: 'API payload',
        likes: 5,
        createdAt: '2026-02-22T10:20:30.000Z',
      },
      '1'
    )

    expect(normalized).toEqual(
      expect.objectContaining({
        id: 'cm_legacy',
        clipId: '1',
        authorId: 'anonymous',
        authorName: 'Alex',
        avatar: '🎬',
        text: 'API payload',
        likes: 5,
        timeLabel: expect.any(String),
      })
    )
    expect(normalized.createdAt).toBe('2026-02-22T10:20:30.000Z')
  })

  it('normalizes whole comments map into unified schema', () => {
    const map = normalizeCommentsMap({
      7: [
        {
          id: 'cm_new',
          clipId: '7',
          authorId: 'user_7',
          authorName: 'new_user',
          avatar: '👤',
          text: 'Hello',
          likes: 0,
          createdAt: '2026-02-22T10:20:30.000Z',
          timeLabel: 'Just now',
        },
      ],
    })

    expect(map['7'][0]).toEqual(
      expect.objectContaining({
        id: 'cm_new',
        clipId: '7',
        authorId: 'user_7',
        authorName: 'new_user',
        text: 'Hello',
      })
    )
  })
})
