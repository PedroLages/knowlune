// E69-S01: Storage Management Dashboard Card
// Settings > Storage & Usage — visual breakdown of IndexedDB storage by category.

import { useState, useEffect } from 'react'
import { BarChart3, AlertTriangle, AlertOctagon, RefreshCw, Loader2, Info } from 'lucide-react'
import { Link } from 'react-router'
import { BarChart, Bar, YAxis, XAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { formatFileSize } from '@/lib/format'
import {
  getStorageOverview,
  STORAGE_CATEGORIES,
  type StorageOverview,
  type StorageCategory,
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
          <p className="text-sm font-medium text-destructive">Storage almost full ({percent}%)</p>
          <p className="text-xs text-destructive/80 mt-1">
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
          <p className="text-xs text-warning/80 mt-1">
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
        <ChartContainer config={chartConfig} className="h-8 w-full">
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
          overview.categorizedTotal > 0
            ? Math.round((cat.sizeBytes / overview.categorizedTotal) * 100)
            : 0

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

// --- Main Component ---

export function StorageManagement() {
  const [overview, setOverview] = useState<StorageOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [warningDismissed, setWarningDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await getStorageOverview()
        if (!cancelled) setOverview(data)
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
  }, [])

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    setError(false)
    try {
      const data = await getStorageOverview()
      setOverview(data)
    } catch {
      // silent-catch-ok — Error state rendered via setError(true) above
      setError(true)
    } finally {
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
            <Button variant="outline" size="sm" asChild>
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
      <CardContent className="p-6 space-y-6">
        {overview && (
          <>
            <QuotaWarningBanner
              usagePercent={overview.usagePercent}
              dismissed={warningDismissed}
              onDismiss={handleDismissWarning}
            />
            <StorageOverviewBar overview={overview} />
            <CategoryBreakdownLegend overview={overview} />
          </>
        )}
      </CardContent>
    </StorageCardShell>
  )
}
