import { afterEach, describe, expect, it } from 'vitest'
import {
  ADAPTIVE_FEED_PLAYER_V1_STAGES,
  PLAYER_LAYOUT_FEATURE_FLAGS,
  detectViewportType,
  isAdaptiveFeedPlayerEnabled,
  resolveContentRect,
  resolveOverlayLayout,
  resolveOverlaySafeInsets,
  resolvePlayerLayout,
} from '../feed/player-layout-rules'

afterEach(() => {
  PLAYER_LAYOUT_FEATURE_FLAGS.adaptiveFeedPlayerV1.stage =
    ADAPTIVE_FEED_PLAYER_V1_STAGES.PHASE_1_AR_AND_PLACEHOLDER
})

describe('isAdaptiveFeedPlayerEnabled', () => {
  it('enables internal audience according to percentage bucket', () => {
    expect(
      isAdaptiveFeedPlayerEnabled({
        userId: 'internal-user-a',
        isInternalAudience: true,
        trafficPercent: 100,
      })
    ).toBe(true)
    expect(
      isAdaptiveFeedPlayerEnabled({
        userId: 'internal-user-a',
        isInternalAudience: true,
        trafficPercent: 0,
      })
    ).toBe(false)
  })

  it('keeps feature disabled for external audience when restricted to internal users', () => {
    expect(
      isAdaptiveFeedPlayerEnabled({
        userId: 'external-user-a',
        isInternalAudience: false,
        trafficPercent: 100,
      })
    ).toBe(false)
  })
})

describe('resolvePlayerLayout', () => {
  it('returns contain on mobile for all formats in MVP', () => {
    const layout = resolvePlayerLayout({
      viewportType: 'mobile',
      videoWidth: 1920,
      videoHeight: 1080,
    })

    expect(layout.fitMode).toBe('contain')
    expect(layout.format).toBe('wide')
    expect(layout.container).toBe('fluid')
  })

  it('classifies portrait, square/universal, wide, and ultra-wide', () => {
    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 720, videoHeight: 1280 }).format
    ).toBe('vertical')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1000, videoHeight: 1000 }).format
    ).toBe('square-universal')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1920, videoHeight: 1080 }).format
    ).toBe('wide')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 2560, videoHeight: 1080 }).format
    ).toBe('ultraWide')
  })

  it('maps desktop formats into stable containers', () => {
    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 720, videoHeight: 1280 }).container
    ).toBe('desktop-tall')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1000, videoHeight: 1000 })
        .container
    ).toBe('desktop-universal')

    expect(
      resolvePlayerLayout({ viewportType: 'desktop', videoWidth: 1920, videoHeight: 1080 })
        .container
    ).toBe('desktop-wide')
  })

  it('returns stable placeholder container for unknown metadata', () => {
    const layout = resolvePlayerLayout({
      viewportType: 'desktop',
      videoWidth: 0,
      videoHeight: null,
    })

    expect(layout.isMetadataKnown).toBe(false)
    expect(layout.container).toBe('placeholder')
    expect(layout.fitMode).toBe('contain')
  })

  it('passes adaptive stage into resolved layout', () => {
    const layout = resolvePlayerLayout({
      viewportType: 'desktop',
      videoWidth: 1920,
      videoHeight: 1080,
      adaptiveStage: ADAPTIVE_FEED_PLAYER_V1_STAGES.PHASE_2_SAFE_ZONES_AND_DESKTOP_REFINEMENT,
    })

    expect(layout.adaptiveStage).toBe(
      ADAPTIVE_FEED_PLAYER_V1_STAGES.PHASE_2_SAFE_ZONES_AND_DESKTOP_REFINEMENT
    )
  })
})

describe('resolveContentRect', () => {
  it('resolves letterbox for landscape video in tall container', () => {
    const rect = resolveContentRect({
      containerWidth: 360,
      containerHeight: 640,
      videoWidth: 1920,
      videoHeight: 1080,
      fitMode: 'contain',
    })

    expect(rect.width).toBe(360)
    expect(Math.round(rect.height)).toBe(203)
    expect(Math.round(rect.bars.top)).toBe(219)
    expect(rect.hasLetterbox).toBe(true)
    expect(rect.hasPillarbox).toBe(false)
  })

  it('resolves pillarbox for portrait video in landscape container', () => {
    const rect = resolveContentRect({
      containerWidth: 1280,
      containerHeight: 720,
      videoWidth: 720,
      videoHeight: 1280,
      fitMode: 'contain',
    })

    expect(Math.round(rect.width)).toBe(405)
    expect(rect.height).toBe(720)
    expect(Math.round(rect.bars.left)).toBe(438)
    expect(rect.hasPillarbox).toBe(true)
    expect(rect.hasLetterbox).toBe(false)
  })
})

describe('resolveOverlaySafeInsets', () => {
  it('returns insets for viewport and container kind', () => {
    expect(resolveOverlaySafeInsets({ viewportType: 'mobile', containerKind: 'vertical' })).toEqual(
      {
        top: 56,
        right: 12,
        bottom: 76,
        left: 12,
      }
    )

    expect(resolveOverlaySafeInsets({ viewportType: 'desktop', containerKind: 'wide' })).toEqual({
      top: 24,
      right: 32,
      bottom: 32,
      left: 32,
    })
  })
})

describe('resolveOverlayLayout', () => {
  it('prefers bars anchoring for horizontal mobile video with thick letterbox', () => {
    const layout = resolveOverlayLayout({
      viewportType: 'mobile',
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 360,
      containerHeight: 640,
    })

    expect(layout.overlayAnchor).toBe('bars')
  })

  it('keeps content anchoring for vertical mobile video', () => {
    const layout = resolveOverlayLayout({
      viewportType: 'mobile',
      videoWidth: 720,
      videoHeight: 1280,
      containerWidth: 360,
      containerHeight: 640,
    })

    expect(layout.overlayAnchor).toBe('content')
  })

  it('applies phase-2 desktop safe-zone refinement for enabled audience', () => {
    PLAYER_LAYOUT_FEATURE_FLAGS.adaptiveFeedPlayerV1.stage =
      ADAPTIVE_FEED_PLAYER_V1_STAGES.PHASE_2_SAFE_ZONES_AND_DESKTOP_REFINEMENT

    const layout = resolveOverlayLayout({
      viewportType: 'desktop',
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 1280,
      containerHeight: 720,
      userId: 'employee-1',
      isInternalAudience: true,
      trafficPercent: 100,
    })

    expect(layout.playerLayout.adaptiveStage).toBe(
      ADAPTIVE_FEED_PLAYER_V1_STAGES.PHASE_2_SAFE_ZONES_AND_DESKTOP_REFINEMENT
    )
    expect(layout.overlaySafeInsets).toEqual({ top: 28, right: 36, bottom: 36, left: 36 })
  })
})

describe('detectViewportType', () => {
  it('detects viewport class by width', () => {
    expect(detectViewportType(375)).toBe('mobile')
    expect(detectViewportType(820)).toBe('tablet')
    expect(detectViewportType(1366)).toBe('desktop')
  })
})
