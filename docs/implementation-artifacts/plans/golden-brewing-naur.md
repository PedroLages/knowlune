# E9B-S04: Knowledge Gap Detection — Implementation Plan

## Context

LevelUp learners accumulate videos and notes across courses, but have no visibility into coverage gaps — videos they skimmed through or topics they never annotated. E9B-S04 adds proactive gap detection: a rule-based engine (with optional AI enrichment) that surfaces "under-noted topics" and "skipped videos" in a dedicated page, plus a cross-course note link suggestion system that fires when saving notes. This follows the AI infrastructure established in E9-S01–S03 and the UI patterns from E9B-S01–S03.

**Epic context**: All E9 infra (AI provider config, web worker, embedding pipeline) and E9B-S01–S03 are done. `src/ai/` has LLM factory, streaming client, and vector store ready to reuse.

---

## Pre-work (before implementation starts)

1. Commit existing dirty changes:
   ```bash
   git add StudyGy-Dashboard src/data/types.ts src/db/schema.ts \
     docs/reviews/epic-1-implementation-status-and-gaps.md docs/test-plans/ tests/fixtures/
   git commit -m "chore: stash pre-E9B-S04 WIP"
   ```
2. Create branch: `git checkout main && git pull && git checkout -b feature/e9b-s04-knowledge-gap-detection`
3. Create story file at `docs/implementation-artifacts/9b-4-knowledge-gap-detection.md` using template
4. Update `docs/implementation-artifacts/sprint-status.yaml`: set `9b-4-knowledge-gap-detection: in-progress`

---

## Acceptance Criteria Map

| # | AC Summary | Implementation |
|---|-----------|----------------|
| AC1 | Under-noted topics: < 1 note per 3 videos | Rule engine in `detectGaps.ts` |
| AC2 | Skipped videos: complete + < 50% watch | Rule engine in `detectGaps.ts` |
| AC3 | Gaps panel sorted by severity + direct video links | `KnowledgeGaps.tsx` page |
| AC4 | Note save → suggest cross-course note link (2+ shared tags) | `noteLinkSuggestions.ts` + note save hook |
| AC5 | Accept suggestion → bidirectional note link | `linkedNoteIds` field on Note + update both notes |
| AC6 | Dismiss suggestion → not re-shown for that pair | localStorage `dismissed-note-links` |
| AC7 | AI unavailable → fallback to rule-based within 2s | AbortController + 2s timeout in `detectGaps.ts` |

---

## Architecture

### New files to create

| File | Purpose |
|------|---------|
| `src/ai/knowledgeGaps/detectGaps.ts` | Rule-based + AI-enriched gap detection engine |
| `src/ai/knowledgeGaps/noteLinkSuggestions.ts` | Tag/keyword matching for cross-course note links |
| `src/ai/knowledgeGaps/types.ts` | `GapItem`, `NoteLinkSuggestion` types |
| `src/app/pages/KnowledgeGaps.tsx` | Dedicated `/knowledge-gaps` page |
| `tests/e2e/story-e09b-s04.spec.ts` | E2E spec covering all 7 ACs |

### Files to modify

| File | Change |
|------|--------|
| `src/data/types.ts` | Add `linkedNoteIds?: string[]` to `Note` interface; add `GapItem`, `NoteLinkSuggestion` types |
| `src/app/config/navigation.ts` | Add "Knowledge Gaps" nav item to "Learn" group |
| `src/app/routes.tsx` | Register lazy-loaded `KnowledgeGaps` page at `/knowledge-gaps` |
| `src/app/pages/Notes.tsx` (or note save path) | Trigger `noteLinkSuggestions` after note save |

---

## Implementation Tasks

### Task 1 — Types

In `src/data/types.ts`:
- Add `linkedNoteIds?: string[]` to the `Note` interface (no schema migration needed — Dexie persists unindexed fields automatically)
- Export from `src/ai/knowledgeGaps/types.ts`:
  ```ts
  export type GapSeverity = 'critical' | 'medium' | 'low'
  export interface GapItem {
    courseId: string
    videoId: string
    courseTitle: string
    videoTitle: string
    gapType: 'under-noted' | 'skipped'
    severity: GapSeverity
    noteCount: number
    videoCount: number       // videos in same topic
    watchPercentage?: number // for skipped type
    aiDescription?: string   // AI enrichment, optional
  }
  export interface NoteLinkSuggestion {
    sourceNoteId: string
    targetNoteId: string
    targetCourseId: string
    targetCourseTitle: string
    sharedTags: string[]
    previewContent: string  // first 100 chars of target note
  }
  ```

### Task 2 — Gap detection engine

**`src/ai/knowledgeGaps/detectGaps.ts`**

Rule-based algorithm (always runs):
1. Load all notes: `db.notes.toArray()` → group by `courseId → videoId`
2. Load all videos: `db.importedVideos.toArray()` → group by `courseId`
3. Load all progress: `db.progress.toArray()`
4. For each course: `notesByVideo = notes grouped by videoId`; videoCount = importedVideos for course
5. **Under-noted rule**: `notesForVideo < (videoCount / 3)` → gap (severity by ratio: 0 notes = critical, < 1/3 = medium, < 1/1 = low)
6. **Skipped rule**: `progress.completedAt && progress.completionPercentage < 50` → gap (severity: < 25% = critical, < 50% = medium)
7. Sort by severity (critical first, then by note ratio ascending)

AI enrichment (optional, wrapped in AbortController with 2s timeout):
- Call `getLLMClient()` from `src/ai/llm/factory.ts`
- Send gaps list to LLM for richer descriptions per gap
- On timeout or error: use rule-based descriptions, set `aiEnriched: false`
- Check `isFeatureEnabled('knowledgeGaps')` from `src/ai/aiConfiguration.ts`

Pattern to follow: `src/ai/learningPath/generatePath.ts` (AbortController, timeout, streaming)

### Task 3 — Note link suggestion engine

**`src/ai/knowledgeGaps/noteLinkSuggestions.ts`**

```ts
export async function findNoteLinkSuggestions(
  savedNote: Note,
  allNotes: Note[]
): Promise<NoteLinkSuggestion[]>
```

Algorithm:
1. Filter `allNotes` to different courses: `note.courseId !== savedNote.courseId`
2. For each candidate: count shared tags (exact match, normalized lowercase)
3. Also extract key terms from content: split on word boundaries, filter stopwords, find 2+ shared words
4. Return candidates with `sharedTags.length >= 2` OR `sharedTerms.length >= 2`
5. Exclude dismissed pairs: check `localStorage.getItem('dismissed-note-links')` → skip if `"${savedNote.id}:${candidateId}"` or reverse is in the set

Dismissed pairs persistence: `localStorage` key `dismissed-note-links`, JSON array of `"id1:id2"` strings (sorted to ensure consistent key).

### Task 4 — Note save integration

In the Notes page (locate note save handler in `src/app/pages/Notes.tsx` or `src/stores/useNoteStore.ts`):
- After successful note save, call `findNoteLinkSuggestions(savedNote, allNotes)`
- If suggestions found, show Sonner toast with action buttons

Sonner toast pattern (non-blocking, matches E9B-S03 style):
```tsx
toast('Note connection found', {
  description: `"${suggestion.previewContent}..." in ${suggestion.targetCourseTitle}`,
  action: {
    label: 'Link notes',
    onClick: () => acceptNoteLinkSuggestion(suggestion)
  },
  cancel: {
    label: 'Dismiss',
    onClick: () => dismissNoteLinkSuggestion(suggestion)
  },
  duration: 8000
})
```

**Accept handler** (`acceptNoteLinkSuggestion`):
- Update source note: `db.notes.update(sourceId, { linkedNoteIds: [...existing, targetId] })`
- Update target note: `db.notes.update(targetId, { linkedNoteIds: [...existing, sourceId] })`

**Dismiss handler** (`dismissNoteLinkSuggestion`):
- Add pair to localStorage `dismissed-note-links`

### Task 5 — KnowledgeGaps page

**`src/app/pages/KnowledgeGaps.tsx`** at route `/knowledge-gaps`

State machine: `'idle' | 'analyzing' | 'completed' | 'error'`

UI structure:
- **Idle**: Page header, description, "Analyze My Learning" button (disabled if no courses/notes)
- **Analyzing**: Skeleton loaders + "Analyzing your study patterns..." with `aria-live="polite"`
- **Completed**:
  - Summary header ("X gaps found across Y courses")
  - Grouped by course, sorted by severity
  - Each `GapItem` card shows:
    - `<Badge variant>` for severity (destructive=critical, warning=medium, info=low)
    - Gap type label ("Under-noted" / "Skipped")
    - Video title + "Review video" `<Link>` to `/imported-courses/:courseId/lessons/:videoId`
    - Note count / watch percentage data
    - Optional AI description if enriched
  - Empty state if no gaps: "Great work! No coverage gaps detected."
- **Error**: `<Alert variant="destructive">` + retry button
- **AI unavailable badge**: when `aiEnriched: false`, show info badge "Rule-based analysis"

Design tokens: severity colors from `theme.css`:
- critical → `text-destructive bg-destructive/10`
- medium → `text-warning bg-warning/10`
- low → `text-info bg-info/10`

Pattern to follow: `src/app/pages/AILearningPath.tsx` page structure.

### Task 6 — Navigation & routing

`src/app/config/navigation.ts` — add to "Learn" group:
```ts
{ name: 'Knowledge Gaps', path: '/knowledge-gaps', icon: Brain }
```
(import `Brain` from lucide-react)

`src/app/routes.tsx` — add lazy-loaded route:
```tsx
const KnowledgeGaps = React.lazy(() =>
  import('./pages/KnowledgeGaps').then(m => ({ default: m.KnowledgeGaps }))
)
// In router children:
{ path: 'knowledge-gaps', element: <SuspensePage><KnowledgeGaps /></SuspensePage> }
```

### Task 7 — E2E tests

**`tests/e2e/story-e09b-s04.spec.ts`**

Setup per test:
```ts
await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
await seedIndexedDB({ courses: [course1], videos: [vid1, vid2, vid3], notes: [], progress: [] })
await seedAIConfiguration(page, { knowledgeGaps: true })
```

Test cases:
1. **AC1** — Under-noted: seed 3 videos, 0 notes for course → expect gap item with type "under-noted"
2. **AC2** — Skipped: seed video with `completedAt` + `completionPercentage: 30` → expect gap with type "skipped", shows "30%"
3. **AC3** — Sorting: seed 2 gaps (one critical, one medium) → critical appears first; each has link to video
4. **AC4** — Note link suggestion: navigate to notes, save a note with tags matching another course's note → expect Sonner toast with "Link notes" / "Dismiss"
5. **AC5** — Accept link: click "Link notes" toast action → reload page, check both notes have each other in metadata (via DB read)
6. **AC6** — Dismiss: click "Dismiss" → save same note text again → toast does NOT reappear
7. **AC7** — AI unavailable: set `connectionStatus: 'unconfigured'` → gaps still detected with "Rule-based analysis" badge

Mock injection: use `window.__mockKnowledgeGapsResponse` pattern (same as E9B-S03's `window.__mockLearningPathResponse`) for AI-enriched gap descriptions.

---

## Critical files (read before implementing)

- `src/ai/learningPath/generatePath.ts` — AbortController + LLM streaming pattern to copy
- `src/app/pages/AILearningPath.tsx` — page state machine + UI structure to follow
- `src/app/components/figma/AISummaryPanel.tsx` — collapsible panel + error handling pattern
- `src/ai/llm/factory.ts` — `getLLMClient()` API
- `src/ai/aiConfiguration.ts` — `isFeatureEnabled()` API
- `tests/support/helpers/ai-summary-mocks.ts` — `seedAIConfiguration()` pattern
- `tests/support/helpers/mock-llm-client.ts` — mock LLM generator pattern
- `tests/support/helpers/indexeddb-seed.ts` — data seeding API
- `src/app/pages/Notes.tsx` — find note save handler to hook into

---

## Commit cadence

Make a commit after each task:
1. `feat(E9B-S04): add gap detection types and rule engine`
2. `feat(E9B-S04): add note link suggestion engine`
3. `feat(E9B-S04): add KnowledgeGaps page and route`
4. `feat(E9B-S04): add note link suggestion toast on note save`
5. `test(E9B-S04): add E2E spec for all 7 ACs`

---

## Verification

```bash
# 1. Start dev server
npm run dev  # → http://localhost:5173

# 2. Build check
npm run build

# 3. E2E tests (current story only)
npx playwright test tests/e2e/story-e09b-s04.spec.ts --project=chromium

# 4. Manual smoke test
# - Navigate to /knowledge-gaps
# - Import a course, watch < 50% of a video and mark complete
# - Go to /knowledge-gaps → click "Analyze" → see skipped gap
# - Add notes with matching tags across 2 courses → save → see suggestion toast
```

---

## Workflow recommendation

**Review first** — this story has UI changes + 5 tasks + 7 ACs across two distinct sub-features.
`/review-story E9B-S04` → fix → `/finish-story E9B-S04`
