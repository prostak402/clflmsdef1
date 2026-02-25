# Feed Player: technical design (MVP)

## Цель документа
Определить техническую архитектуру `PlayerCard` и `FeedPlayer`, правила работы с метаданными видео, вычисляемые сущности, CSS-стратегию и fallback-поведение для ошибок источника/metadata.

---

## 1) Архитектура компонентов

### 1.1 `PlayerCard` (контейнер + оверлеи + состояния)

`PlayerCard` — уровень композиции UI-карточки в ленте. Компонент не управляет напрямую воспроизведением media-элемента, а:

- задает стабильный контейнер карточки;
- рендерит `FeedPlayer`;
- размещает оверлеи (play/pause, mute, progress, error state, loading state);
- синхронизирует визуальные состояния карточки с состоянием `FeedPlayer`;
- передает telemetry hooks вверх.

**Ответственности `PlayerCard`:**

1. **Layout-контейнер**
   - задает размер карточки;
   - фиксирует `aspect-ratio` контейнера до и после загрузки metadata;
   - исключает layout shift в ленте.

2. **Слой оверлеев**
   - верхние/нижние UI-слои (например, иконки, прогресс, CTA, подписи);
   - оверлеи не влияют на размер media-области;
   - учитываются safe-zones из смежных спецификаций.

3. **UI-состояния карточки**
   - `idle` (готова, не играет),
   - `loading` (ожидаем metadata/буфер),
   - `playing`,
   - `paused`,
   - `muted`/`unmuted`,
   - `error` (битый источник или metadata недоступны).

4. **Интеграционный слой**
   - получает callbacks от `FeedPlayer`;
   - транслирует события во внешние обработчики (analytics/telemetry);
   - принимает решение о показе fallback UI.

---

### 1.2 `FeedPlayer` (media-элемент, play/pause/mute, события)

`FeedPlayer` — низкоуровневый компонент-обертка над `<video>` (или иным media-элементом), отвечающий за управление воспроизведением и события media lifecycle.

**Ответственности `FeedPlayer`:**

1. **Рендер media-элемента**
   - рендерит `<video>` с `src`, `poster`, `preload`, `playsInline`, `muted`, `loop` (по контракту);
   - применяет вычисленные `videoClass` и `fitMode`.

2. **Управление воспроизведением**
   - публичные действия: `play()`, `pause()`, `setMuted(boolean)`;
   - реакция на внешние пропсы автоплея/visibility;
   - защита от race-condition при быстрых переключениях карточек в ленте.

3. **Обработка media-событий**
   - `loadedmetadata` (получение размеров и длительности),
   - `play`, `pause`,
   - `volumechange` (mute/unmute),
   - `timeupdate` (прогресс),
   - `ended`,
   - `error`,
   - при необходимости: `canplay`, `waiting` для UX-индикаторов.

4. **Передача состояния наружу**
   - сообщает `PlayerCard`/родителю об изменениях статуса;
   - отдает нормализованный payload метаданных и ошибок;
   - триггерит telemetry hooks.

---

## 2) Источник и момент получения метаданных

### Основной источник (MVP)
Основной источник технических метаданных — сам HTMLMediaElement (`<video>`):

- `videoWidth`
- `videoHeight`
- `duration`

### Момент получения
Метаданные считаются валидными после события **`loadedmetadata`**.

### Резервный источник (опционально)
Если продуктовый API возвращает precomputed metadata, их можно использовать как **предварительное значение** до `loadedmetadata`. Приоритет верификации остается за media-элементом:

1. initial metadata из API (optimistic pre-layout),
2. фактические metadata из `loadedmetadata` (source of truth),
3. при расхождении — логируем telemetry событие `metadata_mismatch`.

---

## 3) Вычисляемые сущности

### 3.1 `aspectRatio`
Вычисление после `loadedmetadata`:

- `aspectRatio = videoWidth / videoHeight`,
- если `videoWidth <= 0` или `videoHeight <= 0` → metadata invalid.

### 3.2 `videoClass`
Классификация для визуальных правил:

- `vertical` — `aspectRatio < 1`
- `universal` — `aspectRatio >= 1 && aspectRatio <= 1.7`
- `wide` — `aspectRatio > 1.7`

> Пороговые значения заданы для MVP и могут быть вынесены в конфиг.

### 3.3 `fitMode`
Для MVP фиксируем:

- `fitMode = 'contain'` для всех `videoClass`.

В будущем допускается расширение до `cover` по explicit user opt-in, но не как default.

---

## 4) CSS-стратегия

1. **`aspect-ratio` у контейнера**
   - `PlayerCard` задает стабильный `aspect-ratio` контейнера;
   - до получения metadata используется безопасный fallback ratio;
   - после получения metadata допускается смена ratio только по предсказуемым правилам (без резких анимаций layout).

2. **`object-fit: contain` у media-элемента**
   - обязательно для MVP;
   - гарантирует отсутствие обрезки значимой части сцены.

3. **Единый фон для областей полос (letterbox/pillarbox)**
   - фон задается на контейнере media-области;
   - используется единый токен/переменная темы (например, `--feed-player-letterbox-bg`);
   - фон визуально консистентен между карточками и состояниями.

Рекомендуемая структура классов:

- `.playerCard` — контейнер карточки,
- `.playerCard__media` — media-область с фоном полос,
- `.playerCard__video` — `<video>` с `object-fit: contain`,
- `.playerCard__overlay` — оверлейный слой,
- `.playerCard--vertical | --universal | --wide` — модификаторы по `videoClass`.

---

## 5) API компонента

Ниже описан целевой API (framework-agnostic, в стиле TS interface).

```ts
interface FeedPlayerMetadata {
  videoWidth: number;
  videoHeight: number;
  duration: number;
  aspectRatio: number;
  videoClass: 'vertical' | 'universal' | 'wide';
}

interface FeedPlayerError {
  code?: number | string;
  message: string;
  isMetadataError?: boolean;
  isSourceError?: boolean;
}

interface FeedPlayerTelemetryContext {
  playerId: string;
  feedItemId: string;
  sourceUrl?: string;
}

interface FeedPlayerProps {
  // source
  src: string;
  poster?: string;

  // playback
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  preload?: 'none' | 'metadata' | 'auto';

  // display
  fitMode?: 'contain'; // MVP
  initialAspectRatio?: number; // optional from API

  // callbacks
  onReady?: (metadata: FeedPlayerMetadata) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onMuteChange?: (muted: boolean) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: FeedPlayerError) => void;

  // telemetry hooks
  onTelemetry?: (
    event:
      | 'player_impression'
      | 'player_play'
      | 'player_pause'
      | 'player_mute'
      | 'player_unmute'
      | 'metadata_loaded'
      | 'metadata_error'
      | 'source_error'
      | 'metadata_mismatch',
    context: FeedPlayerTelemetryContext,
    payload?: Record<string, unknown>
  ) => void;
}
```

### Состояния (state model)
Минимальная модель состояния для интеграции:

- `status`: `idle | loading | playing | paused | error`
- `muted`: `boolean`
- `metadata`: `FeedPlayerMetadata | null`
- `error`: `FeedPlayerError | null`

---

## 6) Fallback при ошибке metadata / битом источнике

### 6.1 Ошибка metadata
Сценарии:

- `loadedmetadata` не приходит в допустимый таймаут;
- `videoWidth`/`videoHeight` = `0` или невалидны;
- `duration` = `NaN`/`Infinity` при контенте, где ожидается finite duration.

Поведение:

1. переводим компонент в `error` или `metadata_error` подстатус;
2. сохраняем fallback `aspect-ratio` контейнера (без layout shift);
3. скрываем интерактивные контролы, требующие валидной timeline;
4. показываем fallback-overlay: «Не удалось загрузить видео» + retry;
5. отправляем telemetry `metadata_error` с диагностикой.

### 6.2 Битый источник (`source error`)
Сценарии:

- media `error` event,
- недоступный URL, неподдерживаемый кодек, 4xx/5xx/CDN error.

Поведение:

1. немедленно останавливаем попытки autoplay/play;
2. показываем poster (если есть), иначе дефолтную заглушку;
3. отображаем action `Retry` (с ограниченным числом попыток);
4. при повторной ошибке — финальный error-state без бесконечного ретрая;
5. отправляем telemetry `source_error` с кодом/сообщением.

### 6.3 Минимальные UX-принципы fallback

- Fallback не должен менять геометрию карточки.
- Ошибка одной карточки не должна ломать ленту.
- Текст ошибки и action должны быть консистентны для всех типов сбоев.

---

## 7) Итог для MVP

- Архитектура разделена на композиционный `PlayerCard` и media-ориентированный `FeedPlayer`.
- Источник metadata по умолчанию — `loadedmetadata` HTMLVideoElement, API metadata — optional prefill.
- Ключевые вычисления: `aspectRatio`, `videoClass`, `fitMode='contain'`.
- CSS-стратегия: стабильный `aspect-ratio`, `object-fit: contain`, единый фон полос.
- API покрывает пропсы, состояния, callbacks и telemetry hooks.
- Fallback-поведение формализовано отдельно для metadata-error и source-error.
