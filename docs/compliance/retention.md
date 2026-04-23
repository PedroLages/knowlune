# Data Retention Matrix

**Last updated:** 2026-04-23
**Owner:** Pedro Lages (Controller / Operator)
**Story:** E119-S10

This document is the authoritative retention schedule for all personal data processed by Knowlune.
It is mirrored as a typed TypeScript export in `src/lib/compliance/retentionPolicy.ts` and kept in
sync via the parity test in `src/lib/compliance/__tests__/retentionParity.test.ts`.

## Notes and Caveats

- **Invoice retention (TBC):** The 10-year placeholder follows standard EU VAT record-keeping
  guidance (Directive 2006/112/EC Art 244). Pedro must confirm the applicable member-state
  obligation with an accountant before treating 10y as final.
- **Breach register:** No application table exists. The register is maintained offline
  (encrypted document / password-manager note). It is listed here for completeness.
- **syncQueue dead-letter:** The Knowlune sync queue lives entirely in client-side IndexedDB.
  There is no server-side syncQueue table. Dead-letter purge is a local-device operation.
- **"Account lifetime + 30d":** Data is retained for the life of the account. After the user
  initiates account deletion, a 7-day grace period applies before hard deletion. The "+30d"
  headroom covers any replication lag or export window.
- **⚠ INDEFINITE — reviewer sign-off required:** Rows marked with this flag retain data with
  no automatic expiry. Each must be reviewed whenever the privacy notice is updated.

---

## Sync Tables (39 tables)

| Artefact | Data Categories | Lawful Basis | Retention Period | Deletion Mechanism | Owner | Notes |
|---|---|---|---|---|---|---|
| `content_progress` | Learning progress metrics | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P0 sync |
| `study_sessions` | Session timestamps, duration | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | Insert-only; P0 sync |
| `video_progress` | Video watch position, seconds watched | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P0 sync; monotonic |
| `notes` | User-authored notes (UGC) | Contract / Legitimate interest | Account lifetime + 30d | hardDeleteUser cascade | Pedro | Conflict-copy strategy; P1 sync |
| `bookmarks` | Course/video bookmarks (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P1 sync |
| `flashcards` | User-created flashcard content (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P1 sync |
| `review_records` | FSRS spaced-repetition review state | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | Derived from flashcards; P1 sync |
| `embeddings` | 384-dim semantic vectors derived from note content | Consent (ai_embeddings) | Purge with source note or on consent withdrawal | hardDeleteUser cascade; consent withdrawal effect | Pedro | Upload-only; P1 sync |
| `book_highlights` | Reader highlights (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P1 sync |
| `vocabulary_items` | Vocabulary items (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P1 sync; monotonic masteryLevel |
| `audio_bookmarks` | Audiobook position timestamps | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | Insert-only; P1 sync |
| `audio_clips` | Audiobook clip metadata (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P1 sync |
| `chat_conversations` | AI tutor conversation history | Consent (ai_tutor) | 365d rolling (pinned: indefinite ⚠ INDEFINITE — reviewer sign-off required) | retention-tick rolling delete; hardDeleteUser cascade | Pedro | 365d from last message; pinned conversations exempt |
| `learner_models` | Per-course AI learner profile | Consent (ai_embeddings / ai_tutor) | Purge with source or on consent withdrawal | hardDeleteUser cascade; consent withdrawal effect | Pedro | P1 sync |
| `user_consents` | Consent grants and withdrawals | Legal obligation (GDPR Art 7) | Account lifetime + 30d (audit trail: 5y pseudonymised) | hardDeleteUser cascade; audit rows pseudonymised | Pedro | Audit trail retained pseudonymised per legal obligation |
| `imported_courses` | Course metadata imported by user | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync; file handles stripped |
| `imported_videos` | Video metadata imported by user | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync; file handle stripped |
| `imported_pdfs` | PDF metadata imported by user | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync; file handle stripped |
| `authors` | Author metadata | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync; photo handle stripped |
| `books` | Book metadata, reading progress | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync; monotonic progress |
| `book_reviews` | User book reviews (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync |
| `shelves` | User reading shelves | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync |
| `book_shelves` | Shelf–book membership | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync |
| `reading_queue` | Ordered reading queue | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync |
| `chapter_mappings` | EPUB–audiobook chapter alignment | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P2 sync; compound PK |
| `learning_paths` | User-created learning paths | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync |
| `learning_path_entries` | Learning path course entries | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync |
| `challenges` | Learning challenges progress | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync; monotonic progress |
| `course_reminders` | Course reminder schedules | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync |
| `notifications` | In-app notifications | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync |
| `career_paths` | Career path definitions | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync; no write sites yet |
| `path_enrollments` | Career path enrolments | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync; no write sites yet |
| `study_schedules` | Study schedule configurations | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync |
| `opds_catalogs` | OPDS server configs (password in Vault) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync; password in Supabase Vault |
| `audiobookshelf_servers` | ABS server configs (apiKey in Vault) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync; apiKey in Supabase Vault |
| `notification_preferences` | Notification preference singleton | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P3 sync; singleton per user |
| `quizzes` | User quiz content (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | P4 sync |
| `quiz_attempts` | Quiz attempt history | Contract (service provision) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | Insert-only; P4 sync |
| `ai_usage_events` | AI feature usage analytics | Consent (analytics_telemetry) | Account lifetime + 30d | hardDeleteUser cascade | Pedro | Insert-only; P4 sync; anonymised for aggregate analytics |

---

## Storage Buckets (4 buckets)

| Artefact | Data Categories | Lawful Basis | Retention Period | Deletion Mechanism | Owner | Notes |
|---|---|---|---|---|---|---|
| `storage:audio` | Audiobook files uploaded by user | Contract (service provision) | Account lifetime + 30d | hardDeleteUser bucket sweep | Pedro | User-uploaded audiobook content |
| `storage:covers` | Book/course cover images | Contract (service provision) | Account lifetime + 30d | hardDeleteUser bucket sweep | Pedro | Cover images for library items |
| `storage:exports` | GDPR data export ZIP archives | Legal obligation (GDPR Art 20) | 7d (signed-URL TTL) | retention-tick bucket purge | Pedro | Signed URL expires after 7d; objects purged by retention-tick |
| `storage:attachments` | File attachments (UGC) | Contract (service provision) | Account lifetime + 30d | hardDeleteUser bucket sweep | Pedro | Attachments linked to notes or flashcards |

---

## Auxiliary Stores

| Artefact | Data Categories | Lawful Basis | Retention Period | Deletion Mechanism | Owner | Notes |
|---|---|---|---|---|---|---|
| `auth_session_logs` | Authentication events, session tokens | Legitimate interest (security) | 90d | Supabase Auth automatic rotation | Pedro | Supabase Auth managed; no app-level deletion needed |
| `sync_queue_dead_letter` | Failed sync operations (local IndexedDB only) | Contract (service provision) | 30d | retention-tick local purge (client-side) | Pedro | Client-side IndexedDB only; no server table |
| `breach_register` | Breach incident records (pseudonymised) | Legal obligation (GDPR Art 33) | 5y pseudonymised | Manual offline destruction | Pedro | Maintained offline; pseudonymised within 30d of incident |
| `invoices` | Billing records, payment references (Stripe) | Legal obligation (VAT / financial regulations) | 10y (TBC — confirm with accountant) | Manual / Stripe data retention policy | Pedro | Anonymise Stripe customer PII at account deletion; retain records for legal compliance |

---

## Consent-Purpose to Artefact Mapping

| Consent Purpose | Artefacts Covered |
|---|---|
| `ai_tutor` | `chat_conversations` |
| `ai_embeddings` | `embeddings`, `learner_models` |
| `voice_transcription` | (audio transcripts stored transiently; no persistent table yet) |
| `analytics_telemetry` | `ai_usage_events` |
| `marketing_email` | (email send logs at provider; no Knowlune application table) |

---

## Related Files

- `src/lib/compliance/retentionPolicy.ts` — typed TypeScript mirror of this matrix
- `src/lib/compliance/__tests__/retentionParity.test.ts` — CI parity test
- `src/lib/sync/tableRegistry.ts` — sync table definitions
- `src/lib/compliance/consentService.ts` — consent purpose enum
- `supabase/functions/retention-tick/index.ts` — enforcement job (E119-S11)
- `docs/compliance/consent-inventory.md` — consent purpose inventory
