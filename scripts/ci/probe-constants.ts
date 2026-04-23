/**
 * E119-S04: CI probe constants — re-export shim
 *
 * Mirrors TABLE_NAMES and STORAGE_BUCKETS from
 * supabase/functions/_shared/hardDeleteUser.ts as plain TypeScript arrays
 * so the deletion probe can run in a Node/tsx context without transpiling
 * Deno URL imports (e.g. `https://esm.sh/@supabase/supabase-js@2`).
 *
 * IMPORTANT: Keep this list in sync with TABLE_NAMES in hardDeleteUser.ts.
 * If you add a table to hardDeleteUser.ts, add it here too — or the CI probe
 * will silently miss that table. The authoritative source of truth for the
 * erasure registry is src/lib/sync/tableRegistry.ts → ERASURE_TABLE_NAMES.
 */

export const TABLE_NAMES: string[] = [
  // P0 — Core progress / session data
  'content_progress',
  'study_sessions',
  'video_progress',
  // P1 — Notes, flashcards, annotations, AI learning data
  'notes',
  'bookmarks',
  'flashcards',
  'review_records',
  'embeddings',
  'book_highlights',
  'vocabulary_items',
  'audio_bookmarks',
  'audio_clips',
  'chat_conversations',
  'learner_models',
  // P2 — Imported content metadata, books, shelves
  'imported_courses',
  'imported_videos',
  'imported_pdfs',
  'authors',
  'books',
  'book_reviews',
  'shelves',
  'book_shelves',
  'reading_queue',
  'chapter_mappings',
  // P3 — Learning paths, scheduling, notifications, integrations
  'learning_paths',
  'learning_path_entries',
  'challenges',
  'course_reminders',
  'notifications',
  'career_paths',
  'path_enrollments',
  'study_schedules',
  'opds_catalogs',
  'audiobookshelf_servers',
  'notification_preferences',
  // P4 — Analytics / append-only events, quizzes
  'quizzes',
  'quiz_attempts',
  'ai_usage_events',
]

/** Storage buckets containing user-prefixed objects. */
export const STORAGE_BUCKETS: string[] = ['avatars', 'course-media', 'audio', 'exports']
