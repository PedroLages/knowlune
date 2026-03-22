import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/app/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import { formatDuration } from '@/lib/formatDuration'
import type { QuizAttempt } from '@/types/quiz'

interface AttemptHistoryProps {
  attempts: QuizAttempt[] // Already sorted most-recent-first
  currentAttemptId: string // ID of the current (just-completed) attempt
  courseId: string
  lessonId: string
}

export function AttemptHistory({
  attempts,
  currentAttemptId,
  courseId: _courseId, // TODO(E16-S01): use for review navigation route
  lessonId: _lessonId, // TODO(E16-S01): use for review navigation route
}: AttemptHistoryProps) {
  const [open, setOpen] = useState(false)

  const handleReview = useCallback((_attemptId: string) => {
    // E16-S01 will implement the review route
    toast.info('Review mode coming soon.')
  }, [])

  const n = attempts.length
  const label = n === 1 ? '(1 attempt)' : `(${n} attempts)`

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="link" className="text-sm font-medium">
          View Attempt History {label}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {/* Desktop table — hidden on mobile */}
        <div className="hidden sm:block mt-3 text-left">
          <Table aria-label="Quiz attempt history">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Attempt</TableHead>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Score</TableHead>
                <TableHead scope="col">Time</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">
                  <span className="sr-only">Review</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt, index) => {
                const attemptNum = attempts.length - index
                const isCurrent = attempt.id === currentAttemptId
                return (
                  <TableRow key={attempt.id} className={cn(isCurrent ? 'bg-brand-soft' : '')}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        #{attemptNum}
                        {isCurrent && (
                          <span className="bg-brand-soft text-brand-soft-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                            Current
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(attempt.completedAt).toLocaleString()}</TableCell>
                    <TableCell>{attempt.percentage}%</TableCell>
                    <TableCell>{formatDuration(attempt.timeSpent)}</TableCell>
                    <TableCell>
                      {attempt.passed ? (
                        <span className="bg-success-soft text-success rounded-full px-2 py-0.5 text-xs font-medium">
                          Passed
                        </span>
                      ) : (
                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                          Not Passed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Review attempt #${attemptNum}`}
                        onClick={() => handleReview(attempt.id)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile stacked cards — hidden on sm+ */}
        <div className="sm:hidden mt-3 space-y-3">
          {attempts.map((attempt, index) => {
            const attemptNum = attempts.length - index
            const isCurrent = attempt.id === currentAttemptId
            return (
              <div
                key={attempt.id}
                className={cn(
                  'rounded-xl border border-border p-3 text-sm space-y-1.5',
                  isCurrent ? 'bg-brand-soft' : 'bg-card'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-1.5">
                    Attempt #{attemptNum}
                    {isCurrent && (
                      <span className="bg-brand-soft text-brand-soft-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                        Current
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Review attempt #${attemptNum}`}
                    onClick={() => handleReview(attempt.id)}
                  >
                    Review
                  </Button>
                </div>
                <div className="text-muted-foreground">
                  {new Date(attempt.completedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-3">
                  <span>{attempt.percentage}%</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{formatDuration(attempt.timeSpent)}</span>
                  <span className="text-muted-foreground">·</span>
                  {attempt.passed ? (
                    <span className="bg-success-soft text-success rounded-full px-2 py-0.5 text-xs font-medium">
                      Passed
                    </span>
                  ) : (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                      Not Passed
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
