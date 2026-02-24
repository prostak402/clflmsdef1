# Recommendation Events — Canonical Spec

## Статус документа

- **Назначение:** canonical спецификация клиентских событий для recommendation/feed.
- **Владелец:** Product Analytics + Client Platform.
- **Schema version:** `1.0.0`.
- **Формат времени:** ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.SSSZ`).

### Клиентская реализация (`feedService.trackEvent`)

- `trackEvent(name, payload)` валидирует обязательные входы: непустой `name` и объект `payload`.
- Сервис автоматически дополняет envelope полями: `eventId`, `schemaVersion`, `ts`, `sessionId`, `userId`.
- `schemaVersion` зафиксирован как `1.0.0`.
- `ts` фиксирован в формате ISO-8601 UTC (`new Date().toISOString()`).
- `userId` сериализуется как `string | null` (для anonymous используется `null`).
- События накапливаются в in-memory буфере; `flush()` детерминированно возвращает массив событий и очищает буфер (для пустого буфера возвращает `[]`).

---

## 1) Общие поля для всех событий

Каждое событие **обязано** содержать общий envelope:

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `eventId` | `string` (UUID v4) | required | Уникальный идентификатор конкретного события. Используется для idempotency на ingestion. |
| `schemaVersion` | `string` | required | Версия схемы события. Для этого документа: `1.0.0`. |
| `sessionId` | `string` | required | Идентификатор клиентской сессии (ротация по restart/timeout). |
| `userId` | `string \| null` | required | Идентификатор пользователя. `null` для анонимного трафика. |
| `ts` | `string` (ISO-8601 UTC) | required | Момент возникновения события на клиенте. |
| `source` | `enum` | required | Источник отправки: `web`, `ios`, `android`, `backend_replay`. |
| `surface` | `enum` | required | Продуктовая поверхность: `home_feed`, `genre_feed`, `search_feed`, `bookmarks_feed`, `deeplink_feed`. |
| `event` | `enum` | required | Имя события (см. раздел 3). |

### Общие правила валидации

1. `eventId` должен быть уникален минимум в окне 7 дней.
2. `ts` не должен быть больше server-time + 5 минут и старше 7 дней.
3. `schemaVersion` должен соответствовать поддерживаемой версии ingest pipeline.
4. `userId` может быть `null`, но поле должно присутствовать.

### Общие правила дедупликации/идемпотентности

- **Primary dedupe key:** `eventId`.
- При повторной доставке с тем же `eventId` событие считается duplicate и не влияет на метрики.
- Если `eventId` новый, но `(sessionId, event, ts±1s, clipId, impressionId)` совпадают, событие помечается как вероятный duplicate (`soft_dedupe=true`) для downstream-агрегаций.

---

## 2) Recommendation context (поля контекста рекомендаций)

Эти поля используются в релевантных событиях feed/clip.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `clipId` | `string` | required для clip-* и action событий | Идентификатор клипа. |
| `impressionId` | `string` (UUID) | required для clip_impression и производных clip событий | ID показа конкретной карточки/клипа в конкретной выдаче. |
| `feedRequestId` | `string` (UUID) | required | ID ответа ранжирования/выдачи, из которого пришёл клип. |
| `position` | `integer` (`>=0`) | required | Позиция клипа в выдаче (0-based). |
| `contextGenreId` | `string \| null` | optional | Жанровый контекст выдачи. |
| `clipDurationMs` | `integer` (`>0`) | required для playback событий | Длительность клипа в миллисекундах. |
| `watchMs` | `integer` (`>=0`) | optional/conditional | Накопленное время просмотра к моменту события. |
| `completionRate` | `number` (`0..1`) | optional/conditional | Доля просмотра: `watchMs / clipDurationMs` (clamped to 1). |

### Правила консистентности context

- `completionRate` должен быть согласован с `watchMs` и `clipDurationMs` (допуск ±0.02).
- Для одного `impressionId` поле `position` неизменно.
- `feedRequestId` должен совпадать с выдачей, в которой зафиксирован `impressionId`.

---

## 3) Спецификация событий

> Ниже для каждого события заданы: обязательные поля, опциональные поля, enum-поля, точка отправки в UI, правила дедупликации и идемпотентности.

### 3.1 `feed_opened`

**Назначение:** пользователь открыл feed-поверхность.

**Обязательные поля:**
- Общие поля (раздел 1).
- `event = "feed_opened"`.
- `feedRequestId`.

**Опциональные поля:**
- `contextGenreId`.
- `entryPoint` (`string`, например `tab_home`, `push`, `deeplink`).

**Enum-поля и значения:**
- `source`: `web | ios | android | backend_replay`.
- `surface`: `home_feed | genre_feed | search_feed | bookmarks_feed | deeplink_feed`.

**Точка отправки в UI:**
- Экран feed: первый mount/foreground feed-экрана после успешной инициализации данных.
- Хук: `useFeedScreenTelemetry` в эффекте `onScreenVisible`.

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- Session dedupe: не более одного `feed_opened` на `(sessionId, surface, feedRequestId)` в окне 30 секунд.

---

### 3.2 `clip_impression`

**Назначение:** карточка клипа стала видимой согласно порогу impression.

**Обязательные поля:**
- Общие поля.
- `event = "clip_impression"`.
- `clipId`, `impressionId`, `feedRequestId`, `position`.

**Опциональные поля:**
- `contextGenreId`.
- `visiblePct` (`number`, `0..1`).

**Enum-поля и значения:**
- `impressionType`: `first_viewable | reflow_viewable` (optional, default `first_viewable`).

**Точка отправки в UI:**
- Feed/list item observer (IntersectionObserver / visibility callback).
- Условие: карточка видима минимум 50% не менее 300ms.

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- Business dedupe: единственный `clip_impression` для `(sessionId, impressionId)`.

---

### 3.3 `clip_play_started`

**Назначение:** старт воспроизведения клипа.

**Обязательные поля:**
- Общие поля.
- `event = "clip_play_started"`.
- `clipId`, `impressionId`, `feedRequestId`, `position`, `clipDurationMs`.

**Опциональные поля:**
- `contextGenreId`.
- `autoplay` (`boolean`, default `true`).

**Enum-поля и значения:**
- `playInitiator`: `autoplay | user_tap | replay`.

**Точка отправки в UI:**
- Video player callback `onPlay` при переходе в состояние playing.

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- Business dedupe: один `clip_play_started` на `(sessionId, impressionId, playSequence)`; `playSequence` инкрементируется при replay.

---

### 3.4 `clip_view_threshold`

**Назначение:** просмотр пересёк контрольный порог.

**Обязательные поля:**
- Общие поля.
- `event = "clip_view_threshold"`.
- `clipId`, `impressionId`, `feedRequestId`, `position`, `clipDurationMs`, `watchMs`, `completionRate`.
- `threshold`.

**Опциональные поля:**
- `contextGenreId`.

**Enum-поля и значения:**
- `threshold`: `25pct | 50pct | 75pct | 95pct`.

**Точка отправки в UI:**
- Таймкод-трекер плеера, когда накопленный `watchMs` впервые пересекает порог.

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- Business dedupe: не более одного события на `(sessionId, impressionId, threshold)`.

---

### 3.5 `clip_view_ended`

**Назначение:** завершение сессии просмотра клипа (скролл дальше, pause+timeout, close).

**Обязательные поля:**
- Общие поля.
- `event = "clip_view_ended"`.
- `clipId`, `impressionId`, `feedRequestId`, `position`, `clipDurationMs`, `watchMs`, `completionRate`.
- `endReason`.

**Опциональные поля:**
- `contextGenreId`.

**Enum-поля и значения:**
- `endReason`: `completed | scrolled_away | paused_timeout | app_backgrounded | error`.

**Точка отправки в UI:**
- Player/session teardown hook (`onStop`, `onVisibilityLost`, app lifecycle).

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- Business dedupe: последний `clip_view_ended` на `(sessionId, impressionId, playSequence)` является источником истины, предыдущие помечаются superseded.

---

### 3.6 `like_set`

**Назначение:** пользователь изменил состояние лайка.

**Обязательные поля:**
- Общие поля.
- `event = "like_set"`.
- `clipId`, `impressionId`, `feedRequestId`, `position`.
- `likeState`.

**Опциональные поля:**
- `contextGenreId`.

**Enum-поля и значения:**
- `likeState`: `liked | unliked`.
- `actionSource`: `feed_overlay | detail_sheet` (optional).

**Точка отправки в UI:**
- Tap на кнопке Like после локального state update (optimistic), с последующим reconcile.

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- State dedupe: события с одинаковым `likeState` для `(sessionId, clipId)` в окне 1 секунды схлопываются.

---

### 3.7 `bookmark_set`

**Назначение:** пользователь изменил состояние закладки.

**Обязательные поля:**
- Общие поля.
- `event = "bookmark_set"`.
- `clipId`, `impressionId`, `feedRequestId`, `position`.
- `bookmarkState`.

**Опциональные поля:**
- `contextGenreId`.

**Enum-поля и значения:**
- `bookmarkState`: `bookmarked | unbookmarked`.
- `actionSource`: `feed_overlay | detail_sheet` (optional).

**Точка отправки в UI:**
- Tap на кнопке Bookmark после локального state update.

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- State dedupe: события с одинаковым `bookmarkState` для `(sessionId, clipId)` в окне 1 секунды схлопываются.

---

### 3.8 `comment_created`

**Назначение:** пользователь создал комментарий к клипу.

**Обязательные поля:**
- Общие поля.
- `event = "comment_created"`.
- `clipId`, `impressionId`, `feedRequestId`, `position`.
- `commentId`.

**Опциональные поля:**
- `contextGenreId`.
- `replyToCommentId`.
- `textLength` (`integer`, `>0`).

**Enum-поля и значения:**
- `creationSurface`: `inline_sheet | full_comments_screen`.

**Точка отправки в UI:**
- После успешного подтверждения создания комментария от API (`201 Created`).

**Дедупликация/идемпотентность:**
- Hard dedupe: по `eventId`.
- Business dedupe: уникальность `commentId`; повторные `comment_created` с тем же `commentId` игнорируются.

---

## 4) JSON-примеры

> Для каждого события: 1 корректный пример (happy path) + 1 пример с ошибкой валидации.

### 4.1 `feed_opened`

**Happy path**
```json
{
  "eventId": "6e9c5c3e-f347-4b0f-8db0-cc5e84f0d2df",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:01.120Z",
  "source": "web",
  "surface": "home_feed",
  "event": "feed_opened",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "entryPoint": "tab_home"
}
```

**Validation error example** (`source` invalid)
```json
{
  "eventId": "e0fd333a-f006-4e5b-9f05-8a16115b1677",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:01.120Z",
  "source": "desktop",
  "surface": "home_feed",
  "event": "feed_opened",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf"
}
```

### 4.2 `clip_impression`

**Happy path**
```json
{
  "eventId": "8ac78f36-7a8b-43f8-a78b-6322ec0add79",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:05.010Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_impression",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "visiblePct": 0.78,
  "impressionType": "first_viewable"
}
```

**Validation error example** (`position` negative)
```json
{
  "eventId": "6ef83a34-c9c8-4f2d-a123-527d49fccf75",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:05.010Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_impression",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": -1
}
```

### 4.3 `clip_play_started`

**Happy path**
```json
{
  "eventId": "4d8e0af6-2ec2-4a3c-a69f-b13ff71ec4a8",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:05.400Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_play_started",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "clipDurationMs": 32000,
  "playInitiator": "autoplay"
}
```

**Validation error example** (`clipDurationMs` missing)
```json
{
  "eventId": "8da7e558-b046-4d49-9ee2-f32985dbe6f9",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:05.400Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_play_started",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "playInitiator": "autoplay"
}
```

### 4.4 `clip_view_threshold`

**Happy path**
```json
{
  "eventId": "63037ef7-0e4d-4def-a25b-c7038920d7b1",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:13.900Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_view_threshold",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "clipDurationMs": 32000,
  "watchMs": 16000,
  "completionRate": 0.5,
  "threshold": "50pct"
}
```

**Validation error example** (`threshold` invalid)
```json
{
  "eventId": "e7909c0d-347d-4136-8cdf-2d5bb9cba8db",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:13.900Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_view_threshold",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "clipDurationMs": 32000,
  "watchMs": 16000,
  "completionRate": 0.5,
  "threshold": "60pct"
}
```

### 4.5 `clip_view_ended`

**Happy path**
```json
{
  "eventId": "4f9d5bb5-bf4e-4f7b-aeb7-3d2be13a6458",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:28.301Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_view_ended",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "clipDurationMs": 32000,
  "watchMs": 30200,
  "completionRate": 0.94375,
  "endReason": "scrolled_away"
}
```

**Validation error example** (`completionRate` out of range)
```json
{
  "eventId": "c662ec7f-b863-466a-a7d9-5d7866550233",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:28.301Z",
  "source": "web",
  "surface": "home_feed",
  "event": "clip_view_ended",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "clipDurationMs": 32000,
  "watchMs": 30200,
  "completionRate": 1.2,
  "endReason": "scrolled_away"
}
```

### 4.6 `like_set`

**Happy path**
```json
{
  "eventId": "73138eda-c930-4f7d-a10d-0ad0374db00a",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:09.770Z",
  "source": "web",
  "surface": "home_feed",
  "event": "like_set",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "likeState": "liked",
  "actionSource": "feed_overlay"
}
```

**Validation error example** (`likeState` invalid)
```json
{
  "eventId": "b30104dd-aaf1-4f8f-ac38-2ccaa6309e7b",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:09.770Z",
  "source": "web",
  "surface": "home_feed",
  "event": "like_set",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "likeState": "on"
}
```

### 4.7 `bookmark_set`

**Happy path**
```json
{
  "eventId": "a0ca1730-f887-4ec9-8225-9db4fbe7ae8c",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:11.342Z",
  "source": "web",
  "surface": "home_feed",
  "event": "bookmark_set",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "bookmarkState": "bookmarked",
  "actionSource": "feed_overlay"
}
```

**Validation error example** (`bookmarkState` missing)
```json
{
  "eventId": "dbf5757b-24cc-4044-bddd-2104cfdb8275",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:11.342Z",
  "source": "web",
  "surface": "home_feed",
  "event": "bookmark_set",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3
}
```

### 4.8 `comment_created`

**Happy path**
```json
{
  "eventId": "0dd297f5-dd84-4f7d-a3f2-12306ffea2cb",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:18.507Z",
  "source": "web",
  "surface": "home_feed",
  "event": "comment_created",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "commentId": "cmt_451901",
  "creationSurface": "inline_sheet",
  "textLength": 42
}
```

**Validation error example** (`commentId` empty)
```json
{
  "eventId": "d8f0108b-2ea2-4197-b95a-19c8027fd531",
  "schemaVersion": "1.0.0",
  "sessionId": "sess_2fc0e7f6",
  "userId": "u_1024",
  "ts": "2026-02-24T09:00:18.507Z",
  "source": "web",
  "surface": "home_feed",
  "event": "comment_created",
  "clipId": "clip_9981",
  "impressionId": "90599f22-cbcc-4388-936d-ece6b9eec2c3",
  "feedRequestId": "9a9d1b86-6273-4bd4-a1a8-311be4fb32cf",
  "position": 3,
  "commentId": "",
  "creationSurface": "inline_sheet"
}
```
