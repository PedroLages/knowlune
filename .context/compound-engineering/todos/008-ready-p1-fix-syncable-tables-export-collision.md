---
status: ready
priority: p1
issue_id: "008"
tags: [e92-s03, sync, api-contract, naming]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Fix SYNCABLE_TABLES export collision — same name, incompatible types

## Problem Statement

The symbol `SYNCABLE_TABLES` is exported from two modules with **incompatible types**:

- `src/lib/sync/backfill.ts:28` — `export const SYNCABLE_TABLES: readonly string[]` (table name strings)
- `src/lib/sync/tableRegistry.ts:722` — `export const SYNCABLE_TABLES: readonly TableRegistryEntry[]` (registry entry objects)

TypeScript has no mechanism to warn a future author importing the wrong module. A consumer that writes `import { SYNCABLE_TABLES } from '@/lib/sync/tableRegistry'` expecting strings will get entry objects and likely call `db.table(entry)` — which either throws `InvalidTable` or silently looks up the literal string `"[object Object]"`.

Additionally, `tableRegistry.ts:714` exports `SYNCABLE_TABLE_NAMES: readonly string[]` — a third name for the same concept. Three overlapping exports for one fact.

Cross-reviewer agreement: api-contract (AC-001), maintainability (M-02), adversarial (ADV-003) all flagged this independently.

## Findings

- **Locations:** `src/lib/sync/backfill.ts:28-30`, `src/lib/sync/tableRegistry.ts:714-724`
- **Consumers today:**
  - `backfill.ts` uses its own export internally (line 58 loop)
  - `backfill.test.ts:5` imports from `../backfill` — correctly gets the string[]
  - No external consumers of tableRegistry's `SYNCABLE_TABLES` or `SYNCABLE_TABLE_NAMES` yet (E92-S04+ will be the first)
- **Dead export check:** maintainability M-01 identified that `SYNCABLE_TABLE_NAMES`, `SYNCABLE_TABLES` (entries version), and `RegistryTableName` all have zero consumers today.

## Proposed Solutions

### Option 1: Rename and re-export

**Approach:**
- In `tableRegistry.ts`: rename `SYNCABLE_TABLES` (the entries array) to `SYNCABLE_TABLE_ENTRIES`
- Keep `SYNCABLE_TABLE_NAMES` as the canonical string[] export
- In `backfill.ts`: remove the local `SYNCABLE_TABLES` export; re-export from tableRegistry: `export { SYNCABLE_TABLE_NAMES as SYNCABLE_TABLES } from './tableRegistry'` (if backwards-compat is needed) or simply import `SYNCABLE_TABLE_NAMES` at the call site.
- Update `backfill.test.ts` and any other importer.

**Pros:**
- Clear, single source for each flavor of the export
- No shadowing risk
- tableRegistry becomes the single-source-of-truth in name too

**Cons:**
- Touches backfill.test.ts (1 import line)

**Effort:** 30 minutes
**Risk:** Low

---

### Option 2: Remove the dead exports entirely

**Approach:** Delete `SYNCABLE_TABLES` and `SYNCABLE_TABLE_NAMES` from tableRegistry.ts (no consumers). Keep only the entries-as-Object.values accessor if/when needed. Keep backfill.ts export as-is.

**Pros:**
- Simplest
- Maintainability wins (M-01 dead-code finding resolved)

**Cons:**
- E92-S04 / S06 will likely need these shortly — would just re-add them

**Effort:** 15 minutes
**Risk:** Low

## Recommended Action

**Option 1** (rename to `SYNCABLE_TABLE_ENTRIES`) if E92-S04 work is imminent. **Option 2** (delete now, add back with the right name when needed) if E92-S04 is >1 week away. Per the plan, E92-S04 is the next story, so Option 1 is the pragmatic choice.

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts:714-724` — rename exports
- `src/lib/sync/backfill.ts:28-30` — remove local duplicate
- `src/lib/sync/__tests__/backfill.test.ts:5` — update import
- `src/db/__tests__/migration-v52-sync.test.ts` — check import (per api-contract KT-08 reference)

**Related components:** None (internal API only).

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding IDs:** AC-001, M-02, ADV-003

## Acceptance Criteria

- [ ] `SYNCABLE_TABLES` exists at exactly one import path
- [ ] `SYNCABLE_TABLE_ENTRIES` (new name) is the registry-entries array, if kept
- [ ] backfill.ts uses `SYNCABLE_TABLE_NAMES` (or its renamed equivalent) from tableRegistry instead of re-computing
- [ ] All tests still pass
- [ ] `RegistryTableName` either made useful (see todo #009) or removed as dead code

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- 3 reviewers flagged the collision — strong signal
- Filed as P1, routed to downstream-resolver
