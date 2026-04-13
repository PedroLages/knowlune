/**
 * TutorEmptyState (E57-S01)
 *
 * Welcome state for the tutor chat when no messages exist.
 * Contextual to the current lesson.
 */

import { GraduationCap, Sparkles } from 'lucide-react'

interface TutorEmptyStateProps {
  lessonTitle: string
}

export function TutorEmptyState({ lessonTitle }: TutorEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <div className="relative mb-6">
        <GraduationCap className="size-16 text-brand" strokeWidth={1.5} />
        <Sparkles className="size-6 text-warning absolute -top-1 -right-1" />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-3">Ask about this lesson</h2>

      <p className="text-muted-foreground mb-6 max-w-md text-sm">
        I can help you understand the material in{' '}
        <span className="font-medium text-foreground">
          {lessonTitle.replace(/\.\w{2,4}$/, '')}
        </span>
        . Ask me anything about the content.
      </p>

      <div className="space-y-2 w-full max-w-sm">
        <div className="text-xs font-medium text-muted-foreground mb-1">Try asking:</div>
        <div className="bg-muted rounded-xl px-3 py-2.5 text-left text-sm text-foreground">
          &ldquo;Can you explain what was just covered?&rdquo;
        </div>
        <div className="bg-muted rounded-xl px-3 py-2.5 text-left text-sm text-foreground">
          &ldquo;What are the key takeaways so far?&rdquo;
        </div>
        <div className="bg-muted rounded-xl px-3 py-2.5 text-left text-sm text-foreground">
          &ldquo;I didn&apos;t understand that last part&rdquo;
        </div>
      </div>
    </div>
  )
}
