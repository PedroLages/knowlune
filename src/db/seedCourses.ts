import { db } from '@/db'
import { allCourses } from '@/data/courses'

/**
 * Seeds the courses table from static data if it's empty.
 * Idempotent — safe to call on every app start.
 */
export async function seedCoursesIfEmpty(): Promise<void> {
  const count = await db.courses.count()
  if (count > 0) return

  await db.courses.bulkAdd(allCourses)
  console.log(`[Seed] Inserted ${allCourses.length} courses into IndexedDB`)
}
