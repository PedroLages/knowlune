/**
 * Hook to fetch recent study session data for CalendarHeatMap.
 *
 * Queries Dexie for study sessions in the last N days and returns
 * an aggregated Map<YYYY-MM-DD, seconds> for the heatmap component.
 *
 * @since Library Redesign
 */

import { useEffect, useState } from 'react'
import { db } from '@/db/schema'
import { aggregateSessionsByDay } from '@/lib/activityHeatmap'
import { toLocalDateString } from '@/lib/dateUtils'

export function useRecentStudyActivity(days = 91) {
  const [dayMap, setDayMap] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const today = toLocalDateString()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    db.studySessions
      .where('startTime')
      .above(cutoff.toISOString())
      .toArray()
      .then(sessions => {
        if (cancelled) return
        const map = aggregateSessionsByDay(sessions, today, days)
        setDayMap(map)
        setIsLoading(false)
      })
      .catch(() => {
        // silent-catch-ok: heatmap is supplementary, don't block goals UI
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [days])

  return { dayMap, isLoading, today: toLocalDateString() }
}
