import { describe, expect, it } from 'vitest'
import { classifyVideoFormat, getAspectRatio, getDesktopContainerType } from '../services/video-layout'

describe('video layout helpers', () => {
  it('uses fallback aspect ratio for missing metadata', () => {
    expect(getAspectRatio({ width: 0, height: 0 })).toBeCloseTo(0.8)
  })

  it('classifies format buckets', () => {
    expect(classifyVideoFormat(16 / 9)).toBe('landscape')
    expect(classifyVideoFormat(9 / 16)).toBe('vertical')
    expect(classifyVideoFormat(1)).toBe('square')
  })

  it('maps aspect ratio to desktop containers', () => {
    expect(getDesktopContainerType(9 / 16)).toBe('vertical')
    expect(getDesktopContainerType(1)).toBe('universal')
    expect(getDesktopContainerType(16 / 9)).toBe('wide')
  })
})
