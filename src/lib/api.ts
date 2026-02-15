/**
 * API Client Library
 * Typed API client functions for the e-learning platform
 */

import type {
  CoursesListResponse,
  CourseDetail,
  LessonDetail,
  ProgressUpdateRequest,
  ProgressUpdateResponse,
  UserProfile,
  ReportsResponse,
  ApiError,
} from '@/types/api'

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: ApiError
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

// ============================================================================
// HTTP Client Utilities
// ============================================================================

/**
 * Base fetch wrapper with error handling
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    // Parse JSON response
    const data = await response.json()

    // Check if the response is an error
    if (!response.ok) {
      const error = data as ApiError
      throw new ApiClientError(error.message || 'API request failed', response.status, error)
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error
    }

    // Handle network errors or JSON parsing errors
    throw new ApiClientError(error instanceof Error ? error.message : 'Unknown error occurred', 0)
  }
}

/**
 * GET request helper
 */
async function get<T>(endpoint: string): Promise<T> {
  return fetchApi<T>(endpoint, { method: 'GET' })
}

/**
 * POST request helper
 */
async function post<T, D = unknown>(endpoint: string, data: D): Promise<T> {
  return fetchApi<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Note: PUT and DELETE helpers removed as they're currently unused.
// Uncomment if needed for future endpoints:
// async function put<T, D = unknown>(endpoint: string, data: D): Promise<T> {
//   return fetchApi<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
// }
// async function del<T>(endpoint: string): Promise<T> {
//   return fetchApi<T>(endpoint, { method: 'DELETE' });
// }

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Courses API
 */
export const coursesApi = {
  /**
   * Get all courses
   * @returns List of all available courses
   * @example
   * ```ts
   * const courses = await coursesApi.getAll();
   * console.log(courses.courses);
   * ```
   */
  getAll: async (): Promise<CoursesListResponse> => {
    return get<CoursesListResponse>('/courses')
  },

  /**
   * Get course details by ID
   * @param courseId - The course ID
   * @returns Detailed course information including modules and lessons
   * @example
   * ```ts
   * const course = await coursesApi.getById('1');
   * console.log(course.modules);
   * ```
   */
  getById: async (courseId: string): Promise<CourseDetail> => {
    return get<CourseDetail>(`/courses/${courseId}`)
  },
}

/**
 * Lessons API
 */
export const lessonsApi = {
  /**
   * Get lesson details by ID
   * @param lessonId - The lesson ID
   * @returns Detailed lesson information including video/PDF URLs and resources
   * @example
   * ```ts
   * const lesson = await lessonsApi.getById('lesson-1');
   * console.log(lesson.videoUrl);
   * ```
   */
  getById: async (lessonId: string): Promise<LessonDetail> => {
    return get<LessonDetail>(`/lessons/${lessonId}`)
  },
}

/**
 * Progress API
 */
export const progressApi = {
  /**
   * Update learning progress
   * @param data - Progress update data
   * @returns Updated progress confirmation
   * @example
   * ```ts
   * const result = await progressApi.update({
   *   lessonId: 'lesson-1',
   *   courseId: '1',
   *   completed: true,
   *   watchedDuration: 930,
   *   totalDuration: 930,
   *   progressPercentage: 100
   * });
   * console.log(result.success);
   * ```
   */
  update: async (data: ProgressUpdateRequest): Promise<ProgressUpdateResponse> => {
    return post<ProgressUpdateResponse, ProgressUpdateRequest>('/progress', data)
  },
}

/**
 * User API
 */
export const userApi = {
  /**
   * Get current user profile
   * @returns User profile with stats, preferences, and badges
   * @example
   * ```ts
   * const profile = await userApi.getProfile();
   * console.log(profile.stats.currentStreak);
   * ```
   */
  getProfile: async (): Promise<UserProfile> => {
    return get<UserProfile>('/user/profile')
  },
}

/**
 * Reports API
 */
export const reportsApi = {
  /**
   * Get progress reports
   * @returns Comprehensive learning progress reports and analytics
   * @example
   * ```ts
   * const reports = await reportsApi.get();
   * console.log(reports.overview.totalLearningTime);
   * console.log(reports.courseProgress);
   * ```
   */
  get: async (): Promise<ReportsResponse> => {
    return get<ReportsResponse>('/reports')
  },
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Main API client object with all endpoints
 */
export const api = {
  courses: coursesApi,
  lessons: lessonsApi,
  progress: progressApi,
  user: userApi,
  reports: reportsApi,
}

/**
 * Default export
 */
export default api

// ============================================================================
// React Query / SWR Helpers (Optional)
// ============================================================================

/**
 * Query keys for React Query or SWR
 * Useful for cache invalidation and refetching
 */
export const queryKeys = {
  courses: {
    all: ['courses'] as const,
    detail: (id: string) => ['courses', id] as const,
  },
  lessons: {
    detail: (id: string) => ['lessons', id] as const,
  },
  user: {
    profile: ['user', 'profile'] as const,
  },
  reports: {
    all: ['reports'] as const,
  },
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  CoursesListResponse,
  CourseDetail,
  LessonDetail,
  ProgressUpdateRequest,
  ProgressUpdateResponse,
  UserProfile,
  ReportsResponse,
  ApiError,
} from '@/types/api'

export { isApiError } from '@/types/api'
