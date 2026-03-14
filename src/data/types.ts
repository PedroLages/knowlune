export type CourseCategory =
  | 'behavioral-analysis'
  | 'influence-authority'
  | 'confidence-mastery'
  | 'operative-training'
  | 'research-library'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type ResourceType = 'video' | 'pdf' | 'audio' | 'image' | 'markdown'

export interface CaptionTrack {
  src: string
  label: string
  language: string
  default?: boolean
}

export interface Chapter {
  time: number // start time in seconds
  title: string
}

export interface TranscriptCue {
  startTime: number
  endTime: number
  text: string
}

export interface Resource {
  id: string
  title: string
  type: ResourceType
  filePath: string
  fileName: string
  metadata?: {
    captions?: CaptionTrack[]
    chapters?: Chapter[]
    duration?: number
  }
}

export interface Lesson {
  id: string
  title: string
  description: string
  order: number
  resources: Resource[]
  keyTopics: string[]
  duration?: string
}

export interface Module {
  id: string
  title: string
  description: string
  order: number
  lessons: Lesson[]
}

// --- Instructor Types ---

export interface InstructorSocialLinks {
  website?: string
  linkedin?: string
  twitter?: string
}

export interface Instructor {
  id: string
  name: string
  avatar: string
  title: string
  bio: string
  shortBio: string
  specialties: string[]
  yearsExperience: number
  education?: string
  socialLinks: InstructorSocialLinks
  featuredQuote?: string
}

export interface Course {
  id: string
  title: string
  shortTitle: string
  description: string
  category: CourseCategory
  difficulty: Difficulty
  totalLessons: number
  totalVideos: number
  totalPDFs: number
  estimatedHours: number
  tags: string[]
  coverImage?: string
  modules: Module[]
  isSequential: boolean
  basePath: string
  instructorId: string
}

export interface Note {
  id: string
  courseId: string // Parent course ID (for Dexie indexing)
  videoId: string // Lesson/video ID (unique index — one note doc per video)
  content: string // Markdown text
  timestamp?: number // Video position when created (in seconds)
  createdAt: string // ISO 8601 timestamp
  updatedAt: string // ISO 8601 timestamp
  tags: string[] // Managed via explicit tag UI (normalized: lowercase, trimmed, sorted)
  deleted?: boolean // Soft delete flag (NFR24)
  deletedAt?: string // ISO 8601 timestamp of soft deletion (NFR24)
}

// --- Imported Course Types (Story 1.1) ---
// These types support the File System Access API import flow.
// They exist alongside the existing Course/Module/Lesson types.

export type CourseStatus = 'importing' | 'ready' | 'error'

export type LearnerCourseStatus = 'active' | 'completed' | 'paused'

export type VideoFormat = 'mp4' | 'mkv' | 'avi' | 'webm'

export type SupportedFileExtension = '.mp4' | '.mkv' | '.avi' | '.webm' | '.pdf'

export interface VideoMetadata {
  duration: number
  width: number
  height: number
}

export interface PdfMetadata {
  pageCount: number
}

export interface ImportedCourse {
  id: string
  name: string
  importedAt: string // ISO 8601
  category: string
  tags: string[]
  status: LearnerCourseStatus
  videoCount: number
  pdfCount: number
  directoryHandle: FileSystemDirectoryHandle
}

export interface ImportedVideo {
  id: string
  courseId: string
  filename: string
  path: string
  duration: number
  format: VideoFormat
  order: number
  fileHandle: FileSystemFileHandle
}

export interface ImportedPdf {
  id: string
  courseId: string
  filename: string
  path: string
  pageCount: number
  fileHandle: FileSystemFileHandle
}

// --- Content Completion Status (Story 4.1) ---

export type CompletionStatus = 'not-started' | 'in-progress' | 'completed'

export interface ContentProgress {
  courseId: string
  itemId: string // lesson or module ID
  status: CompletionStatus
  updatedAt: string // ISO 8601
}

// --- Video Progress & Bookmarks (Story 2.1) ---

export interface VideoProgress {
  courseId: string
  videoId: string
  currentTime: number
  completionPercentage: number
  completedAt?: string // ISO 8601
}

export interface VideoBookmark {
  id: string
  courseId: string
  lessonId: string
  timestamp: number // seconds
  label: string
  createdAt: string // ISO 8601
}

export interface Screenshot {
  id: string
  courseId: string
  lessonId: string
  timestamp: number // Video position in seconds when captured
  blob: Blob // Full-resolution JPEG
  thumbnail: Blob // 200px-wide JPEG thumbnail for inline display
  createdAt: string // ISO 8601
}

export type ThumbnailSource = 'auto' | 'local' | 'url' | 'ai'

export interface CourseThumbnail {
  courseId: string // Primary key
  blob: Blob // 200×112px JPEG
  source: ThumbnailSource
  createdAt: string // ISO 8601
}

export interface StudySession {
  id: string // UUID
  courseId: string // Parent course
  contentItemId: string // Lesson/video/PDF ID
  startTime: string // ISO 8601 timestamp
  endTime?: string // ISO 8601 (undefined = active/orphaned)
  duration: number // Active seconds (excludes idle time)
  idleTime: number // Idle seconds detected
  videosWatched: string[] // Video IDs watched during session
  lastActivity: string // ISO 8601 of last interaction
  sessionType: 'video' | 'pdf' | 'mixed'
}

// --- Learning Challenges (Story 6.1) ---

export type ChallengeType = 'completion' | 'time' | 'streak'

export interface Challenge {
  id: string
  name: string // 1-60 chars
  type: ChallengeType
  targetValue: number // > 0
  deadline: string // ISO 8601 date
  createdAt: string // ISO 8601 timestamp
  currentProgress: number // starts at 0 (updated by E06-S02)
  celebratedMilestones: number[] // [25, 50, 75, 100] (used by E06-S03)
  completedAt?: string // ISO 8601 (set when 100% reached)
}

// --- AI / Vector Embeddings (Epic 9) ---

export interface NoteEmbedding {
  noteId: string // Primary key (references notes.id)
  embedding: Float32Array // 384-dim vector (all-MiniLM-L6-v2)
  model: string // e.g., 'all-MiniLM-L6-v2'
  createdAt: string // ISO timestamp
}

// --- Streak Milestones (Story 5.6) ---

export interface StreakMilestone {
  id: string // UUID
  milestoneValue: number // 7, 30, 60, 100
  earnedAt: string // ISO 8601
  streakStartDate: string // ISO 8601 date string — identifies which streak instance
}

// --- Vector Embeddings (Story 9.3) ---

export interface Embedding {
  noteId: string // Primary key: note UUID
  embedding: number[] // 384-dimensional vector
  createdAt: string // ISO timestamp
}

// --- AI Usage Events (Story 9B.6) ---

export type AIFeatureType =
  | 'summary'
  | 'qa'
  | 'learning_path'
  | 'note_organization'
  | 'knowledge_gaps'

export interface AIUsageEvent {
  id: string // UUID
  featureType: AIFeatureType
  courseId?: string // Optional — not all features are course-scoped
  timestamp: string // ISO 8601
  durationMs?: number // How long the AI operation took
  status: 'success' | 'error'
  metadata?: Record<string, unknown> // Feature-specific data
}

// --- Learning Path (Story 9B.3) ---

export interface LearningPathCourse {
  courseId: string // Primary key: course UUID
  position: number // 1-indexed sequence position
  justification: string // AI-provided reasoning for placement
  isManuallyOrdered: boolean // User manually reordered it
  generatedAt: string // ISO timestamp when path was generated
}
