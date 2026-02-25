# Feed Player Adaptive Spec

## Product Rules

- Этот документ является **единым источником правды (SSOT)** для поведения feed-плеера до и во время реализации.
- До старта реализации документ должен быть согласован с тремя стейкхолдерами:
  - Product (владение правилами продукта и KPI);
  - Design (визуальное и поведенческое соответствие);
  - Frontend (техническая реализуемость и ограничения платформ).
- Любые изменения поведения плеера после согласования вносятся только через update этого документа с фиксацией версии/даты.
- **MVP-ограничение:**
  - На mobile по умолчанию используется режим `contain`.
  - Обрезка видео (cropping) в MVP **запрещена**.
  - Обрезка допускается только в будущем режиме **«Заполнить экран»** и не входит в MVP scope.

## UX Behavior

### Целевые платформы

- **Mobile web** (основной приоритет MVP):
  - Дефолтный рендер: `contain`.
  - Видео полностью помещается в контейнер с возможными letterbox/pillarbox-полями.
  - Поведение без user-toggle на fill/crop в MVP.
- **Tablet web**:
  - Базовое поведение повторяет mobile: `contain` в MVP.
  - Допустимы platform-specific корректировки размеров оверлеев/отступов по дизайн-токенам.
- **Desktop web**:
  - Базовое поведение также `contain` в MVP для консистентности.
  - Возможны отличия в плотности UI (размер контролов, safe area, hover-состояния), но не в core-логике fit-mode.

### Различия в поведении по платформам

- Логика fit-mode в MVP едина (`contain` на всех платформах),
  но:
  - mobile/tablet: приоритет touch ergonomics и читаемости оверлеев;
  - desktop: приоритет hover/focus состояний и более плотной сетки.
- В future-сценарии «Заполнить экран» desktop/tablet/mobile могут иметь разный UX-trigger,
  но это вне MVP.

## Technical Design

### Общая модель

- Входные данные:
  - `videoWidth`, `videoHeight`;
  - размеры контейнера (`containerWidth`, `containerHeight`);
  - платформа (`mobile|tablet|desktop`).
- Производные параметры:
  - `inputAspectRatio = videoWidth / videoHeight`;
  - `containerAspectRatio = containerWidth / containerHeight`.
- Рендер-режим MVP:
  - `renderMode = contain` (жестко зафиксировано для всех платформ).
- Будущий (не-MVP) режим:
  - `renderMode = cover` в рамках фичи «Заполнить экран».

### Таблица соответствия

| Input aspect ratio                          | Container type                     | Render mode (MVP) | Overlays                                                                                                           |
| ------------------------------------------- | ---------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `< 1.0` (portrait)                          | Vertical feed cell (mobile/tablet) | `contain`         | Overlays привязаны к контейнеру; не должны выходить за safe area; видео может иметь поля сверху/снизу или по бокам |
| `= 1.0` (square)                            | Any feed cell                      | `contain`         | Overlays центрируются по контейнеру; интерактивные зоны не пересекают системные inset                              |
| `> 1.0` и `<= 1.77` (landscape, up to 16:9) | Any feed cell                      | `contain`         | Overlays рендерятся поверх контейнера, без crop контента; учитывать letterbox                                      |
| `> 1.77` (ultra-wide)                       | Any feed cell (особенно mobile)    | `contain`         | Overlays сохраняют позиционирование относительно контейнера; увеличенные поля не ломают CTA и controls             |

> Примечание: колонка `Render mode (MVP)` намеренно зафиксирована как `contain` для всех комбинаций. Будущее изменение в `cover` возможно только в отдельной спецификации для режима «Заполнить экран».

### Overlays

- Оверлеи всегда позиционируются относительно **контейнера**, а не «видимой области видео».
- Tap/click targets не должны попадать в недоступные зоны (notch/safe area/system UI).
- При letterbox/pillarbox оверлеи остаются стабильными и не «прыгают» при смене aspect ratio.

## Rollout Plan

### Feature flag

- Новый layout-движок управляется флагом `adaptive_feed_player_v1`.
- Флаг содержит параметры:
  - `stage` (`0..3`);
  - `internalAudienceOnly`;
  - `trafficPercent`.
- Любое расширение трафика выполняется только после прохождения check-list текущего этапа и фиксации rollback-критериев.

### Этап 1 — AR + placeholder для внутренней аудитории/процента трафика

- Scope:
  - включить базовые правила aspect-ratio классификации;
  - включить fallback `placeholder` при неизвестных метаданных;
  - запуск только на internal audience и ограниченный `%` трафика.
- Pre-scale checks:
  - smoke на mobile/tablet/desktop для `contain`-поведения;
  - проверка стабильности overlay anchor при letterbox/pillarbox;
  - проверка корректного fallback при `videoWidth/videoHeight = null|0`.
- Rollback criteria:
  - рост crash/error rate по плееру выше согласованного порога;
  - массовые визуальные дефекты (смещение overlay, неверный placeholder);
  - деградация watch/completion метрик относительно control.

### Этап 2 — safe zones + desktop refinement (без изменения API карточек)

- Scope:
  - включить safe-zone refinement для desktop;
  - сохранить текущий API карточек (без новых обязательных полей).
- Pre-scale checks:
  - визуальная регрессия desktop overlay (top/right/bottom/left insets);
  - проверка доступности кликабельных зон в safe areas;
  - проверка обратной совместимости существующих card props.
- Rollback criteria:
  - перекрытие CTA/контролов системными зонами;
  - поломка desktop-specific layout контейнеров;
  - несовместимость со старыми данными карточек.

### Этап 3 — автотесты + метрики + поэтапный rollout до 100%

- Scope:
  - включить автотесты для флага, стадий и safe-zone логики;
  - добавить мониторинг ключевых метрик и алертов;
  - раскатывать трафик по шагам (например: 10% → 25% → 50% → 100%).
- Pre-scale checks (на каждом шаге):
  - green unit/integration suite;
  - отсутствие регрессий в error budget;
  - подтверждение Product/Design/Frontend по дашбордам и QA выборке.
- Rollback criteria:
  - отклонение KPI (watch time, completion, CTR CTA) за guardrail;
  - рост client-side ошибок/времени старта плеера;
  - критические баги в accessibility/interaction.

### Governance

1. **Spec alignment (обязательный gate)**
   - Согласовать документ с Product/Design/Frontend.
   - Зафиксировать статус: `Approved`.
2. **Validation & release**
   - Выпуск только после sign-off Product + Design + FE на текущем этапе.
3. **Post-MVP (future)**
   - Отдельный RFC/спека для режима «Заполнить экран» (`cover` + правила crop).

## Acceptance Criteria

- Документ утвержден Product/Design/Frontend и используется как SSOT перед началом разработки.
- На mobile web в MVP всегда применяется `contain`.
- На tablet web и desktop web в MVP также применяется `contain` (без расхождений core-логики).
- В MVP отсутствует обрезка видеоконтента независимо от input aspect ratio.
- Таблица соответствия aspect ratio/container/render mode/overlays покрывает целевые случаи.
- Оверлеи корректно отображаются на всех целевых платформах и не нарушают safe area.

## Edge Cases

- Экстремально узкие/широкие ролики (например, 9:21 или 21:9):
  - поведение остается `contain`, возможны большие поля.
- Некорректные метаданные размера видео:
  - fallback на безопасный `contain` с дефолтным контейнером и логированием.
- Динамическая смена ориентации устройства:
  - пересчет container ratio без смены render mode.
- Медленная загрузка/poster-only состояние:
  - оверлеи не должны смещаться при появлении первого кадра.
- Платформенные inset/safe area отличия (iOS/Android/mobile browsers):
  - оверлеи обязаны оставаться доступными и кликабельными.
