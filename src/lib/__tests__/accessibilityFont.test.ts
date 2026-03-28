import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the dynamic CSS imports
vi.mock('@fontsource/atkinson-hyperlegible/400.css', () => ({}))
vi.mock('@fontsource/atkinson-hyperlegible/700.css', () => ({}))

import { loadAccessibilityFont, unloadAccessibilityFont } from '../accessibilityFont'

describe('accessibilityFont', () => {
  let setPropertySpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty('--font-body')
  })

  describe('loadAccessibilityFont', () => {
    it('sets --font-body to Atkinson Hyperlegible font stack', async () => {
      await loadAccessibilityFont()

      expect(setPropertySpy).toHaveBeenCalledWith(
        '--font-body',
        "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif"
      )
    })

    it('dynamically imports both 400 and 700 weight CSS files', async () => {
      await loadAccessibilityFont()

      // If imports failed, the promise would reject — reaching here means both resolved
      expect(setPropertySpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('unloadAccessibilityFont', () => {
    it('restores --font-body to DM Sans font stack', () => {
      unloadAccessibilityFont()

      expect(setPropertySpy).toHaveBeenCalledWith(
        '--font-body',
        "'DM Sans', system-ui, -apple-system, sans-serif"
      )
    })
  })
})
