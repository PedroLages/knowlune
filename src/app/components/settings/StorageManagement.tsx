// E69-S01: Storage Management Dashboard Card
// Settings > Storage & Usage — visual breakdown of IndexedDB storage by category.

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart3,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Loader2,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  MoreHorizontal,
} from 'lucide-react'
import { Link } from 'react-router'
import { BarChart, Bar, YAxis, XAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/app/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { formatFileSize } from '@/lib/format'
import { toast } from 'sonner'
import {
  getStorageOverview,
  getPerCourseUsage,
  clearCourseThumbnail,
  deleteCourseData,
  STORAGE_CATEGORIES,
  type StorageOverview,
  type StorageCategory,
  type CourseStorageEntry,
} from '@/lib/storageEstimate'

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
            document.getElementById('data-management')?.scrollIntoView({ behavior: 'smooth' })
          }}
          title="Cleanup actions coming in a future update"
        >
          View Storage
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

// --- Per-Course Storage Table (E69-S02) ---

type SortDirection = 'default' | 'asc' | 'desc'

function PerCourseStorageTable({
  courses,
  onRefresh,
}: {
  courses: CourseStorageEntry[]
  onRefresh: () => void
}) {
  const [sortDir, setSortDir] = useState<SortDirection>('default')
  const [visibleCount, setVisibleCount] = useState(10)
  const [dialogState, setDialogState] = useState<{
    type: 'clear-thumbnail' | 'delete-course'
    courseId: string
    courseName: string
    estimatedSize: number
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Sort logic
  const sorted = [...courses]
  if (sortDir === 'asc') {
    sorted.sort((a, b) => a.totalBytes - b.totalBytes)
  } else {
    // default and desc are both descending
    sorted.sort((a, b) => b.totalBytes - a.totalBytes)
  }

  const visible = sorted.slice(0, visibleCount)
  const hasMore = sorted.length > visibleCount

  function cycleSortDirection() {
    setSortDir(prev => {
      if (prev === 'default') return 'asc'
      if (prev === 'asc') return 'desc'
      return 'default'
    })
  }

  function getSortIcon() {
    if (sortDir === 'asc') return <ArrowUp className="size-4 text-brand" />
    if (sortDir === 'desc') return <ArrowDown className="size-4 text-brand" />
    return <ArrowUpDown className="size-4" />
  }

  function getAriaSortValue(): 'ascending' | 'descending' | 'none' {
    if (sortDir === 'asc') return 'ascending'
    if (sortDir === 'desc') return 'descending'
    return 'none'
  }

  async function handleClearThumbnail(courseId: string) {
    setActionLoading(true)
    try {
      const freed = await clearCourseThumbnail(courseId)
      toast.success(`Cleared thumbnail — freed ~${formatFileSize(freed)}`)
      onRefresh()
    } catch {
      toast.error('Failed to clear thumbnail')
    } finally {
      setActionLoading(false)
      setDialogState(null)
    }
  }

  async function handleDeleteCourse(courseId: string) {
    setActionLoading(true)
    try {
      const freed = await deleteCourseData([courseId])
      toast.success(`Deleted course data — freed ~${formatFileSize(freed)}`)
      onRefresh()
    } catch {
      toast.error('Failed to delete course data')
    } finally {
      setActionLoading(false)
      setDialogState(null)
    }
  }

  // Empty state
  if (courses.length === 0) {
    return (
      <div data-testid="per-course-table-empty">
        <p className="text-sm text-muted-foreground text-center py-4">No courses imported yet.</p>
      </div>
    )
  }

  return (
    <div data-testid="per-course-storage-table">
      <div className="overflow-x-auto">
        <Table>
          <TableCaption>Storage usage per course</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Course Name</TableHead>
              <TableHead aria-sort={getAriaSortValue()}>
                <button
                  onClick={cycleSortDirection}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  aria-label="Sort by total size"
                >
                  Total Size
                  {getSortIcon()}
                </button>
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                Media
              </TableHead>
              <TableHead className="hidden sm:table-cell">Notes</TableHead>
              <TableHead className="hidden sm:table-cell">Thumbnails</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(course => (
              <TableRow key={course.courseId} data-testid={`course-row-${course.courseId}`}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {course.courseName}
                </TableCell>
                <TableCell className="tabular-nums">~{formatFileSize(course.totalBytes)}</TableCell>
                <TableCell className="tabular-nums hidden sm:table-cell">
                  ~{formatFileSize(course.mediaBytes)}
                </TableCell>
                <TableCell className="tabular-nums hidden sm:table-cell">
                  ~{formatFileSize(course.notesBytes)}
                </TableCell>
                <TableCell className="tabular-nums hidden sm:table-cell">
                  ~{formatFileSize(course.thumbnailBytes)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Actions for ${course.courseName}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setDialogState({
                            type: 'clear-thumbnail',
                            courseId: course.courseId,
                            courseName: course.courseName,
                            estimatedSize: course.thumbnailBytes,
                          })
                        }
                      >
                        Clear thumbnails
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setDialogState({
                            type: 'delete-course',
                            courseId: course.courseId,
                            courseName: course.courseName,
                            estimatedSize: course.totalBytes,
                          })
                        }
                      >
                        Delete course data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount(prev => prev + 10)}
            className="min-h-[44px]"
          >
            Show more ({sorted.length - visibleCount} remaining)
          </Button>
        </div>
      )}

      {/* AlertDialog for clear thumbnail */}
      <AlertDialog
        open={dialogState?.type === 'clear-thumbnail'}
        onOpenChange={open => {
          if (!open) setDialogState(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear thumbnail?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the thumbnail for &ldquo;{dialogState?.courseName}&rdquo;
              (~{formatFileSize(dialogState?.estimatedSize ?? 0)} estimated). This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (dialogState) handleClearThumbnail(dialogState.courseId)
              }}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Clear thumbnail
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog for delete course data */}
      <AlertDialog
        open={dialogState?.type === 'delete-course'}
        onOpenChange={open => {
          if (!open) setDialogState(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all data for &ldquo;{dialogState?.courseName}&rdquo;
              (~{formatFileSize(dialogState?.estimatedSize ?? 0)} estimated), including videos, PDFs,
              notes, flashcards, and progress. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (dialogState) handleDeleteCourse(dialogState.courseId)
              }}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Delete course data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          </>
        )}
      </CardContent>
    </StorageCardShell>
  )
}
