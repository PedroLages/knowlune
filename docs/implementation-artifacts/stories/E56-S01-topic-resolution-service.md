---
story_id: E56-S01
story_name: "Topic Resolution Service"
status: in-progress
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests-skipped
  - design-review-skipped
  - code-review
  - code-review-testing
  - performance-benchmark-skipped
  - security-review-skipped
  - exploratory-qa-skipped
burn_in_validated: false
---

# Story 56.1: Topic Resolution Service

## Story

As a learner with courses containing topic metadata,
I want the system to extract, normalize, and deduplicate topics from my course data,
So that the Knowledge Map has a clean, meaningful set of ~40-60 topics to score and visualize.

## Acceptance Criteria

**BLOCKER: Data Source Migration Required**
> The original design assumes `Course.modules[].lessons[].keyTopics[]` from the deprecated `Course` type.
> `useCourseStore` is deprecated (courses table dropped in Dexie v30, E89-S01). `src/data/courses/*.ts` files no longer exist.
> The active data model uses `ImportedCourse` + `ImportedVideo` (flat tables, no `keyTopics` field).
> Available topic sources: `Question.topic` (optional, from quiz questions), `ImportedCourse.tags[]`, `ImportedCourse.category`.
> **Decision needed:** Either (a) add a `keyTopics` field to `ImportedVideo` and populate via AI/manual entry, or (b) redesign topic resolution to use available signals (tags, quiz topics, AI extraction).

**Given** courses exist as ImportedCourse records in Dexie with associated quiz questions containing optional `topic` fields
**When** resolveTopics() is called
**Then** it returns ResolvedTopic[] with each topic having name, canonicalName, category, courseIds[], and questionTopics[]

**Given** topic sources contain noise entries like "October 2023", "weekly session", "course overview", "getting started", "key takeaways"
**When** topics are resolved
**Then** all noise entries matching NOISE_PATTERNS regexes are filtered out and do not appear in the output

**Given** topic sources contain synonyms like "lie detection" and "deception detection", or "nonverbal communication" and "body language"
**When** topics are resolved
**Then** synonyms are merged into a single canonical topic via CANONICAL_MAP, with courseIds from all variants combined

**Given** a topic appears in courses with different ImportedCourse.category values
**When** topics are resolved
**Then** the topic is assigned the category from the course with more matching topic sources

**Given** raw topics with mixed casing, extra whitespace, and hyphens ("Body  Language", "body-language", "BODY LANGUAGE")
**When** normalization runs
**Then** all variants resolve to the same canonical name with a title-cased display name

**Given** the current set of imported courses in Dexie
**When** resolveTopics() processes all courses
**Then** the output contains a reasonable set of unique topics (after noise filtering and deduplication)

**Given** a topic "deception detection" exists and quiz questions have Question.topic matching "deception detection" or its synonyms
**When** topics are resolved
**Then** the ResolvedTopic.questionTopics[] contains the matching Question.topic values for quiz score mapping

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/topicResolver.ts` with types and constants (AC: 1)
  - [ ] 1.1 Define `ResolvedTopic` interface (name, canonicalName, category, courseIds[], questionTopics[])
  - [ ] 1.2 Define `NOISE_PATTERNS` regex array (dates, meta-topics, session patterns)
  - [ ] 1.3 Define `CANONICAL_MAP` record for known synonyms
  - [ ] 1.4 **Resolve data source blocker** — determine topic extraction strategy given ImportedCourse (no keyTopics)
- [ ] Task 2: Implement normalization pipeline (AC: 5)
  - [ ] 2.1 `normalizeTopic()`: toLowerCase, trim, replace hyphens/underscores with spaces, collapse whitespace
  - [ ] 2.2 `toTitleCase()`: convert canonical name to display name
- [ ] Task 3: Implement noise filter (AC: 2)
  - [ ] 3.1 `isNoiseTopic()`: test normalized topic against all NOISE_PATTERNS
- [ ] Task 4: Implement `resolveTopics()` main function (AC: 1, 3, 4, 6)
  - [ ] 4.1 Iterate topic sources: ImportedCourse.tags[], Question.topic, ImportedCourse.category
  - [ ] 4.2 Normalize and filter noise
  - [ ] 4.3 Canonicalize via CANONICAL_MAP (passthrough if no synonym)
  - [ ] 4.4 Deduplicate: group by canonical name, merge courseIds
  - [ ] 4.5 Assign category: use course with more lessons for cross-category topics
  - [ ] 4.6 Generate display name via title-case
- [ ] Task 5: Implement Question.topic mapping (AC: 7)
  - [ ] 5.1 Canonicalize Question.topic values and match to resolved topics
  - [ ] 5.2 Populate questionTopics[] on each ResolvedTopic
- [ ] Task 6: Write unit tests (AC: all)
  - [ ] 6.1 Test noise filtering for all pattern types (dates, meta-topics, session labels)
  - [ ] 6.2 Test synonym merging (CANONICAL_MAP deduplication)
  - [ ] 6.3 Test normalization (casing, whitespace, hyphens)
  - [ ] 6.4 Test category assignment for cross-category topics
  - [ ] 6.5 Test with known course data to verify 30-80 topic range
  - [ ] 6.6 Test questionTopics mapping

## Design Guidance

No UI in this story. This is a pure function module following the `src/lib/qualityScore.ts` pattern: exported types, constant configuration objects, individual pure functions, and a main composite function.

## Implementation Notes

**Key files to create:**
- `src/lib/topicResolver.ts` (~120 lines)

**Key files to reference:**
- `src/lib/qualityScore.ts` — pattern reference (WEIGHTS object, factor functions, composite)
- `src/data/types.ts` — ImportedCourse, ImportedVideo types (NOTE: deprecated Course type has keyTopics but data source removed)
- `src/types/quiz.ts` — Question schema with optional `topic` field
- `src/data/db.ts` — Dexie database (importedCourses, quizzes tables). Current schema version: **48**

**Architecture decisions (from brainstorming):**
- Deterministic canonical map over fuzzy matching — debuggable, no false positives
- Regex noise filter — extensible without algorithm changes
- Pure function, no side effects — testable and composable

## Testing Notes

- Unit tests only (no E2E needed — no UI)
- Test with seeded ImportedCourse + Quiz data to validate topic extraction
- Edge cases: empty tags[], courses with no quizzes, duplicate topics across courses, Question.topic undefined

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
