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

export interface VideoCaptionRecord {
  courseId: string
  videoId: string
  filename: string
  content: string // Raw SRT/WebVTT text
  format: 'srt' | 'vtt'
  createdAt: string // ISO date
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

// --- Author Types ---

export interface AuthorSocialLinks {
  website?: string
  linkedin?: string
  twitter?: string
}

export interface Author {
  id: string
  name: string
  avatar: string
  title: string
  bio: string
  shortBio: string
  specialties: string[]
  yearsExperience: number
  education?: string
  socialLinks: AuthorSocialLinks
  featuredQuote?: string
}

/**
 * @deprecated Dead regular course type — DB table dropped in Dexie v30 (E89-S01).
 * All page components, routes, and store logic for this type have been removed.
 * Remaining references exist only in legacy helper code (progress, suggestions, etc.)
 * that will be cleaned up when those modules migrate to ImportedCourse.
 * Use ImportedCourse for all new course data going forward.
 */
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
  authorId: string
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
  linkedNoteIds?: string[] // Bidirectional note links (E9B-S04)
}

// --- Imported Course Types (Story 1.1) ---
// These types support the File System Access API import flow.
// They exist alongside the existing Course/Module/Lesson types.

export type CourseStatus = 'importing' | 'ready' | 'error'

export type LearnerCourseStatus = 'not-started' | 'active' | 'completed' | 'paused'

export type VideoFormat = 'mp4' | 'mkv' | 'avi' | 'webm' | 'ts'

export type SupportedFileExtension = '.mp4' | '.mkv' | '.avi' | '.webm' | '.ts' | '.pdf'

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  fileSize: number // File size in bytes (E1B-S02)
}

export interface PdfMetadata {
  pageCount: number
}

export type CourseSource = 'local' | 'youtube'

export interface ImportedCourse {
  id: string
  name: string
  description?: string // AI-suggested or user-entered course description
  importedAt: string // ISO 8601
  category: string
  tags: string[]
  status: LearnerCourseStatus
  videoCount: number
  pdfCount: number
  directoryHandle: FileSystemDirectoryHandle | null
  authorId?: string // FK to ImportedAuthor.id (E25-S01 AC2)
  coverImageHandle?: FileSystemFileHandle // User-selected cover image from folder
  totalDuration?: number // Sum of all video durations in seconds (E1B-S02)
  totalFileSize?: number // Sum of all video file sizes in bytes (E1B-S02)
  maxResolutionHeight?: number // Highest video resolution height in px (E1B-S02)
  // YouTube fields (E28-S01)
  source?: CourseSource // undefined = 'local' (backward-compatible)
  youtubePlaylistId?: string // YouTube playlist ID
  youtubeChannelId?: string // YouTube channel ID
  youtubeChannelTitle?: string // Channel display name
  youtubeThumbnailUrl?: string // Playlist/channel thumbnail URL
  youtubePublishedAt?: string // ISO 8601 — playlist publish date
  lastRefreshedAt?: string // ISO 8601 — last metadata refresh timestamp (E28-S12)
}

export interface ImportedVideo {
  id: string
  courseId: string
  filename: string
  path: string
  duration: number
  format: VideoFormat
  order: number
  fileHandle: FileSystemFileHandle | null
  fileSize?: number // File size in bytes (E1B-S02)
  width?: number // Video width in pixels (E1B-S02)
  height?: number // Video height in pixels (E1B-S02)
  // YouTube fields (E28-S01)
  youtubeVideoId?: string // YouTube video ID (e.g., 'dQw4w9WgXcQ')
  youtubeUrl?: string // Full YouTube URL
  thumbnailUrl?: string // YouTube thumbnail URL
  description?: string // YouTube video description
  chapters?: Chapter[] // YouTube auto-detected chapters
  removedFromYouTube?: boolean // True if video was removed from YouTube (E28-S12)
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
  /** Last-viewed PDF page (1-based). Used by PdfContent to restore position. */
  currentPage?: number
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
  // Quality scoring fields (E11-S03)
  interactionCount?: number // Meaningful learning actions (seek, note, bookmark, navigate)
  breakCount?: number // Number of pause→resume cycles
  qualityScore?: number // 0-100 composite score (calculated on session end)
  qualityFactors?: QualityFactors // Individual factor scores
}

// --- Quality Scoring (Story 11.3) ---

export interface QualityFactors {
  activeTimeScore: number // 0-100, weight 40%
  interactionDensityScore: number // 0-100, weight 30%
  sessionLengthScore: number // 0-100, weight 15%
  breaksScore: number // 0-100, weight 15%
}

export type QualityTier = 'excellent' | 'good' | 'fair' | 'needs-improvement'
export type QualityTrend = 'improving' | 'stable' | 'declining'

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

// --- Course Embeddings (E52-S04) ---

export interface CourseEmbedding {
  courseId: string // Primary key: FK to ImportedCourse.id
  embedding: number[] // 384-dimensional vector (all-MiniLM-L6-v2)
  generatedAt: string // ISO timestamp
  sourceHash: string // SHA-256 of title+description+tags for change detection
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
  | 'auto_analysis'
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

/** @deprecated Use LearningPath + LearningPathEntry instead (E26-S01 multi-path migration) */
export interface LearningPathCourse {
  courseId: string // Primary key: course UUID
  position: number // 1-indexed sequence position
  justification: string // AI-provided reasoning for placement
  isManuallyOrdered: boolean // User manually reordered it
  generatedAt: string // ISO timestamp when path was generated
}

// --- Multi-Path Learning Journeys (E26-S01) ---

export interface LearningPath {
  id: string // Primary key: UUID
  name: string // User-facing name (e.g., "My Learning Path")
  description?: string // Optional description
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  isAIGenerated: boolean // true if created by AI path generation
}

export interface LearningPathEntry {
  id: string // Primary key: UUID
  pathId: string // FK → LearningPath.id
  courseId: string // FK → course UUID
  courseType: 'imported' | 'catalog' // Which course source
  position: number // 1-indexed sequence position
  justification?: string // AI-provided reasoning for placement
  isManuallyOrdered: boolean // User manually reordered it
}

// --- Spaced Review System (Story 11.1) ---

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface CourseReminder {
  id: string // UUID
  courseId: string // FK to ImportedCourse.id
  courseName: string // Denormalized for notification display
  days: DayOfWeek[] // Selected days of the week
  time: string // "HH:MM" format
  enabled: boolean
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

// --- Study Schedule (E50-S01) ---

export interface StudySchedule {
  id: string // Primary key: UUID
  courseId?: string // FK → ImportedCourse.id (optional for free-form blocks)
  learningPathId?: string // FK → LearningPath.id (future learning-path scheduling)
  title: string // User-facing schedule name
  days: DayOfWeek[] // Selected days of the week
  startTime: string // "HH:MM" format
  durationMinutes: number // Default 60
  recurrence: 'weekly' | 'daily' // Recurrence pattern
  reminderMinutes: number // Minutes before start to remind (default 15)
  enabled: boolean // Whether schedule is active
  timezone: string // IANA timezone (e.g., "America/New_York")
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

// --- Imported Author Types (Epic 25) ---
// These types support user-managed author profiles stored in IndexedDB.
// They exist alongside the existing Author type used for pre-seeded data.

export interface ImportedAuthor {
  id: string
  name: string
  title?: string // Professional title (e.g., "Software Engineering Expert")
  bio?: string // Biographical text (optional)
  shortBio?: string // Brief one-liner description
  photoUrl?: string // URL or object URL for display (optional)
  photoHandle?: FileSystemFileHandle // Optional: local file handle for photo
  courseIds: string[] // Linked imported course IDs
  specialties?: string[] // Specialty tags (E25-S01 AC5)
  yearsExperience?: number // Professional experience in years
  education?: string // Education background (e.g., "PhD Computer Science, MIT")
  socialLinks?: { website?: string; twitter?: string; linkedin?: string } // Social profile links (E25-S01 AC5)
  featuredQuote?: string // Memorable quote from the author
  isPreseeded: boolean // Flag indicating if bundled (e.g., Chase Hughes) (E25-S01 AC5)
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

// --- Notifications (E43-S06) ---

export type NotificationType =
  | 'course-complete'
  | 'streak-milestone'
  | 'import-finished'
  | 'achievement-unlocked'
  | 'review-due'
  | 'srs-due'
  | 'knowledge-decay'
  | 'recommendation-match'
  | 'milestone-approaching'
  | 'book-imported'
  | 'book-deleted'
  | 'highlight-review' // Daily highlight review surfacing (E86-S02)

export interface Notification {
  id: string // ULID (time-sortable, unique)
  type: NotificationType
  title: string
  message: string
  createdAt: string // ISO 8601
  readAt: string | null
  dismissedAt: string | null
  actionUrl?: string // Deep link (e.g., '/courses/react-101')
  metadata?: Record<string, unknown>
}

// --- Notification Preferences ---

export interface NotificationPreferences {
  id: 'singleton' // Fixed PK — single-row config
  // Per-type toggles (all default true)
  courseComplete: boolean
  streakMilestone: boolean
  importFinished: boolean
  achievementUnlocked: boolean
  reviewDue: boolean
  srsDue: boolean
  knowledgeDecay: boolean
  recommendationMatch: boolean
  milestoneApproaching: boolean
  bookImported: boolean
  bookDeleted: boolean
  highlightReview: boolean // Daily highlight review surfacing (E86-S02)
  // Quiet hours
  quietHoursEnabled: boolean
  quietHoursStart: string // "HH:MM" (24h format)
  quietHoursEnd: string // "HH:MM" (24h format)
  updatedAt: string // ISO 8601
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

/**
 * FSRS card state machine:
 * 0 = New, 1 = Learning, 2 = Review, 3 = Relearning
 */
export type CardState = 0 | 1 | 2 | 3

export interface ReviewRecord {
  id: string // UUID
  noteId: string // FK to Note.id
  rating: ReviewRating // Last rating given
  // FSRS scheduling fields (replaces SM-2 easeFactor/interval/reviewCount)
  stability: number // FSRS memory stability (days) — higher = slower forgetting
  difficulty: number // FSRS difficulty (0-10) — higher = harder card
  reps: number // Cumulative successful reviews
  lapses: number // Times card was forgotten (rated "Again" from Review state)
  state: CardState // FSRS state machine: 0=New, 1=Learning, 2=Review, 3=Relearning
  elapsed_days: number // Days since last review
  scheduled_days: number // Days until next review (as scheduled)
  due: string // ISO 8601 — when next review is due
  last_review?: string // ISO 8601 — when last reviewed (undefined = never reviewed)
}

export interface Flashcard {
  id: string // UUID
  courseId: string // FK to ImportedCourse.id ('' for book-sourced flashcards)
  noteId?: string // Optional: provenance from note (for traceability)
  /** Discriminated source for back-navigation (E85-S04, E85-S05) */
  sourceType?: 'course' | 'book'
  sourceBookId?: string // FK to Book.id (when sourceType === 'book')
  sourceHighlightId?: string // FK to BookHighlight.id (when sourceType === 'book')
  front: string // Question / prompt text
  back: string // Answer text
  // Embedded FSRS fields — self-contained, no join needed
  stability: number // FSRS memory stability (days) — default 0
  difficulty: number // FSRS difficulty (0-10) — default 0
  reps: number // Cumulative successful reviews — default 0
  lapses: number // Times card was forgotten — default 0
  state: CardState // FSRS state machine: 0=New, 1=Learning, 2=Review, 3=Relearning — default 0
  elapsed_days: number // Days since last review — default 0
  scheduled_days: number // Days until next review (as scheduled) — default 0
  due: string // ISO 8601 — when next review is due
  last_review?: string // ISO 8601 — when last reviewed (undefined = never)
  lastRating?: ReviewRating // Most recent rating
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

// --- Career Paths (Story 20.1) ---

export interface CareerPathStage {
  id: string // e.g., 'web-dev-stage-1'
  title: string // e.g., 'Foundations'
  description: string
  courseIds: string[] // References to Course.id or ImportedCourse.id
  skills: string[] // Skill tags for this stage
  estimatedHours: number
}

export interface CareerPath {
  id: string // e.g., 'behavioral-intelligence'
  title: string // e.g., 'Behavioral Intelligence'
  description: string
  icon: string // Lucide icon name (e.g., 'Brain')
  stages: CareerPathStage[]
  totalEstimatedHours: number
  createdAt: string // ISO 8601
}

export type PathEnrollmentStatus = 'active' | 'completed' | 'dropped'

export interface PathEnrollment {
  id: string // UUID
  pathId: string // FK to CareerPath.id
  enrolledAt: string // ISO 8601
  status: PathEnrollmentStatus
  completedAt?: string // ISO 8601 (set when all stages done)
}

export type EntitlementTier = 'free' | 'trial' | 'premium'

export interface CachedEntitlement {
  userId: string // PK — matches Supabase auth.users.id
  tier: EntitlementTier
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  planId?: string
  expiresAt?: string // ISO 8601
  trialEnd?: string // ISO 8601 — trial expiration date (E19-S08)
  hadTrial?: boolean // true if user has previously used a free trial (E19-S08)
  cachedAt: string // ISO 8601 — for 7-day TTL check
}

// --- YouTube Types (E28-S01) ---

export interface YouTubeVideoCache {
  videoId: string // PK — YouTube video ID
  title: string
  description: string
  channelId: string
  channelTitle: string
  thumbnailUrl: string
  duration: number // seconds
  publishedAt: string // ISO 8601
  chapters: Chapter[]
  fetchedAt: string // ISO 8601
  expiresAt: string // ISO 8601 — cache TTL expiry
}

export interface YouTubeTranscriptRecord {
  courseId: string // Compound PK part 1
  videoId: string // Compound PK part 2 (YouTube video ID)
  language: string // e.g., 'en', 'es'
  cues: TranscriptCue[]
  fullText: string // Concatenated cue text for full-text search
  source: 'youtube-transcript' | 'yt-dlp' | 'whisper' // Transcript extraction tier
  status: 'pending' | 'fetching' | 'done' | 'failed' | 'unavailable'
  failureReason?: string // e.g., 'no-captions-available', 'network-error'
  fetchedAt: string // ISO 8601
}

// --- Book / Library Types (E83) ---

export type BookFormat = 'epub' | 'pdf' | 'audiobook'

export type BookStatus = 'unread' | 'reading' | 'finished' | 'abandoned'

/** User reading goals persisted in localStorage */
export interface ReadingGoal {
  /** Whether daily goal is measured in minutes or pages */
  dailyType: 'minutes' | 'pages'
  /** Daily target value (minutes or pages) */
  dailyTarget: number
  /** Target number of books to finish in the current year */
  yearlyBookTarget: number
  /** ISO 8601 timestamp of last update */
  updatedAt: string
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

/** Where the file content lives */
export type ContentSource =
  | { type: 'local'; opfsPath: string }
  | { type: 'remote'; url: string; auth?: { username: string; password: string } }
  | { type: 'fileHandle'; handle: FileSystemFileHandle }

/** Position within a book */
export type ContentPosition =
  | { type: 'cfi'; value: string } // EPUB CFI
  | { type: 'time'; seconds: number } // Audiobook
  | { type: 'page'; pageNumber: number } // PDF

export interface BookChapter {
  id: string
  bookId: string
  title: string
  order: number
  position: ContentPosition
}

export interface Book {
  id: string // UUID v4
  title: string
  author: string
  narrator?: string // Audiobook narrator (E101-S03)
  format: BookFormat
  status: BookStatus
  coverUrl?: string
  description?: string
  tags: string[]
  chapters: BookChapter[]
  source: ContentSource
  currentPosition?: ContentPosition
  totalPages?: number
  totalDuration?: number // audiobook seconds
  progress: number // 0-100
  isbn?: string
  rating?: number // 1-5
  createdAt: string // ISO 8601
  updatedAt?: string // ISO 8601
  lastOpenedAt?: string // ISO 8601
  fileSize?: number // bytes
  finishedAt?: string // ISO 8601 — set when status transitions to 'finished'
  absServerId?: string // FK to AudiobookshelfServer.id (if sourced from ABS)
  absItemId?: string // ABS item ID for dedup on re-sync
}

export interface BookHighlight {
  id: string // UUID v4
  bookId: string
  cfiRange?: string // EPUB CFI range
  textAnchor: string // highlighted text snippet (selected text)
  /** Surrounding context: 30 chars before and after the selection (for fallback matching) */
  textContext?: { prefix: string; suffix: string }
  chapterHref?: string // EPUB chapter href for grouping in HighlightListPanel
  note?: string
  color: HighlightColor
  flashcardId?: string // FK to Flashcard.id
  position: ContentPosition
  createdAt: string // ISO 8601
  updatedAt?: string // ISO 8601
}

/** A bookmark within an audiobook chapter */
export interface AudioBookmark {
  id: string // UUID v4
  bookId: string // FK to Book.id
  chapterIndex: number // 0-based index into Book.chapters
  timestamp: number // seconds from chapter start
  note?: string
  createdAt: string // ISO 8601
}

/** OPDS catalog connection configuration (E88-S01) */
export interface OpdsCatalog {
  id: string // UUID v4
  name: string // User-assigned display name
  url: string // OPDS catalog root URL
  auth?: {
    username: string
    // NOTE: Password stored in plaintext — acceptable for local-first architecture
    // where data never leaves the device. Must be encrypted before any cloud sync
    // or backup feature is introduced (tracked for pre-sync encryption work).
    password: string
  }
  lastSynced?: string // ISO 8601
  createdAt: string // ISO 8601
}

/** Audiobookshelf server connection configuration (E101-S01) */
export interface AudiobookshelfServer {
  id: string // UUID v4
  name: string // User-friendly label (e.g., "Home Server")
  url: string // Base URL (e.g., "http://192.168.1.50:13378")
  // NOTE: API key stored in plaintext — acceptable for local-first architecture
  // where data never leaves the device. Must be encrypted before any cloud sync
  // or backup feature is introduced (tracked for pre-sync encryption work).
  apiKey: string // Bearer token from ABS Settings > Users > API Keys
  libraryIds: string[] // Selected ABS library IDs to sync
  status: 'connected' | 'offline' | 'auth-failed'
  lastSyncedAt?: string // ISO date of last successful catalog fetch
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

// ABS REST API response shapes (E101-S01)

export interface AbsLibrary {
  id: string
  name: string
  mediaType: string // 'book' | 'podcast'
}

export interface AbsLibraryItem {
  id: string
  ino: string // inode — used in streaming URLs
  media: {
    metadata: {
      title: string
      authors: Array<{ id: string; name: string }>
      narrators: string[]
      duration: number // seconds
      numChapters: number
      description?: string
      isbn?: string
      series?: string
      seriesSequence?: string
    }
    coverPath?: string
    chapters: Array<{ id: string; title: string; start: number; end: number }>
    duration?: number // seconds — newer ABS versions place duration here instead of metadata
  }
}

/** Full item has the same shape as AbsLibraryItem — extended in E102+ if needed */
export type AbsItem = AbsLibraryItem

export interface AbsSearchResult {
  book: AbsLibraryItem[]
}

export interface AbsProgress {
  id: string
  currentTime: number // seconds
  duration: number // seconds
  progress: number // 0-1
  isFinished: boolean
  updatedAt: number // Unix timestamp ms
}

export interface YouTubeCourseChapter {
  id: string // PK — UUID
  courseId: string // FK to ImportedCourse.id
  videoId: string // YouTube video ID
  title: string
  startTime: number // seconds
  endTime?: number // seconds (derived from next chapter or video duration)
  order: number // Display order within the course
}
