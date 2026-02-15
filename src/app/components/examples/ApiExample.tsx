/**
 * API Usage Example Component
 * Demonstrates how to use the API client in React components
 */

import { useState, useEffect } from 'react'
import { api, ApiClientError } from '@/lib/api'
import type { Course, UserProfile } from '@/types/api'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Example 1: Fetching and displaying courses
 */
export function CoursesExample() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCourses() {
      try {
        setLoading(true)
        setError(null)
        const data = await api.courses.getAll()
        setCourses(data.courses)
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(`API Error: ${err.message}`)
        } else {
          setError('Failed to load courses')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading courses...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-lg">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {courses.map(course => (
        <Card key={course.id}>
          <CardHeader>
            <CardTitle>{course.title}</CardTitle>
            <CardDescription>{course.instructor.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={course.enrolled ? 'default' : 'outline'}>{course.level}</Badge>
                <span className="text-sm text-gray-500">{course.duration}</span>
              </div>
              {course.enrolled && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{course.progress}%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Example 2: Fetching course details with error handling
 */
export function CourseDetailExample({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCourse = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.courses.getById(courseId)
      setCourse(data)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 404) {
          setError(`Course with ID "${courseId}" not found`)
        } else {
          setError(`Error ${err.statusCode}: ${err.message}`)
        }
      } else {
        setError('Network error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Detail Example</CardTitle>
        <CardDescription>Try course IDs: 1, 2, 3, 4 (valid) or 999 (404 error)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={loadCourse} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load Course {courseId}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {course && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">Course loaded successfully!</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-lg">{course.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{course.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {course.tags?.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-500">
                {course.totalModules} modules • {course.totalLessons} lessons
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Example 3: Updating progress with optimistic updates
 */
export function ProgressUpdateExample({ lessonId = 'lesson-1', courseId = '1' }) {
  const [updating, setUpdating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const updateProgress = async (completed: boolean) => {
    try {
      setUpdating(true)
      setError(null)

      const response = await api.progress.update({
        lessonId,
        courseId,
        completed,
        watchedDuration: completed ? 930 : 450,
        totalDuration: 930,
        progressPercentage: completed ? 100 : 48,
      })

      setResult(response)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
      } else {
        setError('Failed to update progress')
      }
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress Update Example</CardTitle>
        <CardDescription>Update learning progress for lesson {lessonId}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={() => updateProgress(false)} disabled={updating} variant="outline">
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark In Progress (48%)
          </Button>
          <Button onClick={() => updateProgress(true)} disabled={updating}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark Complete (100%)
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{result.message}</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <pre className="text-xs overflow-auto">{JSON.stringify(result.data, null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Example 4: User profile with loading states
 */
export function UserProfileExample() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await api.user.getProfile()
      setProfile(data)
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile Example</CardTitle>
        <CardDescription>Load current user profile data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={loadProfile} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Load User Profile
        </Button>

        {profile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h3 className="font-semibold">{profile.name}</h3>
                <p className="text-sm text-gray-500">{profile.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {profile.stats.currentStreak}
                </div>
                <div className="text-xs text-gray-600">Day Streak</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {profile.stats.coursesEnrolled}
                </div>
                <div className="text-xs text-gray-600">Courses Enrolled</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.floor(profile.stats.totalLearningTime / 60)}h
                </div>
                <div className="text-xs text-gray-600">Learning Time</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{profile.badges.length}</div>
                <div className="text-xs text-gray-600">Badges Earned</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.badges.slice(0, 3).map(badge => (
                <Badge key={badge.id} variant="outline" className="gap-1">
                  <span>{badge.icon}</span>
                  <span>{badge.name}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Combined demo page showing all examples
 */
export function ApiExamplesPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">API Client Examples</h1>
        <p className="text-gray-600">
          Interactive examples demonstrating the API client library usage
        </p>
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-4">1. Fetching Courses</h2>
        <CoursesExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">2. Course Details with Error Handling</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <CourseDetailExample courseId="1" />
          <CourseDetailExample courseId="999" />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">3. Progress Updates</h2>
        <ProgressUpdateExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">4. User Profile</h2>
        <UserProfileExample />
      </section>
    </div>
  )
}

export default ApiExamplesPage
