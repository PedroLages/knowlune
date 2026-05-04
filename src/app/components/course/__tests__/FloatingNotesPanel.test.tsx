import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { render as rtlRender } from '@testing-library/react'
import { FloatingNotesPanel } from '../FloatingNotesPanel'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import { useNoteStore } from '@/stores/useNoteStore'
import type { Note } from '@/data/types'

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
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
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
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
      )

      const pill = baseElement.querySelector('[data-testid="floating-notes-pill"]')
      expect(pill?.textContent).toContain('2')
    })

    it('pill click sets store state to expanded', () => {
      const { baseElement } = render(
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
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
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
      )

      // No non-empty notes, panel is closed — pill should be absent
      expect(baseElement.querySelector('[data-testid="floating-notes-pill"]')).toBeFalsy()
    })

    it('has accessible ARIA label on pill', () => {
      const { baseElement } = render(
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
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
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
      )

      expect(baseElement.querySelector('[data-testid="floating-notes-panel"]')).toBeTruthy()
      expect(baseElement.querySelector('[data-testid="floating-notes-collapse"]')).toBeTruthy()
      expect(baseElement.querySelector('[data-testid="floating-notes-maximize"]')).toBeTruthy()
      expect(baseElement.querySelector('[data-testid="floating-notes-handle"]')).toBeTruthy()
    })

    it('collapse button sets store state to closed', () => {
      const { baseElement } = render(
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
      )

      const collapseBtn = baseElement.querySelector('[data-testid="floating-notes-collapse"]') as HTMLElement
      act(() => {
        collapseBtn.click()
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('closed')
    })

    it('maximize button sets store state to fullscreen', () => {
      const { baseElement } = render(
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
      )

      const maximizeBtn = baseElement.querySelector('[data-testid="floating-notes-maximize"]') as HTMLElement
      act(() => {
        maximizeBtn.click()
      })

      expect(useLessonChromeStore.getState().mobileNotesPanel).toBe('fullscreen')
    })

    it('has role=dialog and ARIA label', () => {
      const { baseElement } = render(
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
      )

      const panel = baseElement.querySelector('[data-testid="floating-notes-panel"]')
      expect(panel?.getAttribute('role')).toBe('dialog')
      expect(panel?.getAttribute('aria-label')).toBe('Lesson notes')
    })

    it('shows "Saved" indicator via aria-live region', () => {
      const { baseElement } = render(
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
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
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={portalTarget}
        />
      )

      // Neither pill nor panel should render
      expect(baseElement.querySelector('[data-testid="floating-notes-pill"]')).toBeFalsy()
      expect(baseElement.querySelector('[data-testid="floating-notes-panel"]')).toBeFalsy()
    })
  })

  describe('portal target edge cases', () => {
    it('renders nothing when portal target is null', () => {
      const { baseElement } = render(
        <FloatingNotesPanel
          courseId="course-1"
          lessonId="lesson-1"
          portalTarget={null}
        />
      )

      expect(baseElement.querySelector('[data-testid="floating-notes-pill"]')).toBeFalsy()
      expect(baseElement.querySelector('[data-testid="floating-notes-panel"]')).toBeFalsy()
    })
  })
})
