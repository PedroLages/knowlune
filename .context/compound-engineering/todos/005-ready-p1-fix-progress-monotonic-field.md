---
status: ready
priority: p1
issue_id: "005"
tags: [e92-s03, sync, registry, monotonic]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Fix monotonicFields — watchedSeconds and progress don't exist on Dexie records

## Problem Statement

Two registry entries declare `monotonicFields` that name properties not present on the corresponding Dexie record:

1. **`progress.monotonicFields: ['watchedSeconds']`** — VideoProgress Dexie type has `currentTime` (playback position), not `watchedSeconds`. `watchedSeconds` is the camelCase of the *Supabase* column name, not a Dexie property.
2. **`books.monotonicFields: ['progress']`** — 'progress' does not appear as a key in `books.fieldMap`, IDENTITY_FIELD_MAP, or any documented Book property.

Consequences:
- E92-S05 upload phase reads `entry.monotonicFields[i]` to determine which fields need `GREATEST()` treatment. For these entries, `record['watchedSeconds']` returns `undefined`.
- Passed to `upsert_video_progress(p_watched_seconds => NULL)` → SQLSTATE 23502 (NOT NULL violation) on every video progress upload, **OR** if the upload layer defensively pads with 0, every upload zeros-out cumulative watch time — permanent data loss.
- The registry invariant test (`fieldMapper.test.ts:251-264`) only checks `monotonicFields` entries contain no underscore — `watchedSeconds` passes, giving a false green.

Cross-reviewer agreement: 6 independent reviewers flagged this (adversarial, correctness, testing, kieran-ts, data-migrations, api-contract). High-confidence finding.

## Findings

- **Locations:** `src/lib/sync/tableRegistry.ts:223-224` (progress), and books.monotonicFields entry (approx line 470)
- **Surfaced by:** 6 reviewers, confidence boost to 0.98
- **Related:** Testing reviewer T-01 also proposed a new invariant test that would catch this class of bug.
- **Convention inconsistency:** `vocabularyItems.monotonicFields: ['masteryLevel']` — where `masteryLevel` IS the Dexie property — works correctly. The registry has no enforced convention about which side (Dexie vs Supabase) monotonicFields names.

## Proposed Solutions

### Option 1: Standardize on Dexie-side names (camelCase)

**Approach:**
- Change `progress.monotonicFields` to `['currentTime']` (the real Dexie field)
- Audit/fix books.monotonicFields (likely should be a `readingProgress` or similar — depends on actual Book type)
- Document in the TableRegistryEntry JSDoc: "monotonicFields name Dexie-side camelCase property names. The upload phase reads the record using these names and applies GREATEST() on the forward-mapped Supabase column."
- Add a registry invariant: for each `monotonicField`, assert it is a key in `entry.fieldMap` OR a key in `IDENTITY_FIELD_MAP`. This catches "names a Supabase column" mistakes.

**Pros:**
- Matches the existing correct case (`vocabularyItems.masteryLevel`)
- Naturally testable invariant
- Makes the upload phase contract clear

**Cons:**
- None significant

**Effort:** 1 hour
**Risk:** Low

## Recommended Action

**Option 1.** Add the invariant test (see todo #009). This is the single fix that eliminates the entire class of bug.

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts:223-224` — progress entry
- `src/lib/sync/tableRegistry.ts` — books entry monotonicFields
- `src/lib/sync/tableRegistry.ts:49-71` — TableRegistryEntry.monotonicFields JSDoc
- `src/lib/sync/__tests__/fieldMapper.test.ts:251-264` — replace "no underscore" invariant with "resolves through fieldMap"
- `src/data/types.ts` — Book type (verify monotonic field name)

**Related components:**
- E92-S05 upload phase — consumes monotonicFields
- `upsert_video_progress` RPC — expects watched_seconds as NOT NULL

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding IDs:** ADV-001 (adversarial), COR-002 (correctness), T-01 (testing), KT findings (kieran-ts), DM-005 (data-migrations), AC-008 (api-contract)

## Acceptance Criteria

- [ ] `progress.monotonicFields` = `['currentTime']`
- [ ] `books.monotonicFields` corrected to a real Book property (verify against Book type)
- [ ] JSDoc on TableRegistryEntry.monotonicFields documents Dexie-side naming convention
- [ ] New registry invariant test: every `monotonicFields` entry is a key in `IDENTITY_FIELD_MAP ∪ entry.fieldMap`
- [ ] The old "no underscore" invariant remains (still useful)
- [ ] `npm run test:unit` passes

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- 6 independent reviewers converged on this finding — strongest signal in the run
- Filed as P1, routed to downstream-resolver
