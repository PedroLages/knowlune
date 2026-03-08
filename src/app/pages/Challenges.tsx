import { useEffect, useMemo, useState } from 'react'
import { Plus, Target, Clock, Flame, Trophy, RefreshCcw, ChevronDown } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/app/components/ui/collapsible'
import { useChallengeStore } from '@/stores/useChallengeStore'
import { CreateChallengeDialog } from '@/app/components/challenges/CreateChallengeDialog'
import type { Challenge, ChallengeType } from '@/data/types'

const typeConfig: Record<ChallengeType, { label: string; unit: string; icon: typeof Target }> = {
  completion: { label: 'Completion', unit: 'videos', icon: Trophy },
  time: { label: 'Time', unit: 'hours', icon: Clock },
  streak: { label: 'Streak', unit: 'days', icon: Flame },
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
  const progressPercent = Math.min(
    100,
    challenge.targetValue > 0
      ? Math.round((challenge.currentProgress / challenge.targetValue) * 100)
      : 0
  )

  return (
    <Card className={cn(isExpired && 'opacity-60')}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
              <Icon className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">{challenge.name}</h3>
              <p className="text-muted-foreground text-xs">
                {challenge.targetValue} {config.unit}
              </p>
            </div>
          </div>
          <Badge variant={isExpired ? 'secondary' : 'outline'} className="shrink-0 text-xs">
            {config.label}
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
            className="h-2.5"
            aria-label={`${challenge.name}: ${progressPercent}% complete`}
          />
        </div>

        <p className="text-muted-foreground text-xs">
          {isExpired
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
  const { challenges, isLoading, error } = useChallengeStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expiredOpen, setExpiredOpen] = useState(false)

  useEffect(() => {
    let ignore = false
    const { loadChallenges, refreshAllProgress } = useChallengeStore.getState()
    loadChallenges().then(() => {
      if (!ignore) return refreshAllProgress()
    })
    return () => {
      ignore = true
    }
  }, [])

  const { active, expired } = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return challenges.reduce<{ active: Challenge[]; expired: Challenge[] }>(
      (groups, c) => {
        const deadlinePassed = parseLocalDate(c.deadline).getTime() < now.getTime()
        const isCompleted = !!c.completedAt
        if (deadlinePassed && !isCompleted) {
          groups.expired.push(c)
        } else {
          groups.active.push(c)
        }
        return groups
      },
      { active: [], expired: [] }
    )
  }, [challenges])

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
            <Button variant="outline" onClick={() => useChallengeStore.getState().loadChallenges()}>
              <RefreshCcw className="mr-2 size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="text-muted-foreground py-12 text-center text-sm"
        >
          Loading challenges...
        </div>
      ) : active.length === 0 && expired.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="bg-muted flex size-14 items-center justify-center rounded-full">
              <Target className="text-muted-foreground size-7" />
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold">No challenges yet</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Create your first challenge to set concrete learning goals.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create Challenge
            </Button>
          </CardContent>
        </Card>
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

          {expired.length > 0 && (
            <Collapsible open={expiredOpen} onOpenChange={setExpiredOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-sm py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                <ChevronDown
                  aria-hidden="true"
                  className={cn('size-4 transition-transform', expiredOpen && 'rotate-180')}
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
