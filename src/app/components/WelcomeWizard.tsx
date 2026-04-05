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
import { useWelcomeWizardStore } from '@/stores/useWelcomeWizardStore'
import { getSettings, saveSettings, type FontSize } from '@/lib/settings'
import { FontSizePicker } from '@/app/components/settings/FontSizePicker'

type WizardStep = 'welcome' | 'font'

export function WelcomeWizard() {
  const { isOpen, complete, dismiss } = useWelcomeWizardStore()
  const [step, setStep] = useState<WizardStep>('welcome')
  const [selectedFontSize, setSelectedFontSize] = useState<FontSize>(
    getSettings().fontSize ?? 'medium'
  )

  function handleFinish() {
    saveSettings({ fontSize: selectedFontSize })
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
                onClick={() => setStep('font')}
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
              <Button variant="ghost" size="sm" onClick={() => setStep('welcome')}>
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
