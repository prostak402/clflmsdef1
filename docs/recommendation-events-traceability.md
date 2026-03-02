# Recommendation Events Traceability Audit

Дата проверки: 2026-02-24.

## 1) Traceability matrix (spec → UI → implementation → tests)

| Spec event            | UI emission point from spec                          | Active implementation point                                                                                                      | Test coverage                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feed_opened`         | Feed screen visible after successful feed init       | `FeedPage` emits `feedService.trackEvent(EVENT_NAMES.FEED_OPENED, ...)`; envelope + buffer handled by `feedService.trackEvent`.  | `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js`                                                                                                          |
| `clip_impression`     | Feed card becomes active/visible                     | `FeedPage` emits `EVENT_NAMES.CLIP_IMPRESSION`; dedupe by `impressionId` in `feedService`.                                       | `src/test/task-024-feed-service-track-event.test.js`, `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js`                                                    |
| `clip_play_started`   | Player callback `onPlay`                             | `ClipCard` emits `EVENT_NAMES.CLIP_PLAY_STARTED`; `feedService` validates `impressionId`.                                        | `src/test/task-024-feed-service-track-event.test.js`, `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.contract.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js` |
| `clip_view_threshold` | Time tracker crosses thresholds (`p25/p50/p75/p95`)  | `ClipCard.handleTimeUpdate` emits `EVENT_NAMES.CLIP_VIEW_THRESHOLD`; dedupe by `impressionId + threshold` in `feedService`.      | `src/test/task-024-feed-service-track-event.test.js`, `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.contract.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js` |
| `clip_view_ended`     | View teardown (slide change/unmount/visibility loss) | `ClipCard.emitViewEnded` emits `EVENT_NAMES.CLIP_VIEW_ENDED`; `feedService` enforces impression linkage.                         | `src/test/task-024-feed-service-track-event.test.js`, `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.contract.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js` |
| `like_set`            | Like button tap after optimistic local toggle        | `ClipCard.handleToggleLike` emits `EVENT_NAMES.LIKE_SET` with boolean `value`; payload validation in `analytics/events`.         | `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js`                                                                                                          |
| `bookmark_set`        | Bookmark button tap after optimistic local toggle    | `ClipCard.handleToggleBookmark` emits `EVENT_NAMES.BOOKMARK_SET` with boolean `value`; payload validation in `analytics/events`. | `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js`                                                                                                          |
| `comment_created`     | Comment submit success path                          | `CommentsPanel.handleSubmit` emits `EVENT_NAMES.COMMENT_CREATED` after successful `addComment`.                                  | `src/test/task-025-track-event-event-schema.test.js`, `src/test/recommendation-events.ui-emission.test.js`, `src/test/recommendation-events.docs-sync.test.js`                                                                                                          |

## 2) Deprecated events check

`like_toggled` / `bookmark_toggled` отсутствуют в активном UI/analytics коде (`FeedPage`, `ClipCard`, `CommentsPanel`, `analytics/events`) и не используются как runtime события.

## 3) UI emission coverage check

Все 8 canonical событий реально эмитятся из UI-точек, перечисленных в спецификации:

- `FeedPage`: `feed_opened`, `clip_impression`.
- `ClipCard`: `clip_play_started`, `clip_view_threshold`, `clip_view_ended`, `like_set`, `bookmark_set`.
- `CommentsPanel`: `comment_created`.

## 4) schemaVersion + enums sync check

- `schemaVersion`: `1.0.0` в `docs/recommendation-events.md` и в `feedService` (`EVENT_SCHEMA_VERSION`).
- Enum `event`: 8 canonical значений совпадают между docs и `EVENT_NAMES`.
- Enum `source`: `client | server`.
- Enum `surface`: `feed | bookmarks | profile`.
- Enum `threshold`: `p25 | p50 | p75 | p95`.
