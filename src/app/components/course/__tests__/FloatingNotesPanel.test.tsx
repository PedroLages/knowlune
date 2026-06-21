import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { render as rtlRender } from '@testing-library/react'
import { FloatingNotesPanel } from '../FloatingNotesPanel'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import { useNoteStore } from '@/stores/useNoteStore'
import type { Note } from '@/data/types'

// jsdom does not expose Touch as a constructor in all versions.
// Polyfill it so we can create Touch objects for gesture tests.
if (typeof globalThis.Touch === 'undefined') {
  class TouchPolyfill {
    identifier: number
    target: EventTarget
    clientX: number
    clientY: number
    screenX: number
    screenY: number
    pageX: number
    pageY: number
    constructor(init: TouchInit & { target: EventTarget }) {
      const cx = init.clientX ?? 0
      const cy = init.clientY ?? 0
      this.identifier = init.identifier
      this.target = init.target
      this.clientX = cx
      this.clientY = cy
      this.screenX = (init.screenX as number | undefined) ?? cx
      this.screenY = (init.screenY as number | undefined) ?? cy
      this.pageX = (init.pageX as number | undefined) ?? cx
      this.pageY = (init.pageY as number | undefined) ?? cy
    }
  }
  // @ts-expect-error - polyfilling missing constructor
  globalThis.Touch = TouchPolyfill
}

/** Helper: create a single-finger Touch at the given Y coordinate */
function makeTouch(clientY: number): Touch {
  return new Touch({
    identifier: 0,
    target: document.body,
    clientX: 200,
    clientY,
    screenX: 200,
    screenY: clientY,
    pageX: 200,
    pageY: clientY,
  } as TouchInit & { target: EventTarget })
}

/** Helper: dispatch a native TouchEvent on an element (bubbles to React root) */
function fireTouch(target: Element, type: 'touchstart' | 'touchmove' | 'touchend', touch: Touch) {
  const touches = type !== 'touchend' ? [touch] : []
  const event = new TouchEvent(type, {
    touches,
    changedTouches: [touch],
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
}

function render(ui: React.ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => {
      // Portal target div
      return <div id="portal-root">{children}</div>
    },
  })
}

function createPortalTarget(): HTMLElement {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    videoId: 'lesson-1',
    content: '<p>Test note content</p>',
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
    tags: [],
    ...overrides,
  }
}

describe('FloatingNotesPanel', () => {
  let portalTarget: HTMLElement

  beforeEach(() => {
    portalTarget = createPortalTarget()
    // Reset stores
    useLessonChromeStore.getState().reset()
    useNoteStore.setState({ notes: [], isLoading: false })

    // Seed a note so the pill is visible
    useNoteStore.setState({
      notes: [makeNote({ courseId: 'course-1', videoId: 'lesson-1' })],
    })
  })

  describe('closed state (pill)', () => {
    it('renders floating pill when panel is closed and notes exist', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      expect(baseElement.querySelector('[data-testid="floating-notes-pill"]')).toBeTruthy()
    })

    it('shows note count in pill', () => {
      useNoteStore.setState({
        notes: [
          makeNote({ id: 'n1', courseId: 'course-1', videoId: 'lesson-1' }),
          makeNote({ id: 'n2', courseId: 'course-1', videoId: 'lesson-1' }),
        ],
      })

      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      const pill = baseElement.querySelector('[data-testid="floating-notes-pill"]')
      expect(pill?.textContent).toContain('2')
    })

    it('pill click sets store state to expanded', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      const pill = baseElement.querySelector('[data-testid="floating-notes-pill"]') as HTMLElement
      act(() => {
        pill.click()
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('expanded')
    })

    it('hides pill when no notes exist and panel is closed', () => {
      useNoteStore.setState({
        notes: [makeNote({ id: 'n1', courseId: 'course-1', videoId: 'lesson-1', content: '' })],
      })

      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      // No non-empty notes, panel is closed — pill should be absent
      expect(baseElement.querySelector('[data-testid="floating-notes-pill"]')).toBeFalsy()
    })

    it('has accessible ARIA label on pill', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      const pill = baseElement.querySelector('[data-testid="floating-notes-pill"]')
      expect(pill?.getAttribute('aria-label')).toBe('Open notes panel')
    })
  })

  describe('expanded state', () => {
    beforeEach(() => {
      act(() => {
        useLessonChromeStore.getState().setMobileNotesPanel('expanded')
      })
    })

    it('renders expanded panel with toolbar', () => {
      useNoteStore.setState({ isLoading: false })

      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      expect(baseElement.querySelector('[data-testid="floating-notes-panel"]')).toBeTruthy()
      expect(baseElement.querySelector('[data-testid="floating-notes-collapse"]')).toBeTruthy()
      expect(baseElement.querySelector('[data-testid="floating-notes-maximize"]')).toBeTruthy()
      expect(baseElement.querySelector('[data-testid="floating-notes-handle"]')).toBeTruthy()
    })

    it('collapse button sets store state to closed', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      const collapseBtn = baseElement.querySelector(
        '[data-testid="floating-notes-collapse"]'
      ) as HTMLElement
      act(() => {
        collapseBtn.click()
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('closed')
    })

    it('maximize button sets store state to fullscreen', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      const maximizeBtn = baseElement.querySelector(
        '[data-testid="floating-notes-maximize"]'
      ) as HTMLElement
      act(() => {
        maximizeBtn.click()
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('fullscreen')
    })

    it('has role=dialog and ARIA label', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      const panel = baseElement.querySelector('[data-testid="floating-notes-panel"]')
      expect(panel?.getAttribute('role')).toBe('dialog')
      expect(panel?.getAttribute('aria-label')).toBe('Lesson notes')
    })

    it('shows "Saved" indicator via aria-live region', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      const liveRegion = baseElement.querySelector('[aria-live="polite"]')
      expect(liveRegion).toBeTruthy()
      expect(liveRegion?.textContent).toContain('Saved')
    })
  })

  describe('fullscreen state', () => {
    it('does not render expanded panel when fullscreen', () => {
      act(() => {
        useLessonChromeStore.getState().setMobileNotesPanel('fullscreen')
      })

      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )

      // Neither pill nor panel should render
      expect(baseElement.querySelector('[data-testid="floating-notes-pill"]')).toBeFalsy()
      expect(baseElement.querySelector('[data-testid="floating-notes-panel"]')).toBeFalsy()
    })
  })

  describe('portal target edge cases', () => {
    it('renders nothing when portal target is null', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={null} />
      )

      expect(baseElement.querySelector('[data-testid="floating-notes-pill"]')).toBeFalsy()
      expect(baseElement.querySelector('[data-testid="floating-notes-panel"]')).toBeFalsy()
    })
  })

  describe('touch gesture swipe-to-close', () => {
    /** Standard rect for the handle bar in expanded state (48px tall) */
    const HANDLE_RECT: DOMRect = {
      top: 200,
      bottom: 248,
      left: 0,
      right: 375,
      width: 375,
      height: 48,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    }

    beforeEach(() => {
      act(() => {
        useLessonChromeStore.getState().setMobileNotesPanel('expanded')
      })
    })

    function getHandle(baseElement: HTMLElement): HTMLElement {
      const handle = baseElement.querySelector(
        '[data-testid="floating-notes-handle"]'
      ) as HTMLElement
      expect(handle).toBeTruthy()
      vi.spyOn(handle, 'getBoundingClientRect').mockReturnValue(HANDLE_RECT)
      return handle
    }

    it('closes panel on swipe down >= 48px within handle region', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )
      const handle = getHandle(baseElement)

      // Touch start at y=200 (inside handle region: 190-258)
      act(() => {
        fireTouch(handle, 'touchstart', makeTouch(200))
      })

      // Touch move at y=248 (delta = 48, exactly at threshold)
      act(() => {
        fireTouch(handle, 'touchmove', makeTouch(248))
      })

      // Touch end — should close because delta >= 48
      act(() => {
        fireTouch(handle, 'touchend', makeTouch(248))
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('closed')
    })

    it('does nothing when touch starts outside handle region', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )
      const handle = getHandle(baseElement)

      // Touch start at y=300 (well below handle region bottom 258)
      act(() => {
        fireTouch(handle, 'touchstart', makeTouch(300))
      })

      // Touch move with large delta
      act(() => {
        fireTouch(handle, 'touchmove', makeTouch(370))
      })

      // Touch end — should NOT close because touch was outside handle region
      act(() => {
        fireTouch(handle, 'touchend', makeTouch(370))
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('expanded')
    })

    it('does not close panel when swipe is < 48px', () => {
      const { baseElement } = render(
        <FloatingNotesPanel courseId="course-1" lessonId="lesson-1" portalTarget={portalTarget} />
      )
      const handle = getHandle(baseElement)

      // Touch start at y=200
      act(() => {
        fireTouch(handle, 'touchstart', makeTouch(200))
      })

      // Touch move at y=230 (delta = 30, below 48px threshold)
      act(() => {
        fireTouch(handle, 'touchmove', makeTouch(230))
      })

      // Touch end — should NOT close because delta < 48
      act(() => {
        fireTouch(handle, 'touchend', makeTouch(230))
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('expanded')
    })
  })
})
