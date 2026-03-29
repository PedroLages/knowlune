/**
 * AISummaryPanel — Collapsible AI course summary panel (Premium feature).
 * Currently a placeholder — shows transcript import prompt.
 *
 * @see E89-S04
 */

import { useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { cn } from '@/app/components/ui/utils'

export function AISummaryPanel() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border bg-card mb-6" data-testid="ai-summary-panel">
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center justify-between w-full p-4 text-left hover:bg-accent/50 transition-colors rounded-xl"
            aria-label="Toggle AI course summary"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand" aria-hidden="true" />
              <span className="text-sm font-medium">AI Course Summary</span>
              <Badge
                variant="secondary"
                className="text-xs bg-brand-soft text-brand-soft-foreground"
              >
                Premium
              </Badge>
            </div>
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                open && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            <p>
              AI-generated summaries are created from transcript data. Import transcripts for
              this course to enable AI summaries.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
