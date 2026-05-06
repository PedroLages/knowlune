import { useState, useMemo, useCallback, useEffect } from 'react'
import { Lock, Sparkles, Settings, Loader2, Play, Check } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/app/components/ui/utils'
import { PlanMyWeekButton } from '@/app/components/learning-path/PlanMyWeekButton'
import { PathScheduleList } from '@/app/components/learning-path/PathScheduleList'
import { isOrderSuggestionAvailable } from '@/ai/learningPath/suggestOrder'
import { dispatchFocusRequest } from '@/lib/focusModeEvents'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

interface ControlCenterProps {
  pathId: string
  pathName: string
  entries: LearningPathEntry[]
  courseInfoMap: Map<string, PathCourseInfo>
  courseNames: Record<string, string>
  progress: PathProgressSummary
  isSuggesting: boolean
  onSuggestOrder: () => void
  onToggleCurriculum: () => void
  showCurriculum: boolean
}

/** Static array of study tips. Some are context-aware (path-specific conditions). */
const STUDY_TIPS = [
  {
    text: 'Focus on one concept at a time.',
    detail:
      'Multitasking while learning reduces retention. Master each course before moving to the next.',
  },
  {
    text: 'Active recall beats passive review.',
    detail:
      'Test yourself on what you just learned instead of re-reading. Spaced repetition makes it stick.',
  },
  {
    text: 'Break it down into small sessions.',
    detail:
      'Short, focused sessions (25-50 minutes) are more effective than marathon study sessions.',
  },
  {
    text: 'Teach to learn.',
    detail:
      'Explaining a concept to someone else (or even to yourself) reveals gaps in your understanding.',
  },
  {
    text: 'Mix it up with interleaving.',
    detail: 'Alternate between different topics in a single study session to build connections.',
  },
  {
    text: 'Take strategic breaks.',
    detail: 'Your brain consolidates information during rest. A 5-minute walk can boost retention.',
  },
  {
    text: 'Set specific learning goals.',
    detail:
      'Instead of "study more," set goals like "complete one module" or "master one concept."',
  },
]

/** Commitment options for Plan My Week */
const COMMITMENT_OPTIONS = [
  { label: 'Casual', hours: 5, description: '~45 min/day' },
  { label: 'Steady', hours: 8, description: '~1h/day' },
  { label: 'Intense', hours: 12, description: '~1h45min/day' },
]

/**
 * Control Center sidebar section — shows "Up Next" list, focus session
 * button, and integration points for the rest of the right-rail sections.
 */
export function ControlCenter({
  pathId,
  pathName,
  entries,
  courseInfoMap,
  courseNames,
  progress,
  isSuggesting,
  onSuggestOrder,
  onToggleCurriculum,
  showCurriculum,
}: ControlCenterProps) {
  const [expandedSection, setExpandedSection] = useState<'upnext' | 'plan' | null>(null)
  const [aiOrderingEnabled, setAiOrderingEnabled] = useState(false)
  const [commitmentHours, setCommitmentHours] = useState(8)
  const [filteredTip, setFilteredTip] = useState<{ text: string; detail: string } | null>(null)

  // Upcoming entries (not started, excluding unresolved gap entries)
  const upcomingEntries = useMemo(
    () =>
      entries.filter(e => {
        if (e.courseId === '') return false
        const info = courseInfoMap.get(e.courseId)
        return (info?.completionPct ?? 0) === 0
      }),
    [entries, courseInfoMap]
  )

  const completedAll = entries.length > 0 && progress.completionPct >= 100

  // Pick a study tip on mount — context-aware if possible
  useEffect(() => {
    const applicableTips = [...STUDY_TIPS]

    // Add path-specific tips
    if (completedAll) {
      applicableTips.push({
        text: 'You did it! Keep the momentum going.',
        detail:
          'Starting a new path right away helps maintain your learning streak and builds confidence.',
      })
    } else if (progress.completionPct > 50) {
      applicableTips.push({
        text: "You're over 50% through this path!",
        detail: 'The hardest part is behind you. Keep pushing through to the finish line.',
      })
    }

    const remainingCourses = entries.length - progress.completedCourses
    if (remainingCourses <= 2 && remainingCourses > 0) {
      applicableTips.push({
        text: `Only ${remainingCourses} ${remainingCourses === 1 ? 'course' : 'courses'} left!`,
        detail: "You're almost there. Now is a great time to plan your next learning path.",
      })
    }

    // Pick one randomly
    const idx = Math.floor(Math.random() * applicableTips.length)
    setFilteredTip(applicableTips[idx])
  }, []) // intentional: pick once on mount

  const handleStartFocusSession = useCallback(() => {
    // Focus session timer is a future feature.
    // Using 'interleaved-review' as a bridge type until learning-path-specific
    // focus targets are implemented.
    dispatchFocusRequest(pathId, 'interleaved-review')
  }, [pathId])

  // --- Up Next Section ---
  const upNextSection = upcomingEntries.length > 0 && (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Up Next
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {upcomingEntries.length} remaining
          </span>
        </div>
        <div className="space-y-3">
          {upcomingEntries
            .slice(0, expandedSection === 'upnext' ? undefined : 3)
            .map((entry, i) => {
              const info = courseInfoMap.get(entry.courseId)
              return (
                <div
                  key={entry.courseId || `upcoming-${i}`}
                  className="flex items-start gap-3"
                >
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <h4
                      className={cn(
                        'font-medium text-sm',
                        i > 0 && i < 3 ? 'text-muted-foreground' : 'text-foreground'
                      )}
                    >
                      {info?.name || 'Unknown Course'}
                    </h4>
                    {info?.authorName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{info.authorName}</p>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
        {upcomingEntries.length > 3 && (
          <button
            className="text-xs text-brand hover:underline mt-2 font-medium"
            onClick={() => setExpandedSection(expandedSection === 'upnext' ? null : 'upnext')}
          >
            {expandedSection === 'upnext'
              ? 'Show less'
              : `Show all ${upcomingEntries.length} courses`}
          </button>
        )}
        <Button variant="outline" className="w-full mt-3" onClick={onToggleCurriculum}>
          {showCurriculum ? 'Hide Curriculum' : 'View Full Curriculum'}
        </Button>
      </CardContent>
    </Card>
  )

  // --- Focus Session Button ---
  const focusSessionButton = !completedAll && (
    <Button variant="brand" className="w-full" onClick={handleStartFocusSession}>
      <Play className="size-4 mr-2" aria-hidden="true" />
      Start focus session
    </Button>
  )

  // --- Plan My Week Section ---
  const planMyWeekSection = (
    <div className="space-y-3">
      {/* Commitment selector */}
      <div className="flex gap-1.5">
        {COMMITMENT_OPTIONS.map(option => (
          <button
            key={option.hours}
            className={cn(
              'flex-1 p-2 rounded-lg text-center text-xs font-medium transition-all border',
              commitmentHours === option.hours
                ? 'bg-brand text-brand-foreground border-brand'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
            )}
            onClick={() => setCommitmentHours(option.hours)}
            aria-pressed={commitmentHours === option.hours}
            aria-label={`${option.label} — ${option.description}`}
          >
            <span className="block font-bold text-sm">{option.label}</span>
            <span className="block opacity-70">{option.hours}h</span>
          </button>
        ))}
      </div>

      <PlanMyWeekButton
        pathId={pathId}
        pathName={pathName}
        entries={entries}
        courseNames={courseNames}
        progress={progress}
      />
      <PathScheduleList pathId={pathId} />
    </div>
  )

  // --- AI Course Ordering Section ---
  const aiOrderingSection = entries.length >= 2 && (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        {isOrderSuggestionAvailable() ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-ordering-toggle" className="text-sm font-medium cursor-pointer">
                AI Course Ordering
              </Label>
              <Switch
                id="ai-ordering-toggle"
                checked={aiOrderingEnabled}
                onCheckedChange={setAiOrderingEnabled}
                aria-label="Toggle AI course ordering"
              />
            </div>
            {aiOrderingEnabled && (
              <button
                className="w-full text-left text-xs text-brand hover:underline font-medium flex items-center gap-1"
                onClick={onSuggestOrder}
                disabled={isSuggesting}
                data-testid="suggest-order-button"
              >
                {isSuggesting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden="true" />
                )}
                Review suggested order
              </button>
            )}
          </div>
        ) : (
          <Link
            to="/settings"
            className="flex items-center gap-3 text-left"
            data-testid="suggest-order-settings-link"
          >
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <Settings className="size-4" aria-hidden="true" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              Configure AI for ordering
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  )

  // --- All Complete State ---
  const completeState = completedAll && (
    <Card className="rounded-xl border-success/20 bg-success/5">
      <CardContent className="p-4 text-center">
        <div className="size-10 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
          <Check className="size-5 text-success" aria-hidden="true" />
        </div>
        <h3 className="font-bold text-foreground text-sm mb-1">Path Complete!</h3>
        <p className="text-xs text-muted-foreground mb-3">
          You&apos;ve completed all courses in this path.
        </p>
        <Button variant="brand-outline" size="sm" asChild>
          <Link to="/learning-paths">Explore More Paths</Link>
        </Button>
      </CardContent>
    </Card>
  )

  // --- Study Tip ---
  const studyTipSection = filteredTip && (
    <div className="p-4 bg-gradient-to-br from-brand to-brand-hover rounded-xl text-brand-foreground">
      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block">
        Study Tip
      </span>
      <h4 className="font-bold text-sm mb-1 italic">&quot;{filteredTip.text}&quot;</h4>
      <p className="text-brand-foreground/80 text-xs leading-relaxed">{filteredTip.detail}</p>
    </div>
  )

  return (
    <aside className="space-y-4">
      {upNextSection}
      {focusSessionButton}
      {planMyWeekSection}
      {completeState}
      {aiOrderingSection}
      {studyTipSection}
    </aside>
  )
}
