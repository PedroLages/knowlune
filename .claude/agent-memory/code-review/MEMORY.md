# Code Review Agent Memory

## Recurring Anti-Pattern: Uncommitted Fixes (RESOLVED)

- Was: 10 consecutive stories (E03-S02 through E05-S06) shipped with fixes in working tree only
- Status: Pattern resolved since ~E07. Recent stories (E69-S01, E107-S01) have clean working trees.
- Still worth a quick `git diff HEAD` check but no longer critical

## Recurring Code Quality Patterns

- String interpolation for className instead of `cn()` -- recurring since E01-S03 (17+ instances through E18-S07)
- `h-* w-*` instead of `size-*` Tailwind v4 shorthand -- recurring since E02-S05
- Sub-44px touch targets on buttons/icons -- recurring since E02-S07
- `formatTimestamp` duplicated across multiple files -- recurring since E02-S08
- Hardcoded hex/Tailwind colors instead of theme tokens -- recurring since E03-S05
- Fire-and-forget async operations without `.catch()` -- recurring since E03-S03

## Silent Failure Patterns

- Empty catch blocks on IndexedDB/localStorage operations
- `.catch(() => {})` silently swallowing errors
- Async event handlers without try/catch
- `scrollIntoView()` and DOM APIs without element existence checks
- Empty `catch {}` blocks (no variable) in polling/retry loops (E19-S02)

## Edge Function Security Patterns (Epic 19+)

- CORS `Access-Control-Allow-Origin: *` on sensitive endpoints -- found E19-S02
- Missing HTTP method guards on Deno.serve handlers -- found E19-S02
- Non-null assertions (`!`) on Deno.env.get() without validation -- found E19-S02
- Customer lookup by email instead of user ID metadata -- found E19-S02

## Project Conventions

- Import alias: `@/` resolves to `./src`
- Card border radius: `rounded-[24px]`, buttons: `rounded-xl`
- `cn()` from `@/app/components/ui/utils` for class merging
- shadcn/ui components in `src/app/components/ui/`
- Dexie.js DB in `src/db/schema.ts`, streak data in localStorage via `src/lib/studyLog.ts`
- Test factories at `tests/support/fixtures/factories/`
- E2E sidebar seed: `localStorage.setItem('knowlune-sidebar-v1', 'false')` before navigating

## Recurring Pattern: Store Integration Gaps (PR #484)

- Zustand stores with `register*`/`sync*` methods that unit tests pass but zero production consumers call
- grep for each store method in src/ (excluding **tests** and the store file) — 0 callers = BLOCKER
- See [feedback_store_integration_gaps.md](feedback_store_integration_gaps.md)

## Recurring Pattern: React Closure Staleness in finally Blocks (E77a-S03)

- `finally` blocks reading React state from closure see values from last render, not from `setState` in the `try` block
- With React 19 automatic batching, queued `setState` calls from `try` and `finally` are batched, so `finally` can clobber success state
- Fix: Use local variable (e.g., `let succeeded = false`) set in `try`, checked in `finally`
- See [react-closure-staleness-finally.md](react-closure-staleness-finally.md)

## New Pattern: Spec Drift from Current Codebase (E64-S09)

- Spec code blocks drafted against E61-S01 stale config, not current codebase state
- `registerType: 'prompt'` shown but current is `'autoUpdate'`, `swSrc: 'src/sw.ts'` shown but current is `'sw.ts'` (with `srcDir: 'src'`)
- Without validation against the actual running config, spec code blocks cause build failures or silent UX regressions
- Fix: `grep` current config files before including configuration code blocks in spec
- See [story-details.md](story-details.md) for E64-S09 entry

## New Pattern: Class Component Error Boundary Re-throw Pitfalls (E64-S09)

- Re-throwing from `componentDidCatch` does NOT propagate to parent error boundary
- Must use `throw this.state.error` in `render()` method
- Common with error boundaries that conditionally handle vs delegate errors
- See [story-details.md](story-details.md) for E64-S09 entry

## Silent Failure Patterns (Updated E64-S09)

- Error boundaries that catch before parent but fail to call `reportError()` for online failures — added: ChunkErrorBoundary catch-before-RouteErrorBoundary pattern

## Story-Level Details

See [story-details.md](story-details.md) for per-story findings.
