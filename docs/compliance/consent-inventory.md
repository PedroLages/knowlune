# Consent Inventory

**Version**: 2026-04-23.1
**Owner**: Pedro Lages (controller / operator)
**Review cycle**: On any material change to data processing or sub-processors.

This document is the **single source of truth** for every personal-data processing purpose in Knowlune.
All consent UI (`E119-S08`), AI routing guards (`E119-S08`, `E119-S09`), and compliance reports
(`E119-S12`) derive their purpose metadata from this file.

---

## Purpose Keys and Processing Bases

### Core Purposes (Lawful basis: `contract` — no toggle available)

These activities are strictly necessary to deliver the service the user has contracted for.
They cannot be withdrawn without terminating the account.

| Purpose Key               | Description                                                                                   | Lawful Basis | Data Categories                           | Processor(s)          | Default | Withdrawable |
|---------------------------|-----------------------------------------------------------------------------------------------|--------------|-------------------------------------------|-----------------------|---------|--------------|
| `core_auth`               | Authenticate users and maintain secure sessions.                                              | contract     | Email, password hash, session tokens      | Supabase (Auth)       | on      | no           |
| `core_sync`               | Synchronise learning progress, notes, and bookmarks across devices.                           | contract     | Progress records, notes, bookmarks, highlights | Supabase (DB/Storage) | on  | no           |
| `core_billing`            | Process subscription payments and manage entitlements.                                        | contract     | Billing email, subscription status        | Stripe                | on      | no           |
| `core_export`             | Fulfil GDPR Article 20 data-portability requests.                                             | contract     | All personal data (packaged for export)   | Supabase (Storage)    | on      | no           |

---

### Consent Purposes (Lawful basis: `consent` — user-controlled toggles)

These activities require explicit, freely given, specific, and informed consent per GDPR Art. 6(1)(a).
Each consent is independent — bundling is prohibited (GDPR Art. 7(2)).

| Purpose Key              | Description                                                                                    | Lawful Basis | Data Categories                                      | Processor(s)                  | Default | Withdrawable |
|--------------------------|------------------------------------------------------------------------------------------------|--------------|------------------------------------------------------|-------------------------------|---------|--------------|
| `ai_tutor`               | Send learning content to an AI model to generate explanations, quizzes, and study suggestions. | consent      | Course content, notes, question text                 | See provider registry         | off     | yes          |
| `ai_embeddings`          | Generate vector embeddings of notes and highlights for semantic search and recommendations.    | consent      | Notes, bookmarks, highlights (text fragments)        | See provider registry         | off     | yes          |
| `voice_transcription`    | Transcribe audio recordings (voice notes, audiobook narration corrections) to text.            | consent      | Voice recordings, transcription text                 | Speaches / Whisper (self-hosted) | off  | yes          |
| `analytics_telemetry`    | Collect anonymised usage events (feature interactions, session durations) for product improvement. | consent  | Anonymised interaction events, session metadata      | Internal (IndexedDB + Supabase) | off   | yes          |
| `marketing_email`        | Send product announcements, tips, and promotional emails.                                      | consent      | Email address, first name                            | Resend                        | off     | yes          |

---

## Withdrawal Effects

When a user withdraws consent for a purpose, the following effects are applied **atomically**.
Partial application is never permitted — the system rolls back if any step fails.

| Purpose Key              | Withdrawal Effect                                                                                         | Re-grant Behaviour                                              |
|--------------------------|-----------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| `ai_tutor`               | Cancel any in-flight AI requests. No historical data deleted (prompt text is not retained server-side).   | Immediately available; no data regeneration needed.             |
| `ai_embeddings`          | Delete all embedding rows from `embeddings` table and Supabase Storage bucket `embeddings/`. Mark learner model snapshot with `frozen_reason: 'consent_withdrawn'`. | Embeddings are NOT auto-regenerated. Learner model un-freezes on next content write. |
| `voice_transcription`    | Delete pending audio processing jobs. Past transcripts are retained as part of the user's notes.          | Immediately available; new recordings are processed.            |
| `analytics_telemetry`    | Delete all rows from `ai_usage_events` (and any other telemetry tables introduced later).                 | Immediately starts collecting new events.                       |
| `marketing_email`        | Unsubscribe the user from all marketing lists (Resend suppression list).                                  | User must re-subscribe; prior suppression is lifted.            |

---

## AI Provider Registry

The following table enumerates AI providers by `provider_id`.
Provider identity is defined as the **legal entity** and DPA-listed sub-processor — not the model version.
A model version bump (e.g. GPT-4 → GPT-5 within OpenAI) does **not** trigger re-consent.
A provider identity change (e.g. switching from OpenAI to Anthropic) **does** trigger re-consent per `E119-S09`.

| Provider ID   | Legal Entity            | Data Transferred            | Sub-processor Agreement |
|---------------|-------------------------|-----------------------------|-------------------------|
| `ollama`      | Self-hosted (no transfer) | None (processed locally)  | N/A                     |
| `openai`      | OpenAI, L.L.C.          | Prompt text, context window | OpenAI DPA (via API)   |
| `anthropic`   | Anthropic, PBC          | Prompt text, context window | Anthropic DPA (via API)|
| `speaches`    | Self-hosted Whisper     | Audio fragments (local)     | N/A                     |

---

## Notices Referenced

| Purpose Key(s)          | Notice Document                                      | Current Version  |
|-------------------------|------------------------------------------------------|------------------|
| all                     | `docs/compliance/privacy-notice.md`                  | 2026-04-23.1     |

---

## Change Log

| Date        | Change                                           | Author       |
|-------------|--------------------------------------------------|--------------|
| 2026-04-23  | Initial inventory (E119-S07)                    | Pedro Lages  |
| 2026-04-23  | Added provider registry section (E119-S09)      | Pedro Lages  |
