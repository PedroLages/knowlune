---
status: ready
priority: p1
issue_id: "006"
tags: [e92-s03, sync, registry, idempotency]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Add clientRequestId mapping for study_sessions — NOT NULL violation on every insert

## Problem Statement

Migration `20260417000003_p0_sync_foundation_r4.sql` (R4.1) **dropped the DEFAULT** from `study_sessions.client_request_id` to enforce idempotency. The column is now `UUID NOT NULL` with no server-side default. The migration header explicitly states: *"Clients MUST supply a stable UUID per logical session; omitting the column raises NOT NULL violation (SQLSTATE 23502) at insert time."*

But `tableRegistry.studySessions` has **no registry mapping at all** for `clientRequestId → client_request_id`:
- No fieldMap entry
- No stripFields entry
- No mention in the comment block

And the Dexie `StudySession` interface has no `clientRequestId` field (checkpoint.ts:64 confirms the index schema has no such field).

Consequence: any upload path using fieldMapper alone to build the payload will omit `client_request_id`. Every study_sessions INSERT will fail with SQLSTATE 23502. Streak tracking permanently broken for all users.

## Findings

- **Locations:** 
  - `src/lib/sync/tableRegistry.ts:182-215` (studySessions registry entry)
  - `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql:42-43` (column constraint)
  - `src/data/types.ts` — StudySession interface
  - `src/db/checkpoint.ts:64` — Dexie index schema
- **Surfaced by:** adversarial (ADV-002), correctness (COR-005), data-migrations (DM-001) — 3 reviewers converged
- **Existing registry comment at lines 193-207** documents the `updated_at` absence but makes no mention of client_request_id — which is actually the more important omission.

## Proposed Solutions

### Option 1: Add clientRequestId to StudySession + registry

**Approach:**
- Add `clientRequestId: string` as a required field on the Dexie `StudySession` interface
- Add `clientRequestId: 'client_request_id'` to `studySessions.fieldMap`
- The session-start logic (wherever StudySessions are created in Dexie) must generate a stable UUID per logical session and persist it on the record. `crypto.randomUUID()` is available in modern browsers.
- The Dexie version stays at v52 — no schema change (no index), just a new field on the row
- Add a registry entry comment flagging the idempotency contract

**Pros:**
- Aligns Dexie and Supabase semantics (each session has one UUID)
- Preserves the idempotency guarantee end-to-end
- E92-S05 upload handles it automatically via fieldMapper

**Cons:**
- Existing Dexie StudySession records (pre-fix) will have undefined `clientRequestId`. Need a migration or backfill to assign UUIDs to historical rows before they upload.

**Effort:** 2-4 hours (registry + type + session-start logic + backfill path)
**Risk:** Medium — requires coordination with session-tracking code in `src/features/sessions/**` or equivalent

---

### Option 2: Generate UUID at upload time (in E92-S05)

**Approach:** Registry adds an entry comment "E92-S05 must inject client_request_id before upload." Upload layer generates and persists a UUID keyed on session id before calling fieldMapper.

**Pros:**
- Dexie shape stays unchanged

**Cons:**
- UUID must be **stable** across retries — upload must persist to Dexie on first attempt and reuse on subsequent retries. This requires idempotency tracking in the upload layer itself, which is the wrong abstraction — the UUID should live with the session, not with the upload.
- Breaks the "registry is a complete data contract" principle

**Effort:** 3-5 hours
**Risk:** Medium-high

## Recommended Action

**Option 1.** This is Dexie-native data; the UUID belongs on the session record. E92-S05 inherits a correctly-shaped Dexie record and doesn't need special-case logic.

## Technical Details

**Affected files:**
- `src/data/types.ts` — StudySession interface
- `src/lib/sync/tableRegistry.ts:182-215` — studySessions entry
- `src/features/sessions/**` or wherever StudySessions are created (needs investigation)
- `src/lib/sync/backfill.ts` — possibly add a one-time backfill that stamps UUIDs on legacy records with missing clientRequestId

**Related components:**
- Session-tracking UI / service (creates StudySession rows)
- E92-S05 upload phase

**Database changes:** None in Dexie (the index schema already doesn't care about non-indexed fields). Supabase is already correct.

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding IDs:** ADV-002, COR-005, DM-001
- **Migration:** `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql`

## Acceptance Criteria

- [ ] `StudySession` Dexie type has `clientRequestId: string` (required field)
- [ ] `studySessions.fieldMap` includes `clientRequestId: 'client_request_id'`
- [ ] Session-start code generates a stable UUID per logical session
- [ ] Legacy StudySession records (if any exist in tests/dev) get backfilled with UUIDs
- [ ] Test: toSnakeCase on a StudySession produces `client_request_id` in output
- [ ] Registry comment updated to reflect the client-side UUID generation contract
- [ ] `npm run test:unit` passes

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- 3-reviewer convergence on missing idempotency field
- Filed as P1, routed to downstream-resolver
