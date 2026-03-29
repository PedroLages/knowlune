---
story_id: E89-S02
story_name: "Create Unified Course Adapter Layer"
status: complete
started: 2026-03-29
completed: 2026-03-29
reviewed: true
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 89.02: Create Unified Course Adapter Layer

## Story

As a developer building the unified course experience,
I want a source-agnostic adapter layer over ImportedCourse data,
so that unified page components never branch on `course.source` directly.

## Acceptance Criteria

- AC1: Given a `CourseAdapter` interface is defined in `src/lib/courseAdapter.ts`, when inspecting the interface, then it exposes `getCourse()`, `getSource()`, `getLessons()`, `getMediaUrl(lessonId)`, `getTranscript(lessonId)`, `getThumbnailUrl()`, and `getCapabilities()`.
- AC2: Given `LessonItem` is defined, when a lesson is normalized, then it includes `id`, `title`, `type` (`'video' | 'pdf'`), `duration`, `order`, and optional `sourceMetadata`.
- AC3: Given `ContentCapabilities` is defined, when queried, then it declares `hasVideo`, `hasPdf`, `hasTranscript`, `supportsNotes`, `supportsQuiz`, `supportsPrevNext`, and `supportsBreadcrumbs` per source.
- AC4: Given a `LocalCourseAdapter` is created for a local course, when `getLessons()` is called, then it returns a normalized list combining `importedVideos` and `importedPdfs` sorted by order.
- AC5: Given a `YouTubeCourseAdapter` is created for a YouTube course, when `getMediaUrl(lessonId)` is called, then it returns the YouTube embed URL (not a blob URL).
- AC6: Given a `createCourseAdapter(course)` factory function, when passed an `ImportedCourse` with `source: 'youtube'`, then it returns a `YouTubeCourseAdapter`; when passed one with `source: undefined` or `source: 'local'`, then it returns a `LocalCourseAdapter`.
- AC7: Given a `useCourseAdapter(courseId)` hook, when a component calls it, then it loads the course from Dexie, creates the adapter, and returns `{ adapter, loading, error }`.
- AC8: Unit tests cover both adapter implementations with mock Dexie data.

## Tasks / Subtasks

- [x] Task 1: Create `CourseAdapter` interface + `LessonItem` + `ContentCapabilities` types (AC: 1, 2, 3)
- [x] Task 2: Implement `LocalCourseAdapter` (AC: 4, 6)
- [x] Task 3: Implement `YouTubeCourseAdapter` (AC: 5, 6)
- [x] Task 4: Create `createCourseAdapter()` factory function (AC: 6)
- [x] Task 5: Create `useCourseAdapter(courseId)` React hook (AC: 7)
- [x] Task 6: Write unit tests for both adapters + factory (AC: 8)

## Implementation Notes

- Adapters are thin data mappers, not computation-heavy
- `LocalCourseAdapter.getMediaUrl()` reads from `FileSystemFileHandle` and creates a blob URL
- `YouTubeCourseAdapter.getMediaUrl()` constructs `https://www.youtube.com/embed/{videoId}`
- Follow interface design from architecture doc section A1
- No Dexie table modifications needed — adapters read from existing tables

## Testing Notes

Unit tests use `fake-indexeddb/auto` + Dexie module reset pattern per project conventions.

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **PDF ordering ambiguity**: `ImportedPdf` has no `order` field (unlike `ImportedVideo`). Used `pageCount` as a fallback ordering key, which places PDFs roughly alongside videos when sorted. Future stories (S04/S06) may need explicit PDF ordering via a Dexie migration.
- **Adapter as data mapper, not cache**: Adapters hold references to pre-loaded data (videos/pdfs arrays) rather than re-querying Dexie on each method call. This makes them thin and fast but means callers must create a new adapter if underlying data changes. The `useCourseAdapter` hook handles this automatically via `useLiveQuery`.
- **useLiveQuery for reactivity**: Using `useLiveQuery` in the hook ensures the adapter re-creates when Dexie data changes (e.g., video reorder, metadata refresh), without manual subscription management.
- **Backward compatibility**: `source: undefined` on older local courses is treated as `'local'` by the factory, preserving backward compatibility with pre-E28 imported courses.
