---
name: techdebt
description: "Ruthless deduplication agent for Knowlune. Analyzes git diff HEAD to find new code, searches the entire codebase for duplicates, creates shared libraries in src/lib/ and src/hooks/, updates all consumers to use shared versions, and verifies with build+lint+typecheck. Use after implementing a feature to eliminate duplication before review. Also use when you notice repeated patterns across files, when a store follows the same CRUD boilerplate as others, when dialog state management is copy-pasted, or when inline try/catch/toast patterns appear. Not a suggester — it acts."
---

# techdebt — Ruthless Deduplication Agent

Analyzes your session's changes, hunts for duplication across the entire Knowlune codebase, creates shared libraries, updates all consumers, and verifies the result. Runs after implementation, before `/review-story`.

## Workflow Position

```
/start-story → implement → /techdebt → /review-story → /finish-story
```

## Phase 1 — Harvest (Parse the Diff)

Run these commands to understand what changed:

```bash
git diff HEAD --name-status          # files added/modified/deleted
git diff HEAD --unified=5            # full diff with context
git status --short                   # untracked files
```

Parse the diff hunks to identify **new artifacts** (green lines only, not modifications to existing shared code):

| Artifact Kind | How to Identify |
|---------------|----------------|
| Named functions | `export function name(` or `export const name = (` |
| React components | `export function Name(` returning JSX, or `forwardRef` |
| Custom hooks | Functions starting with `use` in `src/hooks/` or inline |
| Type/interface declarations | `export type`, `export interface` |
| Constants/config maps | `export const NAME =` with object/Record literals |
| Inline patterns | Structural patterns: try/catch/toast, `set({isLoading})`, debounced search, dialog state, Dexie CRUD |

Build an **artifact manifest** — for each artifact record: name, kind, file path, line range, and function signature (params + return type).

## Phase 2 — Scan (Find Duplicates)

For each artifact in the manifest, search the codebase for duplicates. The search has two layers:

### Layer 1: Check for existing shared versions

Before looking for duplication, check if a shared version **already exists** that the new code should use instead:

- `src/lib/` — utility functions, helpers, store helpers
- `src/hooks/` — custom React hooks
- `src/types/` and `src/data/types.ts` — shared type declarations
- `src/lib/toastHelpers.ts` — toast notification wrappers
- `src/lib/persistWithRetry.ts` — Dexie error handling

If found: the new code is the duplicate. Plan to rewire it to the existing shared version (skip to Phase 3).

### Layer 2: Search for cross-file duplication

Use the **9 duplication categories** tuned to this project's stack. **See:** [docs/duplication-categories.md](docs/duplication-categories.md) for:
- Category-specific grep patterns and search locations
- Similarity classification (exact, near-duplicate, analogous)
- Parameterization strategies for near-duplicates
- Examples from the actual codebase

For each match, classify the similarity level:
- **Exact**: identical after whitespace normalization — immediate extraction candidate
- **Near-duplicate**: same logic, different variable names — extraction with renaming
- **Analogous**: same structural pattern, different domain (e.g., `loadBookmarks` vs `loadNotes`) — extraction with generics/callbacks

## Phase 3 — Plan (Decide What to Extract)

Apply extraction rules to each finding:

**DO extract when:**
- 3+ instances of the same pattern (including the new one)
- 2 instances if each is >15 lines
- A shared version already exists but the new code doesn't use it

**DO NOT extract when:**
- Only 2 instances and both are simple (<10 lines)
- Generalization would require >3 extra parameters (too domain-specific)
- Would create a circular dependency (check the import hierarchy)
- The existing code is marked `@deprecated`

For each planned extraction, determine:
- **Target location** — which file to create or extend. **See:** [docs/shared-library-strategy.md](docs/shared-library-strategy.md) for placement rules, naming conventions, API design principles, and circular dependency prevention.
- **API surface** — function signature with generics if needed
- **Consumer list** — every file that contains the duplicated pattern (both new AND existing code)

**Cap at 5 extractions per run** to keep changes reviewable.

Present the extraction plan to the user before proceeding. Show:
- What will be extracted and where
- How many consumers will be updated
- Estimated lines saved

## Phase 4 — Extract (Create Shared Modules + Update Consumers)

Execute each extraction **atomically** (one at a time, verify between each).

**See:** [docs/verification-rollback.md](docs/verification-rollback.md) for the atomic extraction protocol with git stash safety net.

For each planned extraction:

### Step A — Create or update the shared module

- Follow project conventions: `@/` import alias, camelCase for `src/lib/`, `use*` for hooks
- Match the style of existing shared code (see `src/lib/toastHelpers.ts` as reference)
- Use generics when the pattern is type-agnostic
- Parameterize domain-specific variations via options/callbacks

### Step B — Update ALL consumers

For each file containing the duplicated pattern:
1. Add the import for the new shared module
2. Replace the inline code with a call to the shared function/hook
3. Remove now-unused imports that were only needed by the removed inline code
4. Preserve any domain-specific logic that wasn't part of the shared pattern

### Step C — Verify this extraction

```bash
npm run build    # catches type errors + import issues
```

If build fails: revert this extraction using the rollback protocol, log the failure reason, move to next extraction.

## Phase 5 — Final Verify

After all extractions are complete:

```bash
npm run build && npm run lint
```

If final verification fails, identify which extraction caused the issue and revert it specifically.

## Phase 6 — Report

Output a structured deduplication report:

```markdown
## Techdebt Deduplication Report

### Session Summary
- Files changed in session: N
- Artifacts harvested: N
- Duplicates found: N
- Extractions performed: N/N planned

### Extractions Performed
1. **Created `src/lib/storeHelpers.ts`** — extracted async load pattern
   - Consumers updated: useBookmarkStore, useNoteStore, useFlashcardStore (+N others)
   - Lines saved: ~N

### Rewired to Existing Shared Code
- `newComponent.tsx` now imports `formatDuration` from `@/lib/formatDuration` instead of inline

### Skipped (not worth extracting)
- [reason for each skip]

### Failed (reverted)
- [extraction description]: [failure reason]

### Verification
- build: PASS/FAIL
- lint: PASS/FAIL
```

## Important Constraints

- **Never break the import hierarchy**: `types` → `lib` → `stores` → `components` → `pages`. A module in `src/lib/` must never import from `src/stores/`.
- **Respect existing APIs**: when adding to existing shared modules (like `toastHelpers.ts`), don't change existing function signatures.
- **Don't over-abstract**: if parameterizing a pattern requires >3 extra parameters or makes the API confusing, skip it. Three similar lines of code is better than a premature abstraction.
- **Preserve behavior exactly**: the refactored code must produce identical runtime behavior. No "improvements" during extraction — only structural deduplication.
