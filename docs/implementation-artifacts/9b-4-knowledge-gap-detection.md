---
story_id: E9B-S04
story_name: "Knowledge Gap Detection"
status: done
started: 2026-03-14
completed: 2026-03-14
reviewed: true
review_started: 2026-03-14
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 9B.4: Knowledge Gap Detection

## Story

As a learner,
I want the system to identify gaps in my study coverage and suggest content to revisit,
So that I can strengthen weak areas and ensure comprehensive understanding.

## Acceptance Criteria

**Given** I have courses with videos and notes
**When** the system analyzes my study patterns
**Then** it identifies topics where I have fewer than 1 note per 3 videos
**And** flags these as "under-noted topics" in a Knowledge Gaps panel

**Given** the system detects a video marked as complete
**When** my watch progress for that video is less than 50% of its total duration
**Then** it flags the video as "skipped" in the Knowledge Gaps panel
**And** displays the actual watch percentage alongside the flag

**Given** the Knowledge Gaps panel is displayed
**When** I view the flagged items
**Then** each gap shows the specific videos or sections recommended to revisit
**And** each recommendation includes a direct link to the video
**And** gaps are sorted by severity (least notes per video ratio first)

**Given** I save a new note
**When** the note shares 2 or more tags or key terms with existing notes in other courses
**Then** the system proactively suggests linking the new note to the related existing notes
**And** the suggestion appears as a non-blocking notification with a preview of the related notes

**Given** the system suggests note links
**When** I accept a suggested link
**Then** the notes are linked bidirectionally
**And** the link is immediately visible in both notes' metadata

**Given** the system suggests note links
**When** I dismiss a suggestion
**Then** the suggestion is removed and not re-shown for that specific note pair
**And** future suggestions for other note pairs are unaffected

**Given** the AI provider is unavailable
**When** the system attempts gap analysis
**Then** it falls back to rule-based detection (note count ratios and watch percentage thresholds) without AI enrichment
**And** the fallback activates within 2 seconds

## Tasks / Subtasks

- [ ] Task 1: Add types for GapItem, NoteLinkSuggestion to `src/data/types.ts` and `src/ai/knowledgeGaps/types.ts` (AC: 1, 2, 3, 4)
  - [ ] 1.1 Add `linkedNoteIds?: string[]` to `Note` interface in `src/data/types.ts`
  - [ ] 1.2 Create `src/ai/knowledgeGaps/types.ts` with `GapItem`, `GapSeverity`, `NoteLinkSuggestion`

- [ ] Task 2: Implement gap detection engine (AC: 1, 2, 3, 7)
  - [ ] 2.1 Create `src/ai/knowledgeGaps/detectGaps.ts` — rule-based algorithm (under-noted + skipped)
  - [ ] 2.2 Add optional AI enrichment with AbortController (2s timeout, falls back gracefully)
  - [ ] 2.3 Sort output by severity (critical first, then note ratio ascending)

- [ ] Task 3: Implement note link suggestion engine (AC: 4, 5, 6)
  - [ ] 3.1 Create `src/ai/knowledgeGaps/noteLinkSuggestions.ts` — tag + key term matching
  - [ ] 3.2 Dismissed pairs persistence via localStorage `dismissed-note-links`
  - [ ] 3.3 Accept handler: bidirectional `linkedNoteIds` update in Dexie

- [ ] Task 4: Create KnowledgeGaps page (AC: 1, 2, 3, 7)
  - [ ] 4.1 Create `src/app/pages/KnowledgeGaps.tsx` — state machine (idle/analyzing/completed/error)
  - [ ] 4.2 Gap item cards with severity badges, type labels, video links
  - [ ] 4.3 Empty state, error state, AI unavailable badge ("Rule-based analysis")

- [ ] Task 5: Hook note link suggestions into note save flow (AC: 4, 5, 6)
  - [ ] 5.1 Trigger `findNoteLinkSuggestions` after note save in Notes page
  - [ ] 5.2 Show Sonner toast with "Link notes" / "Dismiss" action buttons

- [ ] Task 6: Navigation and routing
  - [ ] 6.1 Add "Knowledge Gaps" to `src/app/config/navigation.ts` Learn group
  - [ ] 6.2 Register `/knowledge-gaps` route in `src/app/routes.tsx`

- [ ] Task 7: E2E tests (AC: 1–7)
  - [ ] 7.1 Create `tests/e2e/story-e09b-s04.spec.ts` with 7 test cases

## Design Guidance

This is a UI story — design guidance covers the KnowledgeGaps page and note link suggestion toast.

### Page: `/knowledge-gaps`

**Layout**: Full-page editorial layout, following `AILearningPath.tsx` structure. Max-width container with generous vertical spacing (gap between sections: `space-y-8`).

**Visual hierarchy**:
- Page header: "Knowledge Gaps" with subheading description + "Analyze My Learning" primary CTA button
- Analyzing state: skeleton cards + ARIA live region ("Analyzing your study patterns...")
- Results: grouped by course, within each group cards sorted critical → medium → low

**Gap item card anatomy**:
```
┌─────────────────────────────────────────────────────┐
│ [BADGE: Critical] [Under-noted]  [Course: React 101] │
│ "Async/Await Patterns" — Lesson 3                    │
│ 0 notes / 3 videos in this topic                     │
│                              [Review Video →]        │
└─────────────────────────────────────────────────────┘
```

**Severity color system** (design tokens from `theme.css`):
- Critical → `text-destructive` badge + `bg-destructive/10` card background
- Medium → `text-warning` badge + `bg-warning/10` card background
- Low → `text-info` badge + `bg-info/10` card background

**AI unavailable indicator**: Small `<Badge variant="outline">` pill at top right: "Rule-based analysis" with Cpu icon.

**Empty state**: Centered illustration-like layout — checkmark icon, heading "No gaps found!", subtext "Your study coverage looks great. Keep it up!".

**Mobile-first**: Single column on mobile (<640px), 2-column grid at 768px+ for gap cards.

### Note Link Suggestion Toast

Non-blocking Sonner toast (duration: 8 seconds, top-right position):
- Title: "Note connection found"
- Description: Preview of related note + source course name
- Actions: "Link notes" (primary) / "Dismiss" (ghost)

## Implementation Plan

See [plan](plans/golden-brewing-naur.md) for implementation approach.

## Implementation Notes

- **Rule-based detection first, AI as progressive enhancement**: Gap detection always runs the rule engine (note count ratios, watch percentage thresholds) and optionally enriches with AI descriptions via `Promise.race` with a 2-second timeout. No new dependencies needed — reuses existing `getAIConfiguration` and `/api/ai/generate` endpoint.
- **Window mock injection for E2E**: `window.__mockKnowledgeGapsResponse` lets tests control exact gap data without a real AI backend or complex Dexie seeding. Declared in `types.ts` via `declare global`.
- **Note link suggestions via key-term extraction**: Stopword-filtered content matching (≥2 shared terms or tags) with dismissed pairs persisted in localStorage. Integrated into `useNoteStore.saveNote()` with Sonner toast.
- **State machine UI pattern**: `KnowledgeGaps.tsx` uses explicit `PageState` union (`idle | analyzing | completed | error`) with `AbortController` cleanup in `useEffect`.

## Testing Notes

- **ATDD approach**: Tests written in Red phase before implementation. 7 test cases covering all ACs.
- **IndexedDB seeding**: Uses shared `seedIndexedDBStore` helper for course/video/note/progress data.
- **Window mock pattern**: `page.addInitScript()` injects `__mockKnowledgeGapsResponse` to control gap detection output without hitting Dexie queries.
- **Sidebar seeding**: localStorage `eduvi-sidebar-v1` seeded to `false` to prevent tablet overlay blocking interactions.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

**1 Blocker, 2 High, 2 Medium, 3 Nits** — Report: `docs/reviews/design/design-review-2026-03-14-e9b-s04.md`

- **B1**: Severity color bleeds into video title h3 — `text-destructive` applied to entire card, ~4.3:1 contrast on title
- **H1**: "Review video →" touch target 20px (needs 44px) — fix with `py-3 -my-3`
- **H2**: Course `<section>` lacks `aria-labelledby` for screen reader navigation
- **M2**: Button disabled state may not propagate correctly during store load
- **M3**: Course section h3 contrast ~3.8:1 at 12px — below AA threshold

## Code Review Feedback

**0 Blockers, 5 High, 4 Medium, 2 Nits** — Report: `docs/reviews/code/code-review-2026-03-14-e9b-s04.md`

- **H1**: String interpolation for className instead of `cn()` in GapCard (recurring)
- **H2**: Under-noted detection logic may scale incorrectly — per-video vs course-level ratio
- **H3**: Bidirectional note link write not wrapped in Dexie transaction
- **H4**: Stale `savedNote` in progress.ts trigger call
- **H5**: setTimeout not cleared on AI enrichment success (recurring from E9B-S03)
- **M1**: Unused `toast` import in useNoteStore
- **M2**: Silent swallow in `dismissNoteLinkPair` catch block
- **M3**: Unsafe JSON.parse cast of AI response
- **M4**: Test file approaching 300-line target (384 lines)

## Web Design Guidelines Review

**0 Blockers, 2 High, 4 Medium, 3 Low** — Report: `docs/reviews/code/web-design-guidelines-2026-03-14-e9b-s04.md`

- **H1**: GapCard uses `<div>` instead of `<article>` — screen readers can't identify cards
- **H2**: "Review video" links have identical text — needs `aria-label` per video
- **M1**: Severity badge uses manual `<span>` instead of imported `<Badge>` component
- **M3**: `aria-live` region doesn't announce error state
- **M4**: "Import a course" link may not meet 44px touch target

## Test Coverage Review

**7/7 ACs covered, 0 Blockers, 2 High, 5 Medium** — Report: `docs/reviews/code/code-review-testing-2026-03-14-e9b-s04.md`

- **H1**: AC7 timing requirement (2s fallback) not asserted
- **H2**: No `afterEach` cleanup for `dismissed-note-links` localStorage
- Notable edge cases identified: boundary values (49% vs 50%), empty courses, error/retry state, absence of unit tests for pure logic

## Challenges and Lessons Learned

- **Window mock vs Dexie seeding trade-off**: Seeding all 4 Dexie tables (courses, videos, notes, progress) with the right relationships for gap detection would be fragile and verbose. The `window.__mockKnowledgeGapsResponse` injection pattern bypasses the data layer entirely for UI tests, while keeping the rule engine testable via unit tests. Trade-off: UI tests don't exercise the actual detection algorithm — but the algorithm is pure logic testable in isolation.
- **Note link suggestion timing**: Suggestions trigger after `saveNote()` completes in the Zustand store. Initially considered triggering in a `useEffect` watching the notes array, but that would fire on every load/delete too. Direct invocation after the DB write is more predictable.
- **Severity sorting stability**: The two-level sort (severity bucket first, then note ratio ascending within each bucket) ensures consistent ordering. Without the secondary sort, cards would shuffle on re-analysis since `Map` iteration order depends on insertion order.
- **AbortController cleanup pattern**: The `useRef` + `useEffect` cleanup pattern ensures in-flight `detectGaps()` calls are aborted on unmount, preventing state updates on unmounted components.
