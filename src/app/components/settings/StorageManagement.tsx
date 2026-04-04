// E69-S01: Storage Management Dashboard Card
// E69-S03: Cleanup Actions with Confirmation Dialogs
// Settings > Storage & Usage — visual breakdown of IndexedDB storage by category.

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart3,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Loader2,
  Info,
  Image,
  Brain,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router'
import { BarChart, Bar, YAxis, XAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Checkbox } from '@/app/components/ui/checkbox'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog'
import { formatFileSize } from '@/lib/format'
import { toast } from 'sonner'
import {
  getStorageOverview,
  getPerCourseUsage,
  STORAGE_CATEGORIES,
  estimateThumbnailCacheSize,
  estimateOrphanedEmbeddingsSize,
  clearThumbnailCache,
  removeOrphanedEmbeddings,
  deleteCourseDataWithCount,
  type StorageOverview,
  type StorageCategory,
  type CourseStorageEntry,
} from '@/lib/storageEstimate'
import { db } from '@/db'
import { PerCourseStorageTable } from './PerCourseStorageTable'

// --- Chart Config ---

const chartConfig: ChartConfig = {
  courses: { label: 'Courses', color: 'var(--chart-1)' },
  notes: { label: 'Notes', color: 'var(--chart-2)' },
  flashcards: { label: 'Flashcards', color: 'var(--chart-3)' },
  embeddings: { label: 'AI Search Data', color: 'var(--chart-4)' },
  thumbnails: { label: 'Thumbnails', color: 'var(--chart-5)' },
  transcripts: { label: 'Transcripts', color: 'var(--color-muted)' },
}

const DISMISS_KEY = 'storage-warning-dismissed'

// --- Shared Card Shell ---

function StorageCardShell({
  children,
  refreshButton,
}: {
  children: React.ReactNode
  refreshButton?: React.ReactNode
}) {
  return (
    <Card id="storage-management" data-testid="storage-management-section">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <BarChart3 className="size-5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg font-display leading-none">Storage & Usage</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor and manage your local data storage
              </p>
            </div>
          </div>
          {refreshButton}
        </div>
      </CardHeader>
      {children}
    </Card>
  )
}

// --- Inline Sub-Components ---

function QuotaWarningBanner({
  usagePercent,
  dismissed,
  onDismiss,
}: {
  usagePercent: number
  dismissed: boolean
  onDismiss: () => void
}) {
  const percent = Math.round(usagePercent * 100)

  if (usagePercent >= 0.95) {
    // Critical (95%+) — not dismissible
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4"
      >
        <AlertOctagon className="size-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive-soft-foreground">
            Storage almost full ({percent}%)
          </p>
          <p className="text-xs text-destructive-soft-foreground mt-1">
            You may not be able to save new data. Free up space to continue learning.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 border-destructive text-destructive hover:bg-destructive/20 min-h-[44px]"
          onClick={() => {
            document.getElementById('cleanup-actions')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          Free Up Space
        </Button>
      </div>
    )
  }

  if (usagePercent >= 0.8 && !dismissed) {
    // Warning (80-94%)
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex items-start gap-3 rounded-lg border border-warning bg-warning/10 p-4"
      >
        <AlertTriangle className="size-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-medium text-warning">Storage is getting full ({percent}%)</p>
          <p className="text-xs text-warning mt-1">
            Consider cleaning up unused data to free space.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0 text-warning hover:bg-warning/10 min-h-[44px]"
          onClick={onDismiss}
          aria-label="Dismiss storage warning"
        >
          Dismiss
        </Button>
      </div>
    )
  }

  return null
}

function StorageOverviewBar({ overview }: { overview: StorageOverview }) {
  const percent = Math.round(overview.usagePercent * 100)
  const hasData = overview.categorizedTotal > 0

  // Build single data row for stacked bar
  const chartData = [
    STORAGE_CATEGORIES.reduce(
      (acc, cat) => {
        const found = overview.categories.find(c => c.category === cat)
        acc[cat] = found?.sizeBytes ?? 0
        return acc
      },
      {} as Record<string, number>
    ),
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Total Usage: ~{formatFileSize(overview.totalUsage)} of ~
        {formatFileSize(overview.totalQuota)} ({percent}%)
      </p>

      {hasData ? (
        <ChartContainer
          config={chartConfig}
          className="h-8 w-full"
          aria-label="Storage usage breakdown chart"
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barSize={32}
          >
            <XAxis type="number" hide />
            <YAxis type="category" hide />
            <ChartTooltip
              content={
                <ChartTooltipContent formatter={value => `~${formatFileSize(value as number)}`} />
              }
            />
            {STORAGE_CATEGORIES.map(cat => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="storage"
                fill={chartConfig[cat].color}
                radius={0}
              />
            ))}
          </BarChart>
        </ChartContainer>
      ) : null}

      {/* Screen reader alternative */}
      <table className="sr-only">
        <caption>Storage usage by category</caption>
        <thead>
          <tr>
            <th>Category</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {overview.categories.map(cat => (
            <tr key={cat.category}>
              <td>{cat.label}</td>
              <td>~{formatFileSize(cat.sizeBytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CategoryBreakdownLegend({ overview }: { overview: StorageOverview }) {
  const nonEmpty = overview.categories.filter(c => c.sizeBytes > 0)

  if (nonEmpty.length === 0) return null

  return (
    <div role="list" className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {nonEmpty.map(cat => {
        const percent =
          overview.totalUsage > 0 ? Math.round((cat.sizeBytes / overview.totalUsage) * 100) : 0

        return (
          <div
            key={cat.category}
            role="listitem"
            className="rounded-lg border border-border/50 bg-surface-elevated p-3"
          >
            <div className="flex items-center gap-2 mb-1">
              {/* inline-style-ok — chart color CSS variable cannot be expressed as static Tailwind class */}
              <span
                className="size-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: chartConfig[cat.category as StorageCategory]?.color,
                }}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground truncate">{cat.label}</span>
            </div>
            <p className="text-sm font-medium tabular-nums">~{formatFileSize(cat.sizeBytes)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{percent}%</p>
          </div>
        )
      })}
    </div>
  )
}

// --- Cleanup Actions Section (E69-S03) ---

function CleanupActionsSection({ onRefresh }: { onRefresh: () => void }) {
  const [thumbnailSize, setThumbnailSize] = useState<number>(0)
  const [orphanInfo, setOrphanInfo] = useState<{ count: number; bytes: number }>({
    count: 0,
    bytes: 0,
  })
  const [clearingThumbnails, setClearingThumbnails] = useState(false)
  const [removingOrphans, setRemovingOrphans] = useState(false)
  const [deletingCourses, setDeletingCourses] = useState(false)
  const [courseList, setCourseList] = useState<{ id: string; name: string }[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [courseDialogOpen, setCourseDialogOpen] = useState(false)

  // Load estimated savings on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [thumbSize, orphans] = await Promise.all([
          estimateThumbnailCacheSize(),
          estimateOrphanedEmbeddingsSize(),
        ])
        if (!cancelled) {
          setThumbnailSize(thumbSize)
          setOrphanInfo(orphans)
        }
      } catch {
        // silent-catch-ok — estimation failure shows 0
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleClearThumbnails() {
    setClearingThumbnails(true)
    try {
      const result = await clearThumbnailCache()
      toast.success(`Cleared ~${formatFileSize(result.bytesFreed)} of thumbnail cache`)
      setThumbnailSize(0)
      onRefresh()
    } catch (err) {
      toast.error(
        `Failed to clear thumbnail cache: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setClearingThumbnails(false)
    }
  }

  async function handleRemoveOrphans() {
    setRemovingOrphans(true)
    try {
      const result = await removeOrphanedEmbeddings()
      toast.success(
        `Removed ${result.count} orphaned embeddings (~${formatFileSize(result.bytesFreed)})`
      )
      setOrphanInfo({ count: 0, bytes: 0 })
      onRefresh()
    } catch (err) {
      toast.error(
        `Failed to remove orphaned embeddings: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setRemovingOrphans(false)
    }
  }

  async function loadCourseList() {
    try {
      const courses = await db.importedCourses.toArray()
      setCourseList(courses.map(c => ({ id: c.id, name: c.name ?? c.id })))
    } catch {
      // silent-catch-ok — empty list on failure
      setCourseList([])
    }
  }

  function handleCourseToggle(courseId: string, checked: boolean) {
    setSelectedCourses(prev => {
      const next = new Set(prev)
      if (checked) next.add(courseId)
      else next.delete(courseId)
      return next
    })
  }

  async function handleDeleteCourses() {
    if (selectedCourses.size === 0) return
    setDeletingCourses(true)
    try {
      const result = await deleteCourseDataWithCount(Array.from(selectedCourses))
      toast.success(
        `Deleted ${result.count} course(s), freed ~${formatFileSize(result.bytesFreed)}`
      )
      setSelectedCourses(new Set())
      setCourseDialogOpen(false)
      onRefresh()
    } catch (err) {
      toast.error(
        `Failed to delete course data: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setDeletingCourses(false)
    }
  }

  return (
    <div id="cleanup-actions" className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Cleanup Actions</h3>

      {/* Thumbnail Cache Card */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-soft p-2">
            <Image className="size-4 text-brand-soft-foreground" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Clear Thumbnail Cache</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Remove cached course thumbnails. They will regenerate on next view.
            </p>
            <p className="text-xs font-medium text-success mt-1">
              Estimated savings: ~{formatFileSize(thumbnailSize)}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 min-h-[44px]"
                disabled={clearingThumbnails}
              >
                {clearingThumbnails ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : null}
                Clear Cache
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear thumbnail cache?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all cached course thumbnails (~
                  {formatFileSize(thumbnailSize)}). Thumbnails will regenerate automatically when
                  you view a course.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearThumbnails}>Clear Cache</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Orphaned Embeddings Card */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-soft p-2">
            <Brain className="size-4 text-brand-soft-foreground" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Remove Unused AI Search Data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Delete orphaned embeddings whose source notes no longer exist.
            </p>
            <p className="text-xs font-medium text-success mt-1">
              Estimated savings: ~{formatFileSize(orphanInfo.bytes)}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 min-h-[44px]"
                disabled={removingOrphans}
              >
                {removingOrphans ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Remove Orphaned
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove orphaned embeddings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove {orphanInfo.count} orphaned AI search embeddings (~
                  {formatFileSize(orphanInfo.bytes)}) whose source notes have been deleted. This
                  will not affect search for existing notes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveOrphans}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Delete Course Data Card */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2">
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Delete Course Data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently remove all data for selected courses including notes, flashcards, and
              progress.
            </p>
          </div>
          <Dialog
            open={courseDialogOpen}
            onOpenChange={open => {
              setCourseDialogOpen(open)
              if (open) {
                loadCourseList()
                setSelectedCourses(new Set())
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="flex-shrink-0 min-h-[44px]"
                disabled={deletingCourses}
              >
                {deletingCourses ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Select Courses...
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Delete course data</DialogTitle>
                <DialogDescription>
                  Select courses to permanently delete. This removes all associated data including
                  videos, notes, flashcards, and progress. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-2 py-2">
                {courseList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No imported courses found.
                  </p>
                ) : (
                  courseList.map(course => (
                    <label
                      key={course.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedCourses.has(course.id)}
                        onCheckedChange={checked =>
                          handleCourseToggle(course.id, checked === true)
                        }
                      />
                      <span className="text-sm truncate">{course.name}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedCourses.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedCourses.size} course(s) selected
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCourseDialogOpen(false)}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteCourses}
                  disabled={selectedCourses.size === 0 || deletingCourses}
                  className="min-h-[44px]"
                >
                  {deletingCourses ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                  Delete Selected ({selectedCourses.size})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

export function StorageManagement() {
  const [overview, setOverview] = useState<StorageOverview | null>(null)
  const [perCourse, setPerCourse] = useState<CourseStorageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const [warningDismissed, setWarningDismissed] = useState(false)

  const loadAll = useCallback(async () => {
    const [overviewData, courseData] = await Promise.all([
      getStorageOverview(),
      getPerCourseUsage(),
    ])
    return { overviewData, courseData }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { overviewData, courseData } = await loadAll()
        if (!cancelled) {
          setOverview(overviewData)
          setPerCourse(courseData)
        }
      } catch {
        // silent-catch-ok — Error state rendered via setError(true) below
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Read dismiss state from sessionStorage
    try {
      setWarningDismissed(sessionStorage.getItem(DISMISS_KEY) === 'true')
    } catch {
      // silent-catch-ok — sessionStorage may be unavailable
    }

    load()
    return () => {
      cancelled = true
    }
  }, [loadAll])

  async function handleRefresh() {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    setError(false)
    try {
      const { overviewData, courseData } = await loadAll()
      if (!overviewData.apiAvailable && overview?.apiAvailable) {
        toast.error('Unable to refresh storage data')
      }
      setOverview(overviewData)
      setPerCourse(courseData)
    } catch {
      setError(true)
      toast.error('Unable to refresh storage data')
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }

  function handleDismissWarning() {
    setWarningDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      // silent-catch-ok — sessionStorage may be unavailable
    }
  }

  const refreshButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRefresh}
      disabled={refreshing}
      className="gap-2 min-h-[44px]"
      aria-label="Refresh storage estimates"
    >
      {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Refresh
    </Button>
  )

  // --- Loading State ---

  if (loading) {
    return (
      <StorageCardShell>
        <CardContent className="p-6 space-y-4" aria-busy="true">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </StorageCardShell>
    )
  }

  // --- Error State ---

  if (error && !overview) {
    return (
      <StorageCardShell refreshButton={refreshButton}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Info className="size-5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm">Unable to estimate storage. Try refreshing.</p>
          </div>
        </CardContent>
      </StorageCardShell>
    )
  }

  // --- API Unavailable State ---

  if (overview && !overview.apiAvailable) {
    return (
      <StorageCardShell refreshButton={refreshButton}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Info className="size-5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm">Storage estimation is not available in this browser.</p>
          </div>
        </CardContent>
      </StorageCardShell>
    )
  }

  // --- Empty State (with warning banners — usagePercent may be high even if no Knowlune data) ---

  const isEmpty = overview && overview.categorizedTotal === 0

  if (isEmpty) {
    return (
      <StorageCardShell refreshButton={refreshButton}>
        <CardContent className="p-6 space-y-6">
          {overview && overview.usagePercent >= 0.8 && (
            <QuotaWarningBanner
              usagePercent={overview.usagePercent}
              dismissed={warningDismissed}
              onDismiss={handleDismissWarning}
            />
          )}
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No learning data stored yet. Import a course to get started!
            </p>
            <Button variant="outline" size="sm" className="min-h-[44px]" asChild>
              <Link to="/courses">Browse Courses</Link>
            </Button>
          </div>
        </CardContent>
      </StorageCardShell>
    )
  }

  // --- Normal State ---

  return (
    <StorageCardShell refreshButton={refreshButton}>
      <CardContent className="p-6 space-y-6" aria-live="polite">
        {overview && (
          <>
            <QuotaWarningBanner
              usagePercent={overview.usagePercent}
              dismissed={warningDismissed}
              onDismiss={handleDismissWarning}
            />
            <StorageOverviewBar overview={overview} />
            <CategoryBreakdownLegend overview={overview} />
            <PerCourseStorageTable courses={perCourse} onRefresh={handleRefresh} />
            <CleanupActionsSection onRefresh={handleRefresh} />
          </>
        )}
      </CardContent>
    </StorageCardShell>
  )
}
