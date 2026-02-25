const DEFAULT_ASPECT_RATIO = 4 / 5

export function getAspectRatio({ width, height }) {
  const normalizedWidth = Number(width)
  const normalizedHeight = Number(height)

  if (normalizedWidth <= 0 || normalizedHeight <= 0) {
    return DEFAULT_ASPECT_RATIO
  }

  return normalizedWidth / normalizedHeight
}

export function classifyVideoFormat(aspectRatio) {
  if (aspectRatio >= 1.25) {
    return 'landscape'
  }

  if (aspectRatio <= 0.8) {
    return 'vertical'
  }

  return 'square'
}

export function getDesktopContainerType(aspectRatio) {
  if (aspectRatio <= 0.8) {
    return 'vertical'
  }

  if (aspectRatio > 1.3) {
    return 'wide'
  }

  return 'universal'
}
