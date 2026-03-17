import { useCourseStore } from '@/stores/useCourseStore'
import { getInstructorById } from '@/data/instructors'
import type { Course, Instructor } from '@/data/types'

export function getInstructorStats(instructor: Instructor) {
  const courses = useCourseStore.getState().courses.filter(c => c.instructorId === instructor.id)
  return {
    courses,
    courseCount: courses.length,
    totalLessons: courses.reduce((sum, c) => sum + c.totalLessons, 0),
    totalHours: courses.reduce((sum, c) => sum + c.estimatedHours, 0),
    totalVideos: courses.reduce((sum, c) => sum + c.totalVideos, 0),
    categories: [...new Set(courses.map(c => c.category))],
  }
}

export function getInstructorForCourse(course: Course): Instructor | undefined {
  return getInstructorById(course.instructorId)
}

/** Available responsive avatar widths (px) */
const AVATAR_WIDTHS = [48, 96, 192, 256] as const

/**
 * Returns src + srcSet props for an instructor avatar at a given display size.
 * Picks the smallest width >= displaySize for 1x, and >= displaySize*2 for 2x.
 * Falls back to the largest available width.
 */
export function getAvatarSrc(basePath: string, displaySize: number) {
  // If it's an external URL (e.g. Unsplash), just return it directly
  if (basePath.startsWith('http')) {
    return { src: basePath }
  }

  const w1x = AVATAR_WIDTHS.find(w => w >= displaySize) ?? AVATAR_WIDTHS[AVATAR_WIDTHS.length - 1]
  const w2x =
    AVATAR_WIDTHS.find(w => w >= displaySize * 2) ?? AVATAR_WIDTHS[AVATAR_WIDTHS.length - 1]

  return {
    src: `${basePath}-${w1x}w.jpg`,
    srcSet: `${basePath}-${w1x}w.webp ${w1x}w, ${basePath}-${w2x}w.webp ${w2x}w`,
  }
}
