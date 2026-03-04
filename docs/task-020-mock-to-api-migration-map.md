# TASK-020 — Карта миграции `mock.js` → API schemas

Цель: перевести фронтенд с `src/data/mock.js` на контракт из `docs/api-contract.md` без потерь по пользовательским сценариям (лента, каталог, комментарии, лайки, закладки, профиль).

## 1) Мэппинг `src/data/mock.js` → сущности API

## 1.1 `GENRES` → `Genre`

| mock поле                 | API сущность.поле                     | Действие         | Комментарий                                                                                  |
| ------------------------- | ------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `id` (`action`, `comedy`) | `Genre.slug`                          | rename           | В API `id` должен быть UUID, а mock-идентификатор жанра — это slug.                          |
| `name`                    | `Genre.name`                          | keep             | Без изменений.                                                                               |
| `icon`                    | —                                     | mock-only/remove | В контракте `Genre` нет иконки. Если нужна в UI, хранить как фронтовый справочник по `slug`. |
| `color`                   | —                                     | mock-only/remove | В контракте `Genre` нет цвета. Аналогично: UI-token по `slug`.                               |
| —                         | `Genre.id`                            | add              | UUID генерируется/приходит с сервера.                                                        |
| —                         | `Genre.isActive`                      | add              | Для фильтрации доступных жанров.                                                             |
| —                         | `Genre.createdAt/updatedAt/deletedAt` | add              | Системные поля из API.                                                                       |

## 1.2 `MOCK_CLIPS` → `Clip` (+ агрегаты `Like`/`Bookmark`)

| mock поле             | API сущность.поле                                | Действие         | Комментарий                                                                                                                    |
| --------------------- | ------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                  | `Clip.id`                                        | type-change      | Нужен переход со строк вида `"1"` на UUID.                                                                                     |
| `movieId`             | —                                                | remove           | В контракте отсутствует; если нужен внешний id, добавить отдельным ADR/изменением контракта.                                   |
| `title`               | `Clip.title`                                     | keep             | Без изменений.                                                                                                                 |
| `description`         | `Clip.description`                               | keep             | Без изменений (max 1000).                                                                                                      |
| `clipDescription`     | —                                                | rename/split     | Слить в `Clip.description` или выделить отдельное API-поле (вне текущего контракта).                                           |
| `genres: string[]`    | `Clip.genreId: uuid`                             | reshape          | MVP-контракт поддерживает 1 жанр на клип; для multi-genre нужен bridge: первичный жанр + клиентский fallback до изменения API. |
| `year`                | —                                                | remove           | В `Clip` поля нет; относится к фильму, не к клипу.                                                                             |
| `rating`              | —                                                | remove           | В `Clip` поля нет; можно считать метаданными каталога/фильма.                                                                  |
| `director`            | —                                                | remove           | Не входит в текущую доменную модель.                                                                                           |
| `duration` (`2h 49m`) | `Clip.durationSec`                               | rename+transform | Нужен парсер строки в секунды.                                                                                                 |
| `poster`              | `Clip.thumbnailUrl`                              | rename           | URL постера использовать как thumbnail клипа.                                                                                  |
| `clipUrl`             | `Clip.videoUrl`                                  | rename           | Прямое соответствие.                                                                                                           |
| `watchUrl`            | —                                                | remove           | В контракте нет deep-link на фильм; при необходимости — расширение API.                                                        |
| `likes`               | `Clip.likesCount`                                | rename           | Агрегированный счетчик.                                                                                                        |
| `comments`            | `Clip.commentsCount`                             | rename           | Агрегированный счетчик.                                                                                                        |
| `shares`              | —                                                | remove           | В контракте нет `sharesCount`; пока не переносим.                                                                              |
| `bookmarks`           | —                                                | move             | Не поле `Clip`: источник — сущность `Bookmark` (персонализировано по `me`).                                                    |
| —                     | `Clip.authorId`                                  | add              | Для mock-данных использовать seed-автора `system-seed-user`.                                                                   |
| —                     | `Clip.status`                                    | add              | Для данных ленты ставим `published`.                                                                                           |
| —                     | `Clip.viewsCount`                                | add              | Инициализировать seed-значением (например, `0` или derived).                                                                   |
| —                     | `Clip.createdAt/updatedAt/publishedAt/deletedAt` | add              | Системные поля из API.                                                                                                         |

## 1.3 `MOCK_CATALOG` → `Clip` (каталог как subset)

| mock поле          | API сущность.поле                       | Действие    | Комментарий                                                      |
| ------------------ | --------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `id` (`c1`)        | `Clip.id`                               | type-change | UUID вместо `c*`.                                                |
| `title`            | `Clip.title`                            | keep        | Без изменений.                                                   |
| `year`             | —                                       | remove      | В контракте нет.                                                 |
| `rating`           | —                                       | remove      | В контракте нет.                                                 |
| `genres: string[]` | `Clip.genreId`                          | reshape     | Выбрать primary genre (первый в списке) и зафиксировать правило. |
| `poster`           | `Clip.thumbnailUrl`                     | rename      | Прямое соответствие.                                             |
| `watchUrl`         | —                                       | remove      | В контракте нет.                                                 |
| —                  | `Clip.videoUrl`                         | add         | Для каталога без реального видео: временный placeholder URL.     |
| —                  | `Clip.durationSec`                      | add         | Для MVP задать дефолт, например `30`.                            |
| —                  | `Clip.status`                           | add         | Для видимости в каталоге — `published`.                          |
| —                  | `Clip.authorId` + timestamps + counters | add         | Обязательные поля контракта.                                     |

## 1.4 `MOCK_COMMENTS` → `Comment` (+ `User`)

| mock поле                  | API сущность.поле                       | Действие    | Комментарий                                                              |
| -------------------------- | --------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| key объекта (`'1'`, `'2'`) | `Comment.clipId`                        | type-change | Перейти на UUID клипа.                                                   |
| `id` (`cm1`)               | `Comment.id`                            | type-change | UUID вместо `cm*`.                                                       |
| `user`                     | `User.displayName` / `Comment.authorId` | split       | Имя пользователя не хранить в `Comment`, хранить связь на `User`.        |
| `avatar` (emoji)           | `User.avatarUrl`                        | reshape     | Emoji не URL; хранить как `null`/placeholder URL, emoji — временно в UI. |
| `text`                     | `Comment.body`                          | rename      | Прямое соответствие.                                                     |
| `time` (`2 hours ago`)     | `Comment.createdAt`                     | transform   | Нужен переход на абсолютный ISO timestamp.                               |
| `likes`                    | —                                       | remove      | В контракте нет лайков комментариев.                                     |
| —                          | `Comment.updatedAt`                     | add         | Для seed = `createdAt`.                                                  |
| —                          | `Comment.isEdited`                      | add         | Для seed = `false`.                                                      |
| —                          | `Comment.deletedAt`                     | add         | Для seed = `null`.                                                       |

---

## 2) Поля mock-only на удаление/rename

## 2.1 Удалить (не покрыто текущим контрактом)

- `GENRES.icon`
- `GENRES.color`
- `MOCK_CLIPS.movieId`
- `MOCK_CLIPS.year`
- `MOCK_CLIPS.rating`
- `MOCK_CLIPS.director`
- `MOCK_CLIPS.watchUrl`
- `MOCK_CLIPS.shares`
- `MOCK_CATALOG.year`
- `MOCK_CATALOG.rating`
- `MOCK_CATALOG.watchUrl`
- `MOCK_COMMENTS.likes`

## 2.2 Переименовать/трансформировать

- `GENRES.id` → `Genre.slug`
- `MOCK_CLIPS.clipUrl` → `Clip.videoUrl`
- `MOCK_CLIPS.poster` → `Clip.thumbnailUrl`
- `MOCK_CLIPS.duration` → `Clip.durationSec` (через парсер)
- `MOCK_CLIPS.likes` → `Clip.likesCount`
- `MOCK_CLIPS.comments` → `Clip.commentsCount`
- `MOCK_COMMENTS.text` → `Comment.body`
- `MOCK_COMMENTS.time` → `Comment.createdAt`

## 2.3 Риски несовместимости (требуют решения до cutover)

1. **Multi-genre (`genres[]`) vs `genreId`** — в API один жанр на клип.
2. **Нет полей movie metadata** (`year`, `rating`, `director`) — потеря контента на карточке/каталоге.
3. **Нет `watchUrl` и `sharesCount`** — UX-функции недоописаны контрактом.
4. **Комментарий хранит только `authorId`** — нужен join/expand автора в ответах (`author` объект) или дополнительный запрос.

---

## 3) План миграции по этапам

1. **Freeze текущей формы данных**
   - Зафиксировать текущие shape-типизации в адаптере (JSDoc/contract tests).
2. **Ввести слой нормализации API → UI model**
   - Централизованный mapper `apiClipToViewModel`, `apiCommentToViewModel`, `apiGenreToViewModel`.
3. **Сделать обратный mapper для операций записи**
   - `createComment`, toggles like/bookmark, фильтры по жанрам.
4. **Переключить read-path по флагу**
   - Фича-флаг `VITE_DATA_SOURCE` (`mock` / `api`); mock оставить fallback.
5. **Переключить write-path**
   - Лайки/закладки/комментарии через реальные endpoints + optimistic update.
6. **Удалить mock-only поля из UI-потребления**
   - Убрать использование `year/rating/director/watchUrl/shares` или заменить на API-backed поля.
7. **Final cleanup**
   - Удалить `src/data/mock.js` после стабилизации и прохождения smoke/regression.

---

## 3.3 Canonical feed endpoint

- Единый канонический endpoint ленты: `GET /feed/clips` (см. `docs/api-contract.md`).
- Альтернативные варианты (`GET /feed`, `GET /clips/feed`) не используются во frontend adapter/service и smoke-проверках.

## 3.4 Source of truth для endpoint-ов

- Канонический источник endpoint-ов и DTO: `docs/api-contract.md`.
- Любое изменение endpoint-ов/параметров/ответов сначала вносится в `docs/api-contract.md`, затем в adapter/service реализацию.
- В том же PR обязательно обновляются связанные документы миграции (`README.md`, этот файл), чтобы исключить расхождения между roadmap и фактическим контрактом.

## 4) Seed-данные для локальной разработки

Минимальный набор для воспроизводимости ключевых сценариев.

## 4.1 Users

- `admin@local.dev` (`role=admin`, `hasCompletedOnboarding=true`)
- `user@local.dev` (`role=user`, `hasCompletedOnboarding=true`)
- `new-user@local.dev` (`role=user`, `hasCompletedOnboarding=false`)

## 4.2 Genres

- 12 активных жанров со slug из mock: `action`, `comedy`, `drama`, `horror`, `scifi`, `romance`, `thriller`, `animation`, `documentary`, `fantasy`, `crime`, `adventure`.
- - 1 неактивный жанр для проверки ограничений (`isActive=false`).

## 4.3 Clips

- 8 `published` клипов (бывшие `MOCK_CLIPS`) с заполненными:
  - `title`, `description`, `videoUrl`, `thumbnailUrl`, `durationSec`, `genreId`, `authorId`, `likesCount`, `commentsCount`, `viewsCount`.
- 2 `draft` клипа (видны только автору/admin).
- 1 `archived` клип.

## 4.4 Comments

- По 1–3 комментария на первые 3 клипа.
- От разных пользователей для проверки ownership/редактирования.

## 4.5 Likes / Bookmarks

- Для `user@local.dev`:
  - 3 лайка на клипы.
  - 2 закладки.
- Для `admin@local.dev`:
  - 1 лайк и 1 закладка.

## 4.6 Технические требования к seed

- Все `id` — UUID v4.
- Все даты — ISO UTC.
- Идемпотентный запуск (`upsert`/truncate+insert).
- Версия seed в `seed_meta` (например, `2026-epic9-task020-v1`).

---

## 5) Критерии готовности миграции (DoD check-list)

- [x] Каждое поле из `mock.js` имеет статус: `keep`, `rename`, `remove`, `transform`.
- [x] Нет UI-экранов, завязанных на mock-only поля без replacement.
- [x] Подготовлены seed-данные, покрывающие: ленту, комментарии, лайки, закладки, онбординг, роли.
- [x] Read/write флоу работают от API через единый adapter layer.
- [x] `mock.js` можно отключить флагом без деградации основных сценариев (cutover подтверждён в API-режиме + закреплён регрессионным smoke).

### 5.1 Текущий прогресс по DoD

| Пункт DoD                                  | Статус  | Подтверждение (файлы/модули)                                                                                                                                                                             |
| ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Поля `mock.js` размечены по статусам       | ✅ Done | Разделы 1.1–1.4 этого документа фиксируют `keep/rename/remove/transform` для жанров, клипов, комментариев и профиля.                                                                                     |
| UI не зависит от mock-only полей           | ✅ Done | Каталог и профиль читаются через сервисы (`src/services/content-service.js`, `src/services/feed-service.js`), UI использует нормализованные поля (`genreName`, `durationLabel`).                         |
| Seed покрывает ключевые сценарии           | ✅ Done | Seed и smoke-проверки backend фиксируют сценарии feed/comments/bookmarks/profile/moderation (`scripts/db/seed.py`, `src/test/backend-api-smoke.test.js`).                                                |
| Read/write флоу через единый adapter layer | ✅ Done | Единый API adapter закрывает feed/comments/likes/bookmarks/moderation/profile (`src/services/api-feed-adapter.js`, `src/services/feed-service.js`), catalog — через `content-service`.                   |
| Mock отключаем без деградации              | ✅ Done | Cutover-check пройден в API-режиме (`VITE_DATA_SOURCE=api`): подтверждены критические сценарии auth/onboarding/feed/likes-bookmarks/comments/admin moderation и добавлен регрессионный smoke `task-034`. |

### 5.2 Открытые блокеры

На текущем этапе блокеры по cutover `mock.js` отсутствуют; дальнейшие риски относятся к post-cutover задачам (реальная auth-модель и media pipeline).

### 5.3 Критерий "`mock.js` отключается без деградации" и условия проверки

**Критерий считается выполненным, если одновременно выполнены условия:**

1. Приложение запускается с `VITE_DATA_SOURCE=api`, без импортов/вызовов `src/data/mock.js` в runtime-пути пользовательских экранов.
2. Smoke-проход на API-режиме подтверждает read/write для: feed, comments, likes/bookmarks, moderation, profile, catalog.
3. UX-паритет сохранён: ключевые экраны (`/`, `/catalog`, `/bookmarks`, `/profile`, `/admin`) открываются без ошибок и с корректными fallback-значениями UI-моделей.
4. Переключение обратно в `mock` остаётся доступным как rollback-механизм до финального удаления `mock.js`.

**Минимальная проверка (Definition of Verification):**

- Запуск unit/integration: `npm run test` (включая `api-feed-adapter` и мапперы).
- Запуск backend smoke: `npm run test:smoke` (или `src/test/backend-api-smoke.test.js`) с проверкой endpoint-ов `feed/comments/bookmarks/me/moderation`.
- Ручной smoke маршрутов в API-режиме: `/`, `/catalog`, `/bookmarks`, `/profile`, `/admin/comments`.
- Контрольный чек: в DevTools/логах нет обращений к `mockFeedAdapter` при `VITE_DATA_SOURCE=api`.

---

## 6) Moderation

Для админского экрана модерации добавлен стабильный интерфейс в adapter/service слое, чтобы UI не зависел от источника данных (mock/API).

### 6.1 Методы, которые останутся в UI-контракте

- `getAllCommentsForModeration(params)`
- `blockUserComments(params)`
- `deleteComment(params)`
- `deleteCommentsByUser(params)`

### 6.2 Текущий mock payload → целевой backend payload

1. `getAllCommentsForModeration`
   - Mock вход: `{ comments, clips, blockedUsers }`
   - Mock выход: `Array<ModerationCommentRow>` (flattened comments с `clipTitle`, `isBlockedAuthor`)
   - API замена: `GET /moderation/comments`
   - API payload: query-параметры пагинации/фильтров (`page`, `limit`, `authorId`, `clipId`, `status`) и ответ списком строк модерации.

2. `blockUserComments`
   - Mock вход: `{ authorId, blockedUsers }`
   - Mock выход: `Record<string, boolean>` (обновленная карта блокировок)
   - API замена: `POST /moderation/comments/block-user`
   - API payload: `{ authorId, isBlocked: true, reason?: string }`

3. `deleteComment`
   - Mock вход: `{ clipId, commentId, comments }`
   - Mock выход: `Record<string, Array<Comment>>` (карта комментариев после удаления)
   - API замена: `DELETE /moderation/comments/:commentId`
   - API payload: path-параметр `commentId` (+ при необходимости `hardDelete` как query/body флаг)

4. `deleteCommentsByUser`
   - Mock вход: `{ authorId, comments }`
   - Mock выход: `Record<string, Array<Comment>>` (карта комментариев после bulk-удаления)
   - API замена: `DELETE /moderation/comments/by-user/:authorId`
   - API payload: path-параметр `authorId`, опционально фильтры (`clipId`, `from`, `to`) для частичного bulk-удаления.

### 6.3 Требование стабильности сигнатур

- На уровне UI используются только методы `feedService`.
- При переключении на backend заменяется внутренняя реализация adapter-а, без изменения вызовов из компонентов.
- Возвращаемые формы данных в `feedService` должны оставаться эквивалентными mock-форме, либо нормализоваться в service-слое до UI-совместимого вида.

## 7) Фактическое потребление UI-полей (ClipCard, BookmarksPage, CatalogPage)

| Экран / компонент | Поле в UI до миграции                       | Статус (`keep/rename/remove/transform`) | Новое потребление в view-model            |
| ----------------- | ------------------------------------------- | --------------------------------------- | ----------------------------------------- |
| `ClipCard`        | `clip.id`                                   | keep                                    | `clip.id`                                 |
| `ClipCard`        | `clip.title`                                | keep                                    | `clip.title`                              |
| `ClipCard`        | `clip.description` + `clip.clipDescription` | rename/transform                        | `clip.description`                        |
| `ClipCard`        | `clip.clipUrl`                              | rename                                  | `clip.videoUrl`                           |
| `ClipCard`        | `clip.poster`                               | rename                                  | `clip.thumbnailUrl`                       |
| `ClipCard`        | `clip.watchUrl`                             | rename                                  | `clip.externalUrl`                        |
| `ClipCard`        | `clip.duration`                             | rename/transform                        | `clip.durationSec` + `clip.durationLabel` |
| `ClipCard`        | `clip.genres[]`                             | transform                               | `clip.genreId` + `clip.genreName` lookup  |
| `ClipCard`        | `clip.likes` / `clip.likesCount`            | transform                               | `clip.likesCount`                         |
| `ClipCard`        | `clip.comments` / `clip.commentsCount`      | transform                               | `clip.commentsCount`                      |
| `ClipCard`        | `clip.bookmarks` / `clip.bookmarksCount`    | transform                               | `clip.bookmarksCount`                     |
| `ClipCard`        | `clip.shares` / `clip.sharesCount`          | remove (shares), keep (`sharesCount`)   | `clip.sharesCount` (fallback `0`)         |
| `ClipCard`        | `clip.year`                                 | remove                                  | не используется                           |
| `ClipCard`        | `clip.rating`                               | remove                                  | не используется                           |
| `ClipCard`        | `clip.director`                             | remove                                  | не используется                           |
| `BookmarksPage`   | `clip.poster`                               | rename                                  | `clip.thumbnailUrl`                       |
| `BookmarksPage`   | `clip.watchUrl`                             | rename                                  | `clip.externalUrl`                        |
| `BookmarksPage`   | `clip.year`                                 | remove                                  | `clip.genreName`                          |
| `BookmarksPage`   | `clip.rating`                               | remove                                  | `clip.durationLabel`                      |
| `BookmarksPage`   | `clip.genres[]`                             | transform                               | `clip.genreId` + `clip.genreName` lookup  |
| `CatalogPage`     | `movie.poster`                              | rename                                  | `movie.thumbnailUrl`                      |
| `CatalogPage`     | `movie.watchUrl`                            | rename                                  | `movie.externalUrl`                       |
| `CatalogPage`     | `movie.year`                                | remove                                  | `movie.subtitle` (`durationLabel`)        |
| `CatalogPage`     | `movie.rating`                              | remove                                  | `movie.genreName`                         |
| `CatalogPage`     | `movie.genres[]`                            | transform                               | `movie.genreId` + lookup через жанры      |

## 8) Единый UI-контракт маппинга (`src/services/mappers/*`)

### 6.1 Обязательные поля `Clip` в UI-модели

`toClipUiModel(...)` всегда возвращает объект с полями:
`id`, `title`, `description`, `thumbnailUrl`, `videoUrl`, `externalUrl`, `durationSec`, `durationLabel`, `genreId`, `genreName`, `likesCount`, `commentsCount`, `sharesCount`, `bookmarksCount`.

Правила обработки пропусков:

- `id`: пустая строка, если не удалось извлечь.
- `title`: `"Untitled clip"`.
- `description`: `""`.
- `thumbnailUrl`: `https://placehold.co/400x600?text=No+Preview`.
- `videoUrl`: `""`.
- `externalUrl`: `"#"`.
- `durationSec`: число, по умолчанию `0`; поддерживается парсинг legacy `duration` (`"2h 5m"`).
- `durationLabel`: вычисляется из `durationSec`, при `0` — `"—"`.
- `genreId`: `genreId` API или первый элемент `genres`, иначе `"unknown"`.
- `genreName`: из lookup, иначе `"Unknown"`.
- счетчики (`likesCount/commentsCount/sharesCount/bookmarksCount`): числа, default `0`.

### 6.2 Обязательные поля `Comment` в UI-модели

`toCommentUiModel(...)` всегда возвращает:
`id`, `clipId`, `authorId`, `authorName`, `avatar`, `text`, `likes`, `createdAt`, `timeLabel`.

Правила обработки пропусков:

- `id`: генерируемый `cm_*`.
- `clipId`: входной `comment.clipId` или clipId из контекста.
- `authorId`: `"anonymous"`.
- `authorName`: `authorName` → `user` → `"Anonymous"`.
- `avatar`: `"👤"`.
- `text`: `""`.
- `likes`: `0`.
- `createdAt`: текущее время, если входное невалидно.
- `timeLabel`: человекочитаемый relative time или fallback `"Just now"`.

### 6.3 Обязательные поля `Genre` lookup

`createGenreLookup(...)` возвращает lookup по slug/id, где каждый жанр содержит:
`id`, `name`, `icon`, `color`.

Правила обработки пропусков:

- `id`: берется из `id || slug`, пустые значения пропускаются.
- `name`: `"Unknown"`.
- `icon/color`: из `src/constants/genre-ui-meta.js`, либо из входного объекта жанра, если явно заданы.

### 6.4 Применение в адаптерах

- `api-feed-adapter` и `mock-feed-adapter` обязаны возвращать одинаковую UI-форму через shared mapper-функции.
- Компоненты UI не должны дублировать fallback-логику для этих полей; fallback централизован в `src/services/mappers/*`.


## 10) Новый baseline после cutover

- `src/data/mock.js` и `src/services/mock-feed-adapter.js` удалены из runtime-пути.
- `createFeedAdapter` всегда возвращает `apiFeedAdapter`; fallback на mock больше не существует.
- `toClipUiModel` и `normalizeComment` работают по API-контракту без legacy/mock alias-полей (`clipDescription`, `poster`, `clipUrl`, `watchUrl`, `time`, `user`).
- Для UI-иконок/цветов жанров используется фронтовый справочник `src/constants/genre-ui-meta.js`, а список жанров в onboarding/admin/catalog — `src/constants/genres.js` (без зависимости от mock dataset).

### Acceptance baseline

1. Runtime-импорты `src/data/mock.js` отсутствуют.
2. Runtime-импорты `src/services/mock-feed-adapter.js` отсутствуют.
3. Тесты сервисов/мапперов валидируют API-only поведение и дефолты без mock payload-веток.
