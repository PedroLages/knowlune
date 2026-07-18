import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db } from '@/db'
import {
  buildOverviewDashboardModel,
  type ReadyOverviewDashboardModel,
} from '@/lib/overviewDashboard'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useKnowledgeMapStore } from '@/stores/useKnowledgeMapStore'

export type OverviewDashboardModel =
  | { status: 'loading'; retry: () => void }
  | { status: 'error'; error: string; retry: () => void }
  | (ReadyOverviewDashboardModel & { retry: () => void })

interface DashboardQuerySuccess {
  snapshot: Parameters<typeof buildOverviewDashboardModel>[0]
  error?: never
}

interface DashboardQueryFailure {
  snapshot?: never
  error: string
}

type DashboardQueryResult = DashboardQuerySuccess | DashboardQueryFailure

export function useOverviewDashboardModel(): OverviewDashboardModel {
  const [reloadKey, setReloadKey] = useState(0)
  const now = useMemo(() => new Date(), [reloadKey])
  const lastToastedError = useRef<string | null>(null)

  const knowledgeTopics = useKnowledgeMapStore(state => state.topics)
  const computeKnowledgeScores = useKnowledgeMapStore(state => state.computeScores)
  const invalidateKnowledgeCache = useKnowledgeMapStore(state => state.invalidateCache)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const loadThumbnailUrls = useCourseImportStore(state => state.loadThumbnailUrls)

  useEffect(() => {
    void loadImportedCourses()
    void computeKnowledgeScores(now)
  }, [computeKnowledgeScores, loadImportedCourses, now])

  const queryResult = useLiveQuery<DashboardQueryResult>(async () => {
    try {
      const [
        courses,
        videos,
        pdfs,
        contentProgress,
        videoProgress,
        sessions,
        schedules,
        flashcards,
        quizzes,
        quizAttempts,
      ] = await Promise.all([
        db.importedCourses.toArray(),
        db.importedVideos.toArray(),
        db.importedPdfs.toArray(),
        db.contentProgress.toArray(),
        db.progress.toArray(),
        db.studySessions.toArray(),
        db.studySchedules.toArray(),
        db.flashcards.toArray(),
        db.quizzes.toArray(),
        db.quizAttempts.toArray(),
      ])
      return {
        snapshot: {
          courses,
          videos,
          pdfs,
          contentProgress,
          videoProgress,
          sessions,
          schedules,
          flashcards,
          quizzes,
          quizAttempts,
        },
      }
    } catch (error) {
      // silent-catch-ok — returned error is surfaced by the hook toast and retry UI.
      console.error('[Overview] Failed to load dashboard data:', error)
      return {
        error: error instanceof Error ? error.message : 'Could not load your learning data',
      }
    }
  }, [reloadKey])

  const readyModel = useMemo(() => {
    if (!queryResult?.snapshot) return null
    return buildOverviewDashboardModel(queryResult.snapshot, knowledgeTopics, now)
  }, [knowledgeTopics, now, queryResult])

  useEffect(() => {
    if (!queryResult?.snapshot) return
    void loadThumbnailUrls(queryResult.snapshot.courses.map(course => course.id))
  }, [loadThumbnailUrls, queryResult])

  useEffect(() => {
    if (!queryResult?.error || lastToastedError.current === queryResult.error) return
    lastToastedError.current = queryResult.error
    toast.error('Your dashboard could not be loaded. Please try again.')
  }, [queryResult])

  const retry = useCallback(() => {
    lastToastedError.current = null
    invalidateKnowledgeCache()
    setReloadKey(value => value + 1)
  }, [invalidateKnowledgeCache])

  if (!queryResult) return { status: 'loading', retry }
  if (queryResult.error) return { status: 'error', error: queryResult.error, retry }
  if (!readyModel) return { status: 'loading', retry }
  return { ...readyModel, retry }
}
