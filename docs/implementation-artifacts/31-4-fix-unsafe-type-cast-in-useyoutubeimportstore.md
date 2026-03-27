---
story_id: E31-S04
story_name: "Fix Unsafe Type Cast in useYouTubeImportStore"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, typecheck, unit-tests, code-review]
burn_in_validated: false
---

# Story 31.4: Fix Unsafe Type Cast in useYouTubeImportStore

## Story

As a developer,
I want type-safe null handling in the YouTube import store,
so that calling methods on a null handle doesn't cause runtime TypeErrors.

## Acceptance Criteria

**Given** `useYouTubeImportStore` initializes directory handle state
**When** no directory has been selected
**Then** the state is `null` (not `null as unknown as FileSystemDirectoryHandle`)
**And** all code paths check for `null` before calling handle methods

**Given** a component accesses the directory handle
**When** the handle is `null`
**Then** no method calls are attempted (guarded by null check)
**And** no runtime TypeError occurs

## Tasks / Subtasks

- [x] Task 1: Fix the type declaration at line 278 (AC: 1)
  - [x] 1.1 Change `null as unknown as FileSystemDirectoryHandle` to simply `null`
  - [x] 1.2 Update the type annotation to `FileSystemDirectoryHandle | null`
  - [x] 1.3 Verify TypeScript compiles without errors

- [x] Task 2: Fix the type declaration at line 296 (AC: 1)
  - [x] 2.1 Apply the same fix as Task 1 to the second occurrence
  - [x] 2.2 Ensure both locations use `| null` type consistently

- [x] Task 3: Add null guards to all consumers of the handle (AC: 2)
  - [x] 3.1 Search for all usages of the directory handle property in the store
  - [x] 3.2 Add `if (handle === null) return` or `if (!handle) return` guards before any method calls
  - [x] 3.3 Add appropriate error handling or early returns when handle is null
  - [x] 3.4 Verify no code path can call `.getDirectoryHandle()`, `.getFileHandle()`, or similar methods on null

- [x] Task 4: Update the store's TypeScript interface (AC: 1)
  - [x] 4.1 Update the store's state type definition to use `FileSystemDirectoryHandle | null`
  - [x] 4.2 Run `npx tsc --noEmit` to verify no type errors throughout the codebase
  - [x] 4.3 Fix any downstream type errors caused by the change

- [x] Task 5: Write unit tests for null handle scenarios (AC: 2)
  - [x] 5.1 Test that accessing the handle when null does not throw
  - [x] 5.2 Test that store methods gracefully handle null handle state
  - [x] 5.3 Test that after selecting a directory, the handle is properly typed and usable

## Implementation Notes

- **Audit finding:** H3 (confidence 92%)
- **File:** `useYouTubeImportStore.ts:278,296`
- **Root cause:** `null as unknown as FileSystemDirectoryHandle` is a double type cast that bypasses TypeScript's type system entirely. If any code calls methods on this value without checking for null first, it will throw a runtime TypeError: `Cannot read properties of null (reading 'getDirectoryHandle')`.
- **Fix pattern:**
  ```typescript
  // BEFORE (unsafe):
  directoryHandle: null as unknown as FileSystemDirectoryHandle,

  // AFTER (type-safe):
  directoryHandle: null as FileSystemDirectoryHandle | null,
  // Or better, in the interface:
  directoryHandle: FileSystemDirectoryHandle | null;
  // And in the initial state:
  directoryHandle: null,
  ```
- **Downstream impact:** Changing the type to `| null` may surface type errors in components that use the handle without null checks. These are real bugs that the unsafe cast was hiding — fix them with null guards.

## Testing Notes

- **Null handle test:** Initialize store, verify `directoryHandle` is `null`, call methods that use it, assert no TypeError thrown
- **Happy path test:** Set a mock `FileSystemDirectoryHandle`, verify methods work correctly
- **Type safety verification:** Run `npx tsc --noEmit` — zero errors means all null checks are in place
- **Edge case:** Test resetting the handle back to null after it was set (e.g., user cancels directory selection)
- **Edge case:** Test concurrent access — one component reads handle while another resets it

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **Fix at interface level**: Changed types.ts to `| null` so TypeScript enforces null checks across all consumers
- **Only 1 downstream error**: Most consumers already accepted null/undefined — only courseImport.ts needed a guard
- **PDFs excluded**: ImportedPdf.fileHandle stays non-nullable since PDFs always come from local file system
