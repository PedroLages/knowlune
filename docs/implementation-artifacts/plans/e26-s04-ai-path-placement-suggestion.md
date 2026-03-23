# Implementation Plan: E26-S04 — AI Path Placement Suggestion

**Story**: AI Path Placement Suggestion
**Epic**: E26 — Multi-Path Learning Journeys
**Created**: 2026-03-23
**Status**: Planning Complete

---

## Overview

When a user adds a course to an existing multi-path learning journey, the AI analyzes the existing courses in that path and the new course's metadata to suggest the optimal insertion position with a justification. The user can accept the suggestion (inserting at the recommended position) or reject it (placing the course at the end for manual repositioning).

This builds on the existing AI Learning Path infrastructure from E9B-S03 but is a fundamentally different operation: instead of sequencing ALL courses from scratch, it places ONE course within an EXISTING ordered path.

## Dependencies

### Hard Dependencies (Must Exist Before Implementation)

| Story | What It Provides | Status |
|-------|-----------------|--------|
| E26-S01 | Multi-path data model and Dexie migration (new `learningPaths` and `pathCourses` tables) | Backlog |
| E26-S02 | Learning path list view (browse/create/delete paths) | Backlog |
| E26-S03 | Path detail view with drag-drop editor and "Add Course" flow | Backlog |
| E9B-S03 | AI Learning Path generation infrastructure (`generatePath.ts`, AI config, consent) | Done |

### Assumed Data Model (from E26-S01)

Based on the existing `LearningPathCourse` type and Epic 20's Career Path design, E26-S01 will likely create:

```typescript
// New table: learningPaths
interface LearningPath {
  id: string           // UUID
  title: string        // User-defined path name
  description?: string // Optional description
  createdAt: string    // ISO 8601
  updatedAt: string    // ISO 8601
}

// New table: pathCourses (replaces single-path learningPath table)
interface PathCourse {
  id: string           // UUID (composite key: pathId + courseId)
  pathId: string       // FK to LearningPath.id
  courseId: string      // FK to ImportedCourse.id
  position: number     // 1-indexed sequence position within this path
  justification?: string // AI or user reasoning for placement
  isManuallyOrdered: boolean
  addedAt: string      // ISO 8601
}
```

**Note**: The exact schema will be defined by E26-S01. This plan assumes the above structure. If E26-S01 deviates, adjust Task 2 (store integration) accordingly.

### Assumed Store (from E26-S03)

E26-S03 will likely create a `useMultiPathStore` (or extend `useLearningPathStore`). This plan assumes a store with:
- `getPathCourses(pathId)` — returns ordered courses for a path
- `addCourseToPath(pathId, courseId, position)` — inserts course at position
- The "Add Course" flow in the path detail view

## Architecture Decisions

### 1. Separate `suggestPlacement` Function (Not Reusing `generateLearningPath`)

**Decision**: Create a new `src/ai/learningPath/suggestPlacement.ts` rather than extending `generatePath.ts`.

**Rationale**:
- `generateLearningPath` sequences ALL courses (batch operation). `suggestPlacement` positions ONE course (incremental operation).
- Different prompt structure: suggestPlacement receives the existing path order as context.
- Different response format: single position + justification vs. full ordered list.
- Single Responsibility Principle — each function does one thing well.

**Alternative Rejected**: Parameterizing `generateLearningPath` with a "mode" flag. This would complicate its already complex logic (timeout, streaming, response validation) and violate open/closed principle.

### 2. Non-Blocking Suggestion (Graceful Degradation)

**Decision**: AI suggestion is optional — the "Add Course" flow always completes even if AI fails.

**Rationale**:
- Core functionality (adding a course to a path) must not depend on AI availability.
- Matches the existing pattern in E9B-S03: AI errors show retry, but the page remains functional.
- Users who haven't configured AI or disabled consent still get full path editing.

### 3. Window Mock Pattern for E2E Tests

**Decision**: Use `window.__mockPlacementResponse` for deterministic E2E tests, matching the E9B-S03 pattern.

**Rationale**:
- Proven pattern from `window.__mockLearningPathResponse` in E9B-S03 tests.
- Avoids complex route interception for AI API calls.
- Allows tests to control exact response without network mocking.

### 4. Prompt Design (Focused Context)

**Decision**: Send only the existing path courses (in order) and the new course metadata — not ALL imported courses.

**Rationale**:
- Path placement only needs context about what's IN the path.
- Smaller prompt = faster response, lower token cost.
- More focused = better AI reasoning about prerequisites within this specific path.

## Implementation Steps

### Step 1: Create `suggestPlacement` AI Function

**File**: `src/ai/learningPath/suggestPlacement.ts` (new)

```typescript
interface PlacementSuggestion {
  suggestedPosition: number  // 1-indexed
  justification: string
}

interface SuggestPlacementOptions {
  timeout?: number   // default 2000ms
  signal?: AbortSignal
}

export async function suggestPlacement(
  existingCourses: Array<{ courseId: string; name: string; position: number; tags: string[] }>,
  newCourse: { courseId: string; name: string; tags: string[]; category: string },
  options?: SuggestPlacementOptions
): Promise<PlacementSuggestion>
```

**Key Implementation Details**:

1. **Guard clauses**: Check AI configuration, consent (`learningPath`), API key. If any fail, throw descriptive error.

2. **Prompt construction**:
   ```
   You are an expert learning path advisor. A learner has an existing learning path
   with the following courses in order:

   [list existing courses with position, name, tags]

   They want to add this new course:
   [new course name, tags, category]

   Suggest the optimal position (1 to N+1) for the new course based on
   prerequisite relationships. Explain your reasoning in 1-2 sentences.

   Return ONLY valid JSON:
   { "suggestedPosition": <number>, "justification": "<string>" }
   ```

3. **Response parsing**: Parse JSON, validate `suggestedPosition` is within valid range `[1, existingCourses.length + 1]`. Clamp if out of range.

4. **Test mock**: Check `window.__mockPlacementResponse` before making API call.

5. **Timeout**: 2000ms default (matches E9B-S03 pattern), configurable.

**Testing**: Unit test with mocked fetch for response parsing, edge cases (position out of range, malformed JSON, timeout).

### Step 2: Add Placement Suggestion State to Store

**File**: Extend whichever store E26-S03 creates (likely `src/stores/useMultiPathStore.ts`)

**New State Fields**:
```typescript
// Placement suggestion state
placementSuggestion: PlacementSuggestion | null
isAnalyzingPlacement: boolean
placementError: string | null
placementCourseId: string | null  // The course being placed
```

**New Actions**:
```typescript
requestPlacement: (pathId: string, courseId: string) => Promise<void>
acceptPlacement: (pathId: string) => Promise<void>
rejectPlacement: (pathId: string) => Promise<void>
clearPlacement: () => void
```

**Action Implementations**:

- `requestPlacement`: Loads path courses from DB, loads new course metadata, calls `suggestPlacement()`, updates state. On error, sets `placementError` and clears suggestion.

- `acceptPlacement`: Calls `addCourseToPath(pathId, courseId, suggestedPosition)` (from E26-S03 store), shifts subsequent course positions, persists to IndexedDB, tracks AI usage with `accepted: true`.

- `rejectPlacement`: Calls `addCourseToPath(pathId, courseId, lastPosition + 1)`, tracks AI usage with `accepted: false`.

- `clearPlacement`: Resets all placement state (used on component unmount or path navigation).

### Step 3: Create PlacementSuggestion UI Component

**File**: `src/app/components/learning-paths/PlacementSuggestion.tsx` (new)

**Component Anatomy**:

```
┌─────────────────────────────────────────┐
│  ✨ AI Placement Suggestion             │
│                                         │
│  "Place after 'Python Basics' (pos 2)   │
│   — this course assumes knowledge of    │
│   variables and loops"                  │
│                                         │
│  [✓ Accept Suggestion] [Place Manually] │
└─────────────────────────────────────────┘
```

**States**:

1. **Loading**: `Loader2` spinner + "Analyzing best position..." text
2. **Suggestion**: Card with justification, Accept/Reject buttons
3. **Error/Unavailable**: Info alert: "AI suggestion unavailable — course added at the end"
4. **Hidden**: When path is empty (AC5) or after accept/reject

**Styling** (design tokens):
- Card: `bg-brand-soft/30 border border-brand/20 rounded-[24px] p-6`
- Icon: `Sparkles` from lucide-react in `text-brand`
- Accept: `<Button variant="brand">` with checkmark icon
- Reject: `<Button variant="brand-outline">`
- Loading: `<Loader2 className="animate-spin text-brand" />`

**Accessibility**:
- `aria-live="polite"` on suggestion container
- `role="status"` for loading state
- Focus trap: auto-focus Accept button when suggestion appears
- Screen reader text: "AI suggests placing [course] at position [N] because [justification]"

### Step 4: Integrate into Path Detail View

**File**: Modify path detail component from E26-S03 (likely `src/app/pages/LearningPathDetail.tsx`)

**Integration Points**:

1. **"Add Course" Flow**: After the user selects a course to add:
   - If path has 0 courses → skip AI, add at position 1 (AC5)
   - If path has 1+ courses AND AI is available → show PlacementSuggestion
   - If AI unavailable → add at end with info message (AC4)

2. **Insertion Preview**: While suggestion is pending, show a faded/dashed placeholder row at the suggested position in the course list. This gives visual context for where the course would go.

3. **Position Shift Logic**: When accepting, all courses at `position >= suggestedPosition` need their position incremented by 1. This is handled in the store's `acceptPlacement` action.

**Flow Diagram**:
```
User clicks "Add Course"
  → Course selector dialog opens
  → User picks a course
  → If path has courses AND AI available:
      → Show PlacementSuggestion (loading → suggestion)
      → User clicks Accept → insert at position, close
      → User clicks Reject → insert at end, close
  → If path empty OR AI unavailable:
      → Insert at end immediately
      → Show info toast if AI was expected but unavailable
```

### Step 5: AI Usage Tracking

**Integration**: Use existing `trackAIUsage` from `src/lib/aiEventTracking.ts`.

```typescript
trackAIUsage('learning_path', {
  durationMs: Date.now() - startTime,
  metadata: {
    action: 'placement_suggestion',
    pathId,
    courseId,
    suggestedPosition,
    accepted: true | false,
    existingCourseCount: pathCourses.length,
  },
})
```

This uses the existing `'learning_path'` feature type (from `AIFeatureType` union), extending its metadata with placement-specific fields.

### Step 6: E2E Tests

**File**: `tests/e2e/story-e26-s04.spec.ts` (new)

**Test Structure** (mirrors E9B-S03 test patterns):

```typescript
test.describe('E26-S04: AI Path Placement Suggestion', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate, clear state, seed test data
    // Seed a learning path with 3 courses (from E26-S01 helpers)
    // Seed AI configuration
  })

  test('AC1: AI suggests position when adding course to path', async ({ page }) => {
    // Inject mock placement response
    // Add a new course → verify suggestion card appears
    // Verify justification text displayed
  })

  test('AC2: Accept places course at suggested position', async ({ page }) => {
    // Inject mock suggesting position 2
    // Accept → verify course is at position 2
    // Verify other courses shifted
    // Reload → verify persisted
  })

  test('AC2: Reject places course at end', async ({ page }) => {
    // Inject mock suggesting position 2
    // Reject → verify course is at last position
  })

  test('AC3: Loading state appears during analysis', async ({ page }) => {
    // Delay mock response
    // Verify "Analyzing best position..." appears
    // Verify cancel doesn't break the flow
  })

  test('AC4: AI unavailable gracefully falls back', async ({ page }) => {
    // Do NOT seed AI config
    // Add course → verify added at end
    // Verify info message appears
  })

  test('AC5: Empty path skips AI suggestion', async ({ page }) => {
    // Create empty path
    // Add first course → verify no suggestion card
    // Verify course at position 1
  })
})
```

**Test Helpers** (extend existing):
- `seedLearningPath(page, pathData)` — seed via IndexedDB evaluate
- `seedPathCourses(page, pathId, courses)` — seed courses in a path
- `clearLearningPaths(page)` — cleanup helper

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/ai/learningPath/suggestPlacement.ts` | AI placement suggestion function |
| `src/app/components/learning-paths/PlacementSuggestion.tsx` | Suggestion UI component |
| `tests/e2e/story-e26-s04.spec.ts` | E2E test spec |

### Modified Files

| File | Change |
|------|--------|
| `src/stores/useMultiPathStore.ts` (from E26-S03) | Add placement suggestion state + actions |
| Path detail page component (from E26-S03) | Integrate PlacementSuggestion into "Add Course" flow |
| `src/ai/learningPath/types.ts` | Add `window.__mockPlacementResponse` type declaration |

### No Changes Needed

| File | Reason |
|------|--------|
| `src/db/schema.ts` | No new tables — uses E26-S01's schema |
| `src/data/types.ts` | No new types needed (PlacementSuggestion is local to the AI module) |
| `src/app/routes.tsx` | No new routes — uses E26-S03's path detail route |
| `src/lib/aiConfiguration.ts` | Reuses existing `learningPath` consent toggle |
| `src/lib/aiEventTracking.ts` | Reuses existing `learning_path` feature type |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| E26-S01/S02/S03 schema differs from assumptions | Medium | Low | Plan is modular — only Step 2 (store) needs adaptation |
| AI placement suggestion quality is poor | Low | Medium | 2s timeout + graceful fallback means bad suggestions don't block users |
| Prompt engineering yields inconsistent positions | Medium | Low | Validate position is in range [1, N+1], clamp if not |
| @dnd-kit conflicts with insertion preview | Low | Medium | Preview uses CSS only (no DnD state), so no library conflicts |

## Complexity Estimate

**Medium** (4-6 hours)

- AI function: ~1.5h (prompt + parsing + tests)
- Store integration: ~1h (depends on E26-S03 store shape)
- UI component: ~1.5h (component + styling + accessibility)
- Integration + E2E tests: ~1.5h

## References

- Existing AI Learning Path: `src/ai/learningPath/generatePath.ts`
- Learning Path Store: `src/stores/useLearningPathStore.ts`
- Learning Path Page: `src/app/pages/AILearningPath.tsx`
- E2E Test Pattern: `tests/e2e/regression/story-e9b-s03.spec.ts`
- AI Configuration: `src/lib/aiConfiguration.ts`
- AI Usage Tracking: `src/lib/aiEventTracking.ts`
- Story File: `docs/implementation-artifacts/26-4-ai-path-placement-suggestion.md`
