import { useId, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

const DEFAULT_VISIBLE_COUNT = 5

interface AreasForGrowthProps {
  incorrectItems: Array<{
    questionId: string
    questionText: string
    correctAnswer: string
  }>
}

export function AreasForGrowth({ incorrectItems }: AreasForGrowthProps) {
  const headingId = useId()
  const [showAll, setShowAll] = useState(false)

  if (incorrectItems.length === 0) return null

  const hasMore = incorrectItems.length > DEFAULT_VISIBLE_COUNT
  const visibleItems = showAll ? incorrectItems : incorrectItems.slice(0, DEFAULT_VISIBLE_COUNT)

  return (
    <section aria-labelledby={headingId} className="text-left">
      <div className="bg-muted rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-brand" aria-hidden="true" />
          <h2 id={headingId} className="text-lg font-semibold text-foreground">
            Areas to Review
          </h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Review these topics to strengthen your understanding
        </p>

        <ol className="space-y-3 list-decimal list-inside">
          {visibleItems.map((item) => (
            <li key={item.questionId} className="space-y-1">
              <span className="text-sm font-medium text-foreground">{item.questionText}</span>
              <p className="text-sm text-muted-foreground ml-5">
                Correct answer: {item.correctAnswer}
              </p>
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
