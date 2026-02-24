import { describe, expect, it } from 'vitest'
import { detectViewportType, resolvePlayerLayout } from '../feed/player-layout-rules'

describe('resolvePlayerLayout', () => {
  it('returns contain on mobile for all formats in MVP', () => {
    const layout = resolvePlayerLayout({ viewportType: 'mobile', videoWidth: 1920, videoHeight: 1080 })

    expect(layout.fitMode).toBe('contain')
    expect(layout.format).toBe('wide')
    expect(layout.container).toBe('fluid')
  })

  it('classifies portrait, square/universal, wide, and ultra-wide', () => {
    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 720, videoHeight: 1280 }).format,
    ).toBe('vertical')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1000, videoHeight: 1000 }).format,
    ).toBe('square-universal')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1920, videoHeight: 1080 }).format,
    ).toBe('wide')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 2560, videoHeight: 1080 }).format,
    ).toBe('ultraWide')
  })

  it('maps desktop formats into stable containers', () => {
    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 720, videoHeight: 1280 }).container,
    ).toBe('desktop-tall')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1000, videoHeight: 1000 }).container,
    ).toBe('desktop-universal')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1920, videoHeight: 1080 }).container,
    ).toBe('desktop-wide')
  })

  it('returns stable placeholder container for unknown metadata', () => {
    const layout = resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 0, videoHeight: null })

    expect(layout.isMetadataKnown).toBe(false)
    expect(layout.container).toBe('placeholder')
    expect(layout.fitMode).toBe('contain')
  })
})

describe('detectViewportType', () => {
  it('detects viewport class by width', () => {
    expect(detectViewportType(375)).toBe('mobile')
    expect(detectViewportType(820)).toBe('tablet')
    expect(detectViewportType(1366)).toBe('desktop')
  })
})
