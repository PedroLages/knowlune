---
name: Store Integration Gaps
description: Zustand stores created with integration methods (register callbacks, sync functions) that unit tests pass in isolation but are never wired to their consumers — cross-component state is dead
type: feedback
---

When a PR creates a new Zustand store to share state between two components (e.g., Layout header and page component), verify that BOTH ends of the wire are connected:

- **Producer side** (writes into store): Does the component/hook that owns the source of truth call the store's setter/sync/register methods? Check that `register*` and `sync*` methods have callers outside of test files.
- **Consumer side** (reads from store): Does the component that should respond to the store's state subscribe to the store's selectors? Check that the store's state values are actually used in component rendering logic.

**Why:** On feat/merge-lesson-toolbar-into-header (PR #484), `useLessonChromeStore` had 3 integration methods (`registerReadingModeToggle`, `syncReadingMode`, `setHasNotes`) that unit tests exercised perfectly but zero production consumers called. The reading mode toggle, notes toggle, and hasNotes indicator were all dead in the actual app — the store and consumers existed in parallel universes.

**How to apply:** When reviewing a PR that introduces shared Zustand state, `grep` for each store method name in the source tree (excluding test files and the store definition itself). If a method has 0 callers, flag it as BLOCKER — the integration is incomplete.
