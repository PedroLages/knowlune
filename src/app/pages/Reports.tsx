import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { endOfDay, format, isSameDay, startOfDay, subDays } from 'date-fns'
import { motion } from 'motion/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { ReportsOverview } from '@/app/components/reports/ReportsOverview'
import { StudyAnalyticsTab } from '@/app/components/reports/StudyAnalyticsTab'
import { AIAnalyticsTab } from '@/app/components/reports/AIAnalyticsTab'
import { QuizAnalyticsDashboard } from '@/app/components/reports/QuizAnalyticsDashboard'
import { PathAnalyticsTab } from '@/app/components/reports/PathAnalyticsTab'
import { DateRangeFilter, type DateRange } from '@/app/components/reports/DateRangeFilter'
import { ReportsExportActions } from '@/app/components/reports/ReportsExportActions'
import { staggerContainer, fadeUp } from '@/lib/motion'

const VALID_TABS = ['overview', 'study', 'quizzes', 'ai', 'paths'] as const
type ReportsTab = (typeof VALID_TABS)[number]

function defaultDateRange(): DateRange {
  const today = startOfDay(new Date())
  return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) }
}

function parseDateRange(params: URLSearchParams): DateRange {
  const today = startOfDay(new Date())
  const preset = params.get('range')
  if (preset === 'all') return { from: null, to: null }
  if (preset === '7d' || preset === '30d' || preset === '90d' || preset === '1y') {
    const days = preset === '7d' ? 6 : preset === '30d' ? 29 : preset === '90d' ? 89 : 364
    return { from: startOfDay(subDays(today, days)), to: endOfDay(today) }
  }
  if (preset === 'custom') {
    const fromValue = params.get('from')
    const toValue = params.get('to')
    const from = fromValue ? startOfDay(new Date(`${fromValue}T00:00:00`)) : null
    const to = toValue ? endOfDay(new Date(`${toValue}T00:00:00`)) : null
    if (from && to && Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && from <= to) {
      return { from, to: to > endOfDay(today) ? endOfDay(today) : to }
    }
  }
  return defaultDateRange()
}

function rangeKey(range: DateRange): string {
  const today = startOfDay(new Date())
  if (!range.from && !range.to) return 'all'
  const presets = [
    ['7d', 6],
    ['30d', 29],
    ['90d', 89],
    ['1y', 364],
  ] as const
  for (const [key, days] of presets) {
    if (
      range.from &&
      range.to &&
      isSameDay(range.from, subDays(today, days)) &&
      isSameDay(range.to, endOfDay(today))
    ) {
      return key
    }
  }
  return 'custom'
}

function tabFromParams(params: URLSearchParams): ReportsTab {
  const raw = params.get('tab')
  return VALID_TABS.includes(raw as ReportsTab) ? (raw as ReportsTab) : 'overview'
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = tabFromParams(searchParams)
  const [dateRange, setDateRange] = useState<DateRange>(() => parseDateRange(searchParams))

  function updateRange(nextRange: DateRange) {
    setDateRange(nextRange)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', activeTab)
    const nextKey = rangeKey(nextRange)
    nextParams.set('range', nextKey)
    if (nextKey === 'custom') {
      if (nextRange.from) nextParams.set('from', format(nextRange.from, 'yyyy-MM-dd'))
      else nextParams.delete('from')
      if (nextRange.to) nextParams.set('to', format(nextRange.to, 'yyyy-MM-dd'))
      else nextParams.delete('to')
    } else {
      nextParams.delete('from')
      nextParams.delete('to')
    }
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="pb-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Learning intelligence
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Reports</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            See what is moving, what needs attention, and where to focus next.
          </p>
        </div>
        <ReportsExportActions range={dateRange} />
      </header>

      <div className="mb-5 rounded-2xl border border-border bg-card/70 p-3 sm:p-4">
        <DateRangeFilter value={dateRange} onChange={updateRange} />
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {activeTab === 'overview' ? 'Reports overview displayed' : `${activeTab} reports displayed`}
      </span>

      <Tabs
        value={activeTab}
        onValueChange={value => {
          const nextParams = new URLSearchParams(searchParams)
          nextParams.set('tab', value)
          setSearchParams(nextParams, { replace: true })
        }}
        className="mb-6"
      >
        <motion.div variants={fadeUp}>
          <TabsList className="min-h-11 max-w-full justify-start overflow-x-auto" aria-label="Reports navigation">
            <TabsTrigger value="overview" className="min-h-11 shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="study" className="min-h-11 shrink-0">Study Analytics</TabsTrigger>
            <TabsTrigger value="quizzes" className="min-h-11 shrink-0">Quiz Analytics</TabsTrigger>
            <TabsTrigger value="ai" className="min-h-11 shrink-0">AI Analytics</TabsTrigger>
            <TabsTrigger value="paths" className="min-h-11 shrink-0">Learning Paths</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="overview" className="mt-6">
          <ReportsOverview />
        </TabsContent>
        <TabsContent value="study" className="mt-6">
          <StudyAnalyticsTab />
        </TabsContent>
        <TabsContent value="quizzes" className="mt-6">
          <QuizAnalyticsDashboard />
        </TabsContent>
        <TabsContent value="ai" className="mt-6">
          <AIAnalyticsTab dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="paths" className="mt-6">
          <PathAnalyticsTab dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
