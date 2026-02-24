import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  EVENT_NAMES,
  EVENT_SOURCE,
  EVENT_SURFACE,
  VIEW_THRESHOLD,
} from '../services/analytics/events'

const currentFile = fileURLToPath(import.meta.url)
const testDir = path.dirname(currentFile)

function read(relativePath) {
  return readFileSync(path.resolve(testDir, relativePath), 'utf8')
}

const RECOMMENDATION_EVENTS_DOC = read('../../docs/recommendation-events.md')
const FEED_SERVICE = read('../services/feed-service.js')
const FEED_PAGE = read('../pages/FeedPage.jsx')
const CLIP_CARD = read('../components/ClipCard.jsx')
const COMMENTS_PANEL = read('../components/CommentsPanel.jsx')

describe('recommendation events docs/code sync', () => {
  it('keeps schemaVersion unified between docs and feedService', () => {
    expect(RECOMMENDATION_EVENTS_DOC).toContain('Schema version:** `1.0.0`')
    expect(FEED_SERVICE).toContain("const EVENT_SCHEMA_VERSION = '1.0.0'")
  })

  it('keeps canonical event names and enums aligned with docs', () => {
    expect(Object.values(EVENT_NAMES)).toHaveLength(8)

    for (const eventName of Object.values(EVENT_NAMES)) {
      expect(RECOMMENDATION_EVENTS_DOC).toContain(`\`${eventName}\``)
    }

    expect(RECOMMENDATION_EVENTS_DOC).toContain(
      `- \`source\`: \`${Object.values(EVENT_SOURCE).join(' | ')}\`.`
    )
    expect(RECOMMENDATION_EVENTS_DOC).toContain(
      `- \`surface\`: \`${Object.values(EVENT_SURFACE).join(' | ')}\`.`
    )
    expect(RECOMMENDATION_EVENTS_DOC).toContain(
      `- \`threshold\`: \`${Object.values(VIEW_THRESHOLD).join(' | ')}\`.`
    )
  })

  it('emits all 8 canonical events from spec UI points', () => {
    expect(FEED_PAGE).toContain('EVENT_NAMES.FEED_OPENED')
    expect(FEED_PAGE).toContain('EVENT_NAMES.CLIP_IMPRESSION')

    expect(CLIP_CARD).toContain('EVENT_NAMES.CLIP_PLAY_STARTED')
    expect(CLIP_CARD).toContain('EVENT_NAMES.CLIP_VIEW_THRESHOLD')
    expect(CLIP_CARD).toContain('EVENT_NAMES.CLIP_VIEW_ENDED')
    expect(CLIP_CARD).toContain('EVENT_NAMES.LIKE_SET')
    expect(CLIP_CARD).toContain('EVENT_NAMES.BOOKMARK_SET')

    expect(COMMENTS_PANEL).toContain('EVENT_NAMES.COMMENT_CREATED')
  })

  it('does not use deprecated like_toggled/bookmark_toggled in active UI analytics code', () => {
    expect(FEED_PAGE).not.toContain('like_toggled')
    expect(FEED_PAGE).not.toContain('bookmark_toggled')
    expect(CLIP_CARD).not.toContain('like_toggled')
    expect(CLIP_CARD).not.toContain('bookmark_toggled')
    expect(COMMENTS_PANEL).not.toContain('like_toggled')
    expect(COMMENTS_PANEL).not.toContain('bookmark_toggled')
  })
})
