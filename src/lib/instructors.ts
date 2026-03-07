import { allCourses } from '@/data/courses'
import { getInstructorById } from '@/data/instructors'
import type { Course, Instructor } from '@/data/types'

export function getInstructorStats(instructor: Instructor) {
  const courses = allCourses.filter(c => c.instructorId === instructor.id)
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
