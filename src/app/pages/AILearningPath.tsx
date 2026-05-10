import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CurriculumComposer } from '@/app/components/figma/CurriculumComposer'
import { Sparkles } from 'lucide-react'

/**
 * AILearningPath — thin wrapper that opens CurriculumComposer in AI mode.
 *
 * Preserves the existing `/ai-learning-path` route and its PremiumFeaturePage
 * gating (handled in routes.tsx). This page simply opens the AI path building
 * dialog and navigates on close.
 */
export function AILearningPath() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)

  // Open the dialog on mount
  useEffect(() => {
    setOpen(true)
  }, [])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Navigate back to learning paths when dialog is dismissed
      navigate('/learning-tracks')
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 text-center">
      {/* Page Header */}
      <header className="mb-12 text-center">
        <div className="mx-auto size-16 rounded-full bg-brand-soft flex items-center justify-center mb-4">
          <Sparkles className="size-8 text-brand" aria-hidden="true" />
        </div>
        <h1 className="font-display text-4xl text-foreground mb-4">AI Learning Path</h1>
        <p className="text-muted-foreground text-lg">
          Describe your learning goal and let AI build a personalized path for you.
        </p>
      </header>

      {/* Opens CurriculumComposer in AI mode */}
      <CurriculumComposer open={open} onOpenChange={handleOpenChange} mode="ai" />
    </div>
  )
}
