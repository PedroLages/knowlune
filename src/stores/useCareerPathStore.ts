import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { CareerPath, PathEnrollment, PathEnrollmentStatus } from '@/data/types'
import { CURATED_CAREER_PATHS } from '@/data/careerPaths'
import { persistWithRetry } from '@/lib/persistWithRetry'

export interface PathProgress {
  totalCourses: number
  completedCourses: number
  percentage: number
}

export interface StageProgress {
  totalCourses: number
  completedCourses: number
  percentage: number
}

interface CareerPathState {
  paths: CareerPath[]
  enrollments: PathEnrollment[]
  /** courseId → true when ALL content items for that course are completed in contentProgress */
  courseCompletionCache: Record<string, boolean>
  isLoaded: boolean
  error: string | null

  loadPaths: () => Promise<void>
  enrollInPath: (pathId: string) => Promise<void>
  dropPath: (pathId: string) => Promise<void>
  refreshCourseCompletion: (courseIds: string[]) => Promise<void>
  getEnrollmentForPath: (pathId: string) => PathEnrollment | undefined
  getPathProgress: (pathId: string) => PathProgress
  getStageProgress: (pathId: string, stageId: string) => StageProgress
  isStageUnlocked: (pathId: string, stageIndex: number) => boolean
  isCourseCompleted: (courseId: string) => boolean
}

export const useCareerPathStore = create<CareerPathState>((set, get) => ({
  paths: [],
  enrollments: [],
  courseCompletionCache: {},
  isLoaded: false,
  error: null,

  loadPaths: async () => {
    try {
      // Seed curated paths if the table is empty (first run or new users)
      const existingCount = await db.careerPaths.count()
      if (existingCount === 0) {
        await db.careerPaths.bulkAdd(CURATED_CAREER_PATHS)
      }

      const [paths, enrollments] = await Promise.all([
        db.careerPaths.toArray(),
        db.pathEnrollments.where('status').anyOf(['active', 'completed']).toArray(),
      ])

      // Pre-compute course completion for all courses referenced in paths
      const allCourseIds = paths.flatMap(p => p.stages.flatMap(s => s.courseIds))
      const uniqueIds = [...new Set(allCourseIds)]

      set({ paths, enrollments, isLoaded: true, error: null })

      // Load completion data asynchronously (non-blocking)
      get().refreshCourseCompletion(uniqueIds).catch(err => {
        console.error('[CareerPathStore] Failed to refresh course completion:', err)
      })
    } catch (error) {
      console.error('[CareerPathStore] Failed to load career paths:', error)
      set({ error: 'Failed to load career paths', isLoaded: true })
      toast.error('Failed to load career paths')
    }
  },

  refreshCourseCompletion: async (courseIds: string[]) => {
    if (courseIds.length === 0) return

    try {
      const cache: Record<string, boolean> = { ...get().courseCompletionCache }

      await Promise.all(
        courseIds.map(async courseId => {
          // For seeded courses: check contentProgress records for this courseId
          const progressRecords = await db.contentProgress
            .where('courseId')
            .equals(courseId)
            .toArray()

          if (progressRecords.length === 0) {
            // No progress records yet — not started
            cache[courseId] = false
            return
          }

          // Course is completed when ALL tracked items have status 'completed'
          const allCompleted = progressRecords.every(r => r.status === 'completed')
          cache[courseId] = allCompleted

          // For imported courses: also check importedCourse.status field
          if (!allCompleted) {
            const imported = await db.importedCourses.get(courseId)
            if (imported?.status === 'completed') {
              cache[courseId] = true
            }
          }
        })
      )

      set({ courseCompletionCache: cache })
    } catch (error) {
      console.error('[CareerPathStore] Failed to compute course completion:', error)
    }
  },

  enrollInPath: async (pathId: string) => {
    const { enrollments } = get()
    const existing = enrollments.find(e => e.pathId === pathId)

    // Re-activate a dropped enrollment instead of creating a duplicate
    if (existing && existing.status === 'dropped') {
      const updated: PathEnrollment = { ...existing, status: 'active' as PathEnrollmentStatus }
      try {
        await persistWithRetry(async () => {
          await db.pathEnrollments.put(updated)
        })
        set({ enrollments: enrollments.map(e => (e.id === existing.id ? updated : e)) })
      } catch (error) {
        console.error('[CareerPathStore] Failed to re-activate enrollment:', error)
        toast.error('Failed to enroll in path')
        throw error
      }
      return
    }

    if (existing) return // Already enrolled

    const enrollment: PathEnrollment = {
      id: crypto.randomUUID(),
      pathId,
      enrolledAt: new Date().toISOString(),
      status: 'active',
    }

    try {
      await persistWithRetry(async () => {
        await db.pathEnrollments.add(enrollment)
      })
      set({ enrollments: [...enrollments, enrollment] })
      toast.success('Enrolled! Your progress will be tracked automatically.')
    } catch (error) {
      console.error('[CareerPathStore] Failed to enroll in path:', error)
      toast.error('Failed to enroll in path')
      throw error
    }
  },

  dropPath: async (pathId: string) => {
    const { enrollments } = get()
    const enrollment = enrollments.find(e => e.pathId === pathId && e.status === 'active')
    if (!enrollment) return

    const updated: PathEnrollment = { ...enrollment, status: 'dropped' as PathEnrollmentStatus }

    try {
      await persistWithRetry(async () => {
        await db.pathEnrollments.put(updated)
      })
      set({ enrollments: enrollments.map(e => (e.id === enrollment.id ? updated : e)) })
      toast.success('You have left this path.')
    } catch (error) {
      console.error('[CareerPathStore] Failed to drop path:', error)
      toast.error('Failed to leave path')
      throw error
    }
  },

  getEnrollmentForPath: (pathId: string) => {
    return get().enrollments.find(e => e.pathId === pathId && e.status !== 'dropped')
  },

  isCourseCompleted: (courseId: string) => {
    return get().courseCompletionCache[courseId] ?? false
  },

  getStageProgress: (pathId: string, stageId: string): StageProgress => {
    const { paths, courseCompletionCache } = get()
    const path = paths.find(p => p.id === pathId)
    const stage = path?.stages.find(s => s.id === stageId)
    if (!stage) return { totalCourses: 0, completedCourses: 0, percentage: 0 }

    const totalCourses = stage.courseIds.length
    const completedCourses = stage.courseIds.filter(id => courseCompletionCache[id]).length
    const percentage = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0

    return { totalCourses, completedCourses, percentage }
  },

  getPathProgress: (pathId: string): PathProgress => {
    const { paths } = get()
    const path = paths.find(p => p.id === pathId)
    if (!path) return { totalCourses: 0, completedCourses: 0, percentage: 0 }

    const allCourseIds = path.stages.flatMap(s => s.courseIds)
    const totalCourses = allCourseIds.length
    const completedCourses = allCourseIds.filter(id => get().isCourseCompleted(id)).length
    const percentage = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0

    return { totalCourses, completedCourses, percentage }
  },

  isStageUnlocked: (pathId: string, stageIndex: number): boolean => {
    // Stage 1 (index 0) is always unlocked
    if (stageIndex === 0) return true

    const { paths } = get()
    const path = paths.find(p => p.id === pathId)
    if (!path) return false

    // All previous stages must be fully complete
    for (let i = 0; i < stageIndex; i++) {
      const prev = get().getStageProgress(pathId, path.stages[i].id)
      if (prev.percentage < 100) return false
    }
    return true
  },
}))
