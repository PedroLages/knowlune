/**
 * Empty State Component
 *
 * Welcome message shown when chat has no messages.
 */

import { MessageSquare, Sparkles } from 'lucide-react'

/**
 * Welcome message for empty chat
 *
 * Shows greeting, example queries, and explainer about AI answers.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <div className="relative mb-6">
        <MessageSquare className="size-16 text-brand" strokeWidth={1.5} />
        <Sparkles className="size-6 text-warning absolute -top-1 -right-1" />
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-3">
        Ask me anything about your notes!
      </h2>

      <p className="text-muted-foreground mb-8 max-w-md">
        I can help you review your learning materials by answering questions based on your personal
        note corpus.
      </p>

      <div className="space-y-3 w-full max-w-lg">
        <div className="text-sm font-medium text-foreground mb-2">Try asking:</div>
        <div className="flex flex-col gap-2">
          <div className="bg-muted rounded-xl px-4 py-3 text-left text-sm text-foreground">
            "What are the key concepts in React Hooks?"
          </div>
          <div className="bg-muted rounded-xl px-4 py-3 text-left text-sm text-foreground">
            "Explain the difference between useState and useEffect"
          </div>
          <div className="bg-muted rounded-xl px-4 py-3 text-left text-sm text-foreground">
            "Summarize what I learned about async/await"
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground bg-muted px-4 py-2 rounded-lg">
        <Sparkles className="size-4" />
        <span>Answers are generated from your personal note corpus only</span>
      </div>
    </div>
  )
}
