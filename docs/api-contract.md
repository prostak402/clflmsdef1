# Local API contract

This document describes the API that is actually implemented by the local ClipFlow MVP.

## Base URL

- Base path: `/api/v1`
- Default local origin: `http://localhost:8787`
- Content type: `application/json`

## Canonical model

### User

```json
{
  "id": "usr_local_demo",
  "email": "user@local.dev",
  "displayName": "Demo User",
  "avatarUrl": null,
  "role": "user",
  "hasCompletedOnboarding": false,
  "selectedGenres": ["action", "drama"],
  "preferences": {
    "notificationsEnabled": true,
    "autoplayEnabled": true,
    "preferredLanguage": "en"
  },
  "createdAt": "2026-03-07T10:00:00.000Z",
  "updatedAt": "2026-03-07T10:00:00.000Z"
}
```

### Genre

```json
{
  "id": "scifi",
  "slug": "scifi",
  "name": "Sci-Fi"
}
```

### Clip

```json
{
  "id": "clip_1",
  "authorId": "usr_local_admin",
  "title": "Interstellar docking",
  "description": "Docking sequence highlight",
  "clipDescription": "Docking sequence highlight",
  "thumbnailUrl": "https://placehold.co/600x800?text=Interstellar",
  "videoUrl": "https://... or http://localhost:8787/api/v1/assets/...",
  "watchUrl": "https://example.com/watch/interstellar",
  "rating": 8.7,
  "durationSec": 180,
  "genreIds": ["scifi", "adventure"],
  "genreId": "scifi",
  "likesCount": 0,
  "commentsCount": 1,
  "sharesCount": 0,
  "bookmarksCount": 0,
  "status": "published",
  "createdAt": "2026-03-07T10:00:00.000Z",
  "updatedAt": "2026-03-07T10:00:00.000Z"
}
```

`genreIds` is the canonical clip genre model. `genreId` remains as the derived primary genre for backward compatibility.

### Comment

```json
{
  "id": "cm_seed_1",
  "clipId": "clip_1",
  "authorId": "usr_local_demo",
  "authorName": "Demo User",
  "avatar": "Movie",
  "text": "Great sequence",
  "likes": 0,
  "likedByViewer": false,
  "createdAt": "2026-03-07T10:00:00.000Z",
  "moderationStatus": "approved",
  "isHidden": false,
  "reportsCount": 0
}
```

## Auth endpoints

### `POST /auth/login`

Request:

```json
{ "email": "user@local.dev", "password": "demo-password" }
```

Response `200`:

```json
{
  "accessToken": "header.payload.local",
  "refreshToken": "refresh_uuid",
  "tokenType": "Bearer",
  "expiresAt": "2026-03-07T10:15:00.000Z",
  "user": {
    "id": "usr_local_demo",
    "email": "user@local.dev",
    "displayName": "Demo User",
    "avatarUrl": null,
    "role": "user",
    "hasCompletedOnboarding": false,
    "selectedGenres": [],
    "preferences": {
      "notificationsEnabled": true,
      "autoplayEnabled": true,
      "preferredLanguage": "en"
    },
    "createdAt": "2026-03-07T10:00:00.000Z",
    "updatedAt": "2026-03-07T10:00:00.000Z"
  }
}
```

### `POST /auth/signup`

Creates a local in-memory user and returns the same session payload and canonical `User` shape as login.

### `POST /auth/refresh`

Request:

```json
{ "refreshToken": "refresh_uuid" }
```

Returns a rotated access/refresh pair plus the canonical `User` payload.

### `POST /auth/logout`

Request:

```json
{ "refreshToken": "refresh_uuid" }
```

Requires `Authorization: Bearer <accessToken>` and returns `204`.

## User endpoints

### `GET /me`

Requires auth. Returns the canonical `User` plus profile counts.

Response `200`:

```json
{
  "id": "usr_local_demo",
  "email": "user@local.dev",
  "displayName": "Demo User",
  "avatarUrl": null,
  "role": "user",
  "hasCompletedOnboarding": true,
  "selectedGenres": ["action", "drama"],
  "preferences": {
    "notificationsEnabled": false,
    "autoplayEnabled": false,
    "preferredLanguage": "ru"
  },
  "createdAt": "2026-03-07T10:00:00.000Z",
  "updatedAt": "2026-03-08T10:00:00.000Z",
  "counts": {
    "bookmarks": 1,
    "likes": 2,
    "watched": 0
  }
}
```

### `PATCH /me`

Requires auth.

Request:

```json
{
  "hasCompletedOnboarding": true,
  "selectedGenres": ["action", "drama"],
  "preferences": {
    "notificationsEnabled": false,
    "autoplayEnabled": false,
    "preferredLanguage": "ru"
  }
}
```

Notes:

- `PATCH /me` accepts only `hasCompletedOnboarding`, `selectedGenres`, and `preferences`.
- `selectedGenres` is normalized to backend genre ids, deduplicated, and validated against `GET /genres`.
- `selectedGenres: []` is valid and means “all genres” for the saved default feed filter.
- `preferences.notificationsEnabled` and `preferences.autoplayEnabled` must be boolean.
- `preferences.preferredLanguage` must be a non-empty string.
- Invalid payloads return `422 VALIDATION_ERROR`.

Response `200` returns the updated plain `User`.

### `GET /me/bookmarks`

Requires auth. Returns:

```json
{ "items": [Clip] }
```

## Content endpoints

### `GET /genres`

Returns:

```json
{ "items": [Genre] }
```

### `GET /clips`

Returns:

```json
{ "items": [Clip] }
```

### `GET /feed/clips`

Optional query:

- `genreId=scifi`
- repeated `genreId`
- repeated legacy-compatible `genre`

If no genre filters are provided, the local MVP returns all visible clips.
If a clip has multiple genres, it is included when any of its `genreIds` matches the filter.

Response:

```json
{ "items": [Clip], "nextCursor": null }
```

## Comment endpoints

### `GET /comments`

Returns public comments across clips:

```json
{ "items": [Comment] }
```

If an access token is supplied, each comment is personalized with `likedByViewer`.

### `GET /clips/:clipId/comments`

Returns comments for one clip. If an access token is supplied, each comment is personalized with `likedByViewer`.

### `POST /clips/:clipId/comments`

Requires auth.

Request:

```json
{ "body": "Great clip" }
```

Response `201`:

```json
{ "comment": Comment }
```

## Reaction endpoints

### `POST /clips/:clipId/like`

### `DELETE /clips/:clipId/like`

Require auth. Response:

```json
{ "likes": { "clip_1": true } }
```

### `POST /clips/:clipId/bookmark`

### `DELETE /clips/:clipId/bookmark`

Require auth. Response:

```json
{ "bookmarks": ["clip_1"] }
```

### `POST /comments/:commentId/like`

### `DELETE /comments/:commentId/like`

Require auth. Response:

```json
{ "comment": Comment }
```

## Moderation endpoints

All moderation routes require an admin access token.

### `GET /moderation/comments`

```json
{ "items": [Comment] }
```

### `POST /moderation/comments/block-user`

Request:

```json
{ "authorId": "usr_local_demo", "isBlocked": true }
```

Response:

```json
{ "blockedUsers": { "usr_local_demo": true } }
```

### `DELETE /moderation/comments/:commentId`

### `DELETE /moderation/comments/by-user/:authorId`

Both return:

```json
{ "ok": true }
```

## Admin upload flow

All admin upload routes require an admin access token.

### `POST /admin/clips/upload-url`

Request:

```json
{
  "fileName": "clip.mp4",
  "contentType": "video/mp4",
  "size": 12345
}
```

Response `200`:

```json
{
  "uploadId": "upl_uuid",
  "objectKey": "clips/2026-03-07/uuid.mp4",
  "uploadUrl": "http://localhost:8787/api/v1/uploads/upl_uuid",
  "expiresIn": 900,
  "requiredHeaders": {
    "Content-Type": "video/mp4"
  }
}
```

`uploadUrl` always comes from the active storage provider. In `local` mode it points back to `PUT /uploads/:uploadId`; in `s3` mode it is a presigned PUT URL for the configured S3-compatible bucket.

### `PUT /uploads/:uploadId`

Local filesystem fallback only. This route is available when `STORAGE_PROVIDER=local` and writes the raw video bytes under the configured local storage root.

In `s3` mode, the frontend still does `PUT <uploadUrl>`, but that URL does not resolve through the ClipFlow API.

### `POST /admin/clips`

Request:

```json
{
  "uploadId": "upl_uuid",
  "objectKey": "clips/2026-03-07/uuid.mp4",
  "title": "Movie title",
  "description": "Movie description",
  "clipDescription": "Clip scene",
  "watchUrl": "https://example.com/watch/movie",
  "genreIds": ["drama", "thriller"],
  "rating": 8.5,
  "durationSec": 42,
  "status": "draft"
}
```

`genreIds` is the only supported admin write-path field. Legacy `genreId` and `genres` aliases are rejected with `422`.

`rating` is required and must be a number in the `0..10` range.

Response `201`:

```json
{ "clip": Clip }
```

### `PATCH /admin/clips/:clipId`

Request:

```json
{
  "title": "Updated movie title",
  "description": "Updated movie description",
  "clipDescription": "Updated clip scene",
  "watchUrl": "https://example.com/watch/movie-updated",
  "genreIds": ["thriller", "fantasy"],
  "rating": 8.9,
  "durationSec": 55,
  "status": "published"
}
```

All fields are optional, but any supplied `genreIds` must normalize to at least one valid genre, legacy `genreId`/`genres` aliases are rejected with `422`, and any supplied `rating` must remain in the `0..10` range. Successful responses preserve the canonical `genreIds + genreId` shape.

Response `200`:

```json
{ "clip": Clip }
```

Operational note: the manual `smoke:stage` workflow keeps stage clean by patching created smoke clips to `archived`. Hard-delete semantics are out of scope for the current media rollout.

### `GET /admin/clips`

Returns:

```json
{ "items": [Clip] }
```

## Errors

Error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Comment body is required",
    "requestId": "uuid"
  }
}
```

Common codes used by the local MVP:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `BAD_REQUEST`
- `INTERNAL_ERROR`
