---
story_id: E56-S01
story_name: "Topic Resolution Service"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 56.1: Topic Resolution Service

## Story

As a learner with courses containing topic metadata,
I want the system to extract, normalize, and deduplicate topics from my course data,
So that the Knowledge Map has a clean, meaningful set of ~40-60 topics to score and visualize.

## Acceptance Criteria

**Given** courses exist in useCourseStore with lessons containing keyTopics arrays
**When** resolveTopics(courses) is called
**Then** it returns ResolvedTopic[] with each topic having name, canonicalName, category, lessonIds[], courseIds[], and questionTopics[]

**Given** lesson keyTopics contain noise entries like "October 2023", "weekly session", "course overview", "getting started", "key takeaways"
**When** topics are resolved
**Then** all noise entries matching NOISE_PATTERNS regexes are filtered out and do not appear in the output

**Given** lesson keyTopics contain synonyms like "lie detection" and "deception detection", or "nonverbal communication" and "body language"
**When** topics are resolved
**Then** synonyms are merged into a single canonical topic via CANONICAL_MAP, with lessonIds and courseIds from all variants combined

**Given** a topic like "body language" appears in lessons across two courses with different Course.category values
**When** topics are resolved
**Then** the topic is assigned the category from the course with more matching lessons

**Given** raw keyTopics with mixed casing, extra whitespace, and hyphens ("Body  Language", "body-language", "BODY LANGUAGE")
**When** normalization runs
**Then** all variants resolve to the same canonical name with a title-cased display name

**Given** the full set of 8 courses with ~170 lessons in the Knowlune dataset
**When** resolveTopics() processes all courses
**Then** the output contains between 30 and 80 unique topics (after noise filtering and deduplication)

**Given** a topic "deception detection" exists and quiz questions have Question.topic matching "deception detection" or its synonyms
**When** topics are resolved
**Then** the ResolvedTopic.questionTopics[] contains the matching Question.topic values for quiz score mapping

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/topicResolver.ts` with types and constants (AC: 1)
  - [ ] 1.1 Define `ResolvedTopic` interface (name, canonicalName, category, lessonIds[], courseIds[], questionTopics[])
  - [ ] 1.2 Define `NOISE_PATTERNS` regex array (dates, meta-topics, session patterns)
  - [ ] 1.3 Define `CANONICAL_MAP` record for known synonyms
- [ ] Task 2: Implement normalization pipeline (AC: 5)
  - [ ] 2.1 `normalizeTopic()`: toLowerCase, trim, replace hyphens/underscores with spaces, collapse whitespace
  - [ ] 2.2 `toTitleCase()`: convert canonical name to display name
- [ ] Task 3: Implement noise filter (AC: 2)
  - [ ] 3.1 `isNoiseTopic()`: test normalized topic against all NOISE_PATTERNS
- [ ] Task 4: Implement `resolveTopics()` main function (AC: 1, 3, 4, 6)
  - [ ] 4.1 Iterate Course[].modules[].lessons[].keyTopics[]
  - [ ] 4.2 Normalize and filter noise
  - [ ] 4.3 Canonicalize via CANONICAL_MAP (passthrough if no synonym)
  - [ ] 4.4 Deduplicate: group by canonical name, merge lessonIds/courseIds
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
- `src/data/types.ts` — Course, Module, Lesson types
- `src/data/courses/*.ts` — actual course data for validation

**Architecture decisions (from brainstorming):**
- Deterministic canonical map over fuzzy matching — debuggable, no false positives
- Regex noise filter — extensible without algorithm changes
- Pure function, no side effects — testable and composable

## Testing Notes

- Unit tests only (no E2E needed — no UI)
- Test with actual course data files to validate topic count range
- Edge cases: empty keyTopics[], courses with no lessons, duplicate topics across courses

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
