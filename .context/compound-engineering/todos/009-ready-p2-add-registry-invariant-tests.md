---
status: ready
priority: p2
issue_id: "009"
tags: [e92-s03, sync, testing, invariants]
dependencies: ["002", "003", "004", "005"]
source: ce-review
relates-to: E92-S03
---

# Add registry invariant tests — catch schema/type drift automatically

## Problem Statement

The current registry invariant tests (`fieldMapper.test.ts:231-299`) cover structural properties (conflictStrategy enum, no supabaseTable collisions, priority range) but miss the **cross-set and cross-type** invariants that would have caught the P0/P1 bugs in this story:

1. No test verifies `monotonicFields` entries resolve through `IDENTITY_FIELD_MAP ∪ entry.fieldMap` — this lets `watchedSeconds` slip through (todo #005)
2. No test verifies `stripFields ∩ keys(fieldMap) = ∅` — permits silent drop-vs-rename ambiguity
3. No test verifies `vaultFields ∩ keys(fieldMap) = ∅` — same ambiguity
4. No test verifies `vaultFields` entries are reachable as top-level keys on a real Dexie record — would have caught the `auth.password` nesting bug (todo #001)
5. No test verifies `conflictStrategy: 'skip' ⇔ skipSync: true` — the two can drift independently
6. No test verifies `fieldMap` values are unique within a single entry (no two camelCase keys mapping to the same snake_case)
7. No test verifies that every `fieldMap` key exists as a property on the corresponding Dexie type — would have caught the Flashcard `dueDate` vs `due` bug (todo #004) and vocabularyItems dead entries

## Findings

- **Location:** `src/lib/sync/__tests__/fieldMapper.test.ts:231-299`
- **Surfaced by:** testing (T-01, T-02, T-04, T-05), kieran-ts (TG-02, TG-03), adversarial (TG-001, TG-002), correctness (TG gaps), data-migrations (TG-001, TG-002, TG-003), maintainability (TG-01, TG-02)
- **All reviewers independently proposed similar invariants.** This is the most broadly-agreed-upon testing improvement in the run.

## Proposed Solutions

### Option 1: Add 7 targeted invariants

**Approach:**

Add to the `describe('registry invariants', ...)` block:

```typescript
it('every monotonicField resolves through IDENTITY_FIELD_MAP ∪ entry.fieldMap', () => {
  for (const entry of Object.values(tableRegistry)) {
    const keys = new Set([
      ...Object.keys(IDENTITY_FIELD_MAP),
      ...Object.keys(entry.fieldMap),
    ])
    for (const field of entry.monotonicFields ?? []) {
      expect(keys.has(field), `${entry.dexieTable}.${field} not in fieldMap`).toBe(true)
    }
  }
})

it('stripFields is disjoint from fieldMap keys', () => {
  for (const entry of Object.values(tableRegistry)) {
    const fieldMapKeys = new Set(Object.keys(entry.fieldMap))
    for (const strip of entry.stripFields ?? []) {
      expect(fieldMapKeys.has(strip), `${entry.dexieTable}: ${strip} in both stripFields and fieldMap`).toBe(false)
    }
  }
})

it('vaultFields is disjoint from fieldMap keys', () => {
  for (const entry of Object.values(tableRegistry)) {
    const fieldMapKeys = new Set(Object.keys(entry.fieldMap))
    for (const vault of entry.vaultFields ?? []) {
      expect(fieldMapKeys.has(vault), `${entry.dexieTable}: ${vault} in both vaultFields and fieldMap`).toBe(false)
    }
  }
})

it('skipSync: true ⇔ conflictStrategy: "skip"', () => {
  for (const entry of Object.values(tableRegistry)) {
    if (entry.skipSync === true) {
      expect(entry.conflictStrategy).toBe('skip')
    }
    if (entry.conflictStrategy === 'skip') {
      expect(entry.skipSync).toBe(true)
    }
  }
})

it('fieldMap values are unique within an entry (no two keys map to the same snake_case)', () => {
  for (const entry of Object.values(tableRegistry)) {
    const seen = new Set<string>()
    for (const v of Object.values(entry.fieldMap)) {
      expect(seen.has(v), `${entry.dexieTable}: duplicate fieldMap target ${v}`).toBe(false)
      seen.add(v)
    }
  }
})

// Replace the brittle snapshot:
// DELETE: it('only reviewRecords is marked skipSync: true ...')
```

Replacement for the current reviewRecords snapshot test: the new `skipSync ⇔ 'skip'` invariant above is stronger and does not need updating when E96-S04 lands.

**Invariants 4 and 7 (vaultFields reachability, fieldMap keys on Dexie types)** require importing the Dexie type definitions. More involved — see Option 2 below.

**Pros (Option 1):**
- Purely structural tests, no type imports
- Catches 5 of the 7 classes of bug

**Cons:**
- Doesn't cover vault-field nesting (todo #001) or fieldMap-key-on-type (todo #004) — those need type introspection

**Effort:** 1-2 hours
**Risk:** Low

---

### Option 2: Add type-driven invariants via factory samples

**Approach:** Import a sample record from `@/data/types` for each table (via test factories). For each `fieldMap` key, assert it is a property on the sample. For each `vaultField`, assert it is top-level on the sample.

**Pros:**
- Catches the full class of bugs surfaced by this review

**Cons:**
- Requires test factories for all 38 Dexie types — significant surface area
- Some types are auto-generated or carry runtime-only fields that don't appear in sample objects

**Effort:** 6-10 hours
**Risk:** Medium (test fixture maintenance)

## Recommended Action

**Option 1 now** (land with todos #002–#008 fixes), **Option 2 as a follow-up** in a later sprint when test factories are more mature.

## Technical Details

**Affected files:**
- `src/lib/sync/__tests__/fieldMapper.test.ts:231-299` — add invariants, remove brittle snapshot

**Related components:**
- `src/lib/sync/tableRegistry.ts` — IDENTITY_FIELD_MAP export (already exported for fieldMapper; now also used by tests)

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding IDs:** T-01, T-02, T-04, T-05 (testing), TG-01 through TG-004 across multiple reviewers

## Acceptance Criteria

- [ ] 5 new `describe('registry invariants', ...)` tests added (as above)
- [ ] Brittle `expect(skipped).toEqual(['reviewRecords'])` snapshot removed
- [ ] With these invariants in place, todos #002, #003, #004, #005 fixes cause the invariant tests to pass (not fail)
- [ ] `npm run test:unit src/lib/sync/**` passes

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- 6 reviewers independently proposed similar invariants — strong consensus
- Filed as P2, routed to downstream-resolver
- Depends on the P1 fixes (#002-#005) being complete — otherwise the invariants would fail on land
