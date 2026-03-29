---
story_id: E72-S01
story_name: "Learner Model Schema & CRUD Service"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 72.1: Learner Model Schema & CRUD Service

## Story

As a learner,
I want the tutor to store a structured profile of my learning progress per course,
so that the tutor can personalize future sessions based on my strengths and misconceptions.

## Acceptance Criteria

**Given** the Dexie database is at version 29 (from E57-S03)
**When** the application initializes with the updated schema
**Then** a new `learnerModels` table exists at Dexie v30 with indexes on `id` and `courseId`
**And** the LearnerModel TypeScript interface includes: id, courseId, vocabularyLevel (beginner/intermediate/advanced), strengths (ConceptAssessment[]), misconceptions (ConceptAssessment[]), topicsExplored (string[]), preferredMode (TutorMode), lastSessionSummary (string), quizStats ({totalQuestions, correctAnswers, weakTopics}), createdAt, updatedAt

**Given** a learnerModelService module exists at src/ai/tutor/learnerModelService.ts
**When** getOrCreateLearnerModel(courseId) is called for a course with no existing model
**Then** a new LearnerModel is created with default values (vocabularyLevel: 'beginner', empty arrays, preferredMode: 'socratic') and persisted to Dexie
**And** the model's id is a UUID and createdAt/updatedAt are set to the current ISO timestamp

**Given** a LearnerModel exists for a course
**When** updateLearnerModel(courseId, updates: Partial<LearnerModel>) is called
**Then** the model is merged additively: new strengths/misconceptions are appended (not replaced), vocabularyLevel and lastSessionSummary are overwritten, topicsExplored is unioned, updatedAt is refreshed
**And** duplicate ConceptAssessments (same concept name) are deduplicated by keeping the most recent

**Given** a LearnerModel exists for a course
**When** clearLearnerModel(courseId) is called
**Then** the model is deleted from Dexie and a new default model is NOT auto-created (returns null on next get)

**Given** the useTutorStore Zustand store exists (from E57)
**When** learner model state is added
**Then** the store includes learnerModel (LearnerModel | null) and an updateLearnerModel action
**And** all consumers use individual selectors per project conventions

## Tasks / Subtasks

- [ ] Task 1: Define TypeScript types (AC: 1)
  - [ ] 1.1 Add `VocabularyLevel` type to `src/data/types.ts`
  - [ ] 1.2 Add `ConceptAssessment` interface to `src/data/types.ts`
  - [ ] 1.3 Add `LearnerModel` interface to `src/data/types.ts`
  - [ ] 1.4 Extend `TutorMode` type to include `'eli5' | 'quiz' | 'debug'` (forward-compatible for E73)

- [ ] Task 2: Dexie schema migration to v30 (AC: 1)
  - [ ] 2.1 Add `learnerModels` table to `src/db/schema.ts` with indexes `id, courseId`
  - [ ] 2.2 Update `CHECKPOINT_VERSION` to 30 in `src/db/checkpoint.ts`
  - [ ] 2.3 Add `learnerModels` to `CHECKPOINT_SCHEMA`

- [ ] Task 3: Implement learnerModelService CRUD (AC: 2, 3, 4)
  - [ ] 3.1 Create `src/ai/tutor/learnerModelService.ts`
  - [ ] 3.2 Implement `getOrCreateLearnerModel(courseId)` — returns existing or creates default
  - [ ] 3.3 Implement `updateLearnerModel(courseId, updates)` — additive merge with deduplication
  - [ ] 3.4 Implement `clearLearnerModel(courseId)` — hard delete, returns null on next get
  - [ ] 3.5 Implement `getLearnerModel(courseId)` — read-only, returns null if not found

- [ ] Task 4: Extend useTutorStore (AC: 5)
  - [ ] 4.1 Add `learnerModel: LearnerModel | null` state field
  - [ ] 4.2 Add `updateLearnerModel` action that calls service and updates store
  - [ ] 4.3 Add `clearLearnerModel` action
  - [ ] 4.4 Load learner model on course/video init (extend existing init logic)

- [ ] Task 5: Unit tests
  - [ ] 5.1 Create `src/ai/tutor/__tests__/learnerModelService.test.ts`
  - [ ] 5.2 Test getOrCreateLearnerModel creates defaults correctly
  - [ ] 5.3 Test updateLearnerModel additive merge (strengths, misconceptions, topicsExplored)
  - [ ] 5.4 Test updateLearnerModel deduplication (same concept keeps most recent)
  - [ ] 5.5 Test clearLearnerModel deletes and subsequent get returns null
  - [ ] 5.6 Test that overwrite fields (vocabularyLevel, lastSessionSummary) replace correctly

## Design Guidance

This is a data/service-layer story with no UI components. Focus areas:
- **Dexie migration**: Follow the established v28→v29 pattern from E57-S03
- **Type safety**: All interfaces use strict TypeScript types, no `any`
- **Additive merge**: The merge logic for strengths/misconceptions must append, not replace, and deduplicate by concept name keeping the most recent `lastAssessed` timestamp
- **Zustand pattern**: Follow individual selector pattern per project conventions (`useTutorStore(state => state.learnerModel)`)

## Implementation Notes

**Key architecture references:**
- Architecture doc: `_bmad-output/planning-artifacts/architecture-tutor-memory-modes.md` — LearnerModel schema (Decision 1), state management pattern
- Existing Dexie patterns: `src/db/schema.ts` (v29 chatConversations), `src/db/checkpoint.ts`
- Existing store: `src/stores/useTutorStore.ts` (E57)
- Existing types: `src/data/types.ts` (TutorMessage, ChatConversation, TutorMode)

**ConceptAssessment schema:**
```typescript
interface ConceptAssessment {
  concept: string
  confidence: number  // 0-1
  lastAssessed: string  // ISO timestamp
  assessedBy: TutorMode
}
```

**Merge rules:**
- `strengths` / `misconceptions`: append new entries, deduplicate by `concept` (keep entry with latest `lastAssessed`)
- `topicsExplored`: union (Set-based merge)
- `vocabularyLevel`, `lastSessionSummary`, `preferredMode`: overwrite
- `quizStats`: merge by adding `totalQuestions`/`correctAnswers`, union `weakTopics`

## Testing Notes

- Unit tests only (no E2E) — this is a pure data/service layer story
- Mock Dexie with fake-indexeddb for service tests
- Test deduplication edge cases: same concept with older timestamp should not replace newer
- Test that `getOrCreateLearnerModel` is idempotent (calling twice returns same record)

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
