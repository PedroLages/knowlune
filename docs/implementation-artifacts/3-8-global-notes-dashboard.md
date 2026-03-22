# Story 3.8: Global Notes Dashboard

Status: done
completed: 2026-03-01
reviewed: true
review_started: 2026-03-01
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want to browse, search, and filter all my notes across every course in one dedicated page,
So that I can quickly find, review, and navigate to any note regardless of which course it belongs to.

## Acceptance Criteria

### AC1: Notes page displays all notes across courses

**Given** the user has created notes across multiple courses
**When** the user navigates to the Notes page via sidebar navigation
**Then** all notes are displayed in a list, each showing: course title, lesson/video title, content preview (first ~120 characters of plain text), tags as badges, and relative date (e.g., "2 hours ago")
**And** notes are sorted by most recently updated first (default)
**And** the total note count is displayed in the page header

### AC2: Full-text search filters notes in real-time

**Given** the Notes page is displaying all notes
**When** the user types a query into the search input
**Then** results filter in real-time (< 100ms per NFR21) using the existing MiniSearch index
**And** matching terms are highlighted in the content preview
**And** results show the same card format with course title, lesson title, snippet, tags, and date
**And** a "No results" empty state is shown when no notes match

### AC3: Tag-based filtering

**Given** the Notes page is displaying notes
**When** the user clicks a tag badge on any note card OR selects a tag from the tag filter bar
**Then** only notes containing that tag are shown
**And** the active tag filter is visually indicated (highlighted chip in filter bar)
**And** the user can clear the filter to return to all notes
**And** tag filter and search can be combined (AND semantics — results must match both)

### AC4: Sort controls

**Given** the Notes page is displaying notes
**When** the user changes the sort order via a sort dropdown
**Then** notes re-sort by the selected option: "Most Recent" (updatedAt desc, default), "Oldest First" (updatedAt asc), or "By Course" (grouped by course title alphabetically, then by updatedAt within each group)
**And** the selected sort option persists for the session

### AC5: Navigate to source video from note

**Given** a note card is displayed on the Notes page
**When** the user clicks on the note card
**Then** the card expands to show the full note content (read-only TipTap render)
**And** an "Open in Lesson" button navigates to `/courses/:courseId/:lessonId?panel=notes&t=:timestamp`
**And** if the note has a timestamp, clicking it seeks the video to that position

## Tasks / Subtasks

- [x] Task 1: Add `/notes` route and sidebar navigation entry (AC: 1)
  - [x] 1.1 Add `{ name: 'Notes', path: '/notes', icon: StickyNote }` to `src/app/config/navigation.ts` (insert after Library, before Messages). Import `StickyNote` from lucide-react.
  - [x] 1.2 Add route entry in `src/app/routes.tsx`: `{ path: 'notes', lazy: () => import('./pages/Notes') }` (or eager import matching project convention)
  - [x] 1.3 Create page skeleton `src/app/pages/Notes.tsx` with page title "My Notes" and note count

- [x] Task 2: Display all notes with course/lesson context (AC: 1)
  - [x] 2.1 Call `useNoteStore(state => state.loadNotes)` on mount via `useEffect` to load ALL notes
  - [x] 2.2 Enrich each note with course title and lesson title using `buildLookups()` helper (module-level Maps from `allCourses`, falls back to courseId/videoId for imported courses)
  - [x] 2.3 Render note cards showing: course title, lesson title, plain-text content preview (~120 chars), tags as `<Badge>` chips, relative date (using `formatDistanceToNow` from date-fns)
  - [x] 2.4 Default sort: `updatedAt` descending (most recent first)
  - [x] 2.5 Show total note count in page header (e.g., "My Notes (42)")
  - [x] 2.6 Empty state when no notes exist (prompt user to create notes in the lesson player)
  - [x] 2.7 Skeleton loading state while `isLoading` is true

- [x] Task 3: Full-text search with highlighted results (AC: 2)
  - [x] 3.1 Add search input at top of page (shadcn `Input` with `Search` lucide icon, `type="search"`, `aria-label="Search notes"`)
  - [x] 3.2 On input change (150ms debounce), call `searchNotesWithContext(query)` from `src/lib/noteSearch.ts`
  - [x] 3.3 Filter displayed notes to search result IDs, preserving enriched card format
  - [x] 3.4 Highlight matching terms in content preview using `highlightMatches` + `buildHighlightPatterns` from `src/lib/searchUtils.ts`
  - [x] 3.5 "No results" empty state with search query echo

- [x] Task 4: Tag filter bar (AC: 3)
  - [x] 4.1 On mount, call `getAllNoteTags()` from `src/lib/progress.ts` (uses Dexie multi-entry index) to populate available tags
  - [x] 4.2 Render horizontal scrollable tag chip bar below search input (use `role="group"` with `aria-label="Filter by tag"`)
  - [x] 4.3 Clicking a tag chip activates filter — show only notes whose `tags` array includes the selected tag
  - [x] 4.4 Clicking a tag badge on any note card also activates that tag filter
  - [x] 4.5 Active tag chip gets `bg-blue-600 text-white` styling; clicking again clears filter
  - [x] 4.6 When search is active AND tag filter is active, apply AND semantics: intersect search result IDs with tag-filtered note IDs

- [x] Task 5: Sort controls (AC: 4)
  - [x] 5.1 Add sort dropdown (shadcn `Select`) with options: "Most Recent", "Oldest First", "By Course"
  - [x] 5.2 "Most Recent" = `updatedAt` descending (default)
  - [x] 5.3 "Oldest First" = `updatedAt` ascending
  - [x] 5.4 "By Course" = group notes by course title (alphabetical), then `updatedAt` desc within each group; render course title as group header
  - [x] 5.5 Store selected sort in React state (session-only, no persistence needed)

- [x] Task 6: Expand note card with full content and navigation (AC: 5)
  - [x] 6.1 Adapted `ReadOnlyContent` pattern from `NoteCard.tsx` — TipTap read-only render with `useEditor({ editable: false })`
  - [x] 6.2 Add optional `courseName` prop to `NoteCard` interface for global context display
  - [x] 6.3 Collapsed state shows preview; clicking expands to full TipTap read-only render
  - [x] 6.4 "Open in Lesson" button navigates to `/courses/${courseId}/${note.videoId}?panel=notes&t=${note.timestamp}`
  - [x] 6.5 Timestamp button within expanded content navigates to video player with timestamp

## Dev Notes

### Technical Requirements

- **Performance**: Search must respond in < 100ms (NFR21). MiniSearch index is pre-built at app startup in `main.tsx` — no initialization needed in the Notes page. The `searchNotesWithContext()` function returns enriched results (top 20) with course/lesson names already resolved.
- **Data loading**: `useNoteStore.loadNotes()` fetches ALL notes from Dexie via `db.notes.toArray()`. For a user with hundreds of notes, this is a single IndexedDB transaction — fast enough. The Zustand store's `notes` array is replaced on each `loadNotes*` call, so the global page should call `loadNotes()` on mount.
- **Content format**: Note `content` is **HTML** (TipTap's `getHTML()` output), NOT raw Markdown. For preview snippets, strip HTML tags first, then truncate. For full display, use TipTap's `useEditor({ editable: false, content })` read-only mode.
- **Tag queries**: `getAllNoteTags()` in `src/db/schema.ts` uses Dexie's multi-entry `*tags` index via `db.notes.orderBy('tags').uniqueKeys()` — returns all unique tags without loading note content. For filtering by tag, use `db.notes.where('tags').equals(tag).toArray()` OR filter client-side from the already-loaded `notes` array (simpler for combined search+tag scenarios).

### Architecture Compliance

- **Zustand selectors**: ALWAYS use individual selectors — `const notes = useNoteStore(state => state.notes)`, never destructure the full store.
- **Optimistic updates**: Not applicable for this read-only page (no mutations). Delete from expanded card should delegate to `useNoteStore(state => state.deleteNote)` which already handles optimistic update + rollback.
- **Computed values**: Compute course/lesson title lookups ONCE in the parent component, pass as props to card children. Do NOT call `findCourseAndLesson()` inside `.map()` callbacks.
- **Accessibility (WCAG 2.1 AA+)**:
  - Search input: `<label>` associated with input via `htmlFor`/`id`, or `aria-label="Search notes"`
  - Tag filter bar: `role="group"` with `aria-label="Filter by tag"`
  - Sort dropdown: Keyboard navigable, proper ARIA
  - Note cards: Keyboard expandable (Enter/Space), focus-visible ring
  - All interactive elements: hover, focus-visible, active, disabled states
  - Color contrast: minimum 4.5:1 for text, 3:1 for large text
  - Touch targets: minimum 44x44px on mobile

### Library & Framework Requirements

| Library | Version | Usage |
|---------|---------|-------|
| `@tiptap/react` | existing | Read-only editor for expanded note content |
| `@tiptap/starter-kit` | existing | Minimum extensions for read-only render |
| `minisearch` | existing | Full-text search (already initialized at startup) |
| `date-fns` | existing | `formatDistanceToNow` for relative dates |
| `lucide-react` | existing | `StickyNote` icon for nav, `Search` icon for input |
| `dexie` | existing | `getAllNoteTags()` for tag index queries |

**No new dependencies required.** Everything needed is already installed.

### File Structure Requirements

**Files to CREATE:**
- `src/app/pages/Notes.tsx` — Page component (main deliverable)

**Files to MODIFY:**
- `src/app/config/navigation.ts` — Add Notes nav item (after Library, before Messages)
- `src/app/routes.tsx` — Add `/notes` route
- `src/app/components/notes/NoteCard.tsx` — Add optional `courseName` prop for global context display

**Files to REUSE (read-only, do not modify):**
- `src/stores/useNoteStore.ts` — `loadNotes()`, `deleteNote()`, `notes`, `isLoading`
- `src/lib/noteSearch.ts` — `searchNotesWithContext()`
- `src/lib/searchUtils.ts` — `truncateSnippet()`, `highlightMatches()`, `buildHighlightPatterns()`
- `src/db/schema.ts` — `getAllNoteTags()`
- `src/data/courses.ts` — `allCourses` for course/lesson title lookup

**DO NOT create:**
- A new Zustand store (reuse `useNoteStore`)
- New search utilities (reuse `noteSearch.ts` + `searchUtils.ts`)
- A separate notes API layer (data layer is complete)

### Testing Requirements

- **E2E tests** (Playwright, Chromium only for story scope):
  - Seed IndexedDB with test notes across multiple courses via `db.notes.bulkAdd()`
  - Test AC1: Navigate to `/notes`, verify note cards display with course context
  - Test AC2: Type in search input, verify filtered results with highlights
  - Test AC3: Click tag chip, verify filter; combine with search, verify AND semantics
  - Test AC4: Change sort dropdown, verify reorder
  - Test AC5: Click card to expand, verify "Open in Lesson" navigates correctly
- **E2E test gotcha**: Seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` before navigating to prevent sidebar overlay blocking pointer events at 640-1023px viewports.
- **No unit tests required**: This page is primarily composition of existing tested components (NoteCard, search, store). If the `NoteCard` `courseName` prop addition introduces logic, add a targeted test for that.
- **Regression**: Run existing smoke tests (navigation, overview, courses) to verify no breakage from route/nav changes.

### Previous Story Intelligence (3-7: Bookmarks Page)

**Patterns to reuse:**

- Library page tab pattern (Documents/Bookmarks) demonstrates the project's approach to list pages with filtering — but for Notes, a dedicated page is warranted given the richer feature set (search + tags + sort + expand).
- `findCourseAndLesson()` helper looks up static course data from `allCourses`. Falls back to raw courseId/lessonId for imported courses. Same pattern needed here.
- `AlertDialog` for destructive delete confirmation per NFR23 — already in `NoteCard`.
- Deep-link pattern: `/courses/:courseId/:lessonId?t=:timestamp&panel=notes` for navigating to a note's source video.

**Lessons learned from 3-7:**

- Task 4 (seek bar indicators) was already fully implemented by earlier stories — always check existing code before implementing. Similarly, `NoteCard` and search infrastructure are already built for this story.
- E2E tests that seed IndexedDB and reload are flaky under system load. Run E2E tests after other validation (build, lint), not in parallel.
- `findCourseAndLesson()` works for static `allCourses` but will need extension for user-imported courses once they have metadata in IndexedDB. For now, fall back to raw IDs.
- Code review flagged nested interactive elements (`<Button>` inside `<div role="button">`) — avoid this pattern. Use a single clickable container or separate click zones.

**Review feedback to carry forward:**

- Avoid hardcoded color tokens — use semantic Tailwind classes (`text-muted-foreground` not `text-foreground/70`)
- Ensure `handleDelete` has a catch block for error handling
- All buttons need explicit `type="button"` to prevent form submission
- Focus must be restored after dialog dismissal

### Git Intelligence

**Recent commits (relevant to this story):**

- `7c6638a` feat(E03-S07): bookmarks page — established the list page pattern (query from Dexie, render cards, navigation deep-links)
- `5a9c7a8` merge E03-S06 — course notes collection view, which is the per-course version of what we're building globally
- `b6b5c17` adopt unused shadcn/ui components — 10 files updated, confirms project preference for shadcn/ui primitives
- `c7bea7f` rewrite epics (11 epics, 58 stories) — explains why story 3-8 exists in sprint-status but not in the old epics format

**Conventions from recent work:**

- Commit prefix: `feat(E03-S08):` for implementation commits
- Branch name: `feature/e03-s08-global-notes-dashboard`
- Story file convention: `docs/implementation-artifacts/3-8-global-notes-dashboard.md`

### Project Structure Notes

- Notes page at `/notes` aligns with existing routing structure (`/courses`, `/library`, `/messages`, `/reports`, `/settings`)
- Navigation entry between Library and Messages is logical — notes are a content-adjacent feature
- `StickyNote` icon differentiates from `Notebook` (currently used by Messages placeholder)
- No conflicts with existing routes or components detected

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3] — Epic objective and Story 3.3 AC referencing "global notes"
- [Source: docs/planning-artifacts/prd.md#FR23] — Full-text search across all notes
- [Source: docs/planning-artifacts/prd.md#FR26] — View all notes for a course (extended to all courses)
- [Source: docs/planning-artifacts/ux-design-specification.md#Instant Search Recall] — "Find Notes in Seconds" user journey
- [Source: docs/project-context.md] — Zustand selector rules, optimistic update pattern, accessibility requirements
- [Source: docs/implementation-artifacts/3-7-bookmarks-page.md] — Previous story learnings and review feedback
- [Source: src/stores/useNoteStore.ts] — Note store API (`loadNotes`, `deleteNote`)
- [Source: src/lib/noteSearch.ts] — MiniSearch integration (`searchNotesWithContext`, `initializeSearchIndex`)
- [Source: src/lib/searchUtils.ts] — `truncateSnippet`, `highlightMatches`, `buildHighlightPatterns`
- [Source: src/db/schema.ts] — `getAllNoteTags()`, Dexie schema version 4
- [Source: src/app/components/notes/NoteCard.tsx] — Reusable card component (collapsed/expanded/editing)
- [Source: src/app/config/navigation.ts] — Sidebar navigation configuration

## Implementation Plan

See [plan](../../.claude/plans/soft-strolling-boole.md) for implementation approach.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- E2E test locator fixes: ATDD tests used `getByText()` with text that matched multiple DOM elements (lesson title + content preview, filter bar badges + card badges). Refined locators to scope to `[data-testid="note-card"]` and `getByRole('group')` for filter bar.

### Completion Notes List

- Created `Notes.tsx` page with full search, tag filter, sort, and expand functionality
- Used `buildLookups()` at module level for course/lesson name resolution (not `findCourseAndLesson()` which doesn't exist — built equivalent from `allCourses`)
- `getAllNoteTags()` is in `src/lib/progress.ts`, not `src/db/schema.ts` as noted in story spec
- Notes page handles its own card rendering with TipTap `ReadOnlyContent` rather than reusing `NoteCard` component's expand logic, because the global page needs search highlighting, tag-click callbacks, and `data-testid` attributes that NoteCard doesn't support
- Added optional `courseName` prop to `NoteCard` interface per Task 6.2
- All 18 E2E tests pass (Chromium)
- Build succeeds, no regressions in smoke tests

### Challenges and Lessons Learned

- **Keyboard accessibility on Badge components**: Code review caught that `<Badge>` renders as `<span>`, which is not keyboard-focusable or activatable. Wrapping in `<button>` is the correct fix — applies to both filter bar badges and in-card tag badges. Pattern: any clickable Badge must be inside a semantic `<button>`.
- **Nested interactive elements create a11y confusion**: A `role="button"` container with clickable children (tag badges, timestamps) creates an ambiguous keyboard/screen reader experience. This was flagged in E03-S06 and recurred here. Future cards with expandable behavior should use `<details>`/`<summary>` or explicit ARIA disclosure patterns instead of `role="button"` on a wrapping div.
- **Extract shared utilities early**: `stripHtml` and `ReadOnlyContent` were duplicated between NoteCard and Notes page. Extracted `ReadOnlyContent` to a shared module (`src/app/components/notes/ReadOnlyContent.tsx`) and `stripHtml`/`truncateText` to `src/lib/textUtils.ts`. Lesson: when the plan calls for rendering the same content type in two places, extract the renderer as step 1.
- **E2E seed data needs retry logic**: Raw `indexedDB.open` in test fixtures can race with Dexie initialization. The existing `indexeddb-fixture.ts` has retry logic — future story specs should use it or copy its pattern.
- **Commit before review**: The code review's top blocker was "all files uncommitted." Running `/review-story` on uncommitted work creates a false blocker. Commit implementation before running reviews.

### Change Log

- 2026-03-01: Implemented story 3-8 — Global Notes Dashboard with search, tag filter, sort, and card expansion

### File List

**Created:**

- `src/app/pages/Notes.tsx` — Main page component

**Modified:**

- `src/app/config/navigation.ts` — Added Notes nav item with StickyNote icon
- `src/app/routes.tsx` — Added `/notes` route with lazy-loaded Notes component
- `src/app/components/notes/NoteCard.tsx` — Added optional `courseName` prop to interface
- `tests/e2e/story-e03-s08.spec.ts` — Refined locators for strict mode compliance
- `docs/implementation-artifacts/3-8-global-notes-dashboard.md` — Story file updates
