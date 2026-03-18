import { useNavigate } from 'react-router'
import { BookOpen, Play, Trophy, PartyPopper } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import type { OnboardingStep as StepNumber } from '@/stores/useOnboardingStore'

interface StepConfig {
  icon: React.ElementType
  title: string
  description: string
  cta: string
  path: string
}

const STEPS: Record<1 | 2 | 3, StepConfig> = {
  1: {
    icon: BookOpen,
    title: 'Import your first course',
    description:
      'Add a folder with video lessons or PDFs to start building your personal learning library.',
    cta: 'Go to Courses',
    path: '/courses',
  },
  2: {
    icon: Play,
    title: 'Start studying',
    description:
      'Open a lesson and watch for a few seconds. LevelUp tracks your progress automatically.',
    cta: 'Open a Lesson',
    path: '/courses',
  },
  3: {
    icon: Trophy,
    title: 'Create a learning challenge',
    description:
      'Set a goal to keep yourself motivated — finish a course, study for a set number of hours, or build a streak.',
    cta: 'Create Challenge',
    path: '/challenges',
  },
}

interface OnboardingStepProps {
  step: StepNumber
  isComplete: boolean
  onNavigate: () => void
}

export function OnboardingStepContent({ step, isComplete, onNavigate }: OnboardingStepProps) {
  const navigate = useNavigate()

  if (isComplete) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
          <PartyPopper className="h-8 w-8 text-success" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">You're all set!</h2>
        <p className="text-muted-foreground">
          You've imported a course, started studying, and set a challenge. Your learning journey
          begins now.
        </p>
        <Button onClick={onNavigate} className="mt-2">
          Go to Dashboard
        </Button>
      </div>
    )
  }

  if (step === 0) return null

  const config = STEPS[step as 1 | 2 | 3]
  const Icon = config.icon

  return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
        <Icon className="h-8 w-8 text-brand" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">{config.title}</h2>
      <p className="text-muted-foreground">{config.description}</p>
      <Button
        onClick={() => {
          onNavigate()
          navigate(config.path)
        }}
        className="mt-2"
      >
        {config.cta}
      </Button>
    </div>
  )
}

interface StepIndicatorProps {
  currentStep: StepNumber
  isComplete: boolean
}

export function StepIndicator({ currentStep, isComplete }: StepIndicatorProps) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label="Onboarding progress"
    >
      {[1, 2, 3].map(step => {
        const isDone = isComplete || step < currentStep
        const isActive = !isComplete && step === currentStep

        return (
          <div
            key={step}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              isActive ? 'w-8 bg-brand' : isDone ? 'w-2.5 bg-success' : 'w-2.5 bg-muted'
            }`}
            role="presentation"
            aria-label={`Step ${step}${isDone ? ' completed' : isActive ? ' current' : ''}`}
          />
        )
      })}
    </div>
  )
}
