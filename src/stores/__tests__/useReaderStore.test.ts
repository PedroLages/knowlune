/**
 * Unit tests for useReaderStore — EPUB reader settings.
 *
 * Tests letter spacing, word spacing, reading ruler toggle,
 * persistence, clamping, and reset behavior.
 *
 * @since E114-S01
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { useReaderStore } from '../useReaderStore'

// ── Mock saveSettingsToSupabase for dual-write tests (E95-S01) ────────────────
// vi.hoisted() ensures the variable is initialized before vi.mock factory runs.
const { mockSaveSettingsToSupabase } = vi.hoisted(() => ({
  mockSaveSettingsToSupabase: vi.fn(),
}))
vi.mock('@/lib/settings', () => ({
  saveSettingsToSupabase: mockSaveSettingsToSupabase,
}))

describe('useReaderStore — Supabase dual-write (E95-S01)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockSaveSettingsToSupabase.mockReset()
    act(() => {
      useReaderStore.getState().resetSettings()
    })
  })

  it('setTheme calls saveSettingsToSupabase with readingTheme key', () => {
    act(() => useReaderStore.getState().setTheme('sepia'))
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ readingTheme: 'sepia' })
  })

  it('setFontSize calls saveSettingsToSupabase with readingFontSize key', () => {
    act(() => useReaderStore.getState().setFontSize(120))
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ readingFontSize: 120 })
  })

  it('setLineHeight calls saveSettingsToSupabase with clamped readingLineHeight', () => {
    act(() => useReaderStore.getState().setLineHeight(1.8))
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ readingLineHeight: 1.8 })
  })

  it('setReadingRulerEnabled calls saveSettingsToSupabase with readingRuler key', () => {
    act(() => useReaderStore.getState().setReadingRulerEnabled(true))
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ readingRuler: true })
  })

  it('setScrollMode calls saveSettingsToSupabase with scrollMode key', () => {
    act(() => useReaderStore.getState().setScrollMode(true))
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ scrollMode: true })
  })

  it('setFontFamily does NOT call saveSettingsToSupabase (localStorage-only)', () => {
    act(() => useReaderStore.getState().setFontFamily('serif'))
    expect(mockSaveSettingsToSupabase).not.toHaveBeenCalled()
  })

  it('resetSettings does NOT call saveSettingsToSupabase', () => {
    act(() => useReaderStore.getState().resetSettings())
    expect(mockSaveSettingsToSupabase).not.toHaveBeenCalled()
  })
})

describe('useReaderStore — accessibility settings (E114-S01)', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset store to defaults
    act(() => {
      useReaderStore.getState().resetSettings()
    })
  })

  describe('letterSpacing', () => {
    it('defaults to 0', () => {
      expect(useReaderStore.getState().letterSpacing).toBe(0)
    })

    it('sets letter spacing within range', () => {
      act(() => useReaderStore.getState().setLetterSpacing(0.1))
      expect(useReaderStore.getState().letterSpacing).toBe(0.1)
    })

    it('clamps letter spacing to max 0.3', () => {
      act(() => useReaderStore.getState().setLetterSpacing(0.5))
      expect(useReaderStore.getState().letterSpacing).toBe(0.3)
    })

    it('clamps letter spacing to min 0', () => {
      act(() => useReaderStore.getState().setLetterSpacing(-0.1))
      expect(useReaderStore.getState().letterSpacing).toBe(0)
    })

    it('persists letter spacing to localStorage', () => {
      act(() => useReaderStore.getState().setLetterSpacing(0.12))
      const stored = JSON.parse(localStorage.getItem('knowlune-reader-settings-v1')!)
      expect(stored.letterSpacing).toBe(0.12)
    })
  })

  describe('wordSpacing', () => {
    it('defaults to 0', () => {
      expect(useReaderStore.getState().wordSpacing).toBe(0)
    })

    it('sets word spacing within range', () => {
      act(() => useReaderStore.getState().setWordSpacing(0.25))
      expect(useReaderStore.getState().wordSpacing).toBe(0.25)
    })

    it('clamps word spacing to max 0.5', () => {
      act(() => useReaderStore.getState().setWordSpacing(0.8))
      expect(useReaderStore.getState().wordSpacing).toBe(0.5)
    })

    it('clamps word spacing to min 0 (negative values)', () => {
      act(() => useReaderStore.getState().setWordSpacing(-0.2))
      expect(useReaderStore.getState().wordSpacing).toBe(0)
    })

    it('persists word spacing to localStorage', () => {
      act(() => useReaderStore.getState().setWordSpacing(0.3))
      const stored = JSON.parse(localStorage.getItem('knowlune-reader-settings-v1')!)
      expect(stored.wordSpacing).toBe(0.3)
    })
  })

  describe('readingRulerEnabled', () => {
    it('defaults to false', () => {
      expect(useReaderStore.getState().readingRulerEnabled).toBe(false)
    })

    it('toggles reading ruler on', () => {
      act(() => useReaderStore.getState().setReadingRulerEnabled(true))
      expect(useReaderStore.getState().readingRulerEnabled).toBe(true)
    })

    it('persists reading ruler state', () => {
      act(() => useReaderStore.getState().setReadingRulerEnabled(true))
      const stored = JSON.parse(localStorage.getItem('knowlune-reader-settings-v1')!)
      expect(stored.readingRulerEnabled).toBe(true)
    })
  })

  describe('scrollMode (E114-S02)', () => {
    it('defaults to false', () => {
      expect(useReaderStore.getState().scrollMode).toBe(false)
    })

    it('toggles scroll mode on', () => {
      act(() => useReaderStore.getState().setScrollMode(true))
      expect(useReaderStore.getState().scrollMode).toBe(true)
    })

    it('toggles scroll mode off', () => {
      act(() => useReaderStore.getState().setScrollMode(true))
      act(() => useReaderStore.getState().setScrollMode(false))
      expect(useReaderStore.getState().scrollMode).toBe(false)
    })

    it('persists scroll mode to localStorage', () => {
      act(() => useReaderStore.getState().setScrollMode(true))
      const stored = JSON.parse(localStorage.getItem('knowlune-reader-settings-v1')!)
      expect(stored.scrollMode).toBe(true)
    })
  })

  describe('resetSettings', () => {
    it('resets all accessibility settings to defaults', () => {
      act(() => {
        useReaderStore.getState().setLetterSpacing(0.2)
        useReaderStore.getState().setWordSpacing(0.3)
        useReaderStore.getState().setReadingRulerEnabled(true)
        useReaderStore.getState().setScrollMode(true)
      })

      act(() => useReaderStore.getState().resetSettings())

      const state = useReaderStore.getState()
      expect(state.letterSpacing).toBe(0)
      expect(state.wordSpacing).toBe(0)
      expect(state.readingRulerEnabled).toBe(false)
      expect(state.scrollMode).toBe(false)
    })
  })
})
