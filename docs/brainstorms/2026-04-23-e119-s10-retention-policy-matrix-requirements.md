# E119-S10: Retention Policy Matrix — Requirements

## Problem Statement

Knowlune stores personal data across 26 sync tables, 4 Storage buckets, auth/session logs, and
several auxiliary stores. There is no single authoritative document listing what data is kept, for
how long, on what lawful basis, and how it is deleted. Without this matrix the retention-tick job
(S11) has no typed contract to enforce, and the privacy notice retention section is generic. GDPR
Art 5(1)(e) requires storage-limitation documentation and enforcement.

## Acceptance Criteria

- **AC-1** `docs/compliance/retention.md` contains a table with columns: artefact, data categories,
  lawful basis, retention period, deletion mechanism, owner, notes. Covers all 26 sync tables, 4
  Storage buckets (audio, covers, exports, attachments), auth/session logs, syncQueue dead-letter,
  breach register, invoices, and exports bucket signed-URL TTL.
- **AC-2** Retention defaults match plan §10:
  - UGC (notes/highlights/flashcards/etc.): account lifetime + 30d.
  - AI chat transcripts: 365d rolling unless pinned.
  - Embeddings/learner model: purge with source or consent withdrawal.
  - Auth/session logs: 90d.
  - syncQueue dead-letter: 30d.
  - Breach register: 5y pseudonymised.
  - Invoices: 10y (TBC — Pedro confirms with accountant).
  - Exports bucket objects: 7d.
- **AC-3** `src/lib/compliance/retentionPolicy.ts` exports a typed `RETENTION_POLICY` array
  mirroring every row in retention.md.
- **AC-4** Parity test `src/lib/compliance/__tests__/retentionParity.test.ts` asserts:
  - Every supabaseTable in tableRegistry has an entry in retentionPolicy.
  - Every purpose in CONSENT_PURPOSES has an entry in retentionPolicy.
  - Every entry in retentionPolicy appears in retention.md artefact column (and vice versa).
- **AC-5** `PrivacyPolicy.tsx` retention section links to `retention.md` and reflects actual periods.
- **AC-6** Test flags entries with `period: null` (indefinite retention) as requiring reviewer sign-off.

## Out of Scope

- Retention enforcement job (S11).
- Annual retention review workflow (S13).
- Invoice retention confirmation with accountant (noted in retention.md as TBC).

## Technical Context

- `src/lib/sync/tableRegistry.ts` — all 26 sync tables (supabaseTable names).
- `src/lib/compliance/consentService.ts` — CONSENT_PURPOSES enum.
- `src/app/pages/legal/PrivacyPolicy.tsx` — retention section to update.
- `supabase/functions/retention-tick/index.ts` — skeleton from S03; S11 will flesh out.
- `docs/compliance/retention.md` — currently a TODO placeholder.

## Open Questions

- Q1: Invoice retention period — 10y is the placeholder. Pedro needs to confirm with accountant.
  Noted in retention.md with a TBC flag.
- Q2: Breach register storage: currently only documented; no table exists. Note as "manual/offline"
  in the matrix with pseudonymised 5y retention.
