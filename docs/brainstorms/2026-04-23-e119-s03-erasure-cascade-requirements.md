# E119-S03: Registry-Driven Erasure Cascade — Requirements

## Problem Statement

The existing `delete-account` Edge Function only performs a soft-delete (sets `deleted_at` on the auth row). It has no hard-delete phase and no cascade across application data tables. When a user's 7-day grace period expires, no automated mechanism removes their rows from the 38 sync tables or their objects from the 4 Storage buckets. This violates GDPR Article 17 (right to erasure): deletion must be complete, verifiable, and registry-driven so adding a new sync table automatically includes it in the cascade.

## Acceptance Criteria

- **AC-1**: `delete-account` Edge Function hard-delete phase iterates all `tableRegistry` entries and deletes rows matching `user_id` for each Supabase table (service-role bypass RLS).
- **AC-2**: Hard-delete phase also iterates `STORAGE_BUCKETS = ['avatars', 'course-media', 'audio', 'exports']` and removes user-prefixed objects from each bucket.
- **AC-3**: Soft-delete phase (immediate): `deleted_at` set on auth + `pending_deletion_at` marker on shared `user_metadata` or a dedicated column; user can still log in to cancel during 7-day grace.
- **AC-4**: `cancel-account-deletion` Edge Function reverses soft-delete; reactivates auth user, clears `pending_deletion_at`, no data lost.
- **AC-5**: `retention-tick` skeleton function exists; includes a branch that calls the hard-delete cascade for users whose soft-delete timestamp is > 7 days old.
- **AC-6**: Lawful-basis exceptions documented in code comments + linked to `docs/compliance/retention.md` placeholder: billing rows anonymised/retained, breach-register references pseudonymised.
- **AC-7**: Stripe anonymisation on delete: scrub email/name/address via Stripe API (`stripe.customers.update`), retain customer + invoices for tax retention.
- **AC-8**: Post-delete probe test asserts every registry table returns zero rows for the test user after hard-delete.
- **AC-9**: Registry-drift CI test: adding a new `tableRegistry` entry without updating cascade code fails the probe test (coverage enforced by table count assertion).
- **AC-10**: `supabase/functions/main/index.ts` routes `cancel-account-deletion` and updated `delete-account` (no changes needed — main router is path-based, auto-discovers new function directories).

## Out of Scope

- Sending confirmation emails (S04).
- Full retention-tick scheduling (S11).
- Export functionality (S05, S06).
- Formal `retention.md` document (S10 — only a placeholder comment/link is needed here).

## Technical Context

### Existing Infrastructure

- `supabase/functions/delete-account/index.ts`: CORS + JWT auth already wired. Currently only calls `supabase.auth.admin.deleteUser(userId, true)` (soft-delete). Must be extended with soft-delete phase + hard-delete function.
- `src/lib/sync/tableRegistry.ts`: 38 entries (`tableRegistry` array export), each with `supabaseTable` field. The cascade must iterate `tableRegistry.map(e => e.supabaseTable)`.
- `SOFT_DELETE_GRACE_DAYS = 7` constant exists in both Edge Function and frontend `deleteAccount.ts` — preserve and keep in sync.
- `supabase/functions/cancel-account-deletion/` directory does NOT yet exist — must be created.
- `supabase/functions/retention-tick/` directory does NOT yet exist — skeleton must be created.
- `src/lib/__tests__/deleteAccount.test.ts`: existing Vitest unit test for the frontend `deleteAccount.ts` module. Extend with cascade path coverage.
- `supabase/functions/main/index.ts`: path-based router — no change needed; it auto-discovers `cancel-account-deletion` as a new directory.

### Storage Buckets

`STORAGE_BUCKETS = ['avatars', 'course-media', 'audio', 'exports']`

Objects stored with user-prefixed path (`{userId}/...`). List all objects with prefix `{userId}/` and remove them.

### Stripe Anonymisation (AC-7)

On hard-delete: call `stripe.customers.update(customerId, { email: `deleted-{userId}@deleted.invalid`, name: 'Deleted User', address: null })`. Stripe customer and invoices are retained (tax obligation). Handle Stripe API failure gracefully (log + continue — don't block erasure).

### tableRegistry Table List (38 tables as of E119)

`content_progress`, `study_sessions`, `video_progress`, `notes`, `bookmarks`, `flashcards`, `review_records`, `embeddings`, `book_highlights`, `vocabulary_items`, `audio_bookmarks`, `audio_clips`, `chat_conversations`, `learner_models`, `imported_courses`, `imported_videos`, `imported_pdfs`, `authors`, `books`, `book_reviews`, `shelves`, `book_shelves`, `reading_queue`, `chapter_mappings`, `learning_paths`, `learning_path_entries`, `challenges`, `course_reminders`, `notifications`, `career_paths`, `path_enrollments`, `study_schedules`, `opds_catalogs`, `audiobookshelf_servers`, `notification_preferences`, `quizzes`, `quiz_attempts`, `ai_usage_events`

### Soft-delete Marker (AC-3)

Supabase `auth.admin.deleteUser(userId, true)` sets `deleted_at` on `auth.users`. For `pending_deletion_at`, store in `auth.users.raw_user_meta_data` via `supabase.auth.admin.updateUserById(userId, { user_metadata: { pending_deletion_at: now } })`. This is readable during grace period cancellation.

### Registry-Drift Test (AC-9)

Probe test in `src/lib/__tests__/deleteAccount.test.ts` asserts the table count used by the cascade equals `tableRegistry.length`. If a developer adds a new table without updating the cascade, the count assertion fails CI.

## Open Questions

- None blocking. The `pending_deletion_at` implementation via `raw_user_meta_data` is standard Supabase pattern for per-user metadata without schema migrations.
