# Feed Player: план поэтапного rollout поддержки разных ratio

## Цель
Дать безопасный, обратимый план внедрения поддержки разных video ratio в feed-player без деградации текущего UX/перформанса, с явными критериями перехода между этапами.

## Этап 1 (MVP): безопасная базовая поддержка

### Scope
- `contain` на mobile как дефолт для всех поддерживаемых ratio.
- Первичная классификация desktop-контейнеров по metadata ratio.
- Стабильный placeholder до загрузки metadata/first frame.

### Feature flag
- `ff_feed_ratio_mvp_v1`
- Гранулярность:
  - `mobileContainEnabled` (bool)
  - `desktopContainerClassifierEnabled` (bool)
  - `stablePlaceholderEnabled` (bool)
- Рекомендация rollout: 1% → 10% → 50% → 100% на внутреннем трафике и затем production.

### Rollback-стратегия
- Мгновенный kill-switch: `ff_feed_ratio_mvp_v1=false`.
- Fallback-поведение:
  - mobile: возврат на текущий production-fit режим;
  - desktop: один legacy-контейнер без ratio-классификации;
  - placeholder: legacy poster/skeleton.
- SLA rollback: не более 10 минут от детекта регрессии до полного выключения.

### Критерий “готово к расширению”
- Нет блокирующих дефектов по обрезке сцены в дефолтном режиме.
- Layout shift (CLS-подобный внутренний индикатор карточки) в пределах agreed baseline.
- Ошибки рендера/краши player не выше текущего production baseline.
- Подтверждено продуктом: поведение на ключевых ratio (`9:16`, `16:9`, `1:1`, `4:5`) приемлемо для запуска Этапа 2.

---

## Этап 2: точная desktop-классификация и safe zones

### Scope
- Уточнение порогов выбора desktop-контейнера (включая near-square, wide, ultra-wide).
- Адаптивные позиции overlay UI в зависимости от контейнера/полос.
- Устранение конфликтов UI с ключевыми зонами кадра (safe zones).

### Feature flag
- `ff_feed_ratio_desktop_safezones_v2`
- Гранулярность:
  - `desktopPreciseThresholdsEnabled`
  - `adaptiveOverlayLayoutEnabled`
  - `safeZoneCollisionAvoidanceEnabled`
- Запуск только после 100% стабильности Этапа 1.

### Rollback-стратегия
- Частичный rollback по подсекциям:
  - отключить только `adaptiveOverlayLayoutEnabled`, оставив классификацию;
  - отключить `safeZoneCollisionAvoidanceEnabled`, если ломаются клики/gesture.
- Полный rollback: `ff_feed_ratio_desktop_safezones_v2=false`, система работает в режиме Этапа 1.
- Регламент: сначала частичный rollback (до 30 минут), при сохранении регрессии — полный.

### Критерий “готово к расширению”
- Ошибки неверной классификации контейнера ≤ согласованного порога QA (например, ≤1% на эталонной выборке).
- CTR по ключевым UI-элементам (mute/CTA) без статистически значимого ухудшения относительно Этапа 1.
- Доля сессий с перекрытием центральной safe-zone сведена к целевому минимуму.
- UX-signoff от design + product по основным сценариям desktop.

---

## Этап 3: тесты, полировка, метрики

### Scope
- UX/визуальные регрессии (snapshot/скрин-тесты по ratio и состояниям).
- Оптимизация производительности скролла и стабильности playback в feed.
- Подключение и валидация продуктовых метрик досмотра/CTR CTA.

### Feature flag
- `ff_feed_ratio_quality_metrics_v3`
- Гранулярность:
  - `visualRegressionSuiteEnabled` (CI gate)
  - `scrollPerfOptimizationsEnabled`
  - `watchtimeCtrTelemetryEnabled`
- Rollout: canary-сегмент + A/B до полного включения.

### Rollback-стратегия
- Для перформанс-оптимизаций — отдельный выключатель (`scrollPerfOptimizationsEnabled=false`) без отключения метрик.
- Для телеметрии — degrade to minimal events, если нагрузка или sampling-анализ показывает проблемы.
- Для тестового gate в CI — временный soft-fail режим (warning) с обязательным тикетом на возврат hard gate.

### Критерий “готово к расширению”
- Визуальные регрессии отсутствуют на эталонной матрице ratio × device class × player state.
- Scroll/jank метрики в целевом диапазоне (не хуже baseline; желательно улучшение).
- Метрики досмотра и CTR CTA стабильно собираются, валидированы аналитикой и пригодны для продуктовых решений.
- Команда готова масштабировать на новые ratio/новые surface (например, web desktop variants, TV-like layouts).

---

## Общие правила для всех этапов
- Каждый этап запускается только после post-rollout review предыдущего.
- Для каждого флага обязателен owner, дата ревью и целевой срок удаления флага.
- Любой rollout сопровождается мониторингом: playback errors, crash-free rate, scroll FPS, UX-ошибки по safe-zone.
- Документация display rules и QA-чеклисты обновляются синхронно с переходом этапа.
