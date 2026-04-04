import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useAriaLiveAnnouncer } from '@/hooks/useAriaLiveAnnouncer'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useIsMobile } from '@/app/hooks/useMediaQuery'

export type FocusTargetType = 'quiz' | 'flashcard' | 'interleaved-review'

interface FocusModeState {
  isFocusMode: boolean
  focusTargetId: string | null
  componentType: FocusTargetType | null
  /** Whether a quiz is actively in progress (guards exit confirmation) */
  isQuizInProgress: boolean
  /** Whether confirmation dialog should be shown */
  showExitConfirmation: boolean
}

const COMPONENT_LABELS: Record<FocusTargetType, string> = {
  quiz: 'Quiz',
  flashcard: 'Flashcard review',
  'interleaved-review': 'Interleaved review',
}

/**
 * Manages focus mode -- a spotlight overlay that dims everything except the
 * active interactive component (quiz, flashcard, interleaved review).
 *
 * Mutually exclusive with reading mode (E65-S01).
 * Listens for custom events `focus-request` and `focus-release` (E65-S04).
 */
export function useFocusMode() {
  const [state, setState] = useState<FocusModeState>({
    isFocusMode: false,
    focusTargetId: null,
    componentType: null,
    isQuizInProgress: false,
    showExitConfirmation: false,
  })

  const savedActiveElementRef = useRef<HTMLElement | null>(null)
  const inertElementsRef = useRef<HTMLElement[]>([])
  const portalContainerRef = useRef<HTMLDivElement | null>(null)
  const [announcement, announce] = useAriaLiveAnnouncer(5000)
  const { shouldReduceMotion } = useReducedMotion()
  const isMobile = useIsMobile()

  // Create or get portal container
  const getPortalContainer = useCallback(() => {
    if (portalContainerRef.current) return portalContainerRef.current
    let container = document.getElementById('focus-mode-portal') as HTMLDivElement | null
    if (!container) {
      container = document.createElement('div')
      container.id = 'focus-mode-portal'
      document.body.appendChild(container)
    }
    portalContainerRef.current = container
    return container
  }, [])

  // Apply inert to body children except portal and focus target
  const applyInert = useCallback((targetEl: HTMLElement) => {
    const portalContainer = document.getElementById('focus-mode-portal')
    const children = Array.from(document.body.children) as HTMLElement[]
    const toInert: HTMLElement[] = []

    for (const child of children) {
      if (child === portalContainer) continue
      if (child.contains(targetEl) || child === targetEl) continue
      // Skip script/style elements
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue
      child.setAttribute('inert', '')
      toInert.push(child)
    }

    inertElementsRef.current = toInert
  }, [])

  const removeInert = useCallback(() => {
    for (const el of inertElementsRef.current) {
      el.removeAttribute('inert')
    }
    inertElementsRef.current = []
  }, [])

  const activateFocusMode = useCallback(
    (targetId: string, type: FocusTargetType) => {
      // Exit reading mode first (mutual exclusivity) — via custom event so Layout
      // doesn't need to pass exitReadingMode down as a prop
      window.dispatchEvent(new CustomEvent('exit-reading-mode'))

      // Save current focus for restoration
      savedActiveElementRef.current = document.activeElement as HTMLElement | null

      const targetEl = document.querySelector(`[data-focus-target="${type}"]`) as HTMLElement | null
      if (!targetEl) {
        toast.info('No interactive component to focus')
        return
      }

      // Elevate target above overlay
      targetEl.style.position = 'relative'
      targetEl.style.zIndex = '45'

      if (isMobile) {
        targetEl.style.position = 'fixed'
        targetEl.style.inset = '0'
        targetEl.style.zIndex = '50'
        targetEl.style.overflow = 'auto'
        targetEl.style.background = 'var(--background)'
      }

      // Apply inert to siblings
      applyInert(targetEl)

      // Check if quiz is in progress
      const isQuiz = type === 'quiz' && targetEl.getAttribute('data-focus-active') === 'quiz'

      setState({
        isFocusMode: true,
        focusTargetId: targetId,
        componentType: type,
        isQuizInProgress: isQuiz,
        showExitConfirmation: false,
      })

      const label = COMPONENT_LABELS[type] || type
      announce(`Focus mode activated. ${label} in progress. Press Escape to exit.`)

      // Focus the target element
      targetEl.focus({ preventScroll: true })
    },
    [applyInert, announce, isMobile]
  )

  const deactivateFocusMode = useCallback(() => {
    // Remove inert
    removeInert()

    // Reset target element styles
    if (state.componentType) {
      const targetEl = document.querySelector(
        `[data-focus-target="${state.componentType}"]`
      ) as HTMLElement | null
      if (targetEl) {
        targetEl.style.position = ''
        targetEl.style.zIndex = ''
        targetEl.style.inset = ''
        targetEl.style.overflow = ''
        targetEl.style.background = ''
      }
    }

    setState({
      isFocusMode: false,
      focusTargetId: null,
      componentType: null,
      isQuizInProgress: false,
      showExitConfirmation: false,
    })

    announce('Focus mode deactivated.')

    // Restore focus
    const savedEl = savedActiveElementRef.current
    if (savedEl && document.body.contains(savedEl)) {
      requestAnimationFrame(() => {
        savedEl.focus()
      })
    } else {
      // Fallback to main content area
      const main = document.querySelector('main') as HTMLElement | null
      main?.focus()
    }
    savedActiveElementRef.current = null
  }, [removeInert, announce, state.componentType])

  const requestExit = useCallback(() => {
    // Check quiz-in-progress state dynamically
    const targetEl = state.componentType
      ? (document.querySelector(
          `[data-focus-target="${state.componentType}"]`
        ) as HTMLElement | null)
      : null
    const isQuiz =
      state.componentType === 'quiz' && targetEl?.getAttribute('data-focus-active') === 'quiz'

    if (isQuiz) {
      setState(prev => ({ ...prev, showExitConfirmation: true, isQuizInProgress: true }))
    } else {
      deactivateFocusMode()
    }
  }, [state.componentType, deactivateFocusMode])

  const cancelExitConfirmation = useCallback(() => {
    setState(prev => ({ ...prev, showExitConfirmation: false }))
  }, [])

  const confirmExit = useCallback(() => {
    setState(prev => ({ ...prev, showExitConfirmation: false }))
    deactivateFocusMode()
  }, [deactivateFocusMode])

  // Keyboard shortcut: Cmd+Shift+F / Ctrl+Shift+F to activate, Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+F or Ctrl+Shift+F
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()

        if (state.isFocusMode) {
          requestExit()
          return
        }

        // Find nearest data-focus-target
        const target = document.querySelector('[data-focus-target]') as HTMLElement | null
        if (!target) {
          toast.info('No interactive component to focus')
          return
        }

        const type = target.getAttribute('data-focus-target') as FocusTargetType
        const id = target.id || type
        activateFocusMode(id, type)
        return
      }

      // Escape to exit focus mode
      if (e.key === 'Escape' && state.isFocusMode) {
        e.preventDefault()
        e.stopPropagation()
        requestExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [state.isFocusMode, activateFocusMode, requestExit])

  // Listen for custom events (E65-S04 integration)
  useEffect(() => {
    const handleFocusRequest = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        targetId: string
        type: FocusTargetType
      }
      if (detail?.targetId && detail?.type) {
        activateFocusMode(detail.targetId, detail.type)
      }
    }

    const handleFocusRelease = () => {
      if (state.isFocusMode) {
        deactivateFocusMode()
      }
    }

    window.addEventListener('focus-request', handleFocusRequest)
    window.addEventListener('focus-release', handleFocusRelease)
    return () => {
      window.removeEventListener('focus-request', handleFocusRequest)
      window.removeEventListener('focus-release', handleFocusRelease)
    }
  }, [activateFocusMode, deactivateFocusMode, state.isFocusMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeInert()
      // Reset any styled target elements
      const targets = document.querySelectorAll('[data-focus-target]') as NodeListOf<HTMLElement>
      for (const el of targets) {
        el.style.position = ''
        el.style.zIndex = ''
        el.style.inset = ''
        el.style.overflow = ''
        el.style.background = ''
      }
    }
  }, [removeInert])

  return {
    isFocusMode: state.isFocusMode,
    focusTargetId: state.focusTargetId,
    componentType: state.componentType,
    isQuizInProgress: state.isQuizInProgress,
    showExitConfirmation: state.showExitConfirmation,
    activateFocusMode,
    deactivateFocusMode,
    requestExit,
    cancelExitConfirmation,
    confirmExit,
    announcement,
    shouldReduceMotion,
    isMobile,
    getPortalContainer,
  }
}
