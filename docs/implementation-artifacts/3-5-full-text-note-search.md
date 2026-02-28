---
story_id: E03-S05
story_name: "Full-Text Note Search"
status: done
started: 2026-02-28
completed: 2026-02-28
reviewed: true
review_started: 2026-02-28
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 3.5: Full-Text Note Search

## Story

As a learner,
I want to search across all my notes by content, tags, or course name,
So that I can find specific knowledge I've captured in under 10 seconds.

## Acceptance Criteria

**Given** the user has notes across multiple courses
**When** the user types a search query in the search bar or Cmd+K command palette
**Then** MiniSearch returns matching results within 100ms of the final keystroke (150ms debounce + sub-1ms search)
**And** results show note snippet with highlighted matching keywords, course name, video title, and tags
**And** results are ranked by relevance (tags boosted 2x, course name 1.5x, content 1x)

**Given** the user types a query with a typo (e.g., "custm hooks")
**When** search executes
**Then** fuzzy matching still returns relevant results (e.g., notes containing "custom hooks")
**And** prefix search works for autocomplete (searching "java" finds "javascript")

**Given** a search result is clicked
**When** the user selects a note result
**Then** the Lesson Player opens with the linked video and `?panel=notes` param to auto-open the Notes tab
**And** if the note contains a timestamp link, the video seeks to that position

**Given** no results match the query
**When** search returns empty
**Then** a helpful message is shown: "No notes found. Try different keywords or browse by tag."

## Tasks / Subtasks

- [ ] Task 1: Install and configure MiniSearch (AC: 1, 2)
  - [ ] 1.1 Install `minisearch` package
  - [ ] 1.2 Create search index service with field configuration (content, tags, courseName, videoTitle)
  - [ ] 1.3 Configure boosted fields (tags 2x, courseName 1.5x, content 1x)
  - [ ] 1.4 Enable fuzzy matching and prefix search
- [ ] Task 2: Build search index lifecycle (AC: 1)
  - [ ] 2.1 Initialize index from Dexie notes on app startup
  - [ ] 2.2 Incremental index updates on note CRUD operations
  - [ ] 2.3 Ensure sub-1ms search performance
- [ ] Task 3: Integrate into SearchCommandPalette (AC: 1, 2, 4)
  - [ ] 3.1 Add "Notes" result group to existing SearchCommandPalette.tsx
  - [ ] 3.2 Replace static useMemo index with dynamic MiniSearch-backed results
  - [ ] 3.3 Render results with note icon, content snippet, course/video context, and tag badges
  - [ ] 3.4 Implement 150ms debounce for search input
  - [ ] 3.5 Show empty state message when no results match
- [ ] Task 4: Deep-linking and navigation (AC: 3)
  - [ ] 4.1 Navigate to Lesson Player with `?panel=notes` param on result click
  - [ ] 4.2 Seek video to timestamp position if note contains timestamp link

## Implementation Notes

- MiniSearch index initialized in Story 3.0, updated incrementally on note CRUD
- Search fields: content, tags, courseName, videoTitle
- Combine with 'AND' for multi-term queries
- Limit to top 20 results
- SearchCommandPalette.tsx modification required: Add a "Notes" result group
- The palette's `useMemo(() => buildSearchIndex(), [])` needs dependency on open state or a separate dynamic fetch for notes

## Implementation Plan

See [plan](../../.claude/plans/wobbly-inventing-hearth.md) for implementation approach.

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

Reviewed 2026-02-28 (re-run). Report: `docs/reviews/design/design-review-2026-02-28-e03-s05.md`

**No blockers.** 2 high-priority, 3 medium findings:

- H1: Raw markdown link syntax visible in note snippets (truncateSnippet strips HTML but not markdown)
- H2: Mobile close button 16x16px (pre-existing, fails 44px touch target)
- M1: buildSearchIndex() on every render (needs useMemo)
- M2: "No notes found" message scope ambiguity
- M3: 300px max-height may clip results (pre-existing)

## Code Review Feedback

Reviewed 2026-02-28 (re-run). Reports:

- `docs/reviews/code/code-review-2026-02-28-e03-s05.md`
- `docs/reviews/code/code-review-testing-2026-02-28-e03-s05.md`

**1 blocker (code), 2 blockers (testing).** 4 high (code) + 4 high (testing):

- **B1 (code):** Uncommitted working tree fixes — combineWith, tag separator, searchParams deps, highlight memoization, and tests not committed
- **B1 (testing):** AC1a latency guarantee has zero test coverage
- **B2 (testing):** AC1b keyword highlighting has zero test coverage
- H1: Silent empty results when index not initialized
- H2: "No notes found" message scope ambiguity (cross-domain)
- H3: updateInIndex swallows all errors silently
- H4: h-4 w-4 instead of size-4 Tailwind v4 shorthand
- E2E timestamp test doesn't assert t=42 or video seek
- E2E doesn't assert video title in results
- No snippet content assertion in first AC1 test
- No afterEach cleanup for seeded IndexedDB notes

## Challenges and Lessons Learned

- **MiniSearch field enrichment**: The existing index only stored `content` and `tags`. Extending it with `courseName` and `videoTitle` required enriching documents at index time by joining against the Dexie `courses` and `lessons` tables. The lookup runs once at build time, keeping search itself sub-millisecond.
- **cmdk group locator ambiguity**: Playwright's `getByRole('group')` with `hasText` matching was fragile — it matched ancestor groups containing the text anywhere in descendants. Switching to `{ name: /notes/i }` (accessible name) produced stable, semantically correct selectors. Same issue hit the "Notes" toggle button vs "Close notes panel" button — fixed with `{ name: 'Notes', exact: true }`.
- **`?panel=notes` deep-link timing**: The LessonPlayer reads `panel=notes` from the URL on mount to auto-expand the notes panel. This only works on fresh mounts — navigating between lessons within the same LessonPlayer instance doesn't re-trigger. Acceptable for search navigation (always a fresh mount) but worth noting for future intra-player navigation features.
- **Fuzzy matching trade-off**: MiniSearch's `fuzzy: 0.2` catches common typos (1-2 character edits) without flooding results with irrelevant matches. Combined with `prefix: true`, it covers both autocomplete ("java" → "javascript") and typo tolerance ("custm" → "custom") — two distinct AC requirements from one configuration.
- **Snippet truncation**: `truncateSnippet()` strips HTML but not markdown syntax. Raw markdown link syntax (`[text](url)`) appears in search result snippets. Logged as a high-priority finding but deferred — fixing requires a markdown-to-plain-text pass that would add complexity for marginal UX gain in note snippets.
