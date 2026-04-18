---
status: ready
priority: p1
issue_id: "003"
tags: [e92-s03, sync, registry, schema-drift]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Fix progress fieldMap — courseId has no Supabase column

## Problem Statement

`tableRegistry.progress.fieldMap` contains `courseId: 'course_id'`, but Supabase `video_progress` (from migration `20260413000001_p0_sync_foundation.sql`) has **no course dimension**. Its columns are `user_id, video_id, watched_seconds, duration_seconds, last_position, watched_percent, created_at, updated_at`. UNIQUE is `(user_id, video_id)`.

Upload consequences:
- `toSnakeCase` emits `course_id` in the payload; Postgres rejects (unknown column)
- `compoundPkFields: ['courseId', 'videoId']` names the wrong onConflict target — correct is `['videoId']` (user_id is implicit via RLS)

## Findings

- **Location:** `src/lib/sync/tableRegistry.ts:232-238` (progress entry)
- **Surfaced by:** data-migrations reviewer (DM-003, confidence 0.95)
- **Authoritative source:** `supabase/migrations/20260413000001_p0_sync_foundation.sql`
- **Note:** `courseId` on Dexie VideoProgress is useful for local queries (finding all progress for a course) but should not ship to Supabase — Supabase reconstructs the course from video_id.

## Proposed Solutions

### Option 1: Strip courseId from uploads

**Approach:** 
- Remove `courseId: 'course_id'` from `fieldMap`
- Add `'courseId'` to `stripFields`
- Change `compoundPkFields` to `['videoId']`
- Leave `courseId` on the Dexie record (local indexing, no sync)

**Pros:**
- Registry honestly reflects Supabase columns
- No Dexie data loss — courseId stays locally for queries
- Minimal change

**Cons:**
- Download-phase reconciliation must re-derive courseId from videoId (via importedVideos lookup). E92-S06 concern.

**Effort:** 30 minutes (registry) + E92-S06 follow-up
**Risk:** Low

## Recommended Action

**Option 1.** Strip courseId, fix compoundPkFields. Document in the entry comment that E92-S06 download phase re-derives courseId locally.

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts:222-238` (progress entry)
- `src/lib/sync/__tests__/fieldMapper.test.ts` — round-trip for progress

**Related components:**
- `supabase/migrations/20260413000001_p0_sync_foundation.sql` — authoritative
- E92-S06 download phase — must re-derive courseId from videoId

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding ID:** DM-003 in `data-migrations.json`

## Acceptance Criteria

- [ ] `courseId` removed from `progress.fieldMap`
- [ ] `courseId` added to `progress.stripFields`
- [ ] `progress.compoundPkFields` changed to `['videoId']`
- [ ] Round-trip test updated to reflect strip behavior
- [ ] New assertion: toSnakeCase on a progress record with courseId emits no `course_id` key
- [ ] Comment in the entry documents the E92-S06 re-derivation requirement

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- Cross-reference between registry and `video_progress` DDL surfaced the courseId mismatch
- Filed as P1, routed to downstream-resolver
