# TASK-004 — API contract (frontend-first)

Единый API-контракт для синхронизации frontend/backend: **что за сущности существуют** и **как с ними работать по HTTP**.

## 1) Общие правила

### 1.1 Базовый формат API

- Base path: `/api/v1`
- Формат тела запросов/ответов: `application/json`
- Все timestamp-поля: ISO 8601 UTC (`string`, пример `2026-02-22T10:20:30Z`).
- Все идентификаторы сущностей: `uuid` (UUID v4).

### 1.2 Идентификаторы

- Первичный ключ каждой сущности: `id: uuid`.
- Внешние ключи: `<entity>Id: uuid` (например, `clipId`, `genreId`).
- Клиент не передает серверные `id` при create-операциях.

### 1.3 Аутентификация и `me`

- Аутентификация: Bearer token в заголовке `Authorization: Bearer <token>`.
- Сервер определяет текущего пользователя из токена (`auth subject`).
- В create-операциях, где пользователь однозначно определяется из токена, клиент **не передает** `userId/authorId`.
- Базовый endpoint текущего пользователя:
  - `GET /me` — профиль текущего пользователя.

### 1.4 Роли и ownership

- `user` — обычный пользователь.
- `admin` — модерация и управление справочниками.
- Базовые правила:
  - пользователь может создавать собственные ресурсы;
  - пользователь может менять/удалять только собственные ресурсы;
  - `admin` может create/update/delete любые ресурсы в рамках модерации.

### 1.5 Пагинация

- Для стандартных списков (админка/каталоги): offset-пагинация.
  - Query: `page` (integer, `>=1`, default `1`), `limit` (integer, `1..50`, default `20`).
- Для ленты клипов (бесконечный скролл): cursor-пагинация.
  - Query: `cursor` (string, optional), `limit` (integer, `1..50`, default `20`).

### 1.6 Сортировка и фильтрация

- `sortBy` — поле из whitelist endpoint-а.
- `sortOrder` — `asc | desc`.
- Фильтры передаются query-параметрами.
- Неизвестные фильтры: `400 Bad Request`.

### 1.7 Единый формат ошибок

Все ошибки возвращаются в едином формате:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "title", "message": "Must be between 3 and 120 characters" }],
    "requestId": "6f9eec7b-4c43-4f1f-8c2b-5f68d5a9f95d"
  }
}
```

- `code` — стабильный машинный код ошибки.
- `message` — человекочитаемое сообщение.
- `details` — массив ошибок полей (может быть пустым/отсутствовать для не-валидационных ошибок).
- `requestId` — корреляционный id для логов.

Коды по статусам:

- `400` → `BAD_REQUEST`
- `401` → `UNAUTHORIZED`
- `403` → `FORBIDDEN`
- `404` → `NOT_FOUND`
- `409` → `CONFLICT`
- `422` → `VALIDATION_ERROR`
- `429` → `RATE_LIMITED`
- `500` → `INTERNAL_ERROR`

### 1.8 Валидация

- Все обязательные `uuid` — валидные UUID v4.
- Строки trim-ятся, затем проверяются по min/max.
- Enum-поля принимают только значения, зафиксированные в контракте.
- Ошибки валидации: `422 Unprocessable Entity`.

---

## 2) Доменная модель сущностей

## 2.1 User

| Поле                   | Тип              | Обязательное | Описание                   |
| ---------------------- | ---------------- | -----------: | -------------------------- |
| id                     | uuid             |           да | Идентификатор пользователя |
| email                  | string           |           да | Уникальный email, max 254  |
| displayName            | string           |           да | Публичное имя, 2..50       |
| avatarUrl              | string \| null   |          нет | URL аватара                |
| role                   | enum             |           да | `user` \| `admin`          |
| hasCompletedOnboarding | boolean          |           да | Завершение онбординга      |
| createdAt              | datetime         |           да | Дата создания              |
| updatedAt              | datetime         |           да | Дата обновления            |
| deletedAt              | datetime \| null |          нет | Мягкое удаление            |

## 2.2 Genre

| Поле      | Тип              | Обязательное | Описание                             |
| --------- | ---------------- | -----------: | ------------------------------------ |
| id        | uuid             |           да | Идентификатор жанра                  |
| slug      | string           |           да | Уникальный slug, `^[a-z0-9-]{2,40}$` |
| name      | string           |           да | Название, 2..40                      |
| isActive  | boolean          |           да | Активность жанра                     |
| createdAt | datetime         |           да | Дата создания                        |
| updatedAt | datetime         |           да | Дата обновления                      |
| deletedAt | datetime \| null |          нет | Мягкое удаление                      |

## 2.3 Clip

| Поле          | Тип              | Обязательное | Описание                             |
| ------------- | ---------------- | -----------: | ------------------------------------ |
| id            | uuid             |           да | Идентификатор клипа                  |
| authorId      | uuid             |           да | `User.id` автора                     |
| genreId       | uuid             |           да | `Genre.id`                           |
| title         | string           |           да | 3..120                               |
| description   | string           |          нет | max 1000                             |
| videoUrl      | string           |           да | URL видео                            |
| thumbnailUrl  | string           |          нет | URL превью                           |
| durationSec   | integer          |           да | `1..600`                             |
| status        | enum             |           да | `draft` \| `published` \| `archived` |
| viewsCount    | integer          |           да | `>=0`                                |
| likesCount    | integer          |           да | `>=0`                                |
| commentsCount | integer          |           да | `>=0`                                |
| createdAt     | datetime         |           да | Дата создания                        |
| updatedAt     | datetime         |           да | Дата обновления                      |
| publishedAt   | datetime \| null |          нет | Дата публикации                      |
| deletedAt     | datetime \| null |          нет | Мягкое удаление                      |

## 2.4 Comment

| Поле      | Тип              | Обязательное | Описание                  |
| --------- | ---------------- | -----------: | ------------------------- |
| id        | uuid             |           да | Идентификатор комментария |
| clipId    | uuid             |           да | `Clip.id`                 |
| authorId  | uuid             |           да | `User.id`                 |
| body      | string           |           да | 1..500                    |
| createdAt | datetime         |           да | Дата создания             |
| updatedAt | datetime         |           да | Дата обновления           |
| isEdited  | boolean          |           да | Признак редактирования    |
| deletedAt | datetime \| null |          нет | Мягкое удаление           |

## 2.5 Like

| Поле      | Тип      | Обязательное | Описание            |
| --------- | -------- | -----------: | ------------------- |
| id        | uuid     |           да | Идентификатор лайка |
| userId    | uuid     |           да | `User.id`           |
| clipId    | uuid     |           да | `Clip.id`           |
| createdAt | datetime |           да | Дата создания       |

Уникальность: `userId + clipId`.

## 2.6 Bookmark

| Поле      | Тип      | Обязательное | Описание               |
| --------- | -------- | -----------: | ---------------------- |
| id        | uuid     |           да | Идентификатор закладки |
| userId    | uuid     |           да | `User.id`              |
| clipId    | uuid     |           да | `Clip.id`              |
| createdAt | datetime |           да | Дата создания          |

Уникальность: `userId + clipId`.

---

## 3) Read visibility (кто что может читать)

- Публичная лента: только `status=published` и не soft-deleted.
- `draft` клипы: видит только автор и `admin`.
- `archived` клипы: видит только автор и `admin`.
- Неактивные жанры (`isActive=false`):
  - новые клипы создавать нельзя;
  - уже опубликованные клипы остаются доступными по `id`,
  - но **не попадают** в публичную ленту до реактивации жанра.

---

## 4) HTTP endpoints (MVP)

## 4.1 Me

### `GET /me`

Возвращает профиль текущего пользователя.

Response `200`:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John",
  "avatarUrl": null,
  "role": "user",
  "hasCompletedOnboarding": true,
  "createdAt": "2026-02-22T10:20:30Z",
  "updatedAt": "2026-02-22T10:20:30Z"
}
```

### `GET /me/bookmarks`

Список закладок текущего пользователя (offset-пагинация).

Query: `page`, `limit`, `sortBy=createdAt`, `sortOrder`.

---

## 4.2 Genres

### `GET /genres`

Список жанров.

Query:

- `isActive` (boolean, optional)
- `q` (string, optional)
- `page`, `limit`
- `sortBy` in `name|createdAt`, `sortOrder`

### `POST /genres` (admin)

Создание жанра.

### `PATCH /genres/:id` (admin)

Обновление жанра.

### `DELETE /genres/:id` (admin)

Soft-delete жанра.

---

## 4.3 Clips

### `GET /clips`

Каталог клипов (offset-пагинация).

Query:

- `authorId`, `genreId`, `status`, `q`
- `page`, `limit`
- `sortBy` in `createdAt|publishedAt|viewsCount|likesCount`, `sortOrder`

Правило доступа: если пользователь не `admin`, чужие `draft/archived` исключаются.

### `GET /feed/clips`

Лента клипов (cursor-пагинация, frontend-first для infinite scroll).

Query:

- `cursor` (optional)
- `limit` (default 20)
- `genreId` (optional)

Response `200`:

```json
{
  "items": [],
  "nextCursor": "2026-02-22T10:20:30Z_9f3d0d3f-2f09-4662-a66f-94a83f236f46"
}
```

### `GET /clips/:id`

Детальная карточка клипа с учетом прав доступа.

### `POST /clips`

Создание клипа.

### `PATCH /clips/:id`

Частичное обновление клипа.

### `POST /clips/:id/publish`

Публикация клипа.

### `POST /clips/:id/archive`

Архивация клипа.

### `DELETE /clips/:id`

Soft-delete клипа.

---

## 4.4 Comments

### `GET /clips/:id/comments`

Комментарии клипа (offset-пагинация).

Query: `page`, `limit`, `sortBy=createdAt`, `sortOrder`.

### `POST /clips/:id/comments`

Создать комментарий к клипу.

### `PATCH /comments/:id`

Обновить комментарий.

### `DELETE /comments/:id`

Soft-delete комментария.

---

## 4.5 Likes

### `POST /clips/:id/like`

Поставить лайк текущим пользователем.

### `DELETE /clips/:id/like`

Убрать лайк текущего пользователя.

---

## 4.6 Bookmarks

### `POST /clips/:id/bookmark`

Добавить клип в закладки текущего пользователя.

### `DELETE /clips/:id/bookmark`

Удалить клип из закладок текущего пользователя.

---

## 4.7 Views

### `POST /clips/:id/view`

Событие просмотра клипа.

Body (MVP):

```json
{
  "watchedMs": 4000
}
```

Правило (MVP): просмотр засчитывается, если достигнут порог просмотра (конкретный порог фиксируется в backend-конфиге).

---

## 4.8 Upload media

Для `videoUrl` и `thumbnailUrl` используется flow через signed URL.

### `POST /uploads`

Запросить signed URL для загрузки.

Request:

```json
{
  "type": "clip-video",
  "mimeType": "video/mp4",
  "fileName": "my-clip.mp4",
  "sizeBytes": 10485760
}
```

Response `200`:

```json
{
  "uploadId": "uuid",
  "uploadUrl": "https://storage...",
  "method": "PUT",
  "headers": {
    "Content-Type": "video/mp4"
  },
  "expiresAt": "2026-02-22T10:25:30Z"
}
```

### `POST /uploads/:uploadId/complete`

Подтвердить успешную загрузку.

Response `200`:

```json
{
  "assetUrl": "https://cdn.../clip.mp4"
}
```

`assetUrl` затем передается в `CreateClipRequest/UpdateClipRequest` как `videoUrl`/`thumbnailUrl`.

---

## 5) DTO: request/response модели

## 5.1 Clip DTO

### CreateClipRequest

```json
{
  "genreId": "uuid",
  "title": "My clip",
  "description": "optional",
  "videoUrl": "https://cdn.../video.mp4",
  "thumbnailUrl": "https://cdn.../thumb.jpg",
  "durationSec": 20
}
```

Ограничения:

- `authorId` не передается (берется из токена).
- Нельзя передавать серверные поля: `viewsCount`, `likesCount`, `commentsCount`, `createdAt`, `updatedAt`, `publishedAt`.

### UpdateClipRequest (`PATCH`)

Все поля опциональны:

```json
{
  "genreId": "uuid",
  "title": "Updated title",
  "description": "Updated description",
  "thumbnailUrl": "https://cdn.../new-thumb.jpg"
}
```

### ClipResponse

```json
{
  "id": "uuid",
  "authorId": "uuid",
  "genreId": "uuid",
  "title": "My clip",
  "description": "optional",
  "videoUrl": "https://cdn.../video.mp4",
  "thumbnailUrl": "https://cdn.../thumb.jpg",
  "durationSec": 20,
  "status": "published",
  "viewsCount": 100,
  "likesCount": 12,
  "commentsCount": 4,
  "createdAt": "2026-02-22T10:20:30Z",
  "updatedAt": "2026-02-22T10:20:30Z",
  "publishedAt": "2026-02-22T10:20:30Z",
  "viewerState": {
    "isLiked": true,
    "isBookmarked": false,
    "canEdit": true,
    "canDelete": true
  }
}
```

### ListClipsResponse (offset)

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### FeedClipsResponse (cursor)

```json
{
  "items": [],
  "nextCursor": "2026-02-22T10:20:30Z_9f3d0d3f-2f09-4662-a66f-94a83f236f46"
}
```

## 5.2 Comment DTO

### CreateCommentRequest

```json
{
  "body": "Great clip!"
}
```

### UpdateCommentRequest (`PATCH`)

```json
{
  "body": "Updated comment"
}
```

### CommentResponse

```json
{
  "id": "uuid",
  "clipId": "uuid",
  "authorId": "uuid",
  "body": "Great clip!",
  "createdAt": "2026-02-22T10:20:30Z",
  "updatedAt": "2026-02-22T10:20:30Z",
  "isEdited": false,
  "viewerState": {
    "canEdit": true,
    "canDelete": true
  }
}
```

## 5.3 Like/Bookmark DTO

### Toggle-like/bookmark responses (`POST/DELETE`)

```json
{
  "success": true
}
```

## 5.4 Genre DTO

### CreateGenreRequest

```json
{
  "slug": "hip-hop",
  "name": "Hip-Hop",
  "isActive": true
}
```

### UpdateGenreRequest (`PATCH`)

```json
{
  "name": "Hip Hop",
  "isActive": false
}
```

---

## 6) Validation constraints (обязательно)

- `displayName`: 2..50
- `email`: валидный формат, lowercase, уникальный
- `Genre.slug`: `^[a-z0-9-]{2,40}$`, уникальный
- `Genre.name`: 2..40
- `Clip.title`: 3..120
- `Clip.description`: max 1000
- `Clip.durationSec`: 1..600
- `Comment.body`: 1..500 (после trim)
- Все required `uuid` — валидный UUID v4
- Для `Like` и `Bookmark` пара (`userId`, `clipId`) уникальна

---

## 7) Счетчики и консистентность

- `likesCount` и `commentsCount`: обновляются сразу после успешной операции.
- `viewsCount`: обновляется через endpoint просмотра `POST /clips/:id/view` по правилу порога просмотра.
- Счетчики считаются **eventually consistent** — допускается небольшое отставание.

---

## 8) Soft-delete правила

- Сущности с soft-delete: `User`, `Genre`, `Clip`, `Comment`.
- Поле: `deletedAt: datetime | null`.
- Soft-deleted записи:
  - не возвращаются в стандартных list endpoint-ах;
  - недоступны в обычных read endpoint-ах для `user`;
  - могут быть доступны `admin` для модерации.
- Восстановление (`restore`) не входит в MVP, может быть добавлено отдельными endpoint-ами позже.

---

## 9) Совместимость frontend/backend

- Любое изменение поля/типа/обязательности/формата ответа — versioned change в этом документе.
- Breaking changes допустимы только после согласования FE + BE и миграционного плана.
- Новые поля в response добавляются backward-compatible (клиент игнорирует неизвестные поля).
