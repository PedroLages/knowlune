---
story_id: E26-S04
story_name: "AI Path Placement Suggestion"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 26.4: AI Path Placement Suggestion

## Story

As a learner adding a course to an existing learning path,
I want the AI to suggest the optimal position for the new course within the path,
so that prerequisite ordering is maintained and I can make informed placement decisions.

## Acceptance Criteria

**AC1: AI Placement Suggestion on Course Addition**
**Given** I am viewing a learning path detail view (E26-S03) with at least 1 existing course
**When** I click "Add Course" and select a course to add
**Then** the AI analyzes the existing path courses and the new course
**And** suggests an optimal position with a justification (e.g., "Place after 'Python Basics' — this course assumes knowledge of variables and loops")
**And** the suggestion appears as a highlighted preview in the path before I confirm

**AC2: Accept or Reject Suggestion**
**Given** an AI placement suggestion is displayed
**When** I click "Accept"
**Then** the course is inserted at the suggested position
**And** subsequent courses shift their positions accordingly
**And** the change is persisted to IndexedDB

**Given** an AI placement suggestion is displayed
**When** I click "Place Manually" (reject)
**Then** the course is added at the end of the path (default position)
**And** I can drag it to any position using the existing drag-drop editor

**AC3: Loading and Streaming State**
**Given** the AI is analyzing the placement
**When** the request is in-flight
**Then** a loading indicator appears in the suggestion area
**And** the "Add Course" flow is not blocked (user can still cancel)

**AC4: AI Unavailable / Error Handling**
**Given** the AI provider is unavailable, unconfigured, or the learningPath consent is disabled
**When** I attempt to add a course to a path
**Then** the course is added at the end of the path without AI suggestion
**And** a non-blocking info message explains: "AI suggestion unavailable — course added at the end"
**And** the path editor remains fully functional

**AC5: Single-Course Path (Edge Case)**
**Given** a learning path has 0 existing courses
**When** I add the first course
**Then** no AI suggestion is shown (nothing to sequence against)
**And** the course is placed at position 1

**AC6: AI Usage Tracking**
**Given** an AI placement suggestion is generated
**When** the suggestion completes (success or error)
**Then** an AI usage event is tracked via `trackAIUsage('learning_path', ...)` with metadata including pathId, courseId, and whether the suggestion was accepted

## Tasks / Subtasks

- [ ] Task 1: Create `suggestPlacement` AI function (AC: 1, 3, 4)
  - [ ] 1.1 New file `src/ai/learningPath/suggestPlacement.ts`
  - [ ] 1.2 Construct focused prompt (existing path courses + new course metadata)
  - [ ] 1.3 Parse AI response: `{ suggestedPosition: number, justification: string }`
  - [ ] 1.4 Handle timeout (2s), abort, and error cases
  - [ ] 1.5 Add window mock support for E2E testing

- [ ] Task 2: Extend multi-path store with placement suggestion state (AC: 1, 2)
  - [ ] 2.1 Add placement suggestion state (`suggestedPosition`, `justification`, `isAnalyzing`)
  - [ ] 2.2 Add `requestPlacement(pathId, courseId)` action
  - [ ] 2.3 Add `acceptPlacement(pathId)` action (inserts at suggested position)
  - [ ] 2.4 Add `rejectPlacement(pathId)` action (inserts at end)

- [ ] Task 3: Create PlacementSuggestion UI component (AC: 1, 2, 3)
  - [ ] 3.1 New component `src/app/components/learning-paths/PlacementSuggestion.tsx`
  - [ ] 3.2 Show loading state while AI analyzes
  - [ ] 3.3 Show suggestion card with justification text
  - [ ] 3.4 Accept/Reject buttons with proper styling
  - [ ] 3.5 Preview insertion point in path list (highlighted row)

- [ ] Task 4: Integrate into Path Detail View (AC: 1, 2, 4, 5)
  - [ ] 4.1 Wire PlacementSuggestion into "Add Course" flow in path detail
  - [ ] 4.2 Skip AI suggestion when path is empty (AC5)
  - [ ] 4.3 Graceful fallback when AI is unavailable (AC4)

- [ ] Task 5: AI usage tracking (AC: 6)
  - [ ] 5.1 Track suggestion generation events
  - [ ] 5.2 Track accept/reject decisions in metadata

- [ ] Task 6: E2E tests (all ACs)
  - [ ] 6.1 Test: AI suggests position when adding course to path with courses
  - [ ] 6.2 Test: Accept places at suggested position
  - [ ] 6.3 Test: Reject places at end
  - [ ] 6.4 Test: Empty path skips AI suggestion
  - [ ] 6.5 Test: AI unavailable falls back gracefully
  - [ ] 6.6 Test: Loading state appears during analysis

## Design Guidance

**Layout**: The placement suggestion appears as an inline card within the path detail view, between the "Select Course" step and the final path list. Uses the same card styling as existing AI feature cards (`bg-card border border-border rounded-[24px] p-8`).

**Component Structure**:
- `PlacementSuggestion` — suggestion card with accept/reject
- Integrates into existing path detail view (E26-S03)

**Design System Usage**:
- `variant="brand"` button for "Accept Suggestion"
- `variant="brand-outline"` button for "Place Manually"
- `Sparkles` icon for AI suggestion indicator
- Loading: `Loader2` spinner with "Analyzing best position..." text
- Error: `Alert` component with `variant="default"` (info, not destructive)

**Responsive Strategy**: Full-width card on mobile, constrained width on desktop (max-w-2xl)

**Accessibility**:
- Live region (`aria-live="polite"`) for suggestion appearance
- Focus management: focus moves to suggestion card when it appears
- Accept/Reject buttons have descriptive `aria-label`s

## Implementation Notes

**Plan**: [e26-s04-ai-path-placement-suggestion.md](plans/e26-s04-ai-path-placement-suggestion.md)

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
