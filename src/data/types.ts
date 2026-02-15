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

export interface Resource {
  id: string
  title: string
  type: ResourceType
  filePath: string
  fileName: string
  metadata?: {
    captions?: CaptionTrack[]
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
}

export interface Note {
  id: string
  content: string // Markdown text
  timestamp?: number // Video position when created (in seconds)
  createdAt: string // ISO 8601 timestamp
  updatedAt: string // ISO 8601 timestamp
  tags: string[] // Extracted from #hashtags in content
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
