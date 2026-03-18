import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import confetti from 'canvas-confetti'
import { X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useOnboardingStore } from '@/stores/useOnboardingStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useChallengeStore } from '@/stores/useChallengeStore'
import { OnboardingStepContent, StepIndicator } from './OnboardingStep'

function triggerOnboardingConfetti() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) return

  confetti({
    particleCount: 120,
    spread: 80,
    startVelocity: 35,
    origin: { y: 0.6 },
    colors: ['#2563eb', '#3b82f6', '#60a5fa', '#16a34a', '#4ade80'],
  })
}

export function OnboardingOverlay() {
  const {
    currentStep,
    isActive,
    completedAt,
    initialize,
    advanceStep,
    skipOnboarding,
    completeOnboarding,
    dismiss,
  } = useOnboardingStore()
  const navigate = useNavigate()

  // Initialize on mount — checks localStorage for prior completion
  useEffect(() => {
    initialize()
  }, [initialize])

  // Step 1 → 2: Detect course import
  useEffect(() => {
    if (currentStep !== 1 || !isActive) return

    // Check immediately
    if (useCourseImportStore.getState().importedCourses.length > 0) {
      advanceStep()
      return
    }

    // Subscribe for future imports (single-arg form — stores don't use subscribeWithSelector)
    const unsub = useCourseImportStore.subscribe(state => {
      if (state.importedCourses.length > 0) advanceStep()
    })
    return unsub
  }, [currentStep, isActive, advanceStep])

  // Step 2 → 3: Detect video played for 5 seconds
  useEffect(() => {
    if (currentStep !== 2 || !isActive) return

    const unsub = useSessionStore.subscribe(state => {
      if (state.activeSession && state.activeSession.duration >= 5) advanceStep()
    })
    return unsub
  }, [currentStep, isActive, advanceStep])

  const handleComplete = useCallback(() => {
    completeOnboarding()
    triggerOnboardingConfetti()
  }, [completeOnboarding])

  const handleDismissForAction = useCallback(() => {
    dismiss()
  }, [dismiss])

  const handleCompletionDismiss = useCallback(() => {
    navigate('/')
  }, [navigate])

  // Step 3 → Complete: Detect challenge creation
  useEffect(() => {
    if (currentStep !== 3 || !isActive) return

    // Check immediately
    if (useChallengeStore.getState().challenges.length > 0) {
      handleComplete()
      return
    }

    const unsub = useChallengeStore.subscribe(state => {
      if (state.challenges.length > 0) handleComplete()
    })
    return unsub
  }, [currentStep, isActive, handleComplete])

  // Handle Escape key to skip
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipOnboarding()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, skipOnboarding])

  // Don't render if already completed or not active
  if (completedAt && !isActive) return null

  const isComplete = !!completedAt

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to LevelUp onboarding"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative w-full max-w-md rounded-[24px] bg-card p-8 shadow-xl"
          >
            {/* Close / Skip button */}
            {!isComplete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={skipOnboarding}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                aria-label="Skip onboarding"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {/* Welcome header (only on first view) */}
            {currentStep === 1 && !isComplete && (
              <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
                Welcome to LevelUp! Let's get you started in 3 quick steps.
              </p>
            )}

            {/* Step indicator */}
            <div className="mb-6">
              <StepIndicator currentStep={currentStep} isComplete={isComplete} />
            </div>

            {/* Step content */}
            <OnboardingStepContent
              step={currentStep}
              isComplete={isComplete}
              onNavigate={isComplete ? handleCompletionDismiss : handleDismissForAction}
            />

            {/* Skip link */}
            {!isComplete && (
              <div className="mt-6 text-center">
                <button
                  onClick={skipOnboarding}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip onboarding
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
