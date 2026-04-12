/**
 * Unit tests for useKeyboardShortcuts hook (E108-S03)
 *
 * Covers:
 *   - Fires callback on matching key
 *   - Ignores when input/textarea/select is focused (AC-5)
 *   - Ignores when isComposing (IME guard)
 *   - Chord sequences work (e.g., G then L)
 *   - contentEditable guard
 *   - Disabled flag suppresses all shortcuts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

function fireKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  // Dispatch from document.body so e.target.tagName is 'BODY' (not blocked by guards)
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...options })
  document.body.dispatchEvent(event)
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('fires callback when matching key is pressed', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }]))

    fireKey('n')
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('fires callback for case-insensitive match (key.toLowerCase)', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }]))

    // N (uppercase) should match shortcut registered as 'n'
    fireKey('N')
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('ignores shortcut when isComposing is true (IME guard)', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }]))

    fireKey('n', { isComposing: true })
    expect(action).not.toHaveBeenCalled()
  })

  it('ignores shortcut when INPUT element is focused', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }]))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    // Dispatch from the input element
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    input.dispatchEvent(event)

    expect(action).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('ignores shortcut when TEXTAREA element is focused', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }]))

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    textarea.dispatchEvent(event)

    expect(action).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('ignores shortcut when SELECT element is focused', () => {
    // Note: isContentEditable guard is not testable in jsdom (isContentEditable always false).
    // That guard is verified by the E2E test in story-e21-s02-keyboard-shortcuts.spec.ts.
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }]))

    const select = document.createElement('select')
    document.body.appendChild(select)
    select.focus()

    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    select.dispatchEvent(event)

    expect(action).not.toHaveBeenCalled()
    document.body.removeChild(select)
  })

  it('handles chord sequence (G then L) within timeout', () => {
    const action = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts([{ key: ['g', 'l'], description: 'Toggle view', action }])
    )

    fireKey('g')
    expect(action).not.toHaveBeenCalled()

    fireKey('l')
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('chord sequence times out and resets if second key not pressed in time', () => {
    const action = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts([{ key: ['g', 'l'], description: 'Toggle view', action }], true, 500)
    )

    fireKey('g')
    // Advance past the chord timeout
    vi.advanceTimersByTime(600)

    fireKey('l')
    // 'l' alone doesn't match any shortcut — action should not fire
    expect(action).not.toHaveBeenCalled()
  })

  it('wrong second key in chord does not fire action', () => {
    const action = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts([{ key: ['g', 'l'], description: 'Toggle view', action }])
    )

    fireKey('g')
    fireKey('x') // wrong second key
    expect(action).not.toHaveBeenCalled()
  })

  it('does not fire when enabled=false', () => {
    const action = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }], false)
    )

    fireKey('n')
    expect(action).not.toHaveBeenCalled()
  })

  it('cleans up listener on unmount', () => {
    const action = vi.fn()
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: 'n', description: 'Open import', action }])
    )

    unmount()
    fireKey('n')
    expect(action).not.toHaveBeenCalled()
  })

  it('supports modifier key shortcuts (Cmd/Ctrl + key)', () => {
    const action = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'k', description: 'Open search', action, modifier: true }])
    )

    fireKey('k', { metaKey: true })
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('does not fire modifier shortcut without modifier key', () => {
    const action = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'k', description: 'Open search', action, modifier: true }])
    )

    fireKey('k') // no meta/ctrl key
    expect(action).not.toHaveBeenCalled()
  })
})
