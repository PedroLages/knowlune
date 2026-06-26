import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { InlineCoursePicker, suggestNameFromTags } from '@/app/components/figma/InlineCoursePicker'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { BulkImportDialog } from '@/app/components/figma/BulkImportDialog'
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import { useImportWizardTrigger } from '@/app/hooks/useImportWizardTrigger'
import { PremiumGate } from '@/app/components/PremiumGate'
import { toast } from 'sonner'
import { Loader2, Sparkles, Search, ArrowDownToLine, Trash2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import type { ImportedCourse } from '@/data/types'
import type { GoalPathEntry } from '@/ai/learningPath/generatePathFromGoal'

/** Custom event name dispatched after a successful course import (Unit 3, R9). */
export const COURSE_IMPORTED = 'course-imported' as const

export interface CourseImportedEvent extends CustomEvent {
  detail: { courseId: string }
}

interface CurriculumComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mode: 'manual' shows course picker; 'ai' shows goal-to-path flow */
  mode?: 'manual' | 'ai'
  /** Pre-filled goal text for AI mode (used by AILearningPath wrapper) */
  initialGoal?: string
  /** Base path for post-creation redirect (defaults to "/learning-tracks"). */
  redirectBase?: string
}

/**
 * AI preview state — component-local, not persisted until explicit save.
 */
interface AIPreviewState {
  pathName: string
  pathDescription: string
  entries: GoalPathEntry[]
  rationale: string
}

export function CurriculumComposer({
  open,
  onOpenChange,
  mode = 'manual',
  initialGoal = '',
  redirectBase = '/learning-tracks',
}: CurriculumComposerProps) {
  const navigate = useNavigate()
  const createPathWithCourses = useLearningPathStore(s => s.createPathWithCourses)
  const loadPaths = useLearningPathStore(s => s.loadPaths)
  const loadImportedCourses = useCourseImportStore(s => s.loadImportedCourses)
  const importedCourses = useCourseImportStore(s => s.importedCourses)
  const isCoursesLoaded = useCourseImportStore(s => s.isCoursesLoaded)

  // Manual mode state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nameAutoFilled = useRef(false)

  // AI mode state
  const [goal, setGoal] = useState(initialGoal)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiPreview, setAiPreview] = useState<AIPreviewState | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isMobile = useIsMobile()
  const {
    trigger: handleImportTrigger,
    isOpen: importWizardOpen,
    setIsOpen: setImportWizardOpen,
  } = useImportWizardTrigger()

  const isAiMode = mode === 'ai'

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setSelectedCourseIds([])
      setIsSubmitting(false)
      nameAutoFilled.current = false
      setGoal(initialGoal || '')
      setAiPreview(null)
      setAiError(null)
      setIsGenerating(false)
    }
  }, [open, initialGoal])

  // Auto-name suggestion: when courses are selected and name is empty, suggest a name
  useEffect(() => {
    if (selectedCourseIds.length > 0 && !name.trim() && !nameAutoFilled.current) {
      const selectedItems = importedCourses
        .filter(c => selectedCourseIds.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          type: 'imported' as const,
          authorName: undefined,
          thumbnailUrl: undefined,
          tags: c.tags ?? [],
        }))
      const suggested = suggestNameFromTags(selectedItems, importedCourses)
      if (suggested !== 'Untitled Path') {
        setName(suggested)
        nameAutoFilled.current = true
      }
    }
  }, [selectedCourseIds, name, importedCourses])

  // Listen for course-imported event from ImportWizardDialog
  useEffect(() => {
    function handleCourseImported(e: Event) {
      const event = e as CourseImportedEvent
      if (event.detail?.courseId) {
        // Add the new course to the selection
        setSelectedCourseIds(prev => {
          if (prev.includes(event.detail.courseId)) return prev
          return [...prev, event.detail.courseId]
        })
        // Refresh imported courses to include the new one
        // silent-catch-ok: store refresh failure is non-critical; courses are already in state
        loadImportedCourses().catch(() => {})
      }
    }
    window.addEventListener(COURSE_IMPORTED, handleCourseImported)
    return () => window.removeEventListener(COURSE_IMPORTED, handleCourseImported)
  }, [loadImportedCourses])

  // Handle import course action
  const handleImportCourse = useCallback(() => handleImportTrigger(null), [handleImportTrigger])

  // Batch import state and handlers
  const [batchImportOpen, setBatchImportOpen] = useState(false)

  const handleBatchImport = useCallback(() => setBatchImportOpen(true), [])

  const handleBatchImportComplete = useCallback(
    (importedIds: string[]) => {
      // Add all imported course IDs to the current selection
      setSelectedCourseIds(prev => {
        const unique = importedIds.filter(id => !prev.includes(id))
        if (unique.length === 0) return prev
        return [...prev, ...unique]
      })
      // Refresh imported courses to include new ones
      // silent-catch-ok: store refresh failure is non-critical
      loadImportedCourses().catch(() => {})
    },
    [loadImportedCourses]
  )

  // --- AI Goal Generation ---
  const handleGenerate = useCallback(async () => {
    if (!goal.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsGenerating(true)
    setAiError(null)
    setAiPreview(null)

    try {
      const { generatePathFromGoal } = await import('@/ai/learningPath/generatePathFromGoal')
      const result = await generatePathFromGoal(goal.trim(), importedCourses, {
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setAiPreview(result)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Failed to generate learning path'
        setAiError(message)
        if (message.includes('not configured')) {
          setAiError(
            'AI is not configured. Configure your AI provider in Settings to generate learning paths.'
          )
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false)
      }
    }
  }, [goal, importedCourses])

  // Remove a course from AI preview
  const handleRemovePreviewCourse = useCallback((index: number) => {
    setAiPreview(prev => {
      if (!prev) return prev
      const entries = prev.entries.filter((_, i) => i !== index)
      // Renumber positions
      return {
        ...prev,
        entries: entries.map((e, i) => ({ ...e, position: i + 1 })),
      }
    })
  }, [])

  // Build a map of courseId to course data for rendering
  const courseMap = useMemo(() => {
    const map = new Map<string, ImportedCourse>()
    for (const c of importedCourses) {
      map.set(c.id, c)
    }
    return map
  }, [importedCourses])

  // --- Save AI preview as a real path ---
  const handleSaveAIPath = useCallback(async () => {
    if (!aiPreview) return

    const matchedEntries = aiPreview.entries.filter(e => !e.isGap && e.courseId)
    if (matchedEntries.length === 0) {
      toast.error('No courses to save — all entries are gaps. Import courses first.')
      return
    }

    setIsSubmitting(true)
    try {
      const courses = matchedEntries.map(e => ({
        courseId: e.courseId!,
        courseType: 'imported' as const,
      }))

      const path = await createPathWithCourses(
        aiPreview.pathName || 'AI Learning Path',
        aiPreview.pathDescription || undefined,
        courses
      )
      await loadPaths()
      toast.success(`Created "${aiPreview.pathName}"`)
      onOpenChange(false)
      navigate(`${redirectBase}/${path.id}`)
    } catch {
      toast.error('Failed to create learning path')
    } finally {
      setIsSubmitting(false)
    }
  }, [aiPreview, createPathWithCourses, loadPaths, onOpenChange, navigate, redirectBase])

  // --- Submit manual path ---
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (selectedCourseIds.length === 0) return

      const finalName = name.trim() || 'Untitled Path'
      setIsSubmitting(true)

      try {
        const courses = selectedCourseIds.map(id => ({
          courseId: id,
          courseType: 'imported' as const,
        }))

        const path = await createPathWithCourses(
          finalName,
          description.trim() || undefined,
          courses
        )
        await loadPaths()
        toast.success(`Created "${finalName}"`)
        onOpenChange(false)
        navigate(`${redirectBase}/${path.id}`)
      } catch {
        toast.error('Failed to create learning path')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      name,
      description,
      selectedCourseIds,
      createPathWithCourses,
      loadPaths,
      onOpenChange,
      navigate,
      redirectBase,
    ]
  )

  const canGenerate = goal.trim().length > 0 && !isGenerating

  // --- Manual mode form fields ---
  const stableExcludeCourseIds = useMemo(() => new Set<string>(), [])

  const pickerContent = (
    <InlineCoursePicker
      mode="multiSelect"
      excludeCourseIds={stableExcludeCourseIds}
      onAdd={() => {}}
      selectedCourseIds={selectedCourseIds}
      onSelectionChange={setSelectedCourseIds}
      showRecentlyImported
      showSuggestedNext={false}
      showImportAction
      onImportCourse={handleImportCourse}
      showBatchImportAction
      onBatchImport={handleBatchImport}
      loading={!isCoursesLoaded}
      hideConfirmButton
    />
  )

  const formFieldsContent = (
    <>
      <div className="space-y-2">
        <Label htmlFor="composer-name">Name</Label>
        <Input
          id="composer-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Web Development Fundamentals"
          autoFocus
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="composer-description">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="composer-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="A brief description of what this path covers..."
          rows={3}
          maxLength={500}
        />
      </div>
      <div className="space-y-2">
        <Label>Courses</Label>
        {pickerContent}
      </div>
    </>
  )

  // --- AI mode content ---
  const aiModeContent = (
    <PremiumGate featureLabel="AI path generation">
      <div className="space-y-4">
        {/* Goal input */}
        <div className="space-y-2">
          <Label htmlFor="ai-goal">What do you want to learn?</Label>
          <Textarea
            id="ai-goal"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g., I want to become a full-stack web developer in 6 months..."
            rows={3}
            maxLength={500}
            autoFocus
            disabled={isGenerating || !!aiPreview}
          />
          <p className="text-xs text-muted-foreground">
            Describe your learning goal and the AI will build a path from your library, plus gap
            analysis for topics you are missing.
          </p>
        </div>

        {/* Generate button — shown when no preview yet */}
        {!aiPreview && (
          <Button
            type="button"
            variant="brand"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" aria-hidden="true" />
                Generate Path
              </>
            )}
          </Button>
        )}

        {/* Error display */}
        {aiError && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{aiError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                setAiError(null)
                setAiPreview(null)
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {/* AI Preview */}
        {aiPreview && (
          <div className="border border-border rounded-xl overflow-hidden">
            {/* Preview header */}
            <div className="bg-brand-soft/20 p-4 border-b border-border">
              <div className="space-y-2">
                <Input
                  value={aiPreview.pathName}
                  onChange={e =>
                    setAiPreview(prev => (prev ? { ...prev, pathName: e.target.value } : prev))
                  }
                  placeholder="Path name"
                  className="font-semibold text-lg border-none bg-transparent px-0 py-0 h-auto focus-visible:ring-0"
                  maxLength={100}
                />
                <Textarea
                  value={aiPreview.pathDescription}
                  onChange={e =>
                    setAiPreview(prev =>
                      prev ? { ...prev, pathDescription: e.target.value } : prev
                    )
                  }
                  placeholder="Path description"
                  className="text-sm text-muted-foreground border-none bg-transparent px-0 py-0 resize-none focus-visible:ring-0"
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>

            {/* Preview entry list */}
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {aiPreview.entries.map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-3 p-3 hover:bg-muted/30',
                    entry.isGap && 'bg-gold-muted/5'
                  )}
                >
                  {/* Position badge */}
                  <span className="flex-none size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground mt-0.5">
                    {entry.position}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    {entry.isGap ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {entry.gapTopic || 'Unknown Topic'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-muted/30 text-gold font-semibold uppercase">
                          Gap
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium">
                        {courseMap.get(entry.courseId || '')?.name || 'Unknown Course'}
                      </span>
                    )}

                    {/* Justification */}
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {entry.justification}
                    </p>

                    {/* Gap entry actions */}
                    {entry.isGap && (
                      <div className="flex gap-1 mt-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            // Open import wizard — ImportWizardDialog will handle the import
                            handleImportTrigger(null)
                          }}
                        >
                          <Search className="size-3 mr-1" aria-hidden="true" />
                          Search
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => handleImportTrigger(null)}
                        >
                          <ArrowDownToLine className="size-3 mr-1" aria-hidden="true" />
                          Import
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="flex-none size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemovePreviewCourse(i)}
                    aria-label={`Remove ${entry.isGap ? entry.gapTopic : 'course'} from path`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Preview footer — info + regenerate */}
            <div className="p-3 border-t border-border flex items-center justify-between bg-surface-sunken/30">
              <p className="text-xs text-muted-foreground">
                {aiPreview.entries.filter(e => !e.isGap).length} courses from your library &middot;{' '}
                {aiPreview.entries.filter(e => e.isGap).length} gaps
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setAiPreview(null)
                  setAiError(null)
                }}
                disabled={isGenerating}
              >
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>
    </PremiumGate>
  )

  // --- Derived state ---
  const canSubmitManual = selectedCourseIds.length > 0 && !isSubmitting

  // --- Buttons ---
  const createPathButton =
    isAiMode && aiPreview ? (
      <Button
        type="button"
        variant="brand"
        disabled={
          isSubmitting || aiPreview.entries.filter(e => !e.isGap && e.courseId).length === 0
        }
        onClick={handleSaveAIPath}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
            Creating...
          </>
        ) : (
          'Create Path'
        )}
      </Button>
    ) : (
      <Button type="submit" variant="brand" disabled={!canSubmitManual}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
            Creating...
          </>
        ) : (
          'Create Path'
        )}
      </Button>
    )
  const title = isAiMode ? 'AI Learning Path' : 'Create Learning Path'
  const desc = isAiMode
    ? 'Describe your learning goal and the AI will build a path for you.'
    : 'Build a learning path by selecting courses from your library.'

  const cancelButton = (
    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
      Cancel
    </Button>
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="h-[90vh] p-0">
            <form
              onSubmit={e => {
                // Prevent form submit in AI mode — save is button-driven
                if (isAiMode) {
                  e.preventDefault()
                  return
                }
                handleSubmit(e)
              }}
              className="flex flex-col h-full"
            >
              <SheetHeader className="p-6 pb-0">
                <SheetTitle>{title}</SheetTitle>
                <SheetDescription>{desc}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {isAiMode ? aiModeContent : formFieldsContent}
              </div>
              <SheetFooter className="p-6 border-t border-border">
                <div className="flex gap-2 w-full [&>button]:flex-1">
                  {cancelButton}
                  {createPathButton}
                </div>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
            <form
              onSubmit={e => {
                if (isAiMode) {
                  e.preventDefault()
                  return
                }
                handleSubmit(e)
              }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{desc}</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto min-h-0 py-4 space-y-4">
                {isAiMode ? aiModeContent : formFieldsContent}
              </div>
              <DialogFooter className="gap-2 pt-4 border-t border-border">
                {cancelButton}
                {createPathButton}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Import Wizard */}
      <ImportWizardDialog open={importWizardOpen} onOpenChange={setImportWizardOpen} />

      {/* Batch Import Dialog */}
      <BulkImportDialog
        open={batchImportOpen}
        onOpenChange={setBatchImportOpen}
        onSingleImport={handleImportCourse}
        onComplete={handleBatchImportComplete}
      />
    </>
  )
}
