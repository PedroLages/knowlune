---
status: ready
priority: p1
issue_id: "004"
tags: [e92-s03, sync, registry, fsrs, schema-drift]
dependencies: []
source: ce-review
relates-to: E92-S03
---

# Fix flashcards fieldMap — FSRS field names don't match Dexie Flashcard type

## Problem Statement

`tableRegistry.flashcards.fieldMap` declares `{ dueDate: 'due_date', elapsedDays: 'elapsed_days', scheduledDays: 'scheduled_days', lastReview: 'last_review' }`, but the actual Dexie `Flashcard` interface (from a prior FSRS migration) uses **snake_case-preserved** property names: `due`, `elapsed_days`, `scheduled_days`, `last_review`. 

Consequences:
- **Upload:** `toSnakeCase` sees `due` (not `dueDate`) on the record, passes it through unchanged as `'due'`. Supabase expects column `due_date`. The upload either errors (unknown column) or silently miswrites to the wrong column.
- **Download:** Supabase returns `due_date`. Inverse map rewrites to `dueDate`. The merged Dexie record has `dueDate` (not on the Flashcard type) while the type-expected `due` property is `undefined`. FSRS scheduling reads `card.due` → undefined → next-due computation broken silently.
- The three other FSRS fields (`elapsed_days`, `scheduled_days`, `last_review`) are already snake_case in Dexie, so they pass through the forward map unchanged and coincidentally match the Supabase columns — those fieldMap entries are dead but harmless on their own. The bug is only catastrophic on `due`.

## Findings

- **Location:** `src/lib/sync/tableRegistry.ts:280-296` (flashcards entry)
- **Surfaced by:** correctness reviewer (COR-001, confidence 0.95)
- **Authoritative source:** `src/data/types.ts` — Flashcard interface
- **Test blindness:** fieldMapper.test.ts:57-60 uses `{ dueDate: null }` (the wrong key), and the round-trip test at line 212 builds fixtures from `Object.keys(entry.fieldMap)` (also wrong keys). Round-trip passes trivially because it never touches a real Flashcard shape.
- **Related:** `vocabularyItems.fieldMap` also has dead entries (`sourceBookId`, `sourceHighlightId`, `flashcardId`) that don't appear on the VocabularyItem type (COR residual risks in correctness.json). Same class issue; audit during this fix.

## Proposed Solutions

### Option 1: Remove dead entries, add only the one that actually renames

**Approach:**
- Remove `dueDate`, `elapsedDays`, `scheduledDays`, `lastReview` from flashcards.fieldMap (all dead)
- Add `due: 'due_date'` (the only true rename the Flashcard interface needs)
- `elapsed_days`, `scheduled_days`, `last_review` already pass through untouched — correct
- Update fieldMapper.test.ts:57-60 to use `{ due: null }` and assert `{ due_date: null }`

**Pros:**
- Registry honestly reflects the Dexie type
- Upload/download actually works for FSRS

**Cons:**
- Audit cost for other entries (vocabularyItems has similar dead entries)

**Effort:** 1-2 hours (flashcards + vocabularyItems audit)
**Risk:** Low

## Recommended Action

**Option 1.** Also run a registry-wide audit: for each `fieldMap` key, verify it exists on the corresponding Dexie type in `src/data/types.ts`. See todo #010 for the broader audit.

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts:280-296` — flashcards entry
- `src/lib/sync/tableRegistry.ts:430-450` — vocabularyItems entry (audit)
- `src/lib/sync/__tests__/fieldMapper.test.ts:57-60` — fixture update
- `src/data/types.ts` — Flashcard + VocabularyItem types (authoritative)

**Related components:**
- FSRS scheduler (`src/lib/fsrs/**`) — reads `card.due`; broken `dueDate` write would break scheduling
- E92-S05 upload — consumes fixed fieldMap

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding ID:** COR-001 in `correctness.json`
- **Residual risks:** Dead entries on `vocabularyItems` per correctness.json

## Acceptance Criteria

- [ ] `flashcards.fieldMap` contains only real Flashcard-typed property renames: `{ due: 'due_date' }`
- [ ] VocabularyItem audit: dead entries in `vocabularyItems.fieldMap` removed
- [ ] fieldMapper.test.ts updated: use `{ due: ... }` in the null-preservation test, assert `{ due_date: ... }` output
- [ ] New test: compose a real Flashcard Dexie record shape, run toSnakeCase, assert `due_date` is present and no stray `dueDate` key
- [ ] `npm run test:unit` passes

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- Cross-reference between fieldMap and Dexie Flashcard type surfaced dead entries + broken `due` handling
- Filed as P1, routed to downstream-resolver
