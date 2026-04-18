---
status: ready
priority: p1
issue_id: "002"
tags: [e92-s03, sync, registry, schema-drift]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Fix contentProgress fieldMap — schema drift against Supabase content_progress

## Problem Statement

`tableRegistry.contentProgress.fieldMap` declares `{ courseId: 'course_id', itemId: 'item_id' }`, but the actual Supabase `content_progress` table (from migration `20260413000001_p0_sync_foundation.sql`) has columns `content_id` and `content_type`, not `course_id` or `item_id`. The `upsert_content_progress` RPC takes `p_content_id` and `p_content_type`.

Every upload to content_progress will:
1. Emit the wrong column names (`course_id`, `item_id`)
2. Hit `onConflict` with targets that don't exist on the table
3. Be rejected by Postgres

Additionally, `compoundPkFields: ['courseId', 'itemId']` references the same wrong column names; the actual UNIQUE constraint is `(user_id, content_id, content_type)`.

## Findings

- **Location:** `src/lib/sync/tableRegistry.ts:167-179` + `:112-115` (JSDoc contract)
- **Surfaced by:** data-migrations reviewer (DM-002, confidence 0.97) and correctness reviewer (COR-004, confidence 0.78)
- **Authoritative source:** `supabase/migrations/20260413000001_p0_sync_foundation.sql`
- **Related finding:** compoundPkFields JSDoc at tableRegistry.ts:112-115 promises the field names translate to the Supabase onConflict target — that promise is broken for this entry.
- **Tests do not catch this:** fieldMapper tests use `{ courseId, itemId }` as the camelCase input, so round-trip passes — but round-trip only verifies self-consistency, not correspondence to the real DB schema.

## Proposed Solutions

### Option 1: Align the registry to the existing Supabase schema

**Approach:** 
- Change `fieldMap` to `{ itemId: 'content_id' }` (or whatever the actual Dexie↔Supabase mapping should be — requires decision: does Dexie's `ContentProgress.itemId` correspond to Supabase's `content_id`, and where does `content_type` come from?)
- Add `'courseId'` to `stripFields` if courseId doesn't ship to Supabase
- Change `compoundPkFields: ['contentId', 'contentType']` (and add the corresponding fieldMap entry if they rename)
- Update the Dexie `ContentProgress` type if a `contentType` field is needed

**Pros:**
- Upload actually works against the P0 Supabase schema
- onConflict target matches UNIQUE constraint

**Cons:**
- Requires understanding the semantic mapping: `courseId`/`itemId` → `content_id`/`content_type` is not a pure rename — it's a projection

**Effort:** 2-4 hours (depends on whether ContentProgress needs a new `contentType` field)
**Risk:** Medium — changes the Dexie type contract

---

### Option 2: Add a new Supabase migration to restore the old column names

**Approach:** Create a migration that renames `content_progress.content_id` → `course_id` + `item_id` (or adds them as columns), then update the RPC.

**Pros:**
- Registry stays as-is

**Cons:**
- The P0 migration is already deployed to some environments
- `content_type` exists for a reason (it's likely a polymorphic key)
- Significant migration surface

**Effort:** 4-8 hours + env-specific migration coordination
**Risk:** High

## Recommended Action

**Option 1.** Align to the existing, deployed P0 schema. The registry must match reality. The semantic mapping needs to be confirmed by the E92-S04 author (syncableWrite) — pair on this during the P0 fix pass. Also update the compoundPkFields JSDoc at tableRegistry.ts:112-115 to state: "Dexie compound PK. Not necessarily the Supabase onConflict target — sync engines may project before upload." (See todo #010.)

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts:164-180` — contentProgress entry (fieldMap, compoundPkFields, conflictStrategy)
- `src/lib/sync/tableRegistry.ts:112-115` — compoundPkFields JSDoc contract
- `src/data/types.ts` — ContentProgress Dexie type (needs verification / possible extension)
- `src/lib/sync/__tests__/fieldMapper.test.ts:20-33` — round-trip test for contentProgress

**Related components:**
- `supabase/migrations/20260413000001_p0_sync_foundation.sql` — authoritative columns
- E92-S05 upload phase — will use the fixed fieldMap

**Database changes:** None (registry + possibly Dexie type only).

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding IDs:** DM-002 in `data-migrations.json`, COR-004 in `correctness.json`

## Acceptance Criteria

- [ ] `tableRegistry.contentProgress.fieldMap` aligned with `content_progress` Supabase columns
- [ ] `compoundPkFields` matches Supabase UNIQUE constraint `(user_id, content_id, content_type)`
- [ ] Dexie `ContentProgress` type updated if needed
- [ ] Round-trip test updated with real column names
- [ ] Add a new test: compose a realistic `ContentProgress` Dexie record, run toSnakeCase, assert output keys match actual `content_progress` columns (minus `user_id`, `created_at`, `updated_at` which are identity fields)
- [ ] Depends on/parallel with todo #007 (contentProgress conflictStrategy)

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- Cross-reference between registry and P0 Supabase migration surfaced schema drift
- Filed as P1, manual resolution required (semantic mapping decision)
