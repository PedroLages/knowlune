---
story_id: E44-S04
story_name: "ESLint Rule + Auth-Change Handler"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 44.4: ESLint Rule + Auth-Change Handler

## Story

As a developer,
I want automated enforcement that prevents unscoped Dexie access,
so that missing a userId filter is caught at save-time, not in production.

## Acceptance Criteria

**Given** a file contains `db.notes.where({courseId}).toArray()`
**When** the ESLint rule `data-scoping/no-direct-db-access` runs
**Then** an error is reported: "Direct db.notes access detected. Use scopedTable('notes')..."

**Given** the file is `scopedQuery.ts` or `scopedWrite.ts` or `exportService.ts`
**When** the ESLint rule runs
**Then** no errors are reported (allowlisted files)

**Given** User A is authenticated and User B logs in
**When** the auth state changes in useAuthStore
**Then** all 13 resettable stores call their `reset()` action
**And** store state is cleared (no stale User A data in memory)
**And** next store access re-fetches from Dexie with User B's scope

## Tasks / Subtasks

- [ ] Task 1: Create ESLint rule `no-direct-db-access` (AC: 1, 2)
  - [ ] 1.1 Create `eslint-plugin-data-scoping.js` in project root
  - [ ] 1.2 Implement `MemberExpression` visitor that matches `db.<tableName>` patterns
  - [ ] 1.3 Allowlist files: `scopedQuery.ts`, `scopedWrite.ts`, `exportService.ts`, `schema.ts`, `checkpoint.ts`
  - [ ] 1.4 Allow `db.transaction()` and `db.table()` calls (used by helpers)
  - [ ] 1.5 Error message: "Direct db.{{table}} access detected. Use scopedTable('{{table}}') for reads or scopedPut/scopedAdd/scopedDelete for writes."
- [ ] Task 2: Register ESLint plugin (AC: 1)
  - [ ] 2.1 Add `data-scoping/no-direct-db-access` rule to `eslint.config.js` with severity ERROR
  - [ ] 2.2 Verify rule runs on save in IDE
- [ ] Task 3: Add `reset()` action to all 13 resettable stores (AC: 3)
  - [ ] 3.1 Add `reset()` to `src/stores/useBookmarkStore.ts`
  - [ ] 3.2 Add `reset()` to `src/stores/useNoteStore.ts`
  - [ ] 3.3 Add `reset()` to `src/stores/useFlashcardStore.ts`
  - [ ] 3.4 Add `reset()` to `src/stores/useReviewStore.ts`
  - [ ] 3.5 Add `reset()` to `src/stores/useContentProgressStore.ts`
  - [ ] 3.6 Add `reset()` to `src/stores/useSessionStore.ts`
  - [ ] 3.7 Add `reset()` to `src/stores/useCourseImportStore.ts`
  - [ ] 3.8 Add `reset()` to `src/stores/useLearningPathStore.ts`
  - [ ] 3.9 Add `reset()` to `src/stores/useChallengeStore.ts`
  - [ ] 3.10 Add `reset()` to `src/stores/useQuizStore.ts`
  - [ ] 3.11 Add `reset()` to `src/stores/useCareerPathStore.ts`
  - [ ] 3.12 Add `reset()` to `src/stores/useAuthorStore.ts`
  - [ ] 3.13 Add `reset()` to `src/stores/useCourseStore.ts`
  - [ ] 3.14 Skip `useYouTubeImportStore` (stateless wizard, no cached Dexie data)
- [ ] Task 4: Create auth-change handler (AC: 3)
  - [ ] 4.1 Create `src/lib/auth/authChangeHandler.ts`
  - [ ] 4.2 Implement `initAuthChangeHandler()` that subscribes to `useAuthStore`
  - [ ] 4.3 Track `previousUserId` and detect changes (login, logout, user switch)
  - [ ] 4.4 On userId change, iterate `RESETTABLE_STORES` array and call `reset()` on each
  - [ ] 4.5 Return unsubscribe function for cleanup
- [ ] Task 5: Initialize auth handler on app mount (AC: 3)
  - [ ] 5.1 Call `initAuthChangeHandler()` from `src/app/App.tsx` in a useEffect
  - [ ] 5.2 Use returned unsubscribe function as useEffect cleanup
- [ ] Task 6: Tests (AC: 1, 2, 3)
  - [ ] 6.1 ESLint rule test: `db.notes.where(...)` triggers error
  - [ ] 6.2 ESLint rule test: `scopedTable('notes')` does not trigger error
  - [ ] 6.3 ESLint rule test: allowlisted files produce no errors
  - [ ] 6.4 ESLint rule test: `db.transaction()` is allowed
  - [ ] 6.5 Auth handler test: userId change triggers reset on all stores
  - [ ] 6.6 Auth handler test: same userId does not trigger reset
  - [ ] 6.7 Auth handler test: logout (userId -> null) triggers reset

## Implementation Notes

- **New files:**
  - `eslint-plugin-data-scoping.js` -- ESLint plugin with `no-direct-db-access` rule
  - `src/lib/auth/authChangeHandler.ts` -- auth state change subscriber
- **Modified files:**
  - `eslint.config.js` -- register new plugin and rule
  - `src/app/App.tsx` -- call `initAuthChangeHandler()` on mount
  - All 13 store files -- add `reset()` action to each
- **Architecture spec:** `_bmad-output/planning-artifacts/architecture-multi-user-filtering.md` (sections 4 and 5)
- **Dependency:** E44-S03 must be completed first (provides scoping helpers that the ESLint rule directs developers toward)
- **Pattern:** Follows existing ESLint plugin patterns in the project: `eslint-plugin-design-tokens.js`, `eslint-plugin-test-patterns.js`, `eslint-plugin-react-hooks-async.js`, etc.
- **Store reset pattern:** Each store's `reset()` should clear all cached data back to initial state (empty arrays, false booleans, null values) -- the next access will re-fetch from Dexie with the new user's scope
- **13 resettable stores:** useBookmarkStore, useNoteStore, useFlashcardStore, useReviewStore, useContentProgressStore, useSessionStore, useCourseImportStore, useLearningPathStore, useChallengeStore, useQuizStore, useCareerPathStore, useAuthorStore, useCourseStore
- Once this rule is active, any future direct `db.tableName` access in non-allowlisted files will be caught at save-time -- maintaining data isolation as the codebase grows
- **Rollout strategy for existing violations:** The 14 store files currently use direct `db.` access (~100+ usages). Ship the ESLint rule with a per-file `/* eslint-disable data-scoping/no-direct-db-access */` comment at the top of each store file. Remove the disable incrementally as each store is migrated to scopedTable/scopedWrite in E45-E48. This way new code is enforced immediately while existing code migrates gradually.

## Testing Notes

- ESLint rule tests: create test fixtures with direct db access and verify errors are reported
- ESLint rule tests: verify allowlisted files pass without errors
- Auth handler tests: mock useAuthStore subscription, simulate user changes, verify reset calls
- Auth handler tests: verify unsubscribe cleanup works
- Integration: run `npm run lint` and verify no false positives on existing codebase (existing direct db access will flag -- expected until stores are migrated in E45+)
- Note: existing stores still use direct `db.` access -- the ESLint rule will report errors on them. This is intentional; stores will be migrated incrementally as sync wiring is added in E45-E48. Consider using `// eslint-disable-next-line data-scoping/no-direct-db-access` or a blanket disable for store files until migration.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
