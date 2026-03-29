/**
 * Dexie Migration Checkpoint — v30
 *
 * This file provides a frozen snapshot of the complete IndexedDB schema at version 30.
 * Fresh installs skip the 30 incremental version declarations and create the full
 * schema in a single step. Existing users at lower versions still run incremental
 * migrations through the legacy version chain in schema.ts.
 *
 * When adding new schema versions:
 *   1. Add the new version to schema.ts (after the checkpoint gate)
 *   2. When you next cut a checkpoint, update CHECKPOINT_VERSION and CHECKPOINT_SCHEMA
 *      to reflect the new latest version
 *
 * @see schema.ts for the full migration chain and upgrade callbacks
 */

/**
 * The version number this checkpoint represents.
 * All versions up to (and including) this number are collapsed into
 * a single `db.version(CHECKPOINT_VERSION).stores(CHECKPOINT_SCHEMA)` call
 * for fresh installs.
 */
export const CHECKPOINT_VERSION = 30

/**
 * Complete schema snapshot at CHECKPOINT_VERSION.
 * This is the result of applying all migrations v1–v30 on a fresh database.
 *
 * IMPORTANT: This must exactly match the schema produced by running all
 * 30 incremental migrations. The unit test `schema-checkpoint.test.ts`
 * enforces this invariant.
 *
 * Note: `courses` table was dropped in v30 (E89-S01) — dead regular course system removed.
 */
export const CHECKPOINT_SCHEMA: Record<string, string> = {
  importedCourses: 'id, name, importedAt, status, *tags, source',
  importedVideos: 'id, courseId, filename, youtubeVideoId',
  importedPdfs: 'id, courseId, filename',
  progress: '[courseId+videoId], courseId, videoId',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
  screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
  contentProgress: '[courseId+itemId], courseId, itemId, status',
  challenges: 'id, type, deadline, createdAt',
  embeddings: 'noteId, createdAt',
  courseThumbnails: 'courseId',
  aiUsageEvents: 'id, featureType, timestamp, courseId',
  reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
  courseReminders: 'id, courseId',
  quizzes: 'id, lessonId, createdAt',
  quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
  videoCaptions: '[courseId+videoId], courseId, videoId',
  authors: 'id, name, createdAt',
  careerPaths: 'id',
  pathEnrollments: 'id, pathId, status',
  flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
  entitlements: 'userId',
  learningPaths: 'id, createdAt',
  learningPathEntries: 'id, [pathId+courseId], pathId',
  youtubeVideoCache: 'videoId, expiresAt',
  youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
  youtubeChapters: 'id, courseId, order',
  notifications: 'id, type, createdAt, readAt, dismissedAt',
  notificationPreferences: 'id',
}
