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

## Story-Level Details
See [story-details.md](story-details.md) for per-story findings.
