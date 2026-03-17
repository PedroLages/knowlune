# Plan: E12-S01 — Create Quiz Type Definitions

## Context

Epic 12 (Take Basic Quizzes) is the next major feature for LevelUp. Story 12.1 establishes the foundational type system that all quiz epics (12-18, 61 QFRs) will build on. This is a types-only story — no UI, no database, no store. It creates TypeScript interfaces + Zod validation schemas for the quiz data model.

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/quiz.ts` | All quiz TypeScript types + Zod schemas |
| `src/types/__tests__/quiz.test.ts` | Unit tests for Zod validation |

## Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/data/types.ts` | Existing type conventions (ISO 8601 strings, union types, interface patterns) |
| `server/index.ts:18-41` | Existing Zod v4 usage pattern with `.safeParse()` |
| `docs/planning-artifacts/quiz-ux-design-specification.md` | QFR9-12, QFR49 data model requirements |

## Implementation

### Task 1: Create `src/types/quiz.ts`

Define types and Zod schemas in this order (dependencies flow downward):

1. **QuestionType** — Union type: `'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-in-blank'`

2. **TimerAccommodation** — Union type: `'standard' | '150%' | '200%' | 'untimed'`

3. **QuestionMediaSchema + QuestionMedia** — `{ type: 'image' | 'video' | 'audio'; url: string; alt?: string }`

4. **QuestionSchema + Question** — Fields: id, order, type, text, options?, correctAnswer (string | string[]), explanation, points, media?
   - **Type-specific refinement** via `.refine()`:
     - MC: options required, 2-6 items
     - TF: options required, exactly 2 items
     - MS: options required, 2-6 items
     - FIB: options must be absent/empty

5. **QuizSchema + Quiz** — Fields: id, lessonId, title, description, questions (QuestionSchema[]), timeLimit (number | null), passingScore (z.number().min(0).max(100)), allowRetakes, shuffleQuestions, shuffleAnswers, createdAt (string), updatedAt (string)

6. **AnswerSchema + Answer** — Fields: questionId, userAnswer (string | string[]), isCorrect, pointsEarned, pointsPossible

7. **QuizAttemptSchema + QuizAttempt** — Fields: id, quizId, answers (AnswerSchema[]), score, percentage, passed, timeSpent, completedAt (string), startedAt (string), timerAccommodation

8. **QuizProgressSchema + QuizProgress** — Fields: quizId, currentQuestionIndex, answers (Record<string, string | string[]>), startTime (number), timeRemaining (number | null), isPaused, markedForReview (string[]), questionOrder (string[]), timerAccommodation

**Patterns to follow:**
- Infer types from schemas: `export type Quiz = z.infer<typeof QuizSchema>`
- JSDoc on every exported type and property
- Timestamps as ISO 8601 strings (matching `src/data/types.ts` convention)
- Never export `.parse()` — only `.safeParse()` via the schemas

### Task 2: Create `src/types/__tests__/quiz.test.ts`

Test groups:

1. **Valid data** — Happy path `.safeParse()` returns `{ success: true }`
   - Valid MC question, TF question, MS question, FIB question
   - Valid complete quiz with mixed question types
   - Valid quiz attempt, answer, progress

2. **Invalid data — type-specific refinements**
   - MC question without options → fails
   - MS question without options → fails
   - TF question with 3 options → fails
   - FIB question with options → fails (or passes if optional — check spec)

3. **Invalid data — field constraints**
   - passingScore = -1 → fails
   - passingScore = 101 → fails
   - Missing required fields → fails with descriptive errors

4. **Type inference** — TypeScript compilation check (if it compiles, types infer correctly)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Timestamps | `string` (ISO 8601) | Matches all existing types in `src/data/types.ts`; Dexie serializes cleanly |
| Zod approach | Schema-first, infer types | Avoids interface/schema drift; single source of truth |
| File location | `src/types/quiz.ts` | Epic spec rationale: quiz spans 7 epics, separate from `src/data/types.ts` |
| FIB options | Optional (undefined/empty OK) | FIB questions don't need options; enforce via `.refine()` |
| Existing `Quiz` in api.ts | Leave untouched | `src/types/api.ts:113-119` is for API display; new types are for quiz engine |

## Scoring Convention (documented in JSDoc, not enforced)

- MC, TF, FIB: all-or-nothing (0% or 100% of points)
- MS: Partial Credit Model — `max(0, (correct - incorrect) / total_correct)` (Epic 14)

## Verification

```bash
# Type check
npx tsc --noEmit

# Unit tests
npm run test:unit -- --testPathPattern=quiz

# Lint
npm run lint

# Build
npm run build
```
