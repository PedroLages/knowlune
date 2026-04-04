import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Shuffle, ArrowLeft } from 'lucide-react'
import { useReviewStore } from '@/stores/useReviewStore'
import { useNoteStore } from '@/stores/useNoteStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { isDue } from '@/lib/spacedRepetition'
import { useCourseStore } from '@/stores/useCourseStore'
import { InterleavedCard } from '@/app/components/figma/InterleavedCard'
import { InterleavedSummary } from '@/app/components/figma/InterleavedSummary'
import { EmptyState as EmptyStateComponent } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/app/components/ui/alert-dialog'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/app/components/ui/empty'
import type { Note, ReviewRating } from '@/data/types'
import type { InterleavedSessionSummary } from '@/stores/useReviewStore'
import { dispatchFocusRequest, dispatchFocusRelease } from '@/lib/focusModeEvents'
import { getSettings } from '@/lib/settings'

type SessionPhase = 'loading' | 'single-course-prompt' | 'reviewing' | 'summary' | 'empty'

/** Build a combined course name map from static + imported courses */
function buildCourseNameMap(
  allCourses: { id: string; title: string }[],
  importedCourses: { id: string; name: string }[]
): Map<string, string> {
  const map = new Map(allCourses.map(c => [c.id, c.title]))
  for (const c of importedCourses) {
    map.set(c.id, c.name)
  }
  return map
}

export function InterleavedReview() {
  const allCourses = useCourseStore(s => s.courses)
  const navigate = useNavigate()

  // Stores
  const {
    allReviews,
    isLoading: reviewsLoading,
    loadReviews,
    interleavedQueue,
    interleavedIndex,
    isInterleavedActive,
    startInterleavedSession,
    rateInterleavedNote,
    endInterleavedSession,
    resetInterleavedSession,
  } = useReviewStore()
  const { notes, isLoading: notesLoading, loadNotes } = useNoteStore()
  const { importedCourses, loadImportedCourses } = useCourseImportStore()

  // Local state
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [isFlipped, setIsFlipped] = useState(false)
  const [summary, setSummary] = useState<InterleavedSessionSummary | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [dataLoaded, setDataLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Derived data
  const noteMap = useMemo(() => {
    const map = new Map<string, Note>()
    for (const note of notes) {
      if (!note.deleted) map.set(note.id, note)
    }
    return map
  }, [notes])

  const courseNameMap = useMemo(
    () => buildCourseNameMap(allCourses, importedCourses),
    [allCourses, importedCourses]
  )

  // Refresh `now` every 60s so retention percentages stay current during long sessions
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Load data on mount
  useEffect(() => {
    Promise.all([loadReviews(), loadNotes(), loadImportedCourses()])
      .then(() => setDataLoaded(true))
      .catch(err => {
        // silent-catch-ok — error state handled by setLoadError UI with retry button
        console.error('[InterleavedReview] Failed to load data:', err)
        setLoadError(true)
      })
    return () => {
      // Cleanup session on unmount if still active
      resetInterleavedSession()
    }
  }, [loadReviews, loadNotes, loadImportedCourses, resetInterleavedSession])

  // Release focus mode on unmount to prevent stuck focus state (E65-S04)
  useEffect(() => {
    return () => {
      dispatchFocusRelease()
    }
  }, [])

  const startSession = useCallback(() => {
    startInterleavedSession(noteMap, now)
    setIsFlipped(false)
    setPhase('reviewing')

    // Auto-activate focus mode if enabled (E65-S04)
    // Interleaved review uses the flashcard auto setting
    const settings = getSettings()
    if (settings.focusAutoFlashcard !== false) {
      requestAnimationFrame(() => {
        dispatchFocusRequest('interleaved-review', 'interleaved-review')
      })
    }
  }, [startInterleavedSession, noteMap, now])

  // Determine initial phase after data loads (runs once)
  // Does NOT re-run during an active session — handleRate manages
  // phase transitions from 'reviewing' → 'summary'.
  const phaseInitialised = useRef(false)
  useEffect(() => {
    if (!dataLoaded || reviewsLoading || notesLoading) return
    if (phaseInitialised.current) return
    phaseInitialised.current = true

    // If session is already active (navigated away and back), resume
    if (isInterleavedActive) {
      setPhase('reviewing')
      return
    }

    const dueReviews = allReviews.filter(r => isDue(r, now))
    if (dueReviews.length === 0) {
      setPhase('empty')
      return
    }

    // Check unique courses among due notes
    const courseIds = new Set(
      dueReviews.map(r => noteMap.get(r.noteId)?.courseId).filter(Boolean) as string[]
    )

    if (courseIds.size <= 1) {
      setPhase('single-course-prompt')
    } else {
      startSession()
    }
  }, [
    dataLoaded,
    reviewsLoading,
    notesLoading,
    allReviews,
    noteMap,
    now,
    isInterleavedActive,
    startSession,
  ])

  const handleFlip = useCallback(() => {
    setIsFlipped(true)
  }, [])

  const handleRate = useCallback(
    async (rating: ReviewRating) => {
      await rateInterleavedNote(rating, noteMap, now)
      setIsFlipped(false)

      // Check if session is complete
      const { interleavedIndex: nextIndex, interleavedQueue: queue } = useReviewStore.getState()
      if (nextIndex >= queue.length) {
        const sessionSummary = endInterleavedSession(courseNameMap)
        setSummary(sessionSummary)
        setPhase('summary')
        dispatchFocusRelease()
      } else {
        // Focus the card after flip animation completes (500ms transition)
        setTimeout(() => {
          const frontFace = cardRef.current?.querySelector<HTMLElement>(
            '[data-testid="interleaved-card-front"]'
          )
          frontFace?.focus()
        }, 500)
      }
    },
    [rateInterleavedNote, endInterleavedSession, noteMap, courseNameMap, now]
  )

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== 'reviewing') return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when a dialog or button is focused
      const target = e.target as HTMLElement
      if (target.closest('[role="alertdialog"]')) return

      if (!isFlipped && (e.key === ' ' || e.key === 'Enter')) {
        // Only flip if the card front or its container has focus
        if (target.closest('[data-testid="interleaved-card-front"]') || target === document.body) {
          e.preventDefault()
          setIsFlipped(true)
        }
      }

      if (isFlipped) {
        const ratingKeys: Record<string, ReviewRating> = {
          '1': 'again',
          '2': 'hard',
          '3': 'good',
          '4': 'easy',
        }
        const rating = ratingKeys[e.key]
        if (rating) {
          e.preventDefault()
          handleRate(rating)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isFlipped, handleRate])

  // --- Render phases ---

  if (loadError) {
    return (
      <main data-testid="interleaved-review" className="space-y-6 p-1">
        <PageHeader onBack={() => navigate('/review')} />
        <div className="mx-auto max-w-lg pt-12">
          <Empty className="border-none">
            <EmptyMedia variant="icon">
              <Shuffle className="size-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Failed to load review data</EmptyTitle>
              <EmptyDescription>
                Something went wrong loading your notes and reviews. Please try again.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              onClick={() => {
                setLoadError(false)
                setDataLoaded(false)
                Promise.all([loadReviews(), loadNotes(), loadImportedCourses()])
                  .then(() => setDataLoaded(true))
                  .catch(err => {
                    // silent-catch-ok — error state handled by setLoadError UI
                    console.error('[InterleavedReview] Retry failed:', err)
                    setLoadError(true)
                  })
              }}
            >
              Retry
            </Button>
          </Empty>
        </div>
      </main>
    )
  }

  if (phase === 'loading') {
    return (
      <DelayedFallback>
        <div className="space-y-6 p-1" aria-busy="true" aria-label="Loading interleaved review">
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-[280px] w-full max-w-lg rounded-2xl" />
        </div>
      </DelayedFallback>
    )
  }

  if (phase === 'empty') {
    return (
      <main data-testid="interleaved-review" className="space-y-6 p-1">
        <PageHeader onBack={() => navigate('/review')} />
        <div className="mx-auto max-w-lg pt-12">
          <EmptyStateComponent
            data-testid="empty-state-interleaved-review"
            icon={Shuffle}
            title="No notes due for review"
            description="Rate notes after studying to build your review queue, then come back for interleaved practice."
            actionLabel="Back to Review Queue"
            onAction={() => navigate('/review')}
          />
        </div>
      </main>
    )
  }

  if (phase === 'single-course-prompt') {
    return (
      <main data-testid="interleaved-review" className="space-y-6 p-1">
        <PageHeader onBack={() => navigate('/review')} />
        <AlertDialog open>
          <AlertDialogContent data-testid="single-course-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Interleaved Review Works Best with Multiple Courses
              </AlertDialogTitle>
              <AlertDialogDescription>
                Interleaved review works best with notes from multiple courses — mixing topics
                strengthens cross-topic connections and improves retention. You currently have notes
                due from only one course.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => navigate('/review')}>
                Return to Review Queue
              </AlertDialogCancel>
              <AlertDialogAction onClick={startSession}>Continue Anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    )
  }

  if (phase === 'summary' && summary) {
    return (
      <main data-testid="interleaved-review" className="space-y-6 p-1">
        <PageHeader onBack={() => navigate('/review')} />
        <InterleavedSummary
          summary={summary}
          onStartNew={() => {
            setSummary(null)
            startSession()
          }}
          onReturnToQueue={() => navigate('/review')}
        />
      </main>
    )
  }

  // --- Reviewing phase ---
  const currentRecord = interleavedQueue[interleavedIndex]
  const currentNote = currentRecord ? noteMap.get(currentRecord.noteId) : null
  const currentCourseName = currentNote
    ? (courseNameMap.get(currentNote.courseId) ?? 'Unknown Course')
    : ''
  const total = interleavedQueue.length
  const current = interleavedIndex + 1
  const progressPct = total > 0 ? (interleavedIndex / total) * 100 : 0

  return (
    <main
      data-testid="interleaved-review"
      className="space-y-6 p-1"
      ref={cardRef}
      data-focus-target="interleaved-review"
    >
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <PageHeader onBack={() => navigate('/review')} />
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            const sessionSummary = endInterleavedSession(courseNameMap)
            setSummary(sessionSummary)
            setPhase('summary')
            dispatchFocusRelease()
          }}
        >
          End Session
        </Button>
      </div>

      {/* Progress */}
      <div data-testid="interleaved-progress" className="mx-auto max-w-lg space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {current} / {total}
          </span>
          <span className="hidden text-xs sm:inline">
            Press{' '}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
              Space
            </kbd>{' '}
            to flip
            {isFlipped && (
              <>
                ,{' '}
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                  1
                </kbd>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                  2
                </kbd>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                  3
                </kbd>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                  4
                </kbd>{' '}
                to rate
              </>
            )}
          </span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Card */}
      {currentRecord && currentNote && (
        <InterleavedCard
          record={currentRecord}
          note={currentNote}
          courseName={currentCourseName}
          now={now}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          onRate={handleRate}
        />
      )}
    </main>
  )
}

function PageHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to review queue">
        <ArrowLeft className="size-5" />
      </Button>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Shuffle className="size-5" />
        </div>
        <h1 className="font-display text-2xl tracking-tight">Interleaved Review</h1>
      </div>
    </div>
  )
}
