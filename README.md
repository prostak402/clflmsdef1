# ClipFlow Frontend

Frontend-приложение для MVP видеосервиса с короткими клипами из фильмов.

Проект реализован на **React + Vite** и включает:

- demo-аутентификацию;
- онбординг по жанрам;
- персонализированную ленту;
- закладки, лайки, комментарии;
- профиль пользователя;
- административные экраны (добавление контента и модерация комментариев).

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

## Быстрый старт

### Требования

- Node.js 20+
- npm 10+

### Установка

```bash
npm install
```

### Настройка окружения

1. Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

2. При необходимости измените переменные (`VITE_API_URL`, `VITE_FF_*`).

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
