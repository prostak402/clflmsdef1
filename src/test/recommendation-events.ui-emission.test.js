import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const testDir = path.dirname(currentFile)

function read(relativePath) {
  return readFileSync(path.resolve(testDir, relativePath), 'utf8')
}

const FEED_PAGE = read('../pages/FeedPage.jsx')
const CLIP_CARD = read('../components/ClipCard.jsx')
const COMMENTS_PANEL = read('../components/CommentsPanel.jsx')
const ANALYTICS_EVENTS = read('../services/analytics/events.js')

describe('recommendation events UI emission coverage', () => {
  it('emits all 8 canonical events from expected UI modules', () => {
    expect(FEED_PAGE).toContain('EVENT_NAMES.FEED_OPENED')
    expect(FEED_PAGE).toContain('EVENT_NAMES.CLIP_IMPRESSION')

    expect(CLIP_CARD).toContain('EVENT_NAMES.CLIP_PLAY_STARTED')
    expect(CLIP_CARD).toContain('EVENT_NAMES.CLIP_VIEW_THRESHOLD')
    expect(CLIP_CARD).toContain('EVENT_NAMES.CLIP_VIEW_ENDED')
    expect(CLIP_CARD).toContain('EVENT_NAMES.LIKE_SET')
    expect(CLIP_CARD).toContain('EVENT_NAMES.BOOKMARK_SET')

    expect(COMMENTS_PANEL).toContain('EVENT_NAMES.COMMENT_CREATED')
  })

  it('does not use deprecated like_toggled/bookmark_toggled in active analytics code', () => {
    expect(ANALYTICS_EVENTS).not.toContain('like_toggled')
    expect(ANALYTICS_EVENTS).not.toContain('bookmark_toggled')
    expect(FEED_PAGE).not.toContain('like_toggled')
    expect(FEED_PAGE).not.toContain('bookmark_toggled')
    expect(CLIP_CARD).not.toContain('like_toggled')
    expect(CLIP_CARD).not.toContain('bookmark_toggled')
    expect(COMMENTS_PANEL).not.toContain('like_toggled')
    expect(COMMENTS_PANEL).not.toContain('bookmark_toggled')
  })
})
