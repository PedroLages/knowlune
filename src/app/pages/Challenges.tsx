import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Target, Clock, Flame, Trophy, RefreshCcw, ChevronDown, Check, BookOpen, FileText } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/app/components/ui/collapsible'
import { useChallengeStore } from '@/stores/useChallengeStore'
import { CreateChallengeDialog } from '@/app/components/challenges/CreateChallengeDialog'
import { fireMilestoneToasts } from '@/lib/fireMilestoneToasts'
import type { Challenge, ChallengeType } from '@/data/types'

const typeConfig: Record<ChallengeType, { label: string; unit: string; icon: typeof Target }> = {
  completion: { label: 'Completion', unit: 'videos', icon: Trophy },
  time: { label: 'Time', unit: 'hours', icon: Clock },
  streak: { label: 'Streak', unit: 'days', icon: Flame },
  books: { label: 'Books', unit: 'books', icon: BookOpen },
  pages: { label: 'Pages', unit: 'pages', icon: FileText },
}

/** Parse date-only string as local date (avoids UTC midnight shift). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDeadline(deadline: string): string {
  return parseLocalDate(deadline).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysRemaining(deadline: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((parseLocalDate(deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const config = typeConfig[challenge.type]
  const Icon = config.icon
  const remaining = daysRemaining(challenge.deadline)
  const isExpired = remaining < 0
  const isCompleted = !!challenge.completedAt
  const progressPercent = Math.min(
    100,
    challenge.targetValue > 0
      ? Math.round((challenge.currentProgress / challenge.targetValue) * 100)
      : 0
  )

  return (
    <Card
      className={cn(
        isExpired && !isCompleted && 'opacity-60',
        isCompleted && 'border-warning/60 bg-warning/5'
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                isCompleted ? 'bg-warning/10 text-warning' : 'bg-brand/10 text-brand'
              )}
            >
              {isCompleted ? <Check className="size-4.5" /> : <Icon className="size-4.5" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">{challenge.name}</h3>
              <p className="text-muted-foreground text-xs">
                {challenge.targetValue} {config.unit}
              </p>
            </div>
          </div>
          <Badge
            variant={isCompleted ? 'default' : isExpired ? 'secondary' : 'outline'}
            className={cn('shrink-0 text-xs', isCompleted && 'bg-warning hover:bg-warning/90')}
          >
            {isCompleted ? 'Completed' : config.label}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {challenge.currentProgress} / {challenge.targetValue} {config.unit}
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            className={cn('h-2.5', isCompleted && '[&>div]:bg-amber-500')}
            aria-label={`${challenge.name}: ${progressPercent}% complete`}
          />
        </div>

        <p className="text-muted-foreground text-xs">
          {isCompleted
            ? 'Completed'
            : isExpired
              ? 'Expired'
              : remaining === 0
                ? 'Deadline is today'
                : `${remaining} day${remaining !== 1 ? 's' : ''} remaining`}{' '}
          &middot; Due {formatDeadline(challenge.deadline)}
        </p>
      </CardContent>
    </Card>
  )
}

export function Challenges() {
  const { challenges, isLoading, error, loadChallenges, refreshAllProgress } = useChallengeStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(true)
  const [expiredOpen, setExpiredOpen] = useState(false)
  const timerIdsRef = useRef<number[]>([])

  useEffect(() => {
    let ignore = false
    loadChallenges()
      .then(() => {
        if (!ignore) {
          return refreshAllProgress()
        }
      })
      .then(milestoneMap => {
        if (!ignore && milestoneMap && milestoneMap.size > 0) {
          const current = useChallengeStore.getState().challenges
          timerIdsRef.current = fireMilestoneToasts(milestoneMap, current)
        }
      })
      .catch(err => {
        // silent-catch-ok — non-critical milestone detection; challenges still display
        console.error('[Challenges] milestone detection failed:', err)
      })
    return () => {
      ignore = true
      timerIdsRef.current.forEach(id => clearTimeout(id))
      timerIdsRef.current = []
    }
  }, [loadChallenges, refreshAllProgress])

  const { active, completed, expired } = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return challenges.reduce<{ active: Challenge[]; completed: Challenge[]; expired: Challenge[] }>(
      (groups, c) => {
        const deadlinePassed = parseLocalDate(c.deadline).getTime() < now.getTime()
        const isCompleted = !!c.completedAt
        if (isCompleted) {
          groups.completed.push(c)
        } else if (deadlinePassed) {
          groups.expired.push(c)
        } else {
          groups.active.push(c)
        }
        return groups
      },
      { active: [], completed: [], expired: [] }
    )
  }, [challenges])

  const sectionTriggerClass = cn(
    'flex w-full items-center gap-2 rounded-sm py-3 text-sm font-medium text-muted-foreground',
    'transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Challenges</h1>
        <Button data-testid="header-create-challenge" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create Challenge
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" onClick={() => loadChallenges()}>
              <RefreshCcw className="mr-2 size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <DelayedFallback>
          <div role="status" aria-busy="true" aria-label="Loading challenges" className="space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        </DelayedFallback>
      ) : active.length === 0 && completed.length === 0 && expired.length === 0 ? (
        <EmptyState
          data-testid="empty-state-challenges"
          icon={Trophy}
          title="Create your first learning challenge"
          description="Set goals and track your progress with timed challenges"
          actionLabel="Create Challenge"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="sr-only">Active Challenges</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {active.map(challenge => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <Collapsible
              data-testid="completed-section"
              open={completedOpen}
              onOpenChange={setCompletedOpen}
            >
              <CollapsibleTrigger className={sectionTriggerClass}>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'size-4 transition-transform motion-reduce:transition-none',
                    completedOpen && 'rotate-180'
                  )}
                />
                Completed ({completed.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  {completed.map(challenge => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {expired.length > 0 && (
            <Collapsible open={expiredOpen} onOpenChange={setExpiredOpen}>
              <CollapsibleTrigger className={sectionTriggerClass}>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'size-4 transition-transform motion-reduce:transition-none',
                    expiredOpen && 'rotate-180'
                  )}
                />
                Expired ({expired.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  {expired.map(challenge => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <CreateChallengeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
