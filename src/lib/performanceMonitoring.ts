import { onLCP, onCLS, onFCP, onTTFB, onINP } from 'web-vitals'
import type { Metric } from 'web-vitals'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerformanceEntry {
  name: string
  value: number
  rating: Metric['rating']
  timestamp: number
}

export interface PerformanceSummary {
  LCP: PerformanceEntry | null
  CLS: PerformanceEntry | null
  FCP: PerformanceEntry | null
  TTFB: PerformanceEntry | null
  INP: PerformanceEntry | null
}

// ---------------------------------------------------------------------------
// In-memory buffer (capped at 100 entries, FIFO)
// ---------------------------------------------------------------------------

const MAX_BUFFER_SIZE = 100
const metricsBuffer: PerformanceEntry[] = []

function pushMetric(entry: PerformanceEntry) {
  if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
    metricsBuffer.shift()
  }
  metricsBuffer.push(entry)
}

// ---------------------------------------------------------------------------
// Metric handler
// ---------------------------------------------------------------------------

const isDev = import.meta.env.DEV

function handleMetric(metric: Metric) {
  const entry: PerformanceEntry = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    timestamp: Date.now(),
  }

  pushMetric(entry)

  if (isDev) {
    const unit = metric.name === 'CLS' ? '' : 'ms'
    console.log(
      `[EduVi:Perf] ${metric.name}: ${metric.value.toFixed(2)}${unit} (rating: ${metric.rating})`
    )
  }
}

// ---------------------------------------------------------------------------
// Route transition timing
// ---------------------------------------------------------------------------

export function markRouteStart(routeName: string) {
  const markName = `route-start:${routeName}`
  performance.mark(markName)

  if (isDev) {
    console.log(`[EduVi:Perf] Route transition started: ${routeName}`)
  }
}

export function markRouteEnd(routeName: string) {
  const startMark = `route-start:${routeName}`
  const endMark = `route-end:${routeName}`
  const measureName = `route:${routeName}`

  performance.mark(endMark)

  try {
    const measure = performance.measure(measureName, startMark, endMark)

    if (isDev) {
      console.log(`[EduVi:Perf] Route transition ${routeName}: ${measure.duration.toFixed(2)}ms`)
    }

    pushMetric({
      name: `route:${routeName}`,
      value: measure.duration,
      rating:
        measure.duration < 200 ? 'good' : measure.duration < 500 ? 'needs-improvement' : 'poor',
      timestamp: Date.now(),
    })
  } catch {
    // Start mark may not exist if markRouteStart was never called
    if (isDev) {
      console.warn(`[EduVi:Perf] Missing start mark for route: ${routeName}`)
    }
  } finally {
    // Clean up marks
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(measureName)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns a shallow copy of the metrics buffer. */
export function getPerformanceMetrics(): ReadonlyArray<PerformanceEntry> {
  return [...metricsBuffer]
}

/** Returns the latest value for each Core Web Vital. */
export function getPerformanceSummary(): PerformanceSummary {
  const latest = (name: string): PerformanceEntry | null => {
    for (let i = metricsBuffer.length - 1; i >= 0; i--) {
      if (metricsBuffer[i].name === name) return metricsBuffer[i]
    }
    return null
  }

  return {
    LCP: latest('LCP'),
    CLS: latest('CLS'),
    FCP: latest('FCP'),
    TTFB: latest('TTFB'),
    INP: latest('INP'),
  }
}

/** Start collecting all Core Web Vitals. Call once at app startup. */
export function initPerformanceMonitoring() {
  onLCP(handleMetric)
  onCLS(handleMetric)
  onFCP(handleMetric)
  onTTFB(handleMetric)
  onINP(handleMetric)

  if (isDev) {
    console.log('[EduVi:Perf] Performance monitoring initialized')
  }
}
