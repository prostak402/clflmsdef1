export const PLAYER_LAYOUT_BREAKPOINTS = {
  vertical: 1,
  squareUniversalMax: 1.1,
  wideMax: 1.85,
}

export const PLAYER_LAYOUT_FEATURE_FLAGS = {
  enableFillMode: false,
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

  if (aspectRatio < PLAYER_LAYOUT_BREAKPOINTS.vertical) {
    return 'vertical'
  }

  if (aspectRatio <= PLAYER_LAYOUT_BREAKPOINTS.squareUniversalMax) {
    return 'square-universal'
  }

  if (aspectRatio <= PLAYER_LAYOUT_BREAKPOINTS.wideMax) {
    return 'wide'
  }

  return 'ultraWide'
}

function resolveDesktopContainer(format) {
  if (format === 'vertical') {
    return 'desktop-tall'
  }

  if (format === 'wide' || format === 'ultraWide') {
    return 'desktop-wide'
  }

  if (format === 'square-universal') {
    return 'desktop-universal'
  }

  return 'placeholder'
}

export function resolvePlayerLayout({ viewportType, videoWidth, videoHeight }) {
  const normalizedViewportType = normalizeViewportType(viewportType)
  const aspectRatio = toAspectRatio(videoWidth, videoHeight)

  if (aspectRatio === null) {
    return {
      ...UNKNOWN_METADATA_LAYOUT,
      viewportType: normalizedViewportType,
    }
  }

  const format = classifyFormat(aspectRatio)
  const fitMode =
    normalizedViewportType === 'mobile' || !PLAYER_LAYOUT_FEATURE_FLAGS.enableFillMode
      ? 'contain'
      : 'fill'

  if (normalizedViewportType === 'desktop') {
    return {
      viewportType: normalizedViewportType,
      format,
      container: resolveDesktopContainer(format),
      fitMode,
      isMetadataKnown: true,
    }
  }

  return {
    viewportType: normalizedViewportType,
    format,
    container: 'fluid',
    fitMode,
    isMetadataKnown: true,
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
