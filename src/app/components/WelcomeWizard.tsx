import { useState } from 'react'
import { Sparkles, Type, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { useWelcomeWizardStore } from '@/stores/useWelcomeWizardStore'
import { getSettings, saveSettings, type AgeRange, type FontSize } from '@/lib/settings'
import { FontSizePicker } from '@/app/components/settings/FontSizePicker'

const AGE_RANGES: { value: AgeRange; label: string; emoji: string; description: string }[] = [
  {
    value: 'gen-z',
    label: 'Gen Z',
    emoji: '🎮',
    description: 'Born 1997-2012',
  },
  {
    value: 'millennial',
    label: 'Millennial',
    emoji: '💻',
    description: 'Born 1981-1996',
  },
  {
    value: 'boomer',
    label: 'Boomer',
    emoji: '📖',
    description: 'Born 1946-1964',
  },
  {
    value: 'prefer-not-to-say',
    label: 'Prefer not to say',
    emoji: '🤐',
    description: 'Use default settings',
  },
]

/** Maps age range to recommended font size defaults */
const AGE_FONT_DEFAULTS: Record<AgeRange, FontSize> = {
  'gen-z': 'medium',
  millennial: 'medium',
  boomer: 'large',
  'prefer-not-to-say': 'medium',
}

type WizardStep = 'welcome' | 'age' | 'font'

export function WelcomeWizard() {
  const { isOpen, complete, dismiss } = useWelcomeWizardStore()
  const [step, setStep] = useState<WizardStep>('welcome')
  const [selectedAge, setSelectedAge] = useState<AgeRange | null>(null)
  const [selectedFontSize, setSelectedFontSize] = useState<FontSize>(
    getSettings().fontSize ?? 'medium'
  )

  function handleAgeSelect(age: AgeRange) {
    setSelectedAge(age)
    // Apply recommended font size for the age range
    const recommended = AGE_FONT_DEFAULTS[age]
    setSelectedFontSize(recommended)
  }

  function handleContinueFromAge() {
    setStep('font')
  }

  function handleFinish() {
    const updates: Partial<ReturnType<typeof getSettings>> = {
      fontSize: selectedFontSize,
    }
    if (selectedAge && selectedAge !== 'prefer-not-to-say') {
      updates.ageRange = selectedAge
    }
    saveSettings(updates)
    // Apply font scale immediately
    window.dispatchEvent(new Event('settingsUpdated'))
    complete()
  }

  function handleSkip() {
    dismiss()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleSkip()
      }}
    >
      <DialogContent
        className="sm:max-w-lg rounded-2xl"
        data-testid="welcome-wizard"
        aria-label="Welcome wizard"
      >
        {step === 'welcome' && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto rounded-full bg-brand-soft p-4 w-fit">
                <Sparkles className="size-8 text-brand" aria-hidden="true" />
              </div>
              <DialogTitle className="text-xl font-display">Welcome to Knowlune</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Let us personalize your experience. This takes about 30 seconds and you can change
                these settings anytime.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-4">
              <Button
                variant="brand"
                size="lg"
                onClick={() => setStep('age')}
                className="gap-2"
                data-testid="wizard-start"
              >
                Get Started
                <ChevronRight className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip} data-testid="wizard-skip">
                Skip for now
              </Button>
            </div>
          </>
        )}

        {step === 'age' && (
          <>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-lg font-display">What generation are you?</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                This helps us set comfortable defaults. Your answer stays on your device and is
                never sent to any server.
              </DialogDescription>
            </DialogHeader>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4"
              role="radiogroup"
              aria-label="Age range selection"
            >
              {AGE_RANGES.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selectedAge === option.value}
                  onClick={() => handleAgeSelect(option.value)}
                  data-testid={`age-option-${option.value}`}
                  className={cn(
                    'flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer text-left',
                    'transition-all duration-200 hover:shadow-sm min-h-[44px]',
                    selectedAge === option.value
                      ? 'border-brand bg-brand-soft shadow-sm'
                      : 'border-border bg-background hover:border-brand/50'
                  )}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {option.emoji}
                  </span>
                  <div>
                    <span className="text-sm font-medium block">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep('welcome')}>
                Back
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={handleContinueFromAge}
                disabled={!selectedAge}
                className="gap-1"
                data-testid="wizard-continue"
              >
                Continue
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        )}

        {step === 'font' && (
          <>
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Type className="size-5 text-brand" aria-hidden="true" />
                <DialogTitle className="text-lg font-display">Font Size</DialogTitle>
              </div>
              <DialogDescription className="text-muted-foreground text-sm">
                Choose a comfortable reading size. You can always change this in Settings.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <FontSizePicker value={selectedFontSize} onChange={setSelectedFontSize} />
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep('age')}>
                Back
              </Button>
              <Button variant="brand" size="sm" onClick={handleFinish} data-testid="wizard-finish">
                Finish Setup
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
