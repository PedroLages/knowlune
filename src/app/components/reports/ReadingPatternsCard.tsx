/**
 * ReadingPatternsCard — displays time-of-day reading patterns from study sessions.
 *
 * Shows 4 time buckets (Morning, Afternoon, Evening, Night) with relative
 * progress bars. Highlights the dominant time bucket with brand color.
 * Renders null when fewer than 7 sessions exist.
 *
 * @module ReadingPatternsCard
 * @since E112-S01
 */
import { useState, useEffect, useCallback } from 'react'
import { Moon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import { Skeleton } from '@/app/components/ui/skeleton'
import { getTimeOfDayPattern, type TimeOfDayPattern } from '@/services/ReadingStatsService'

export function ReadingPatternsCard() {
  const [pattern, setPattern] = useState<TimeOfDayPattern | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadPattern = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getTimeOfDayPattern()
      setPattern(data)
    } catch (err) {
      // silent-catch-ok: pattern data is non-critical — graceful degradation
      console.error('[ReadingPatternsCard] Failed to load reading pattern:', err)
      setPattern(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPattern()
  }, [loadPattern])

  // Render nothing if no pattern data or fewer than 7 sessions
  if (!isLoading && !pattern) {
    return null
  }

  return (
    <Card data-testid="reading-patterns-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Moon className="size-4 text-muted-foreground" aria-hidden="true" />
          Reading Patterns
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-48" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : pattern ? (
          <div className="space-y-4">
            {pattern.dominant && (
              <p className="text-sm font-medium text-foreground">
                You read most in the {pattern.dominant}
              </p>
            )}

            <div className="space-y-3">
              {pattern.buckets.map(bucket => (
                <div key={bucket.period}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">{bucket.period}</span>
                    <span className="text-xs text-muted-foreground">
                      {bucket.count} {bucket.count === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                  <Progress
                    value={bucket.percentage}
                    className={bucket.period === pattern.dominant ? 'bg-brand-soft' : undefined}
                    role="meter"
                    aria-valuenow={bucket.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${bucket.period}: ${bucket.percentage}% of reading sessions`}
                    data-testid={`reading-pattern-${bucket.period.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
