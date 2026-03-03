# ClipFlow Frontend

Frontend-приложение MVP-видеосервиса с вертикальной лентой коротких клипов из фильмов.

## Назначение продукта

`ClipFlow Frontend` нужен для проверки ключевых продуктовых гипотез до подключения полноценного backend:

- короткий time-to-content: пользователь быстро доходит от входа до персональной ленты;
- вовлечение через реакции и комментарии;
- базовая модерация пользовательского контента в admin-зоне;
- проверка UX-цепочки «auth → onboarding → feed» на реальных сценариях.

## Ключевые страницы

- `/` — вход/регистрация (demo auth);
- `/genres` — онбординг с выбором жанров;
- `/feed` — персонализированная лента;
- `/bookmarks` — сохранённые клипы;
- `/catalog` — каталог и поиск;
- `/profile` — профиль и пользовательская статистика;
- `/admin` — добавление контента (MVP UI);
- `/admin/comments` — модерация комментариев.

## Роль mock-режима

В текущем MVP **mock-режим — основной источник данных**. Он нужен, чтобы:

- независимо от backend разрабатывать и тестировать UI/UX;
- стабильно воспроизводить сценарии для QA/демо;
- постепенно мигрировать на API через adapter layer без массового переписывания компонентов.

Переключение источника данных выполняется через `VITE_DATA_SOURCE` (`mock` \/ `api`).

## Стек

- React 19
- React Router 7
- Vite 7
- Vitest + Testing Library
- ESLint 9 + Prettier

## Текущие фичи (MVP)

### Пользовательские сценарии

- **Auth (demo mode):** Sign In / Sign Up + быстрый вход через Demo Account и Admin Demo.
- **Онбординг жанров:** выбор предпочтений с ограничениями min/max перед доступом к ленте.
- **Лента клипов:** фильтрация по выбранным жанрам, вертикальная навигация, состояние загрузки/ошибки/пустого списка.
- **Комментарии:** просмотр и добавление комментариев с валидацией текста.
- **Реакции:** лайк и закладка с optimistic update на уровне сервисного слоя.
- **Каталог:** поиск и фильтр по жанрам для рекомендованных фильмов.
- **Профиль:** агрегированная статистика пользователя (лайки/закладки) и черновик предпочтений.

### Админские сценарии

- **`/admin`:** форма создания карточки/клипа (MVP UI).
- **`/admin/comments`:** модерация комментариев (удаление, блок автора, удаление всех комментариев автора).

## Маршруты и доступ

| Route             | Доступ                              | Назначение                       |
| ----------------- | ----------------------------------- | -------------------------------- |
| `/`               | только для неавторизованных         | Экран входа/регистрации          |
| `/genres`         | авторизованные                      | Онбординг: выбор жанров          |
| `/feed`           | авторизованные + завершён онбординг | Лента клипов                     |
| `/bookmarks`      | авторизованные + завершён онбординг | Сохранённые клипы                |
| `/catalog`        | авторизованные + завершён онбординг | Каталог фильмов                  |
| `/profile`        | авторизованные + завершён онбординг | Профиль пользователя             |
| `/admin`          | администратор + завершён онбординг  | Админ-экран управления контентом |
| `/admin/comments` | администратор + завершён онбординг  | Модерация комментариев           |

### Правила guard-логики

- `AuthOnlyRoute` не пускает авторизованного пользователя на `/`, сразу редиректит на `/genres` или `/feed`.
- `ProtectedRoute`:
  - редиректит неавторизованного на `/`;
  - требует прохождение онбординга для продуктовых разделов;
  - ограничивает админские маршруты ролью `user.isAdmin`.

## Архитектура данных

### 1) Слой состояния (`AppContext`)

Глобальное состояние хранит и управляет:

- `user`;
- `hasCompletedOnboarding`;
- `selectedGenres`;
- `bookmarks`;
- `likes`;
- `comments`;
- `blockedCommentUsers`;
- `draftPreferences`.

Состояние персистится в `localStorage` (ключ `app_state_v1`) c миграцией из legacy-ключа `clipflow.app-state`.

### 2) Сервисный слой

- `feedService` — основной facade для ленты, реакций, комментариев и модерации.
- `contentService` — жанры и данные каталога.
- `payload-normalizer` / `comment-normalizer` / `comment-validation` — нормализация payload и доменная валидация.

Дополнительно в `feedService` встроены:

- обработка и логирование API-ошибок;
- метрики длительности запросов;
- optimistic-операции для лайков/закладок.

### 3) Adapter layer

Сейчас используется `mockFeedAdapter` (данные из `src/data/mock.js`).
Интерфейс адаптера (`feed-adapter.js`) зафиксирован так, чтобы можно было переключиться на backend API без изменений UI-слоя.

### 4) Документация по API/migration

- `docs/api-contract.md` — frontend-first контракт API.
- `docs/task-020-mock-to-api-migration-map.md` — карта миграции с mock на реальный backend.
- `docs/auth-mvp-model.md` — модель auth/guard поведения для MVP.

## Quick start

### Требования

- Node.js 20+
- npm 10+

### 1) Установка

```bash
npm install
```

### 2) Настройка окружения

1. Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

2. Проверьте и при необходимости измените значения env-переменных.

### 3) Запуск проекта

```bash
npm run dev
```

### Env-переменные

| Переменная          | По умолчанию | Назначение                                                          |
| ------------------- | ------------ | ------------------------------------------------------------------- |
| `VITE_DATA_SOURCE`  | `mock`       | Источник данных для `feedService`: `mock` (текущий режим) или `api` |
| `VITE_API_BASE_URL` | —            | Базовый URL backend API для `api`-режима                            |
| `VITE_APP_ENV`      | `dev`        | Маркер окружения (`dev`/`stage`)                                    |

Env-матрица для backend-ready сценариев:

- `.env.dev.example` — локальная разработка (CORS localhost, relaxed cookie policy, dev secrets).
- `.env.stage.example` — stage-контур (strict CORS, secure cookies, секреты только из secret manager).

Дополнительно добавлены переменные для CORS и auth policy: `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_CREDENTIALS`, `AUTH_COOKIE_*`, `AUTH_*_TOKEN_*`.

## Текущие ограничения MVP

- **Demo auth:** авторизация демонстрационная, без реальной identity-проверки и backend-сессий.
- **Локальные данные:** состояние и пользовательские действия хранятся в `localStorage`.
- **Без реального upload:** админская форма не загружает файлы в хранилище и не создаёт persistent media-объекты.
- **API-режим покрывает ключевые продуктовые потоки:** feed/comments/likes/bookmarks/moderation/profile/catalog работают через adapter/service слой; в работе остаётся финальный stage cutover-check для отключения `mock.js`.

### Статус потоков API-адаптера (mock vs api)

| Сценарий          | `mock`    | `api`     | Статус/комментарий                                                                                                                                 |
| ----------------- | --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed              | ✅ Готово | ✅ Готово | `GET /feed/clips` подключён через `api-feed-adapter`, нормализация payload вынесена в shared mapper-слой.                                          |
| Comments          | ✅ Готово | ✅ Готово | Чтение/запись работают через `GET /comments` и `POST /clips/:clipId/comments`, переходный legacy payload авторства ограничен feature-flag режимом. |
| Likes / Bookmarks | ✅ Готово | ✅ Готово | Toggle и read-path закрыты endpoint-ами `/clips/:clipId/{like,bookmark}` и `GET /me/bookmarks`; UI получает единый формат через `feed-service`.    |
| Moderation        | ✅ Готово | ✅ Готово | Админский комментарийный поток переведён на `/moderation/comments*` через adapter/service методы без зависимости UI от источника данных.           |
| Profile           | ✅ Готово | ✅ Готово | `GET /me` является источником профильных счётчиков; при частичном payload действуют безопасные fallback-значения.                                  |
| Catalog           | ✅ Готово | ✅ Готово | Каталог читает данные через `content-service` + `api-feed-adapter.getCatalog()` с переключением `VITE_DATA_SOURCE` без изменения UI-компонентов.   |

### Источник истины по endpoint-ам и правило синхронизации

- **Единый источник истины по endpoint-ам: `docs/api-contract.md`.**
- Любое изменение endpoint-а, query/body-полей или формата ответа сначала фиксируется в `docs/api-contract.md`, и только затем в коде adapter/service.
- После изменений контракта обязательно синхронизировать связанные документы (`README.md`, `docs/task-020-mock-to-api-migration-map.md`) в том же PR.

## Roadmap next: mock → api

1. ✅ Поднять backend-контур (auth, feed, comments, moderation, bookmarks/likes) по `docs/api-contract.md`.
2. ✅ Реализовать `api-feed-adapter` с сохранением текущего интерфейса `feed-adapter.js`.
3. ✅ Добавить мапперы API ↔ UI-моделей (клипы, комментарии, профиль, жанры).
4. ✅ Включить read-path через API под feature flag и оставить mock как fallback.
5. ✅ Перевести write-path (лайки, закладки, комментарии, модерация) на реальные endpoint-ы.
6. ✅ Провести финальный stage cutover-check: `mock.js` выключается (`VITE_DATA_SOURCE=api`) без деградации ключевых сценариев (auth, onboarding, feed, likes/bookmarks, comments, admin moderation).
7. ✅ Подключить реальную auth-модель (token/session refresh, logout, guards по роли; login/refresh/logout/me).
8. ⏳ Внедрить upload/media pipeline (presigned URL/object storage + валидация).
9. ⏳ Удалить mock-only зависимости после успешного cutover и закрепить smoke/regression на API-режиме.

## Чек-лист готовности к этапу аренды/подключения сервера

- [ ] Определён целевой хостинг (VPS/Cloud) и бюджет на среду `dev/stage/prod`.
- [ ] Настроены домен и TLS (HTTPS), описаны DNS-записи.
- [x] Подготовлены backend-конфиги и секреты (env, CORS, cookie/token policy) через `.env.dev.example` и `.env.stage.example`.
- [x] Доступны тестовые БД/seed-данные и версии seed (`seed_meta`) для smoke-проверок.
- [ ] Реализованы минимальные endpoint-ы для auth/feed/comments/likes/bookmarks/moderation.
- [x] Настроен минимальный stage pipeline (`.github/workflows/stage-smoke.yml`): migrate + seed + smoke API.
- [ ] Подключены наблюдаемость и алёрты (логи, метрики, error tracking).
- [ ] Пройден базовый security-check (закрытые порты, секреты, rate-limit, backup).
- [ ] Выполнен e2e smoke: вход, онбординг, лента, реакции, комментарии, админ-модерация.

## Команды разработки

```bash
npm run dev
```

Запуск локального dev-сервера Vite.

```bash
npm run build
```

Production-сборка.

```bash
npm run preview
```

Локальный preview production-сборки.

## Команды проверки качества

```bash
npm run lint
```

Проверка ESLint (с `--max-warnings 0`).

```bash
npm run format:check
```

Проверка форматирования Prettier.

```bash
npm run test
```

Запуск тестов Vitest в CI-режиме.

```bash
npm run test:watch
```

Интерактивный watch-режим тестов.

```bash
npm run test:smoke
```

Стабильный smoke-набор критичных тестов (последовательный запуск без file parallelism).

```bash
npm run db:migrate
```

Применить SQL-миграции из `db/migrations` в SQLite БД (`DB_PATH` можно переопределить env-переменной).

```bash
npm run db:seed
```

Идемпотентно загрузить seed-набор (пользователи, жанры, клипы, комментарии, лайки, закладки) и записать версию в `seed_meta`.

```bash
npm run smoke:stage-api
```

Smoke-check stage API при наличии `STAGE_API_BASE_URL` с проверками:

- `GET /api/v1/genres`
- `GET /api/v1/feed/clips`
- `GET /api/v1/me`
- `GET /api/v1/me/bookmarks`
- `GET /api/v1/comments`
- один безопасный write-path: `POST /api/v1/clips/:clipId/bookmark` (в safe-mode с rollback `DELETE` при необходимости)
- один moderation endpoint без разрушительных действий: `GET /api/v1/moderation/comments`

Для безопасного режима stage smoke используются переменные:

- `STAGE_SMOKE_SAFE_MODE` (по умолчанию `true`)
- `STAGE_SMOKE_CLIP_ID` (опционально, для фиксированного id клипа)

## Процесс разработки (рекомендуемый)

1. Создать/обновить `.env` из `.env.example`.
2. Разрабатывать фичу через `npm run dev`.
3. Перед коммитом прогнать:
   - `npm run lint`
   - `npm run format:check`
   - `npm run test`
4. Обновлять документацию в `docs/` и `README.md`, если меняется поведение маршрутов, состояние или контракты.

## Обязательные тест-кейсы

Перед merge обязательно должны быть покрыты и зелёными оставаться кейсы:

- route guards (unauth/auth/admin redirect matrix);
- onboarding gate для продуктовых и админских экранов;
- optimistic like/bookmark rollback при ошибке persist;
- валидация комментариев (empty/trim/max length);
- admin access (ограничение для обычного пользователя и доступ для admin).

## Что запускать перед каждым merge

- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npm run test:smoke`

## Политика изменений AppContext/feedService

Любое изменение в `src/context/AppContext.jsx` и/или `src/services/feed-service.js` без тестов не принимается. Минимум: добавить/обновить тесты в `src/test/`, подтверждающие новое поведение и регрессионные сценарии.

## Структура проекта

```text
src/
  components/     UI-компоненты и layout
  context/        глобальный state (AppContext)
  pages/          route-level страницы
  services/       сервисный и adapter-слой
  data/           mock-данные MVP
  constants/      доменные константы
  test/           unit + integration тесты
  styles/         дизайн-токены и глобальные стили

docs/
  api-contract.md
  auth-mvp-model.md
  auth-onboarding-flow.md
  task-020-mock-to-api-migration-map.md
```
