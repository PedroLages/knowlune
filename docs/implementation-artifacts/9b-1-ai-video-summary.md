---
story_id: E09B-S01
story_name: "AI Video Summary"
status: done
started: 2026-03-12
completed: 2026-03-13
reviewed: true
review_started: 2026-03-13
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: true
---

# Story 9B.1: AI Video Summary

## Story

As a learner,
I want to generate an AI-powered summary of a video's content displayed alongside the player,
So that I can quickly review key concepts without rewatching the entire video.

## Acceptance Criteria

**AC1: Summary Generation UI**

**Given** I am viewing a video in the video player
**When** I click the "Generate Summary" button
**Then** a collapsible panel opens alongside the video player
**And** the AI-generated summary streams into the panel in real time
**And** the summary is between 100 and 300 words

**AC2: Panel Collapse/Expand**

**Given** the summary panel is open with a completed summary
**When** I click the collapse toggle on the panel
**Then** the panel collapses to a minimal bar showing "AI Summary" with an expand button
**And** clicking expand restores the full summary without regenerating

**AC3: Timeout Handling**

**Given** I click "Generate Summary"
**When** the AI provider takes longer than 30 seconds to respond
**Then** the request is cancelled with a timeout
**And** a fallback message is displayed: "Summary generation timed out. Please try again."
**And** the "Generate Summary" button becomes active again for retry

**AC4: Error Fallback**

**Given** I click "Generate Summary"
**When** the AI provider is unavailable or returns an error
**Then** the system falls back gracefully within 2 seconds
**And** displays a non-blocking error message with a retry option
**And** the video player remains fully functional

## Tasks / Subtasks

- [ ] Task 1: Research existing AI infrastructure and video player integration patterns (AC: all)
  - [ ] 1.1 Review Epic 9 AI infrastructure (provider config, web worker, embedding pipeline)
  - [ ] 1.2 Review video player components and current layout
  - [ ] 1.3 Identify transcript data source for summary generation

- [ ] Task 2: Design summary panel UI component (AC: #1, #2)
  - [ ] 2.1 Create collapsible panel component with expand/collapse states
  - [ ] 2.2 Implement streaming text display
  - [ ] 2.3 Add loading states and visual feedback

- [ ] Task 3: Implement AI summary generation service (AC: #1, #3, #4)
  - [ ] 3.1 Create summary generation API call with timeout handling
  - [ ] 3.2 Implement streaming response handling
  - [ ] 3.3 Add error handling and retry logic
  - [ ] 3.4 Validate summary length (100-300 words)

- [ ] Task 4: Integrate summary panel with video player (AC: all)
  - [ ] 4.1 Add "Generate Summary" button to video player UI
  - [ ] 4.2 Wire up panel state management
  - [ ] 4.3 Handle panel positioning and responsive layout

- [ ] Task 5: Add E2E tests (AC: all)
  - [ ] 5.1 Test summary generation happy path
  - [ ] 5.2 Test panel collapse/expand behavior
  - [ ] 5.3 Test timeout handling
  - [ ] 5.4 Test error fallback scenarios

## Implementation Notes

[To be populated during implementation]

## Testing Notes

[To be populated during testing]

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

**Review Date:** 2026-03-13
**Verdict:** ✅ APPROVED - Production-ready with optional post-merge enhancements

**Highlights:**
- Zero design violations (all colors/spacing use theme tokens)
- WCAG 2.1 AA+ accessibility compliance with comprehensive ARIA attributes
- Excellent responsive behavior across mobile (375px), tablet (768px), desktop (1440px)
- Robust four-state architecture (idle, generating, completed, error)
- Clean TypeScript with proper interfaces and type safety

**Findings:**
- **0 Blockers** — No issues preventing merge
- **0 High Priority** — No critical concerns
- **1 Medium Priority** — Icon direction for collapse/expand (ChevronUp/Down may be reversed from convention)
- **2 Nitpicks** — Minor UX polish opportunities (word count badge during regeneration, collapsed state hint text size)

**Full report:** [docs/reviews/design/design-review-2026-03-13-e09b-s01.md](../reviews/design/design-review-2026-03-13-e09b-s01.md)

## Code Review Feedback

**Review Date:** 2026-03-13
**Verdict:** 🔴 BLOCKED - 1 critical blocker

**Blocker:**
- `src/lib/aiConfiguration.ts:191-196` (confidence: 95): Production code contains test-only `_testApiKey` escape hatch that bypasses API key encryption. Any user (or XSS payload) can inject arbitrary plaintext API key via localStorage, defeating the entire security model. **Fix:** Remove `_testApiKey` escape hatch—E2E tests already mock the OpenAI API at network level.

**High Priority (3 issues):**
- `src/app/components/figma/AISummaryPanel.tsx:64-110`: No cancellation on component unmount or re-invocation. Navigating away mid-generation causes "Can't perform React state update on unmounted component" warnings and resource leaks. **Fix:** Add `AbortController` ref at component level with useEffect cleanup.
- `src/lib/aiSummary.ts:202-203`: AbortController timeout not exposed to caller. Component cannot cancel request on unmount. **Fix:** Add optional `signal?: AbortSignal` parameter to `generateVideoSummary`.
- `src/lib/aiConfiguration.ts:191`: TypeScript `as any` cast defeats type safety. **Fix:** Add `_testApiKey` to interface or remove escape hatch.

**Medium Priority (5 issues):**
- Word count validation not enforced (comment says it is)
- AC3 test takes 35 seconds (impacts CI feedback time)
- Missing sidebar localStorage seed (causes tablet viewport test failures)
- CSP connect-src too permissive (allows all paths on AI provider domains)
- Quadratic word count recalculation on every chunk

**Test Coverage (100% AC coverage):**
- 3 High Priority: Mock doesn't verify true streaming, malformed VTT edge case untested, consent disabled mid-generation untested
- 8 Edge Cases identified: Network interruption mid-stream, concurrent requests, Anthropic provider streaming, etc.

**Full reports:**
- Architecture: [docs/reviews/code/code-review-2026-03-13-e09b-s01.md](../reviews/code/code-review-2026-03-13-e09b-s01.md)
- Testing: [docs/reviews/code/code-review-testing-2026-03-13-e09b-s01.md](../reviews/code/code-review-testing-2026-03-13-e09b-s01.md)

## Challenges and Lessons Learned

### CSP Configuration for AI Provider APIs

**Challenge**: E2E tests failed with CSP violations when attempting to connect to AI provider APIs.

**Error**: `Connecting to 'https://api.openai.com/v1/chat/completions' violates the following Content Security Policy directive: "connect-src 'self' ..."`

**Solution**: Updated [index.html](../../index.html) CSP `connect-src` directive to include `https://api.openai.com` and `https://api.anthropic.com`. This is a critical requirement for any feature making external API calls.

**Key insight**: CSP violations fail silently in the browser console but cause E2E tests to fail with clear error messages. Always verify CSP configuration when adding new external API integrations.

### E2E Test Data Seeding for Imported Courses

**Challenge**: Tests navigating to `/courses/operative-six/op6-introduction` got 404s or empty pages.

**Root cause**: Course data wasn't seeded in IndexedDB before navigation. The video player expects imported courses to have full structure including modules, lessons, and resource metadata.

**Solution**: Added `seedImportedCourses()` call in test beforeEach with complete course structure:
```typescript
await seedImportedCourses(page, [{
  id: 'operative-six',
  name: 'The Operative Six',
  modules: [{
    id: 'op6-module-1',
    lessons: [{
      id: 'op6-introduction',
      resources: [{
        type: 'video',
        metadata: {
          captions: [{ src: '/captions/op6-introduction.vtt', srclang: 'en' }]
        }
      }]
    }]
  }]
}])
```

**Key insight**: The shared helper from `tests/support/helpers/indexeddb-seed.ts` provides frame-accurate waits and retry logic. Never duplicate IndexedDB seeding code—always use shared helpers.

### Mock API Timing for Observable UI States

**Challenge**: Tests couldn't verify loading states like "Generating summary..." because state transitions happened too fast.

**Issue**: Initial mock delay of 50ms made UI states imperceptible to Playwright's assertions.

**Solution**: Increased mock API delay to 200ms in `mockOpenAIStreaming()` helper:
```typescript
async function mockOpenAIStreaming(page: Page, summaryText: string, delayMs = 200) {
  // Delay must be long enough for UI state to be observable
}
```

**Key insight**: For streaming features, mock delays must balance test speed with UI state observability. 200ms is fast enough for CI (<2s per test) but slow enough to catch state transition bugs.

### Route Mocking Reliability in Playwright

**Challenge**: AC4 error fallback test failed to trigger error UI with `route.abort('failed')`.

**Issue**: The abort() method doesn't reliably simulate HTTP error responses. Different browsers handle aborted requests differently.

**Solution**: Changed to `route.fulfill({ status: 500, body: JSON.stringify({ error: ... }) })` to simulate proper HTTP error response.

**Key insight**: For error scenario tests, fulfill() with error status codes is more reliable than abort(). It triggers the same error handling paths as production HTTP errors.

### ESLint Configuration for Git Worktrees

**Challenge**: Lint pre-check failed with 14,535 errors from `.worktrees/*/dist/` directories.

**Root cause**: Git worktrees create separate working directories for parallel branch development. Build artifacts in these directories were being linted.

**Solution**: Added `.worktrees/` to `eslint.config.js` ignores:
```javascript
ignores: [
  'dist/',
  '.worktrees/', // Git worktree directories with build artifacts
]
```

**Key insight**: When using git worktrees for parallel development, update lint/format/test ignore patterns early to prevent spurious failures from build artifacts.

## Implementation Plan

See [docs/implementation-artifacts/plans/e09b-s01-ai-video-summary-plan.md](plans/e09b-s01-ai-video-summary-plan.md)
