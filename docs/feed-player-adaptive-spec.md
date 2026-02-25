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

| ID    | Acceptance-критерий                                                                          | Expected result                                                                                                  | Метод валидации                                                                    |
| ----- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| AC-01 | Документ утвержден Product/Design/Frontend и используется как SSOT перед началом разработки. | В документе зафиксирован статус `Approved` и дата согласования; изменения проходят только через update spec.     | state (статус документа) + визуально (review артефакта в PR/Confluence)            |
| AC-02 | На mobile web в MVP всегда применяется `contain`.                                            | Для mobile `fitMode === contain` для всех форматов видео, включая экстремальные AR.                              | DOM/state (инструментальная проверка resolved layout), CSS (`object-fit: contain`) |
| AC-03 | На tablet web и desktop web в MVP также применяется `contain` (без расхождений core-логики). | Для tablet/desktop `fitMode === contain`, нет платформенных исключений в core-логике.                            | state (layout resolver), DOM/CSS (стиль плеера на целевых брейкпоинтах)            |
| AC-04 | В MVP отсутствует обрезка видеоконтента независимо от input aspect ratio.                    | `resolveContentRect` не выходит за границы контейнера; `hasLetterbox`/`hasPillarbox` возможны, crop отсутствует. | DOM/CSS (размеры media-box), state (метрики contentRect)                           |
| AC-05 | Таблица соответствия aspect ratio/container/render mode/overlays покрывает целевые случаи.   | Покрыты как минимум `9:16`, `16:9`, `1:1`, `21:9`, а также unknown metadata/error state.                         | state (test matrix), визуально (snapshot/smoke), DOM/class (container kind)        |
| AC-06 | Оверлеи корректно отображаются на всех целевых платформах и не нарушают safe area.           | Overlay anchors и insets стабильны при letterbox/pillarbox, кликабельные зоны доступны.                          | визуально + CSS (позиционирование), DOM/class (anchor mode), state (safe insets)   |

## Test Matrix (format x device x orientation x network)

### Форматы и обозначения

- **Formats:** `9:16`, `16:9`, `1:1`, `21:9`, `unknown metadata`, `error state`.
- **Device:** `mobile`, `tablet`, `desktop`.
- **Orientation:** `portrait`, `landscape`.
- **Network profile:** `good` (Wi-Fi/4G stable), `slow` (3G throttling), `offline/interrupted`.

### Базовая матрица покрытия

| Format                              | Device                | Orientation          | Network                           | Ожидаемый результат                                                              | Валидация                              |
| ----------------------------------- | --------------------- | -------------------- | --------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| 9:16                                | mobile/tablet/desktop | portrait + landscape | good + slow                       | `fitMode=contain`, вертикальный контент без crop, overlay в safe-area            | визуально + DOM/CSS + state            |
| 16:9                                | mobile/tablet/desktop | portrait + landscape | good + slow + offline/interrupted | `fitMode=contain`, возможен letterbox, controls/CTA не смещаются                 | визуально + state (contentRect/anchor) |
| 1:1                                 | mobile/tablet/desktop | portrait + landscape | good + slow                       | `fitMode=contain`, симметричные поля при необходимости, anchor стабильный        | DOM/class + state                      |
| 21:9                                | mobile/tablet/desktop | portrait + landscape | good + slow + offline/interrupted | `fitMode=contain`, выраженный letterbox допустим, overlay остается доступным     | визуально + CSS + state                |
| unknown metadata (`w/h = null/0`)   | mobile/tablet/desktop | portrait + landscape | good + slow + offline/interrupted | fallback `placeholder`, `isMetadataKnown=false`, crash отсутствует               | state + DOM/class                      |
| error state (manifest/stream error) | mobile/tablet/desktop | portrait + landscape | good + slow + offline/interrupted | отображается error UI, retry/exit доступен, overlay не блокирует recovery action | визуально + DOM/state                  |

> Минимум для регрессионного smoke на каждый rollout-step: все device-классы × форматы `9:16/16:9/1:1/21:9` в `portrait+landscape` на `good` сети + отдельный прогон unknown metadata и error state на `slow` и `offline/interrupted`.

## Минимальный набор e2e/интеграционных сценариев

1. **E2E-SMOKE-01 (9:16 / mobile / portrait):** открытие feed, проверка `contain`, проверка overlay safe-area и кликабельности CTA.
2. **E2E-SMOKE-02 (16:9 / mobile / portrait+landscape):** проверка letterbox и стабильности anchor при смене ориентации.
3. **INT-CORE-03 (1:1 / tablet+desktop):** проверка классификации формата, container kind и safe insets без crop.
4. **INT-CORE-04 (21:9 / mobile+desktop):** проверка bar-anchoring и стабильности overlay при thick letterbox.
5. **INT-EDGE-05 (unknown metadata):** `videoWidth/videoHeight = null|0` возвращает placeholder layout и безопасный `contain`.
6. **E2E-EDGE-06 (error state):** при ошибке загрузки потокового источника показывается recovery UI (`retry`/`fallback`), core-layout не ломается.

## Edge Cases

- Экстремально узкие/широкие ролики (например, 9:21 или 21:9):
  - поведение остается `contain`, возможны большие поля.
- Некорректные метаданные размера видео:
  - fallback на безопасный `contain` с дефолтным контейнером и логированием.
- Unknown metadata (`videoWidth/videoHeight` отсутствуют, `0`, `NaN`, отрицательные):
  - обязательно рендерится `placeholder` + `isMetadataKnown=false` без падения UI.
- Error state (poster/manifest/network/runtime):
  - вместо «битого» плеера показывается явное error-состояние с action на восстановление (`retry`) и telemetry-событием.
- Динамическая смена ориентации устройства:
  - пересчет container ratio без смены render mode.
- Медленная загрузка/poster-only состояние:
  - оверлеи не должны смещаться при появлении первого кадра.
- Платформенные inset/safe area отличия (iOS/Android/mobile browsers):
  - оверлеи обязаны оставаться доступными и кликабельными.

## Release Gate перед включением фичи на 100%

- Переход флага `adaptive_feed_player_v1` на `trafficPercent=100` разрешен только если:
  1. Полностью пройден чек-лист матрицы `format x device x orientation x network`.
  2. Пройдены минимальные e2e/интеграционные сценарии (раздел выше) для `9:16`, `16:9`, `1:1`, `21:9`, unknown metadata и error state.
  3. Есть sign-off Product + Design + FE с приложением результатов в release ticket.
  4. Зафиксированы rollback-порог и владелец on-call на rollout-окно.
- Нарушение любого пункта блокирует rollout выше текущего процента до устранения.
