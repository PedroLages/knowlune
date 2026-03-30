---
story_id: E53-S01
story_name: "Flashcard & Bookmark Markdown Export"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, typecheck, format, unit-tests, e2e-tests, code-review, test-coverage-review, lessons-learned]
burn_in_validated: false
---

# Story 53.01: Flashcard & Bookmark Markdown Export

## Story

As a learner using Obsidian or other PKM tools,
I want to export my flashcards as Markdown Q/A files and bookmarks as Markdown lists with YAML frontmatter,
so that I can integrate my learning artifacts into my personal knowledge management system.

## Acceptance Criteria

- [ ] AC1: Given flashcards exist in IndexedDB, when `exportFlashcardsAsMarkdown()` is called, then each flashcard produces a `.md` file with YAML frontmatter containing `type: "flashcard"`, `deck`, `tags`, `interval`, `ease_factor`, `review_count`, `created`, and body with `# Q: {front}` heading followed by `{back}`.
- [ ] AC2: Given flashcards span 3 courses, when exported, then files are organized under `flashcards/{course-name}/` folder paths (3 distinct course folders).
- [ ] AC3: Given a flashcard has `noteId` linking to a Note with tags `["react", "hooks"]` in course "React Mastery", when exported, then tags include `["react-mastery", "react", "hooks"]` (course name kebab-cased + linked note tags, deduplicated).
- [ ] AC4: Given a flashcard has `reviewedAt: undefined` and `lastRating: undefined`, when exported, then those YAML lines are omitted entirely (not `reviewed_at: "undefined"`).
- [ ] AC5: Given bookmarks exist across 2 courses with 3 videos each, when `exportBookmarksAsMarkdown()` is called, then 2 Markdown files are generated (one per course), each with bookmarks grouped by video heading, sorted by timestamp ascending.
- [ ] AC6: Given a bookmark has timestamp 3725 seconds, when exported, then the formatted timestamp is `1:02:05`.
- [ ] AC7: Given no flashcards exist, when `exportFlashcardsAsMarkdown()` is called, then an empty array is returned without error. Same for bookmarks.

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/flashcardExport.ts` (AC: 1, 2, 3, 4)
  - [ ] 1.1 Implement `deriveFlashcardTags(flashcard, courseMap, noteTagMap): string[]` — course name kebab-case + linked note tags, deduplicated
  - [ ] 1.2 Implement `exportFlashcardsAsMarkdown(onProgress?): Promise<Array<{ name: string; content: string }>>` — load flashcards, courses, notes; group by courseId; generate YAML frontmatter + Q/A body; organize under `flashcards/{course-name}/` paths
  - [ ] 1.3 Reuse `sanitizeFilename()` from `noteExport.ts` for file naming
  - [ ] 1.4 Implement filename dedup with counter suffix for collision handling
  - [ ] 1.5 Progress callbacks + `yieldToUI()` every 20 items
  - [ ] 1.6 Handle undefined optional SM-2 fields (omit from YAML, don't write "undefined")

- [ ] Task 2: Create `src/lib/bookmarkExport.ts` (AC: 5, 6, 7)
  - [ ] 2.1 Implement `formatTimestamp(seconds: number): string` — `0:00`, `1:05`, `1:02:05`
  - [ ] 2.2 Implement `exportBookmarksAsMarkdown(onProgress?): Promise<Array<{ name: string; content: string }>>` — load bookmarks, courses, videos; group by courseId then lessonId; generate one `.md` per course
  - [ ] 2.3 YAML frontmatter with `type: "bookmarks"`, `course`, `bookmark_count`, `exported`
  - [ ] 2.4 Sort bookmarks within each video by `timestamp` ascending
  - [ ] 2.5 Filename: `bookmarks/{sanitized-course-name}/bookmarks.md`

- [ ] Task 3: Verify `MarkdownNoteFile` type export (AC: 1)
  - [ ] 3.1 Check `exportService.ts` — ensure `{ name: string; content: string }` interface is exported; add `export` keyword if missing

## Design Guidance

N/A — this story is purely data transformation logic with no UI components.

## Implementation Notes

**Key files to reference/extend:**
- `src/lib/noteExport.ts` (134 lines) — `htmlToMarkdown()`, `generateBulkFrontmatter()`, `sanitizeFilename()`, YAML pattern
- `src/lib/exportService.ts` (302 lines) — `ExportProgressCallback` type, `yieldToUI()`, `exportNotesAsMarkdown()`, course map building
- `src/data/types.ts:437-452` — `Flashcard` type: `front`, `back`, SM-2 fields, `courseId`, `noteId?`
- `src/data/types.ts:227-234` — `VideoBookmark` type: `label`, `timestamp`, `courseId`, `lessonId`, `createdAt`
- `src/db/schema.ts` — Dexie tables: `flashcards`, `bookmarks`, `notes`, `importedCourses`, `importedVideos`

**New file to create:**
- `src/lib/flashcardExport.ts` — `deriveFlashcardTags()`, `exportFlashcardsAsMarkdown()`
- `src/lib/bookmarkExport.ts` — `formatTimestamp()`, `exportBookmarksAsMarkdown()`

**YAML frontmatter conventions (from noteExport.ts):**
- `---` delimited YAML block
- Quote strings, escape internal quotes with `\"`
- Array syntax for tags: `[tag1, tag2]`
- ISO 8601 dates
- Omit optional fields when undefined

## Testing Notes

**Unit-level edge cases:**
- YAML frontmatter with quotes in flashcard front text (`Q: What is "React"?`)
- `formatTimestamp()`: `0 -> "0:00"`, `65 -> "1:05"`, `3725 -> "1:02:05"`, `59 -> "0:59"`
- `deriveFlashcardTags()`: no noteId -> course tag only; with noteId -> course + note tags; dedup
- Empty flashcard/bookmark arrays -> empty result array

**E2E tests:**
- Seed IDB with flashcards + bookmarks via factories
- Call export functions and verify file count, folder structure, content format

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

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
