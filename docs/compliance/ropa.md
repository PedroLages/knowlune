# Record of Processing Activities (ROPA)

**Article 30 GDPR — Controller Record**

**Last updated:** 2026-04-23
**Owner:** Pedro Lages (Controller / Operator)
**Story:** E119-S12
**Review cycle:** On any material change to data processing, sub-processors, or retention periods.

---

## Notes

- Controller and Processor are the same legal entity (Pedro Lages / Knowlune) for all activities
  except those delegated to Supabase, Stripe, and other sub-processors listed below.
- "Account lifetime + 30d" means data is retained for the life of the account; after the user
  initiates deletion a 7-day grace period applies before hard deletion, with +30d headroom for
  replication lag. See `docs/compliance/retention.md` for full details.
- Retention values in this table are summaries; `docs/compliance/retention.md` is authoritative.
- Lawful bases are derived from `docs/compliance/consent-inventory.md`.

---

## Processing Activities

| # | Activity | Controller | Processor | Purpose | Lawful Basis (Art 6) | Data Categories | Recipients / Sub-processors | Retention Period |
|---|----------|-----------|-----------|---------|---------------------|-----------------|----------------------------|-----------------|
| 1 | **Authentication & Session Management** | Pedro Lages / Knowlune | Supabase Ireland Ltd (Auth) | Authenticate users and maintain secure sessions across devices | Art 6(1)(b) — Performance of contract | Email address, password hash (bcrypt), session tokens, refresh tokens, OAuth provider tokens (Google) | Supabase (Auth service) | Account lifetime + 30d; session tokens expire per Supabase policy |
| 2 | **Learning Content Storage & Sync** | Pedro Lages / Knowlune | Supabase Ireland Ltd (DB / Storage) | Store and synchronise learning progress, notes, bookmarks, flashcards, and media across devices | Art 6(1)(b) — Performance of contract | Course progress, study session data, notes (UGC), bookmarks, flashcards, video progress, highlights, vocabulary, quiz content, audiobook positions | Supabase (Postgres DB, Object Storage) | Account lifetime + 30d; deleted via cascade on account deletion |
| 3 | **AI Tutoring & Semantic Features** | Pedro Lages / Knowlune | Self-hosted (Ollama on Unraid) or third-party AI provider (Anthropic / OpenAI / Google — user-selected, consent-gated) | Generate AI explanations, quizzes, semantic search embeddings, and study recommendations | Art 6(1)(a) — Consent (ai_tutor, ai_embeddings); Art 6(1)(b) for on-device WebLLM | Query text (course content, notes, question text); vector embeddings (384-dim) stored in Supabase; learner profile (per-course AI state) | Anthropic (claude API), OpenAI (gpt API), Google (Gemini API), Groq — only when user has granted AI consent; Supabase (embedding storage) | Embeddings purged on consent withdrawal; chat history 365d rolling (pinned: indefinite, requires sign-off); learner models purged on withdrawal |
| 4 | **Billing & Subscription Management** | Pedro Lages / Knowlune | Stripe, Inc. | Process subscription payments and manage entitlement state | Art 6(1)(b) — Performance of contract | Billing email, subscription status, Stripe customer ID (card details held exclusively by Stripe; never reach Knowlune servers) | Stripe (payment processing) | Account lifetime + 30d for Knowlune-side Stripe IDs; Stripe retains payment records per their legal obligations (7y for financial records) |
| 5 | **Telemetry & Analytics** | Pedro Lages / Knowlune | Supabase Ireland Ltd (DB); Sentry (error tracking) | Collect anonymised usage events for product improvement; capture error telemetry for bug resolution | Art 6(1)(a) — Consent (analytics_telemetry) for usage events; Art 6(1)(f) — Legitimate interests for error tracking (anonymised stack traces only) | Anonymised interaction events, session metadata (ai_usage_events); anonymised stack traces (Sentry) | Supabase (ai_usage_events table); Sentry (error events) | Account lifetime + 30d for ai_usage_events; purged on consent withdrawal for analytics_telemetry; Sentry events retained per Sentry plan (90d default) |
| 6 | **Sync Queue Operations** | Pedro Lages / Knowlune | Client-side (IndexedDB, no server-side sync queue table) | Manage offline-first sync operations and resolve conflicts | Art 6(1)(b) — Performance of contract | Sync queue entries (locally mirrored learning data — no new data categories); dead-letter entries (failed sync operations) | No third-party sub-processor; client-side IndexedDB only | Dead-letter entries purged by local retention-tick; no server-side syncQueue table exists |
| 7 | **Marketing Email** | Pedro Lages / Knowlune | Resend, Inc. | Send product announcements, tips, and promotional emails (consent-gated) | Art 6(1)(a) — Consent (marketing_email) | Email address, first name | Resend (transactional email service) | Until consent withdrawn; unsubscribe processed within 24h |
| 8 | **GDPR Data Export** | Pedro Lages / Knowlune | Supabase Ireland Ltd (Storage) | Fulfil Art 20 data-portability requests by packaging all user data into a downloadable ZIP archive | Art 6(1)(c) — Legal obligation (GDPR Art 20) | All personal data categories listed above | Supabase (exports Storage bucket; signed URL) | Export objects purged after 7 days (signed-URL TTL); deleted by retention-tick bucket purge |
| 9 | **Voice Transcription** | Pedro Lages / Knowlune | Speaches / Whisper (self-hosted on Unraid — first-party infrastructure) | Transcribe user voice recordings to text for voice notes and audiobook narration corrections | Art 6(1)(a) — Consent (voice_transcription) | Voice recordings (audio data), transcription text | No third-party sub-processor; self-hosted Speaches service on operator's Unraid server | Transcription text retained as part of user notes (account lifetime + 30d); source audio not retained after transcription |

---

## Art 30 Coverage Checklist

Per Art 30(1) GDPR, the controller's record must contain:

- [x] Name and contact details of the controller — Pedro Lages / Knowlune; privacy@knowlune.com
- [x] Purposes of processing — Column "Purpose" above
- [x] Description of categories of data subjects and personal data — Columns "Data Categories" above
- [x] Categories of recipients — Column "Recipients / Sub-processors" above
- [x] Transfers to third countries or international organisations — Stripe (US), Anthropic (US), OpenAI (US), Google (US); covered by SCCs / adequacy decisions or DPA clauses
- [x] Time limits for erasure — Column "Retention Period" above; full detail in `docs/compliance/retention.md`
- [x] General description of technical and organisational security measures — See `docs/compliance/dpa-supabase.md` Section 5 (Art 32 measures)

---

## Related Documents

- `docs/compliance/retention.md` — Authoritative retention schedule (machine-readable mirror in `src/lib/compliance/retentionPolicy.ts`)
- `docs/compliance/consent-inventory.md` — Lawful basis and purpose registry
- `docs/compliance/subprocessors.md` — Full sub-processor register with DPA links
- `docs/compliance/dpa-supabase.md` — Data Processing Agreement with Supabase
- `docs/compliance/privacy-notice.md` — Public-facing privacy notice
