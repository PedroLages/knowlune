import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

const DEFAULT_VISIBLE_COUNT = 5

interface AreasForGrowthProps {
  incorrectItems: Array<{
    questionText: string
    correctAnswer: string
  }>
}

export function AreasForGrowth({ incorrectItems }: AreasForGrowthProps) {
  const [showAll, setShowAll] = useState(false)

  if (incorrectItems.length === 0) return null

  const hasMore = incorrectItems.length > DEFAULT_VISIBLE_COUNT
  const visibleItems = showAll ? incorrectItems : incorrectItems.slice(0, DEFAULT_VISIBLE_COUNT)

  return (
    <section aria-labelledby="areas-for-growth-heading" className="text-left">
      <div className="bg-muted rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-brand" aria-hidden="true" />
          <h2
            id="areas-for-growth-heading"
            className="text-lg font-semibold text-foreground"
          >
            Areas to Review
          </h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Review these topics to strengthen your understanding
        </p>

        <ol className="space-y-3">
          {visibleItems.map((item, index) => (
            <li key={index} className="flex gap-3">
              <span className="text-sm font-medium text-muted-foreground mt-0.5 shrink-0">
                {index + 1}.
              </span>
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.questionText}</p>
                <p className="text-sm text-muted-foreground">
                  Correct answer: {item.correctAnswer}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {hasMore && !showAll && (
          <Button
            variant="ghost"
            size="sm"
            className="text-brand hover:text-brand min-h-[44px]"
            onClick={() => setShowAll(true)}
          >
            Show all ({incorrectItems.length} items)
          </Button>
        )}
      </div>
    </section>
  )
}
