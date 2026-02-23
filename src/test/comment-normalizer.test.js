import { describe, expect, it } from 'vitest'

import { normalizeComment, normalizeCommentsMap } from '../services/comment-normalizer'

describe('comment normalizer', () => {
  it('maps legacy shape to unified comment schema', () => {
    const normalized = normalizeComment(
      {
        id: 'cm_legacy',
        user: 'legacy_user',
        avatar: '🎬',
        text: 'Legacy payload',
        likes: 5,
        time: '2 hours ago',
      },
      '1'
    )

    expect(normalized).toEqual(
      expect.objectContaining({
        id: 'cm_legacy',
        clipId: '1',
        authorId: 'anonymous',
        authorName: 'legacy_user',
        avatar: '🎬',
        text: 'Legacy payload',
        likes: 5,
        timeLabel: '2 hours ago',
      })
    )
    expect(normalized.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('normalizes whole comments map into unified schema', () => {
    const map = normalizeCommentsMap({
      '7': [
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
