import { useEffect, useMemo } from 'react'
import { AlertTriangle, Brain, Calendar, ShieldCheck } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { StatsCard } from '@/app/components/StatsCard'
import { EmptyState } from '@/app/components/EmptyState'
import { TopicRetentionCard } from '@/app/components/figma/TopicRetentionCard'
import { EngagementDecayAlerts } from '@/app/components/figma/EngagementDecayAlert'
import { useReviewStore } from '@/stores/useReviewStore'
import { useNoteStore } from '@/stores/useNoteStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { getTopicRetention, getRetentionStats, detectEngagementDecay } from '@/lib/retentionMetrics'
import { staggerContainer, fadeUp } from '@/lib/motion'

export function RetentionDashboard() {
  const { allReviews, loadReviews, isLoading: reviewsLoading } = useReviewStore()
  const { notes, loadNotes, isLoading: notesLoading } = useNoteStore()
  const { sessions, loadSessionStats, isLoading: sessionsLoading } = useSessionStore()

  const now = useMemo(() => new Date(), [])

  useEffect(() => {
    let ignore = false
    Promise.all([loadReviews(), loadNotes(), loadSessionStats()]).catch(err => {
      // silent-catch-ok — error state handled by individual store isLoading flags
      if (!ignore) console.error('[RetentionDashboard] Failed to load data:', err)
    })
    return () => {
      ignore = true
    }
  }, [loadReviews, loadNotes, loadSessionStats])

  const isLoading = reviewsLoading || notesLoading || sessionsLoading

  // Derived data
  const topicRetention = useMemo(
    () => getTopicRetention(notes, allReviews, now),
    [notes, allReviews, now]
  )

  const stats = useMemo(() => getRetentionStats(allReviews, now), [allReviews, now])

  const decayAlerts = useMemo(() => detectEngagementDecay(sessions, now), [sessions, now])

  const hasData = allReviews.length > 0

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        data-testid="retention-dashboard"
      >
        <motion.h1 variants={fadeUp} className="text-2xl font-bold mb-6">
          Knowledge Retention
        </motion.h1>

        {isLoading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading retention data">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-40 rounded-[24px] bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : !hasData ? (
          <EmptyState
            data-testid="retention-empty-state"
            icon={Brain}
            title="No review data yet"
            description="Start reviewing notes in the Review Queue to see your knowledge retention dashboard."
            actionLabel="Go to Review Queue"
            actionHref="/review"
          />
        ) : (
          <div className="space-y-6">
            {/* Row 1: Stats Cards */}
            <motion.div
              variants={fadeUp}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              data-testid="retention-stats"
            >
              <StatsCard
                label="Notes at Risk"
                value={stats.notesAtRisk}
                icon={AlertTriangle}
                testId="stat-notes-at-risk"
              />
              <StatsCard
                label="Due Today"
                value={stats.dueToday}
                icon={Calendar}
                testId="stat-due-today"
              />
              <StatsCard
                label="Avg Retention"
                value={`${stats.avgRetention}%`}
                icon={ShieldCheck}
                testId="stat-avg-retention"
              />
            </motion.div>

            {/* Row 2: Topic Retention Cards */}
            {topicRetention.length > 0 && (
              <motion.section variants={fadeUp} aria-labelledby="retention-by-topic-heading">
                <Card className="rounded-[24px]">
                  <CardHeader>
                    <h2
                      id="retention-by-topic-heading"
                      className="text-base font-semibold flex items-center gap-2"
                    >
                      <Brain className="size-4 text-muted-foreground" aria-hidden="true" />
                      Retention by Topic
                    </h2>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {topicRetention.map(topic => (
                        <TopicRetentionCard key={topic.topic} topic={topic} now={now} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.section>
            )}

            {/* Row 3: Engagement Status */}
            <motion.section variants={fadeUp} aria-labelledby="engagement-health-heading">
              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2
                    id="engagement-health-heading"
                    className="text-base font-semibold flex items-center gap-2"
                  >
                    <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                    Engagement Health
                  </h2>
                </CardHeader>
                <CardContent>
                  <EngagementDecayAlerts alerts={decayAlerts} />
                </CardContent>
              </Card>
            </motion.section>
          </div>
        )}
      </motion.div>
    </MotionConfig>
  )
}
