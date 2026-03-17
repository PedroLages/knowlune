---
story_id: E12-S01
story_name: "Create Quiz Type Definitions"
status: done
started: 2026-03-17
completed: 2026-03-17
reviewed: true
review_started: 2026-03-17
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing, web-design-guidelines-skipped]
burn_in_validated: false
---

# Story 12.1: Create Quiz Type Definitions

## Story

As a developer,
I want Quiz, Question, and QuizAttempt TypeScript interfaces with Zod validation,
so that I have type safety and runtime validation for quiz data throughout the application.

## Acceptance Criteria

**Given** quiz data requirements from the quiz UX design specification
**When** I create `src/types/quiz.ts`
**Then** it exports all required TypeScript interfaces (Quiz, Question, QuizAttempt, Answer, QuizProgress, QuestionMedia)
**And** all properties match the quiz UX specification
**And** Zod schemas are defined for runtime validation using `.safeParse()` (returns result objects, never throws)
**And** QuestionType enum includes all 4 types: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-in-blank'
**And** JSDoc comments document each interface and property
**And** types are importable from other modules using `@/types/quiz`

**Given** the Question interface
**When** defining the `correctAnswer` property
**Then** it supports both `string` and `string[]` types for polymorphic question handling
**And** the `options` property is optional (not needed for fill-in-blank)
**And** the `media` property uses the `QuestionMedia` type: `{ type: 'image' | 'video' | 'audio'; url: string; alt?: string }`

**Given** the QuizProgress interface
**When** defining progress state for crash recovery
**Then** it includes `markedForReview: string[]` for question flagging (per UX spec)
**And** it includes `questionOrder: string[]` to persist shuffled question sequence
**And** it includes `timerAccommodation: 'standard' | '150%' | '200%' | 'untimed'`

**Given** the Quiz interface
**When** defining the `passingScore` property
**Then** it is a percentage value constrained to 0-100 via Zod: `z.number().min(0).max(100)`

## Tasks / Subtasks

- [ ] Task 1: Create `src/types/quiz.ts` with all TypeScript interfaces and Zod schemas (AC: 1-4)
  - [ ] 1.1 Define QuestionType union type
  - [ ] 1.2 Define QuestionMedia interface + Zod schema
  - [ ] 1.3 Define Question interface + Zod schema with type-specific refinements
  - [ ] 1.4 Define Quiz interface + Zod schema with passingScore constraint
  - [ ] 1.5 Define Answer interface + Zod schema
  - [ ] 1.6 Define QuizAttempt interface + Zod schema
  - [ ] 1.7 Define QuizProgress interface + Zod schema
  - [ ] 1.8 Add JSDoc comments to all interfaces and properties
- [ ] Task 2: Write unit tests for Zod validation (AC: all)
  - [ ] 2.1 Valid quiz data passes safeParse
  - [ ] 2.2 Invalid data fails safeParse with descriptive errors
  - [ ] 2.3 MC/MS questions without options fail validation
  - [ ] 2.4 passingScore outside 0-100 fails validation
  - [ ] 2.5 Type inference correctness

## Implementation Plan

See [plan](plans/e12-s01-create-quiz-type-definitions.md) for implementation approach.

## Implementation Notes

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

Skipped — no UI changes (pure TypeScript types/schemas story).

## Code Review Feedback

Report: `docs/reviews/code/code-review-2026-03-17-e12-s01.md`

**Verdict: PASS** (0 blockers, 4 high, 4 medium, 3 nits)

Key findings:
- `Question` type inferred from `BaseQuestionSchema` instead of `QuestionSchema` — semantic gap if schema diverges in future (HIGH)
- `createdAt`/`updatedAt` accept any string (no ISO 8601 validation) — malformed dates crash downstream UI (HIGH)
- Single `.refine()` produces generic error message — use `.superRefine()` for type-specific messages in Epic 13 (HIGH)
- `correctAnswer` accepts empty strings/arrays — should use `.min(1)` (HIGH)

## Web Design Guidelines Review

Skipped — no UI changes (pure TypeScript types/schemas story).

## Challenges and Lessons Learned

- Story setup only — lessons will be documented during implementation.
