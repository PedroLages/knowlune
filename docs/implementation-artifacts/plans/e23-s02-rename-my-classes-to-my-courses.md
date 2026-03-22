# Plan: E23-S02 — Rename "My Classes" to "My Courses"

## Context

Epic 23 (Platform Identity & Navigation Cleanup) renames navigation labels to match self-directed learning terminology. E23-S01 (remove hardcoded branding) is done. This story renames "My Classes" → "My Courses" across all surfaces while keeping the `/my-class` route for backwards compatibility.

**Key discovery**: The page title and search palette currently say "My Progress" (not "My Classes"). The AC requires all surfaces to say "My Courses".

## Worktree

Path: `.worktrees/e23-s02`
Branch: `feature/e23-s02-rename-my-classes-to-my-courses`

## Implementation Steps

### Step 1: Update navigation config label
- **File**: `src/app/config/navigation.ts:35`
- **Change**: `'My Classes'` → `'My Courses'`
- This drives sidebar label AND mobile bottom bar (both consume this config)
- Route path `/my-class` stays unchanged

### Step 2: Update page title in MyClass.tsx
- **File**: `src/app/pages/MyClass.tsx:116,136`
- **Change**: `'My Progress'` → `'My Courses'` (both empty state and main heading)

### Step 3: Update search command palette
- **File**: `src/app/components/figma/SearchCommandPalette.tsx:49-55`
- **Change**: `label: 'My Progress'` → `label: 'My Courses'`
- **Change**: `keywords: ['progress', 'class', 'my']` → `keywords: ['courses', 'progress', 'class', 'my']`

### Step 4: Update prototype layouts
- **File**: `src/app/pages/prototypes/layouts/SwissLayout.tsx:27` — `'My Classes'` → `'My Courses'`
- **File**: `src/app/pages/prototypes/layouts/HybridLayout.tsx:25` — `'My Classes'` → `'My Courses'`

### Step 5: Update unit test
- **File**: `src/app/pages/__tests__/MyClass.test.tsx:94`
- **Change**: `'My Progress'` → `'My Courses'` assertion

### Step 6: Update E2E navigation helper
- **File**: `tests/support/helpers/navigation.ts:40-47`
- **Change**: Comment "My Class page" → "My Courses page"
- **Change**: Selector `'h1:has-text("My Class")'` → `'h1:has-text("My Courses")'`

### Step 7: Update existing E2E tests
- **File**: `tests/e2e/navigation.spec.ts:35` — test name + selector `/my class/i` → `/my courses/i`
- **File**: `tests/e2e/regression/story-e07-s07.spec.ts:392` — `getByRole('link', { name: /my class/i })` → `/my courses/i`
- **File**: `tests/e2e/accessibility-courses.spec.ts:120-121` — test name update

### Step 8: Commit after each logical group
- Commit 1: Source changes (Steps 1-4)
- Commit 2: Test updates (Steps 5-7)

## Files Summary

| File | Change |
|------|--------|
| `src/app/config/navigation.ts` | Sidebar label "My Classes" → "My Courses" |
| `src/app/pages/MyClass.tsx` | Page heading "My Progress" → "My Courses" |
| `src/app/components/figma/SearchCommandPalette.tsx` | Label + keywords |
| `src/app/pages/prototypes/layouts/SwissLayout.tsx` | Prototype label |
| `src/app/pages/prototypes/layouts/HybridLayout.tsx` | Prototype label |
| `src/app/pages/__tests__/MyClass.test.tsx` | Unit test assertion |
| `tests/support/helpers/navigation.ts` | Navigation helper selector |
| `tests/e2e/navigation.spec.ts` | E2E test name + assertion |
| `tests/e2e/regression/story-e07-s07.spec.ts` | Regression test selector |
| `tests/e2e/accessibility-courses.spec.ts` | Test name |

## What NOT to change
- Route path `/my-class` (backwards compatibility)
- File name `MyClass.tsx` (component/file names)
- Route config in `routes.tsx` (path stays `my-class`)

## Verification

1. `npm run build` — passes
2. `npm run test:unit` — passes (MyClass.test.tsx updated)
3. `npx playwright test tests/e2e/story-e23-s02.spec.ts --project=chromium` — ATDD tests pass (use port 5174 to avoid killing main server)
4. `npx playwright test tests/e2e/navigation.spec.ts --project=chromium` — navigation tests pass
5. Visual check: sidebar, mobile nav, search palette, page title all say "My Courses"
