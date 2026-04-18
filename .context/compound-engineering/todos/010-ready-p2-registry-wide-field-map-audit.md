---
status: ready
priority: p2
issue_id: "010"
tags: [e92-s03, sync, registry, audit, schema-drift]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Registry-wide audit — verify every fieldMap key, stripField, vaultField, monotonicField, and compoundPkField against Dexie types and Supabase schemas

## Problem Statement

This story's P0/P1 findings (todos #001–#007) all share a single root cause: **the registry was populated without cross-referencing each entry against the actual Dexie TypeScript types and the actual Supabase migration DDL**. The specific bugs surfaced by reviewers are:
- `contentProgress` fieldMap wrong (todo #002)
- `progress` fieldMap has phantom courseId (todo #003)
- `flashcards` fieldMap has 4 dead entries (todo #004)
- `progress` + `books` monotonicFields wrong (todo #005)
- `studySessions` missing clientRequestId (todo #006)
- `opdsCatalogs` vaultFields nested (todo #001)
- `vocabularyItems` has 3+ dead fieldMap entries (flagged in correctness residual risks)

The P0/P1 todos address specific tables where reviewers found issues. **This todo addresses the 30+ other tables that weren't individually audited.** Given 7 of ~12 audited tables had issues, statistically we should expect ~15-20 similar issues across the rest.

## Findings

- **Location:** `src/lib/sync/tableRegistry.ts` (all 38 entries)
- **Surfaced by:** correctness residual risks, data-migrations RR-003 ("All P1/P2/P3/P4 tables have no committed Supabase migration in the repo. Their fieldMap entries cannot be cross-verified.")
- **Scope:** only P0 tables (content_progress, video_progress, study_sessions) and the P0 R4 migration have DDL. All other entries are unverifiable against Supabase until E93/E94 ship.

## Proposed Solutions

### Option 1: Audit against Dexie types only (now)

**Approach:**
- For each registry entry, read the corresponding Dexie type from `src/data/types.ts` or `src/db/schema.ts`
- For each `fieldMap` camelCase key, confirm it is a property on the Dexie type
- For each `stripField`, confirm it is a property
- For each `vaultField`, confirm it is a top-level property
- For each `monotonicField`, confirm it is a property in `fieldMap` or IDENTITY
- For each `compoundPkField`, confirm it is a property
- Produce a findings document `docs/reviews/code/e92-s03-registry-audit.md` listing every misalignment
- Fix all of them (likely a substantial diff)

**Pros:**
- Catches ~50% of potential schema-drift bugs now (Dexie-side)
- Produces a reviewable document for the fix commit

**Cons:**
- Supabase-side drift remains unknown until E93/E94 migrations land

**Effort:** 4-8 hours (depends on how many issues are found)
**Risk:** Low

---

### Option 2: Defer Supabase audit to E93/E94 and add CI check

**Approach:**
- Do Option 1 now
- Add a CI job that, when E93/E94 migrations are merged, re-runs a registry↔Supabase cross-check
- Fail CI on any registry entry whose fieldMap values don't map to real columns

**Pros:**
- Permanent guard against future drift

**Cons:**
- Infrastructure overhead
- E93/E94 are not imminent

**Effort:** 2 hours on top of Option 1
**Risk:** Low

## Recommended Action

**Option 1 first** (land with or immediately after the P1 fixes). **Option 2 deferred** to when E93/E94 are being planned. For now, todo #009's invariant tests catch the most common patterns.

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts` — all 38 entries (audit; fix as needed)
- `src/data/types.ts` — authoritative Dexie types
- `src/db/schema.ts` — authoritative Dexie index schema

**Related components:**
- Supabase migrations (only P0 exists today)
- Test factories (would enable Option 2 if built)

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Related todos:** #001–#008 (specific entries already identified)

## Acceptance Criteria

- [ ] `docs/reviews/code/e92-s03-registry-audit.md` produced, listing all misalignments found
- [ ] Every misalignment fixed or explicitly documented as acceptable
- [ ] Specific entries known to be risky (from reviewers' residual risks): `vocabularyItems`, `bookShelves.compoundPkFields`, `audiobookshelfServers.apiKey`, `embeddings.embedding` (Float32Array serialization)
- [ ] Run todo #009's new invariants over the full registry — zero failures
- [ ] `npm run test:unit` passes

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- 7 of ~12 audited tables had issues — filed broader audit
- Filed as P2, routed to downstream-resolver
