/**
 * Dexie Migration Checkpoint — v38
 *
 * This file provides a frozen snapshot of the complete IndexedDB schema at version 38.
 * Fresh installs skip the incremental version declarations and create the full
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
export const CHECKPOINT_VERSION = 45

/**
 * Complete schema snapshot at CHECKPOINT_VERSION.
 * This is the result of applying all migrations v1–v38 on a fresh database.
 *
 * IMPORTANT: This must exactly match the schema produced by running all
 * 41 incremental migrations. The unit test `schema-checkpoint.test.ts`
 * enforces this invariant.
 *
 * Note: `courses` table was dropped in v30 (E89-S01) — dead regular course system removed.
 * v31 (E59-S03): flashcards and reviewRecords indexes updated for FSRS migration.
 * v35 (E52-S01): courseEmbeddings table added for ML quiz generation.
 * v36 (E50-S01): studySchedules table for calendar integration.
 * v37 (E83-S01): books, bookHighlights, bookFiles tables for book library.
 * v38 (E87-S01): audioBookmarks table for audiobook chapter bookmarks.
 * v39 (E88-S01): opdsCatalogs table for OPDS catalog connections.
 * v40 (E101-S01): audiobookshelfServers table for ABS server connections.
 * v41 (E103-S01): chapterMappings table for EPUB↔audiobook chapter alignment.
 * v42 (E109-S01): vocabularyItems table for vocabulary tracking.
 * v44 (E110-S01): shelves + bookShelves tables for Smart Shelves.
 * v45 (E110-S02): series index added to books for series grouping.
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
  reviewRecords: 'id, noteId, due, last_review',
  courseReminders: 'id, courseId',
  quizzes: 'id, lessonId, createdAt, transcriptHash',
  quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
  videoCaptions: '[courseId+videoId], courseId, videoId',
  authors: 'id, name, createdAt',
  careerPaths: 'id',
  pathEnrollments: 'id, pathId, status',
  flashcards: 'id, courseId, noteId, due, createdAt',
  entitlements: 'userId',
  learningPaths: 'id, createdAt',
  learningPathEntries: 'id, [pathId+courseId], pathId',
  youtubeVideoCache: 'videoId, expiresAt',
  youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
  youtubeChapters: 'id, courseId, order',
  notifications: 'id, type, createdAt, readAt, dismissedAt',
  notificationPreferences: 'id',
  courseEmbeddings: 'courseId',
  studySchedules: 'id, courseId, learningPathId, enabled',
  books: 'id, title, author, format, status, createdAt, lastOpenedAt, series',
  bookHighlights: 'id, bookId, color, flashcardId, createdAt, lastReviewedAt, reviewRating',
  bookFiles: '[bookId+filename], bookId',
  audioBookmarks: 'id, bookId, chapterIndex, timestamp, createdAt',
  opdsCatalogs: 'id, name, url, createdAt',
  audiobookshelfServers: 'id, name, url, status, lastSyncedAt',
  chapterMappings: '[epubBookId+audioBookId], epubBookId, audioBookId',
  vocabularyItems: 'id, bookId, masteryLevel, createdAt',
  shelves: 'id, name, isDefault, sortOrder, createdAt',
  bookShelves: 'id, bookId, shelfId, [bookId+shelfId], addedAt',
}

// v42 (E109-S01): vocabularyItems table added
// v43 (E109-S02): (data-only migration, no schema change)
// v44 (E110-S01): shelves + bookShelves tables added for Smart Shelves
// v45 (E110-S02): series index added to books for series grouping
