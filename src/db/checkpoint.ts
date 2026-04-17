/**
 * Dexie Migration Checkpoint — v52
 *
 * This file provides a frozen snapshot of the complete IndexedDB schema at version 52.
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
export const CHECKPOINT_VERSION = 52

/**
 * Complete schema snapshot at CHECKPOINT_VERSION.
 * This is the result of applying all migrations v1–v52 on a fresh database.
 *
 * IMPORTANT: This must exactly match the schema produced by running all
 * incremental migrations. The unit test `schema-checkpoint.test.ts`
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
 * v46 (E110-S03): readingQueue table.
 * v47 (E111-S01): audioClips table.
 * v48 (E113-S01): bookReviews table.
 * v49 (E57-S03): chatConversations table.
 * v50 (E57-S05): transcriptEmbeddings table.
 * v51 (E72-S01): learnerModels table.
 * v52 (E92-S02): sync foundation — `userId` + `[userId+updatedAt]` indexes on all
 *                syncable tables; new `syncQueue` and `syncMetadata` tables.
 */
export const CHECKPOINT_SCHEMA: Record<string, string> = {
  importedCourses: 'id, name, importedAt, status, *tags, source, userId, [userId+updatedAt]',
  importedVideos: 'id, courseId, filename, youtubeVideoId, userId, [userId+updatedAt]',
  importedPdfs: 'id, courseId, filename, userId, [userId+updatedAt]',
  progress: '[courseId+videoId], courseId, videoId, userId, [userId+updatedAt]',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt, userId, [userId+updatedAt]',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt, userId, [userId+updatedAt]',
  screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  studySessions:
    'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime, userId, [userId+updatedAt]',
  contentProgress: '[courseId+itemId], courseId, itemId, status, userId, [userId+updatedAt]',
  challenges: 'id, type, deadline, createdAt, userId, [userId+updatedAt]',
  embeddings: 'noteId, createdAt, userId, [userId+updatedAt]',
  courseThumbnails: 'courseId',
  aiUsageEvents: 'id, featureType, timestamp, courseId, userId, [userId+updatedAt]',
  reviewRecords: 'id, noteId, due, last_review, userId, [userId+updatedAt]',
  courseReminders: 'id, courseId, userId, [userId+updatedAt]',
  quizzes: 'id, lessonId, createdAt, transcriptHash, userId, [userId+updatedAt]',
  quizAttempts: 'id, quizId, [quizId+completedAt], completedAt, userId, [userId+updatedAt]',
  videoCaptions: '[courseId+videoId], courseId, videoId',
  authors: 'id, name, createdAt, userId, [userId+updatedAt]',
  careerPaths: 'id, userId, [userId+updatedAt]',
  pathEnrollments: 'id, pathId, status, userId, [userId+updatedAt]',
  flashcards: 'id, courseId, noteId, due, createdAt, userId, [userId+updatedAt]',
  entitlements: 'userId',
  learningPaths: 'id, createdAt, userId, [userId+updatedAt]',
  learningPathEntries: 'id, [pathId+courseId], pathId, userId, [userId+updatedAt]',
  youtubeVideoCache: 'videoId, expiresAt',
  youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
  youtubeChapters: 'id, courseId, order',
  notifications: 'id, type, createdAt, readAt, dismissedAt, userId, [userId+updatedAt]',
  notificationPreferences: 'id, userId, [userId+updatedAt]',
  courseEmbeddings: 'courseId',
  studySchedules: 'id, courseId, learningPathId, enabled, userId, [userId+updatedAt]',
  books: 'id, title, author, format, status, createdAt, lastOpenedAt, series, userId, [userId+updatedAt]',
  bookHighlights:
    'id, bookId, color, flashcardId, createdAt, lastReviewedAt, reviewRating, userId, [userId+updatedAt]',
  bookFiles: '[bookId+filename], bookId',
  audioBookmarks: 'id, bookId, chapterIndex, timestamp, createdAt, userId, [userId+updatedAt]',
  opdsCatalogs: 'id, name, url, createdAt, userId, [userId+updatedAt]',
  audiobookshelfServers: 'id, name, url, status, lastSyncedAt, userId, [userId+updatedAt]',
  chapterMappings: '[epubBookId+audioBookId], epubBookId, audioBookId, userId, [userId+updatedAt]',
  vocabularyItems: 'id, bookId, masteryLevel, createdAt, userId, [userId+updatedAt]',
  shelves: 'id, name, isDefault, sortOrder, createdAt, userId, [userId+updatedAt]',
  bookShelves: 'id, bookId, shelfId, [bookId+shelfId], addedAt, userId, [userId+updatedAt]',
  readingQueue: 'id, bookId, sortOrder, addedAt, userId, [userId+updatedAt]',
  audioClips: 'id, bookId, chapterId, createdAt, sortOrder, userId, [userId+updatedAt]',
  bookReviews: 'id, bookId, createdAt, userId, [userId+updatedAt]',
  chatConversations: 'id, [courseId+videoId], courseId, updatedAt, userId, [userId+updatedAt]',
  transcriptEmbeddings: 'id, [courseId+videoId], courseId, createdAt',
  learnerModels: 'id, courseId, userId, [userId+updatedAt]',
  // v52 (E92-S02): sync infrastructure tables
  syncQueue: '++id, status, [tableName+recordId], createdAt',
  syncMetadata: 'table',
}

// v42 (E109-S01): vocabularyItems table added
// v43 (E109-S02): (data-only migration, no schema change)
// v44 (E110-S01): shelves + bookShelves tables added for Smart Shelves
// v45 (E110-S02): series index added to books for series grouping
// v46 (E110-S03): readingQueue table for reading queue
// v47 (E111-S01): audioClips table for audio clip ranges
// v48 (E113-S01): bookReviews table for personal book reviews & star ratings
// v49 (E57-S03): chatConversations table for tutor chat persistence
// v50 (E57-S05): transcriptEmbeddings table for RAG-grounded tutor answers
// v51 (E72-S01): learnerModels table for persistent per-course learner profiles
// v52 (E92-S02): userId + [userId+updatedAt] on all syncable tables; syncQueue + syncMetadata.
//                Excluded: screenshots, courseThumbnails, videoCaptions, entitlements,
//                youtubeVideoCache, youtubeTranscripts, youtubeChapters, courseEmbeddings,
//                bookFiles, transcriptEmbeddings.
