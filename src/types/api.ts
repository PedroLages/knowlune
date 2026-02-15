/**
 * API Type Definitions
 * TypeScript interfaces for all API responses from the mock backend
 */

// ============================================================================
// Common Types
// ============================================================================

export interface Instructor {
  id: string
  name: string
  avatar: string
  title: string
  bio?: string
  coursesCount?: number
  studentsCount?: number
  rating?: number
}

export interface Module {
  id: string
  title: string
  description: string
  order: number
  duration: string
  completed: boolean
  lessons: Lesson[]
}

export interface Lesson {
  id: string
  title: string
  type: 'video' | 'pdf' | 'quiz' | 'assignment'
  duration: string
  completed: boolean
  order: number
}

export interface Review {
  id: string
  user: {
    name: string
    avatar: string
  }
  rating: number
  comment: string
  date: string
}

// ============================================================================
// Course Types
// ============================================================================

export interface Course {
  id: string
  title: string
  description: string
  instructor: Instructor
  thumbnail: string
  duration: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  rating: number
  studentsEnrolled: number
  progress: number
  totalModules: number
  completedModules: number
  totalLessons: number
  completedLessons: number
  category: string
  tags: string[]
  price: number
  currency: string
  enrolled: boolean
  lastAccessed: string | null
  certificateAvailable: boolean
}

export interface CourseDetail extends Course {
  modules: Module[]
  syllabus: string
  requirements: string[]
  whatYouWillLearn: string[]
  reviews: Review[]
}

export interface CoursesListResponse {
  courses: Course[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// Lesson Types
// ============================================================================

export interface Resource {
  id: string
  title: string
  type: 'pdf' | 'zip' | 'link' | 'video' | 'image'
  url: string
  size: string | null
}

export interface Note {
  id: string
  timestamp: string
  content: string
  createdAt: string
}

export interface Quiz {
  id: string
  totalQuestions: number
  passingScore: number
  completed: boolean
  score: number | null
}

export interface LessonNavigation {
  id: string
  title: string
}

export interface LessonDetail {
  id: string
  title: string
  description: string
  type: 'video' | 'pdf' | 'quiz' | 'assignment'
  duration: string
  videoUrl?: string
  pdfUrl?: string
  thumbnailUrl: string
  courseId: string
  courseTitle: string
  moduleId: string
  moduleTitle: string
  order: number
  completed: boolean
  lastWatchedPosition: number
  resources: Resource[]
  transcript: string
  notes: Note[]
  quiz?: Quiz
  nextLesson: LessonNavigation | null
  previousLesson: LessonNavigation | null
}

// ============================================================================
// Progress Types
// ============================================================================

export interface ProgressUpdateRequest {
  lessonId: string
  courseId: string
  completed: boolean
  watchedDuration: number
  totalDuration: number
  progressPercentage: number
}

export interface ProgressUpdateResponse {
  success: boolean
  message: string
  data: {
    userId: string
    lessonId: string
    courseId: string
    completed: boolean
    watchedDuration: number
    totalDuration: number
    progressPercentage: number
    updatedAt: string
  }
}

// ============================================================================
// User Types
// ============================================================================

export interface UserStats {
  coursesEnrolled: number
  coursesCompleted: number
  totalLearningTime: number
  certificatesEarned: number
  currentStreak: number
  longestStreak: number
  totalPoints: number
  rank: string
}

export interface UserPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  weeklyDigest: boolean
  autoPlayVideos: boolean
  playbackSpeed: number
  subtitles: boolean
  theme: 'light' | 'dark' | 'auto'
  language: string
}

export interface SocialLinks {
  github?: string
  linkedin?: string
  twitter?: string
  website?: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar: string
  role: 'student' | 'instructor' | 'admin'
  joinedDate: string
  bio: string
  location: string
  timezone: string
  stats: UserStats
  preferences: UserPreferences
  socialLinks: SocialLinks
  badges: Badge[]
}

// ============================================================================
// Reports Types
// ============================================================================

export interface WeeklyActivity {
  week: string
  startDate: string
  endDate: string
  totalMinutes: number
  lessonsCompleted: number
  daysActive: number
}

export interface CourseProgress {
  courseId: string
  courseTitle: string
  progress: number
  timeSpent: number
  lessonsCompleted: number
  totalLessons: number
  lastAccessed: string
  estimatedCompletion: string
}

export interface SkillProgress {
  skill: string
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  progress: number
  lessonsCompleted: number
  totalLessons: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  date: string
  type: 'milestone' | 'performance' | 'excellence' | 'social'
}

export interface Recommendation {
  type: 'course' | 'practice' | 'skill' | 'article'
  title: string
  reason: string
  courseId?: string
  url?: string
}

export interface ReportsResponse {
  userId: string
  generatedAt: string
  period: string
  overview: {
    totalLearningTime: number
    averageDailyTime: number
    lessonsCompleted: number
    coursesInProgress: number
    coursesCompleted: number
    quizzesCompleted: number
    averageQuizScore: number
    currentStreak: number
    skillsAcquired: number
  }
  weeklyActivity: WeeklyActivity[]
  courseProgress: CourseProgress[]
  skillsProgress: SkillProgress[]
  achievements: Achievement[]
  recommendations: Recommendation[]
}

// ============================================================================
// Error Types
// ============================================================================

export interface ApiError {
  error: string
  message: string
  statusCode: number
}

export type ApiResponse<T> = T | ApiError

// Type guard to check if response is an error
export function isApiError(response: any): response is ApiError {
  return response && typeof response.error === 'string' && typeof response.statusCode === 'number'
}
