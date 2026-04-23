/**
 * Retention Policy — E119-S10
 *
 * Typed TypeScript mirror of `docs/compliance/retention.md`.
 * This is the machine-readable contract consumed by the retention-tick job (E119-S11).
 *
 * The human-readable counterpart is `docs/compliance/retention.md`.
 * Both must stay in sync — the parity test in
 * `src/lib/compliance/__tests__/retentionParity.test.ts` enforces this at CI time.
 *
 * Design invariants:
 *   - Pure module: no Dexie, React, or Zustand imports.
 *   - `period: null` signals indefinite retention — requires explicit reviewer sign-off.
 *   - `purposeArtefacts` maps each CONSENT_PURPOSES value to the artefact keys it covers.
 *     Every consent purpose must appear here; the parity test enforces this.
 *
 * IMPORTANT: Every entry here must appear as a row in `docs/compliance/retention.md`
 * (and vice versa). Add new entries in both places simultaneously.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetentionEntry {
  /** Artefact identifier — matches the first column in retention.md */
  artefact: string
  /** Categories of personal data held in this artefact */
  dataCategories: string[]
  /** GDPR lawful basis for processing */
  lawfulBasis: string
  /**
   * Retention period as a human-readable string, or null for indefinite retention.
   * `null` entries require explicit reviewer sign-off (AC-6).
   */
  period: string | null
  /** How data is deleted when the period expires or the account is removed */
  deletionMechanism: string
  /** Responsible owner */
  owner: string
  /** Additional context or caveats */
  notes?: string
}

// ---------------------------------------------------------------------------
// Sync Tables (39 tables mirroring tableRegistry)
// ---------------------------------------------------------------------------

const syncTableEntries: readonly RetentionEntry[] = [
  // P0 — Core progress / session data
  {
    artefact: 'content_progress',
    dataCategories: ['Learning progress metrics'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P0 sync',
  },
  {
    artefact: 'study_sessions',
    dataCategories: ['Session timestamps', 'Duration'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'Insert-only; P0 sync',
  },
  {
    artefact: 'video_progress',
    dataCategories: ['Video watch position', 'Seconds watched'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P0 sync; monotonic',
  },

  // P1 — Notes, flashcards, annotations, AI learning data
  {
    artefact: 'notes',
    dataCategories: ['User-authored notes (UGC)'],
    lawfulBasis: 'Contract / Legitimate interest',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'Conflict-copy strategy; P1 sync',
  },
  {
    artefact: 'bookmarks',
    dataCategories: ['Course/video bookmarks (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P1 sync',
  },
  {
    artefact: 'flashcards',
    dataCategories: ['User-created flashcard content (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P1 sync',
  },
  {
    artefact: 'review_records',
    dataCategories: ['FSRS spaced-repetition review state'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'Derived from flashcards; P1 sync',
  },
  {
    artefact: 'embeddings',
    dataCategories: ['384-dim semantic vectors derived from note content'],
    lawfulBasis: 'Consent (ai_embeddings)',
    period: 'Purge with source note or on consent withdrawal',
    deletionMechanism: 'hardDeleteUser cascade; consent withdrawal effect',
    owner: 'Pedro',
    notes: 'Upload-only; P1 sync',
  },
  {
    artefact: 'book_highlights',
    dataCategories: ['Reader highlights (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P1 sync',
  },
  {
    artefact: 'vocabulary_items',
    dataCategories: ['Vocabulary items (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P1 sync; monotonic masteryLevel',
  },
  {
    artefact: 'audio_bookmarks',
    dataCategories: ['Audiobook position timestamps'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'Insert-only; P1 sync',
  },
  {
    artefact: 'audio_clips',
    dataCategories: ['Audiobook clip metadata (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P1 sync',
  },
  {
    artefact: 'chat_conversations',
    dataCategories: ['AI tutor conversation history'],
    lawfulBasis: 'Consent (ai_tutor)',
    // null for pinned conversations — see notes. Rolling 365d for non-pinned.
    // The retention-tick job must handle the rolling case; pinned = indefinite.
    period: null,
    deletionMechanism: 'retention-tick rolling delete; hardDeleteUser cascade',
    owner: 'Pedro',
    notes:
      '365d rolling for non-pinned conversations; pinned conversations are indefinite (INDEFINITE — reviewer sign-off required)',
  },
  {
    artefact: 'learner_models',
    dataCategories: ['Per-course AI learner profile'],
    lawfulBasis: 'Consent (ai_embeddings / ai_tutor)',
    period: 'Purge with source or on consent withdrawal',
    deletionMechanism: 'hardDeleteUser cascade; consent withdrawal effect',
    owner: 'Pedro',
    notes: 'P1 sync',
  },
  {
    artefact: 'user_consents',
    dataCategories: ['Consent grants and withdrawals'],
    lawfulBasis: 'Legal obligation (GDPR Art 7)',
    period: 'Account lifetime + 30d (audit trail: 5y pseudonymised)',
    deletionMechanism: 'hardDeleteUser cascade; audit rows pseudonymised',
    owner: 'Pedro',
    notes: 'Audit trail retained pseudonymised per legal obligation',
  },

  // P2 — Imported content metadata, books, shelves
  {
    artefact: 'imported_courses',
    dataCategories: ['Course metadata imported by user'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync; file handles stripped',
  },
  {
    artefact: 'imported_videos',
    dataCategories: ['Video metadata imported by user'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync; file handle stripped',
  },
  {
    artefact: 'imported_pdfs',
    dataCategories: ['PDF metadata imported by user'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync; file handle stripped',
  },
  {
    artefact: 'authors',
    dataCategories: ['Author metadata'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync; photo handle stripped',
  },
  {
    artefact: 'books',
    dataCategories: ['Book metadata', 'Reading progress'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync; monotonic progress',
  },
  {
    artefact: 'book_reviews',
    dataCategories: ['User book reviews (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync',
  },
  {
    artefact: 'shelves',
    dataCategories: ['User reading shelves'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync',
  },
  {
    artefact: 'book_shelves',
    dataCategories: ['Shelf–book membership'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync',
  },
  {
    artefact: 'reading_queue',
    dataCategories: ['Ordered reading queue'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync',
  },
  {
    artefact: 'chapter_mappings',
    dataCategories: ['EPUB–audiobook chapter alignment'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P2 sync; compound PK',
  },

  // P3 — Learning paths, scheduling, notifications, integrations
  {
    artefact: 'learning_paths',
    dataCategories: ['User-created learning paths'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync',
  },
  {
    artefact: 'learning_path_entries',
    dataCategories: ['Learning path course entries'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync',
  },
  {
    artefact: 'challenges',
    dataCategories: ['Learning challenges progress'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync; monotonic progress',
  },
  {
    artefact: 'course_reminders',
    dataCategories: ['Course reminder schedules'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync',
  },
  {
    artefact: 'notifications',
    dataCategories: ['In-app notifications'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync',
  },
  {
    artefact: 'career_paths',
    dataCategories: ['Career path definitions'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync; no write sites yet',
  },
  {
    artefact: 'path_enrollments',
    dataCategories: ['Career path enrolments'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync; no write sites yet',
  },
  {
    artefact: 'study_schedules',
    dataCategories: ['Study schedule configurations'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync',
  },
  {
    artefact: 'opds_catalogs',
    dataCategories: ['OPDS server configs (password in Vault)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync; password in Supabase Vault',
  },
  {
    artefact: 'audiobookshelf_servers',
    dataCategories: ['ABS server configs (apiKey in Vault)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync; apiKey in Supabase Vault',
  },
  {
    artefact: 'notification_preferences',
    dataCategories: ['Notification preference singleton'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P3 sync; singleton per user',
  },

  // P4 — Analytics / append-only events, quizzes
  {
    artefact: 'quizzes',
    dataCategories: ['User quiz content (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'P4 sync',
  },
  {
    artefact: 'quiz_attempts',
    dataCategories: ['Quiz attempt history'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'Insert-only; P4 sync',
  },
  {
    artefact: 'ai_usage_events',
    dataCategories: ['AI feature usage analytics'],
    lawfulBasis: 'Consent (analytics_telemetry)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser cascade',
    owner: 'Pedro',
    notes: 'Insert-only; P4 sync; anonymised for aggregate analytics',
  },
] as const

// ---------------------------------------------------------------------------
// Storage Buckets (4 buckets)
// ---------------------------------------------------------------------------

const storageBucketEntries: readonly RetentionEntry[] = [
  {
    artefact: 'storage:audio',
    dataCategories: ['Audiobook files uploaded by user'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser bucket sweep',
    owner: 'Pedro',
    notes: 'User-uploaded audiobook content',
  },
  {
    artefact: 'storage:covers',
    dataCategories: ['Book/course cover images'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser bucket sweep',
    owner: 'Pedro',
    notes: 'Cover images for library items',
  },
  {
    artefact: 'storage:exports',
    dataCategories: ['GDPR data export ZIP archives'],
    lawfulBasis: 'Legal obligation (GDPR Art 20)',
    period: '7d (signed-URL TTL)',
    deletionMechanism: 'retention-tick bucket purge',
    owner: 'Pedro',
    notes: 'Signed URL expires after 7d; objects purged by retention-tick',
  },
  {
    artefact: 'storage:attachments',
    dataCategories: ['File attachments (UGC)'],
    lawfulBasis: 'Contract (service provision)',
    period: 'Account lifetime + 30d',
    deletionMechanism: 'hardDeleteUser bucket sweep',
    owner: 'Pedro',
    notes: 'Attachments linked to notes or flashcards',
  },
] as const

// ---------------------------------------------------------------------------
// Auxiliary Stores
// ---------------------------------------------------------------------------

const auxiliaryEntries: readonly RetentionEntry[] = [
  {
    artefact: 'auth_session_logs',
    dataCategories: ['Authentication events', 'Session tokens'],
    lawfulBasis: 'Legitimate interest (security)',
    period: '90d',
    deletionMechanism: 'Supabase Auth automatic rotation',
    owner: 'Pedro',
    notes: 'Supabase Auth managed; no app-level deletion needed',
  },
  {
    artefact: 'sync_queue_dead_letter',
    dataCategories: ['Failed sync operations (local IndexedDB only)'],
    lawfulBasis: 'Contract (service provision)',
    period: '30d',
    deletionMechanism: 'retention-tick local purge (client-side)',
    owner: 'Pedro',
    notes: 'Client-side IndexedDB only; no server table',
  },
  {
    artefact: 'breach_register',
    dataCategories: ['Breach incident records (pseudonymised)'],
    lawfulBasis: 'Legal obligation (GDPR Art 33)',
    period: '5y pseudonymised',
    deletionMechanism: 'Manual offline destruction',
    owner: 'Pedro',
    notes: 'Maintained offline; pseudonymised within 30d of incident',
  },
  {
    artefact: 'invoices',
    dataCategories: ['Billing records', 'Payment references (Stripe)'],
    lawfulBasis: 'Legal obligation (VAT / financial regulations)',
    period: '10y (TBC — confirm with accountant)',
    deletionMechanism: 'Manual / Stripe data retention policy',
    owner: 'Pedro',
    notes:
      'Anonymise Stripe customer PII at account deletion; retain records for legal compliance',
  },
] as const

// ---------------------------------------------------------------------------
// Full policy export
// ---------------------------------------------------------------------------

/**
 * Complete retention policy array — one entry per artefact in retention.md.
 * Consumed by the retention-tick enforcement job (E119-S11).
 *
 * Entry order: sync tables (P0→P4), storage buckets, auxiliary stores.
 */
export const RETENTION_POLICY: readonly RetentionEntry[] = [
  ...syncTableEntries,
  ...storageBucketEntries,
  ...auxiliaryEntries,
]

// ---------------------------------------------------------------------------
// Consent-purpose → artefact mapping (AC-4 cross-check)
// ---------------------------------------------------------------------------

/**
 * Maps each CONSENT_PURPOSES value to the artefact keys it covers.
 * Used by the parity test to verify every consent purpose has at least one
 * corresponding retention entry.
 *
 * Keys must match exactly the values in CONSENT_PURPOSES from consentService.ts:
 *   'ai_tutor' | 'ai_embeddings' | 'voice_transcription' |
 *   'analytics_telemetry' | 'marketing_email'
 */
export const PURPOSE_ARTEFACTS: Record<string, string[]> = {
  ai_tutor: ['chat_conversations'],
  ai_embeddings: ['embeddings', 'learner_models'],
  // voice_transcription data is stored transiently during processing only —
  // no persistent application table exists yet. Listed here with an empty array
  // so the parity test knows this purpose is accounted for (not an oversight).
  voice_transcription: [],
  analytics_telemetry: ['ai_usage_events'],
  // marketing_email logs are held at the email provider (Resend), not in a
  // Knowlune application table. Listed here for completeness.
  marketing_email: [],
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** All artefact keys with indefinite retention (period: null) — require sign-off. */
export const INDEFINITE_RETENTION_ARTEFACTS: string[] = RETENTION_POLICY.filter(
  e => e.period === null,
).map(e => e.artefact)

/** Look up a retention entry by artefact key. */
export function getRetentionEntry(artefact: string): RetentionEntry | undefined {
  return RETENTION_POLICY.find(e => e.artefact === artefact)
}
