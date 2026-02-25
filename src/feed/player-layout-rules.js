export const PLAYER_LAYOUT_BREAKPOINTS = {
  extremeTallMax: 0.56,
  vertical: 1,
  squareUniversalMax: 1.1,
  wideMax: 1.85,
  extremeWideMin: 2.2,
}

export const PLAYER_LAYOUT_FEATURE_FLAGS = {
  enableFillMode: false,
  adaptiveFeedPlayerV1: {
    stage: 1,
    internalAudienceOnly: true,
    trafficPercent: 0,
  },
}

export const ADAPTIVE_FEED_PLAYER_V1_STAGES = {
  OFF: 0,
  PHASE_1_AR_AND_PLACEHOLDER: 1,
  PHASE_2_SAFE_ZONES_AND_DESKTOP_REFINEMENT: 2,
  PHASE_3_METRICS_AND_FULL_ROLLOUT: 3,
}

function hashToBucket(seed) {
  const value = String(seed || '')
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash % 100)
}

export function isAdaptiveFeedPlayerEnabled({
  userId,
  isInternalAudience = false,
  trafficPercent,
  featureConfig = PLAYER_LAYOUT_FEATURE_FLAGS.adaptiveFeedPlayerV1,
} = {}) {
  const safeTrafficPercent = Number.isFinite(trafficPercent)
    ? trafficPercent
    : Number(featureConfig.trafficPercent)

  if (!featureConfig || featureConfig.stage <= ADAPTIVE_FEED_PLAYER_V1_STAGES.OFF) {
    return false
  }

  if (featureConfig.internalAudienceOnly && !isInternalAudience) {
    return false
  }

  if (!Number.isFinite(safeTrafficPercent) || safeTrafficPercent <= 0) {
    return false
  }

  if (safeTrafficPercent >= 100) {
    return true
  }

  return hashToBucket(userId) < safeTrafficPercent
}

export const PLAYER_OVERLAY_SAFE_INSETS = {
  mobile: {
    vertical: { top: 56, right: 12, bottom: 76, left: 12 },
    universal: { top: 56, right: 12, bottom: 84, left: 12 },
    wide: { top: 48, right: 10, bottom: 64, left: 10 },
  },
  tablet: {
    vertical: { top: 40, right: 20, bottom: 48, left: 20 },
    universal: { top: 40, right: 24, bottom: 52, left: 24 },
    wide: { top: 36, right: 24, bottom: 44, left: 24 },
  },
  desktop: {
    vertical: { top: 28, right: 24, bottom: 36, left: 24 },
    universal: { top: 28, right: 28, bottom: 36, left: 28 },
    wide: { top: 24, right: 32, bottom: 32, left: 32 },
  },
}

const UNKNOWN_METADATA_LAYOUT = {
  format: 'unknown',
  container: 'placeholder',
  fitMode: 'contain',
  isMetadataKnown: false,
}

function normalizeViewportType(viewportType) {
  if (viewportType === 'mobile' || viewportType === 'tablet' || viewportType === 'desktop') {
    return viewportType
  }

  return 'mobile'
}

function toAspectRatio(videoWidth, videoHeight) {
  const width = Number(videoWidth)
  const height = Number(videoHeight)

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return width / height
}

function classifyFormat(aspectRatio) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return 'unknown'
  }

  if (aspectRatio <= PLAYER_LAYOUT_BREAKPOINTS.extremeTallMax) {
    return 'extreme-vertical'
  }

  if (aspectRatio < PLAYER_LAYOUT_BREAKPOINTS.vertical) {
    return 'vertical'
  }

  if (aspectRatio <= PLAYER_LAYOUT_BREAKPOINTS.squareUniversalMax) {
    return 'square-universal'
  }

  if (aspectRatio <= PLAYER_LAYOUT_BREAKPOINTS.wideMax) {
    return 'wide'
  }

  if (aspectRatio >= PLAYER_LAYOUT_BREAKPOINTS.extremeWideMin) {
    return 'extreme-wide'
  }

  return 'ultraWide'
}

function resolveDesktopContainer(format) {
  if (format === 'vertical' || format === 'extreme-vertical') {
    return 'desktop-tall'
  }

  if (format === 'wide' || format === 'ultraWide' || format === 'extreme-wide') {
    return 'desktop-wide'
  }

  if (format === 'square-universal') {
    return 'desktop-universal'
  }

  return 'placeholder'
}

export function getContainerKind(format) {
  if (format === 'vertical' || format === 'extreme-vertical') {
    return 'vertical'
  }

  if (format === 'square-universal') {
    return 'universal'
  }

  return 'wide'
}

export function resolveOverlaySafeInsets({ viewportType, containerKind }) {
  const resolvedViewportType = normalizeViewportType(viewportType)
  const resolvedContainerKind =
    containerKind === 'vertical' || containerKind === 'universal' || containerKind === 'wide'
      ? containerKind
      : 'wide'

  return PLAYER_OVERLAY_SAFE_INSETS[resolvedViewportType][resolvedContainerKind]
}

function resolveOverlaySafeInsetsByPhase({ viewportType, containerKind, adaptiveStage }) {
  const baseInsets = resolveOverlaySafeInsets({ viewportType, containerKind })

  if (adaptiveStage < ADAPTIVE_FEED_PLAYER_V1_STAGES.PHASE_2_SAFE_ZONES_AND_DESKTOP_REFINEMENT) {
    return baseInsets
  }

  if (viewportType !== 'desktop') {
    return baseInsets
  }

  return {
    top: baseInsets.top + 4,
    right: baseInsets.right + 4,
    bottom: baseInsets.bottom + 4,
    left: baseInsets.left + 4,
  }
}

export function resolvePlayerLayout({ viewportType, videoWidth, videoHeight, adaptiveStage = 0 }) {
  const normalizedViewportType = normalizeViewportType(viewportType)
  const aspectRatio = toAspectRatio(videoWidth, videoHeight)

  if (aspectRatio === null) {
    return {
      ...UNKNOWN_METADATA_LAYOUT,
      viewportType: normalizedViewportType,
    }
  }

  const format = classifyFormat(aspectRatio)
  const isExtremeAspect = format === 'extreme-wide' || format === 'extreme-vertical'
  const fitMode =
    normalizedViewportType === 'mobile' ||
    !PLAYER_LAYOUT_FEATURE_FLAGS.enableFillMode ||
    isExtremeAspect
      ? 'contain'
      : 'fill'

  const safeAdaptiveStage = Number.isFinite(adaptiveStage)
    ? adaptiveStage
    : ADAPTIVE_FEED_PLAYER_V1_STAGES.OFF

  if (normalizedViewportType === 'desktop') {
    return {
      viewportType: normalizedViewportType,
      format,
      container: resolveDesktopContainer(format),
      fitMode,
      isMetadataKnown: true,
      adaptiveStage: safeAdaptiveStage,
    }
  }

  return {
    viewportType: normalizedViewportType,
    format,
    container: 'fluid',
    fitMode,
    isMetadataKnown: true,
    adaptiveStage: safeAdaptiveStage,
  }
}

export function resolveContentRect({
  containerWidth,
  containerHeight,
  videoWidth,
  videoHeight,
  fitMode = 'contain',
}) {
  const width = Number(containerWidth)
  const height = Number(containerHeight)
  const nativeWidth = Number(videoWidth)
  const nativeHeight = Number(videoHeight)
  const videoAspect = toAspectRatio(videoWidth, videoHeight)

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      bars: { top: 0, right: 0, bottom: 0, left: 0 },
      hasLetterbox: false,
      hasPillarbox: false,
      isLowResolution: false,
    }
  }

  if (fitMode !== 'contain' || videoAspect === null) {
    return {
      x: 0,
      y: 0,
      width,
      height,
      bars: { top: 0, right: 0, bottom: 0, left: 0 },
      hasLetterbox: false,
      hasPillarbox: false,
      isLowResolution: false,
    }
  }

  const containerAspect = width / height
  let contentWidth = width
  let contentHeight = height

  if (videoAspect > containerAspect) {
    contentWidth = width
    contentHeight = width / videoAspect
  } else {
    contentHeight = height
    contentWidth = height * videoAspect
  }

  const isLowResolution =
    Number.isFinite(nativeWidth) &&
    Number.isFinite(nativeHeight) &&
    nativeWidth > 0 &&
    nativeHeight > 0 &&
    Math.max(nativeWidth, nativeHeight) <= 960

  if (isLowResolution) {
    const scaleX = contentWidth / nativeWidth
    const scaleY = contentHeight / nativeHeight
    const targetScale = Math.min(scaleX, scaleY)
    const maxUpscaleFactor = 1.25

    if (targetScale > maxUpscaleFactor) {
      contentWidth = nativeWidth * maxUpscaleFactor
      contentHeight = nativeHeight * maxUpscaleFactor
    }
  }

  const x = Math.max(0, (width - contentWidth) / 2)
  const y = Math.max(0, (height - contentHeight) / 2)
  const bars = {
    top: y,
    right: x,
    bottom: y,
    left: x,
  }

  return {
    x,
    y,
    width: contentWidth,
    height: contentHeight,
    bars,
    hasLetterbox: bars.top > 0,
    hasPillarbox: bars.left > 0,
    isLowResolution,
  }
}

export function resolveOverlayLayout({
  viewportType,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
  userId,
  isInternalAudience,
  trafficPercent,
}) {
  const isAdaptiveEnabled = isAdaptiveFeedPlayerEnabled({
    userId,
    isInternalAudience,
    trafficPercent,
  })
  const adaptiveStage = isAdaptiveEnabled
    ? PLAYER_LAYOUT_FEATURE_FLAGS.adaptiveFeedPlayerV1.stage
    : ADAPTIVE_FEED_PLAYER_V1_STAGES.OFF
  const playerLayout = resolvePlayerLayout({ viewportType, videoWidth, videoHeight, adaptiveStage })
  const containerKind = getContainerKind(playerLayout.format)
  const overlaySafeInsets = resolveOverlaySafeInsetsByPhase({
    viewportType,
    containerKind,
    adaptiveStage,
  })
  const contentRect = resolveContentRect({
    containerWidth,
    containerHeight,
    videoWidth,
    videoHeight,
    fitMode: playerLayout.fitMode,
  })

  const prefersBarAnchoring =
    playerLayout.viewportType === 'mobile' &&
    (playerLayout.format === 'wide' ||
      playerLayout.format === 'ultraWide' ||
      playerLayout.format === 'extreme-wide') &&
    contentRect.bars.top >= 44

  const overlayAnchor = prefersBarAnchoring ? 'bars' : 'content'

  return {
    playerLayout,
    containerKind,
    overlaySafeInsets,
    contentRect,
    overlayAnchor,
  }
}

export function detectViewportType(width) {
  const resolvedWidth =
    typeof width === 'number' ? width : typeof window !== 'undefined' ? window.innerWidth : 0

  if (resolvedWidth >= 1024) {
    return 'desktop'
  }

  if (resolvedWidth >= 768) {
    return 'tablet'
  }

  return 'mobile'
}
