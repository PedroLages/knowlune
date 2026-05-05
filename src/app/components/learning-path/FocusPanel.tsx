import { useState } from 'react'
import { Link } from 'react-router'
import { Lock, BookOpen, Sparkles, ChevronRight, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { PlanMyWeekButton } from '@/app/components/learning-path/PlanMyWeekButton'
import { PathScheduleList } from '@/app/components/learning-path/PathScheduleList'
import { isOrderSuggestionAvailable } from '@/ai/learningPath/suggestOrder'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

interface FocusPanelProps {
  pathId: string
  pathName: string
  entries: LearningPathEntry[]
  courseInfoMap: Map<string, PathCourseInfo>
  courseNames: Record<string, string>
  progress: PathProgressSummary
  isSuggesting: boolean
  onSuggestOrder: () => void
  /** Show reorder list callback (from parent) */
  onToggleCurriculum: () => void
  showCurriculum: boolean
}

/**
 * Unified focus panel for the roadmap detail page.
 * Combines "Up Next", "Plan My Week", "Suggest Order", and
 * a daily tip into one cohesive right-rail widget.
 */
export function FocusPanel({
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
}: FocusPanelProps) {
  const [expandedSection, setExpandedSection] = useState<'upnext' | 'plan' | null>(null)

  // Upcoming entries (not started, excluding unresolved gap entries)
  const upcomingEntries = entries.filter(e => {
    if (e.courseId === '') return false
    const info = courseInfoMap.get(e.courseId)
    return (info?.completionPct ?? 0) === 0
  })

  return (
    <aside className="space-y-6">
      {/* Up Next Section */}
      {upcomingEntries.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Up Next
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {upcomingEntries.length} remaining
              </span>
            </div>
            <div className="space-y-4">
              {upcomingEntries.slice(0, expandedSection === 'upnext' ? undefined : 3).map((entry, i) => {
                const info = courseInfoMap.get(entry.courseId)
                return (
                  <div
                    key={entry.courseId || `upcoming-${i}`}
                    className={cn('flex items-start gap-3', i > 0 && i < 3 && 'opacity-60')}
                  >
                    <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-foreground">
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
                className="text-xs text-brand hover:underline mt-3 font-medium"
                onClick={() => setExpandedSection(expandedSection === 'upnext' ? null : 'upnext')}
              >
                {expandedSection === 'upnext'
                  ? 'Show less'
                  : `Show all ${upcomingEntries.length} courses`}
              </button>
            )}
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={onToggleCurriculum}
            >
              {showCurriculum ? 'Hide Curriculum' : 'View Full Curriculum'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Suggest Order */}
      {entries.length >= 2 &&
        (isOrderSuggestionAvailable() ? (
          <button
            className="w-full bg-brand-soft p-5 rounded-2xl border border-brand/20 flex items-center justify-between group hover:bg-brand-muted transition-all text-left"
            onClick={onSuggestOrder}
            disabled={isSuggesting}
            data-testid="suggest-order-button"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-card flex items-center justify-center text-brand shadow-sm">
                {isSuggesting ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-5" aria-hidden="true" />
                )}
              </div>
              <span className="font-bold text-foreground text-sm">
                {isSuggesting ? 'Analyzing...' : 'Suggest Order'}
              </span>
            </div>
            <ChevronRight
              className="size-5 text-muted-foreground group-hover:text-brand transition-colors"
              aria-hidden="true"
            />
          </button>
        ) : (
          <Link
            to="/settings"
            className="w-full block bg-muted p-5 rounded-2xl border border-border"
            data-testid="suggest-order-settings-link"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-card flex items-center justify-center text-muted-foreground shadow-sm">
                <Settings className="size-5" aria-hidden="true" />
              </div>
              <span className="font-medium text-muted-foreground text-sm">
                Configure AI for ordering
              </span>
            </div>
          </Link>
        ))}

      {/* All Complete State */}
      {entries.length > 0 && progress.completionPct >= 100 && (
        <Card className="rounded-2xl border-success/20 bg-success/5">
          <CardContent className="p-6 text-center">
            <div className="size-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="size-6 text-success" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-foreground mb-1">Path Complete!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You&apos;ve completed all courses in this path.
            </p>
            <Button variant="brand-outline" size="sm" asChild>
              <Link to="/learning-paths">Explore More Paths</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan My Week */}
      <PlanMyWeekButton
        pathId={pathId}
        pathName={pathName}
        entries={entries}
        courseNames={courseNames}
        progress={progress}
      />
      <PathScheduleList pathId={pathId} />

      {/* Daily Tip */}
      <div className="p-5 bg-gradient-to-br from-brand to-brand-hover rounded-2xl text-brand-foreground">
        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full mb-3 inline-block">
          Study Tip
        </span>
        <h4 className="font-bold text-base mb-2 italic">
          &quot;Focus on one concept at a time.&quot;
        </h4>
        <p className="text-brand-foreground/80 text-sm leading-relaxed">
          Multitasking while learning reduces retention. Master each course before moving to the
          next.
        </p>
      </div>
    </aside>
  )
}
