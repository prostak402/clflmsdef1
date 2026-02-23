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
   - Фича-флаг `USE_REAL_API`; mock оставить fallback.
5. **Переключить write-path**
   - Лайки/закладки/комментарии через реальные endpoints + optimistic update.
6. **Удалить mock-only поля из UI-потребления**
   - Убрать использование `year/rating/director/watchUrl/shares` или заменить на API-backed поля.
7. **Final cleanup**
   - Удалить `src/data/mock.js` после стабилизации и прохождения smoke/regression.

---

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

- [ ] Каждое поле из `mock.js` имеет статус: `keep`, `rename`, `remove`, `transform`.
- [ ] Нет UI-экранов, завязанных на mock-only поля без replacement.
- [ ] Подготовлены seed-данные, покрывающие: ленту, комментарии, лайки, закладки, онбординг, роли.
- [ ] Read/write флоу работают от API через единый adapter layer.
- [ ] `mock.js` можно отключить флагом без деградации основных сценариев.
