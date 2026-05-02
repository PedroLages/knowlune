import { useState, useId } from 'react'
import { Sparkles, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import type { ActionSuggestion } from '@/lib/actionSuggestions'
import { ActionCard } from '@/app/components/knowledge/ActionCard'
import { cn } from '@/app/components/ui/utils'

// ── Component ───────────────────────────────────────────────────

export interface SuggestedActionsPanelProps {
  suggestions: ActionSuggestion[]
  maxVisible?: number
  className?: string
}

export function SuggestedActionsPanel({
  suggestions,
  maxVisible,
  className,
}: SuggestedActionsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const titleId = useId()

  const hasOverflow = maxVisible !== undefined && suggestions.length > maxVisible
  const visibleSuggestions =
    hasOverflow && !expanded ? suggestions.slice(0, maxVisible) : suggestions
  const hiddenCount = hasOverflow ? suggestions.length - maxVisible : 0

  return (
    <section
      data-testid="suggested-actions-panel"
      aria-labelledby={titleId}
      role="region"
      className={cn('rounded-xl border border-border bg-card p-4', className)}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-5 shrink-0 text-brand" />
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Suggested Actions
          </h2>
          <p className="text-sm text-muted-foreground">Topics that need your attention</p>
        </div>
      </div>

      {/* Empty state */}
      {suggestions.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="text-sm font-medium">All topics looking strong!</p>
          <p className="text-sm text-muted-foreground">
            Your knowledge is looking great! Keep up the good work.
          </p>
        </div>
      )}

      {/* Card list */}
      {suggestions.length > 0 && (
        <>
          <div
            role="list"
            className={cn(
              // Mobile: horizontal scroll with snap
              'flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2',
              '[mask-image:linear-gradient(to_right,black_85%,transparent)]',
              // Tablet: 2-col grid
              'sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:[mask-image:none] sm:pb-0',
              // Desktop: vertical stack
              'lg:flex lg:flex-col lg:overflow-visible lg:[mask-image:none]'
            )}
          >
            {visibleSuggestions.map(suggestion => (
              <ActionCard
                key={`${suggestion.canonicalName}-${suggestion.actionType}`}
                suggestion={suggestion}
                className={cn(
                  // Mobile: fixed-width snap cards
                  'min-w-[280px] max-w-[300px] shrink-0 snap-start',
                  // Tablet+: natural sizing
                  'sm:min-w-0 sm:max-w-none sm:shrink'
                )}
              />
            ))}
          </div>

          {/* Show more/less toggle */}
          {hasOverflow && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(prev => !prev)}
              className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:text-brand-hover"
            >
              {expanded ? (
                <>
                  Show less
                  <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  Show {hiddenCount} more suggestions
                  <ChevronDown className="size-4" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  )
}
