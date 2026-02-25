# Feed Player: acceptance criteria и edge-case matrix

## Цель
Зафиксировать приемочные критерии и единые ожидания для edge-cases в feed-player, чтобы:

- проверка качества выполнялась одинаково на QA, продукте и разработке;
- поведение UI и воспроизведения было предсказуемым для ключевых форматов;
- в нестандартных условиях (ошибки, сеть, ориентация) оставался безопасный fallback;
- по каждому отклонению собиралась наблюдаемая telemetry.

## Acceptance criteria (обязательные проверки)

### AC-01: `16:9` на mobile показывается целиком без обрезки
- **Given:** mobile viewport и видео `16:9`.
- **When:** карточка с видео отображается и запускается в feed-player.
- **Then:** весь кадр виден целиком (без crop), допустимы `letterbox`-полосы; главный объект сцены не обрезан.

### AC-02: `9:16` корректно заполняет основной контейнер
- **Given:** viewport mobile/tablet/desktop и видео `9:16`.
- **When:** плеер отрисовывает кадр в основном контейнере.
- **Then:** видео использует доступную высоту контейнера как primary fill, без артефактов масштабирования и без выхода контента за пределы контейнера.

### AC-03: `1:1` не ломает layout
- **Given:** видео `1:1` в ленте.
- **When:** карточка появляется, загружаются metadata, начинается playback.
- **Then:** сетка/карточка сохраняет стабильную геометрию, соседние элементы не «прыгают», критичный layout shift отсутствует.

### AC-04: UI не выходит за границы и не перекрывает критичную область
- **Given:** любой поддерживаемый ratio.
- **When:** отображаются overlay-элементы (controls, caption, CTA, метаинформация).
- **Then:** элементы остаются в safe-area, не выходят за границы контейнера и не перекрывают критичную область кадра (центр внимания сцены).

### AC-05: при неизвестных размерах используется стабильный placeholder без layout shift
- **Given:** metadata видео еще не получены.
- **When:** карточка уже показана пользователю.
- **Then:** используется стабильный placeholder/poster контейнерного типа; после прихода metadata нет визуального скачка контейнера.

### AC-06: корректность на mobile/tablet/desktop
- **Given:** одно и то же видео проверяется на mobile, tablet и desktop.
- **When:** выполняются сценарии loading → playing → pause → resume → swipe-next.
- **Then:** поведение соответствует правилам fit/layout, UI остается доступным, воспроизведение не деградирует относительно платформенных ожиданий.

---

## Edge-case matrix и ожидаемое поведение

| Edge-case | Expected UI | Expected playback behavior | Fallback action | Telemetry event |
|---|---|---|---|---|
| `21:9` | Выраженные `letterbox`-полосы допустимы; overlay смещается в полосы/нижнюю safe-area, чтобы не закрывать центр кадра | Видео проигрывается без crop, с корректным `contain`-масштабированием | Если вычисление контейнера не удалось — применить стандартный wide-container preset | `feed_player_ratio_rendered` (`ratio=21:9`, `fit=contain`) |
| `4:3` | Кадр визуально центрирован; на узком экране возможны небольшие поля, но без деформации | Стабильный playback без рывков при переходах между карточками | При неопределенном ratio — временный neutral placeholder до metadata | `feed_player_ratio_rendered` (`ratio=4:3`) |
| `3:4` | Портретное видео заполняет высоту при сохранении пропорций; UI в нижней safe-area | Автовоспроизведение и пауза работают штатно, без обрезки | При конфликте safe-area упростить overlay (compact mode) | `feed_player_ratio_rendered` (`ratio=3:4`, `overlay=compact`) |
| `1:1` | Квадрат центрирован, соседние элементы ленты не смещаются | Playback начинается/останавливается без layout jump | Если poster отсутствует — показать square-skeleton | `feed_player_ratio_rendered` (`ratio=1:1`) |
| Очень маленькое разрешение (низкая высота/ширина viewport) | Контролы не выходят за экран; второстепенные элементы сворачиваются в compact UI | Воспроизведение приоритизирует стабильность (возможен lower quality) | Скрыть non-critical controls, оставить play/pause, mute, CTA | `feed_player_compact_ui_enabled` |
| Ошибка загрузки (network/media error) | Показывается error-state в контейнере: понятный текст, retry, fallback CTA | Playback останавливается корректно, без зависаний и «черного» активного плеера | Переключиться на poster/error-card; дать retry и возможность свайпа дальше | `feed_player_playback_error` (`stage=load`) |
| Медленный интернет | Виден индикатор буферизации/деградации качества без агрессивного перекрытия контента | Буферизация и/или адаптивное снижение bitrate; отсутствие краша плеера | Включить low-bandwidth mode, ограничить prefetch, сохранить responsive controls | `feed_player_low_bandwidth_detected` |
| Быстрое пролистывание (rapid swipe) | Карточки не «мерцают», placeholder стабильный, нет наложения UI от соседних карточек | Воспроизведение активируется только у текущей карточки; предыдущие экземпляры быстро останавливаются | Агрессивно отменять in-flight preload/dispose off-screen players | `feed_player_rapid_swipe_handled` |
| Смена ориентации (portrait ↔ landscape) | Контейнер и overlay перестраиваются без выхода за safe-area и без наложений | Playback продолжаетcя из текущей позиции (или кратко rebuffer), без сброса состояния пользователя | Пересчитать layout preset и safe-area; при необходимости временно зафиксировать controls | `feed_player_orientation_changed` |

## Минимальный набор telemetry-полей
Для унификации аналитики edge-cases рекомендуется включать в события:

- `video_id`
- `session_id`
- `device_class` (`mobile` / `tablet` / `desktop`)
- `viewport_w`, `viewport_h`
- `video_ratio`
- `container_ratio`
- `fit_mode`
- `network_state` (если доступно)
- `player_state` (`loading`, `playing`, `paused`, `buffering`, `error`)
- `timestamp_ms`
