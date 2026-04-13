---
story_id: E72-S03
story_name: "Session Boundary Learner Model Update Pipeline"
status: review
started:
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed: [build, lint, type-check, unit-tests, e2e-tests, code-review, security-review, test-review]
burn_in_validated: false
---

# Story 72.3: Session Boundary Learner Model Update Pipeline

## Story

As a learner,
I want the tutor to automatically learn about my progress at the end of each session,
so that future sessions are personalized without me having to do anything.

## Acceptance Criteria

**Given** a tutor session is active with 3 or more exchanges in assessment modes (Quiz Me or Debug)
**When** the learner navigates away from the lesson (navigateAway event via useEffect cleanup or visibilitychange)
**Then** a background LLM call is triggered via learnerModelService.updateFromSession()
**And** the LLM prompt includes the current learner model and session assessment messages
**And** the LLM returns a Partial<LearnerModel> as structured JSON (using callOllamaChat + format param)
**And** the response is validated with a Zod schema before merging

**Given** the session had fewer than 3 exchanges
**When** the learner navigates away
**Then** no learner model update is triggered (insufficient data threshold)

**Given** Quiz Me exchanges occurred during the session
**When** the session boundary update runs
**Then** quizStats (totalQuestions, correctAnswers, weakTopics) are updated in the learner model
**And** correct answers add to strengths, incorrect answers add to misconceptions with confidence scores

**Given** Debug exchanges occurred during the session
**When** the session boundary update runs
**Then** green assessments add to strengths, red assessments add to misconceptions, and yellow assessments update existing entries with reduced confidence scores

**Given** the learner model is injected into the prompt builder
**When** a new tutor message is generated
**Then** slot 6 (learner profile, priority 6) contains a compact natural-language summary of the model (~50-80 tokens) in the format: "Student profile: [vocabulary] vocabulary. Strengths: [list]. Misconceptions: [list]. Preferred mode: [mode]. Last session: [summary]."
**And** this augments (not replaces) the existing E63 learner profile data already injected via `buildAndFormatLearnerProfile()` in `src/ai/tutor/learnerProfileBuilder.ts`

**Given** the LLM provider is offline or the update LLM call fails
**When** the session boundary update is attempted
**Then** the error is logged via console.warn() with no user-facing toast or error
**And** the learner model remains at its last-known-good state

**Given** the LLM returns invalid JSON or fails Zod validation
**When** the response is parsed
**Then** the update is silently skipped and a console.warn is emitted with the parse error details

## Tasks / Subtasks

- [ ] Task 1: Implement session boundary detection (AC: 1, 2)
  - [ ] 1.1 Add useEffect cleanup in the Tutor tab component to detect navigation away
  - [ ] 1.2 Add visibilitychange listener for tab switching / minimizing
  - [ ] 1.3 Implement exchange counting: count messages where mode is 'quiz' or 'debug' and role is 'user' (note: TutorMode currently is 'socratic' | 'explain' | 'quiz'; 'debug' will be added by E72-S01 task 1.4)
  - [ ] 1.4 Only trigger update when exchange count >= 3

- [ ] Task 2: Implement updateFromSession in learnerModelService (AC: 1, 3, 4)
  - [ ] 2.1 Create `updateFromSession(courseId, messages, currentModel)` method
  - [ ] 2.2 Build LLM prompt: include current model + session assessment messages
  - [ ] 2.3 Call `callOllamaChat` with `format` param for structured JSON output
  - [ ] 2.4 Define Zod schema for `Partial<LearnerModel>` validation
  - [ ] 2.5 Parse and validate LLM response with Zod
  - [ ] 2.6 Merge validated response using existing `updateLearnerModel` from E72-S01

- [ ] Task 3: Implement Quiz Me stats extraction (AC: 3)
  - [ ] 3.1 Extract quiz scores from messages with `quizScore` field
  - [ ] 3.2 Calculate totalQuestions, correctAnswers from session
  - [ ] 3.3 Identify weakTopics from incorrect answers
  - [ ] 3.4 Map correct answers to strengths, incorrect to misconceptions with confidence scores

- [ ] Task 4: Implement Debug assessment extraction (AC: 4)
  - [ ] 4.1 Extract debug assessments from messages with `debugAssessment` field
  - [ ] 4.2 Map green → strengths, red → misconceptions
  - [ ] 4.3 Map yellow → reduce confidence on existing entries

- [ ] Task 5: Implement learner model prompt serialization (AC: 5)
  - [ ] 5.1 Create `serializeLearnerModelForPrompt(model: LearnerModel): string` function
  - [ ] 5.2 Format as compact natural-language: "Student profile: [vocab] vocabulary. Strengths: [list]. Misconceptions: [list]. Preferred mode: [mode]. Last session: [summary]."
  - [ ] 5.3 Target ~50-80 tokens output
  - [ ] 5.4 Integrate into prompt builder slot 6 (learner profile, priority 6) — extend the existing `buildLearnerSlot()` in `src/ai/tutor/tutorPromptBuilder.ts` to include LearnerModel data alongside E63's `buildAndFormatLearnerProfile()` output

- [ ] Task 6: Error handling (AC: 6, 7)
  - [ ] 6.1 Wrap LLM call in try/catch, console.warn on failure, no toast
  - [ ] 6.2 Handle Zod validation failure: console.warn with parse error details, skip update
  - [ ] 6.3 Handle LLM offline: console.warn, skip update, model stays at last-known-good
  - [ ] 6.4 Ensure background call does not block navigation (fire-and-forget with error handling)

- [ ] Task 7: Unit tests
  - [ ] 7.1 Create `src/ai/tutor/__tests__/learnerModelUpdate.test.ts`
  - [ ] 7.2 Test updateFromSession with mock LLM returning valid Partial<LearnerModel>
  - [ ] 7.3 Test exchange count threshold (< 3 skips, >= 3 triggers)
  - [ ] 7.4 Test Quiz Me stats extraction and merge
  - [ ] 7.5 Test Debug assessment extraction (green/yellow/red mapping)
  - [ ] 7.6 Test serializeLearnerModelForPrompt output format and approximate token count
  - [ ] 7.7 Test LLM offline handling (console.warn, no throw)
  - [ ] 7.8 Test Zod validation failure (invalid JSON, missing fields)

## Design Guidance

This story is primarily service-layer with one UI integration point (prompt injection). No new visual components.

**Prompt injection format (slot 5):**
```
Student profile: Intermediate vocabulary. Strengths: event loops, closures.
Misconceptions: confuses Promise.all with Promise.race. Preferred mode: Quiz Me.
Last session: Discussed async/await error handling, reached hint level 2.
```

**Background update UX:**
- No loading spinner or toast for the background LLM call
- No user-facing error on failure — silent skip with console.warn
- The learner model UI (from E72-S02) will show updated data on next visit

## Implementation Notes

**Key architecture references:**
- Architecture doc: `_bmad-output/planning-artifacts/architecture-tutor-memory-modes.md` — Decision 7 (Learner Model Update Pipeline)
- Existing LLM integration: `src/ai/providers/` — `callOllamaChat` with `format` param (proven in `courseTagger.ts`)
- Existing prompt builder: `src/ai/tutor/tutorPromptBuilder.ts` — 7-slot priority system (base, mode, course, rag, transcript, learner, resume)
- Existing learner profile builder: `src/ai/tutor/learnerProfileBuilder.ts` (E63) — already provides `buildAndFormatLearnerProfile()` which is called in `useTutor.ts` and passed to `buildTutorSystemPrompt()` as `learnerProfile` param
- **No session boundary logic exists** in `useTutor.ts` — must be added (useEffect cleanup + visibilitychange)
- Zod: already in project dependencies

**Dependencies:**
- E72-S01 (learner model schema, CRUD service) — must be complete first
- E72-S02 (TutorMessage mode tags, quizScore, debugAssessment fields) — must be complete first

**Structured output pattern:**
Use the same `callOllamaChat` + `format` param pattern from `courseTagger.ts`:
```typescript
const response = await callOllamaChat({
  messages: [{ role: 'system', content: updatePrompt }],
  format: 'json',
})
```

**Zod schema for validation:**
```typescript
const LearnerModelUpdateSchema = z.object({
  vocabularyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  strengths: z.array(ConceptAssessmentSchema).optional(),
  misconceptions: z.array(ConceptAssessmentSchema).optional(),
  topicsExplored: z.array(z.string()).optional(),
  lastSessionSummary: z.string().optional(),
  quizStats: QuizStatsSchema.optional(),
}).partial()
```

**Fire-and-forget pattern:**
The session boundary update must not block navigation. Use a detached async call:
```typescript
// In useEffect cleanup or visibilitychange handler
void updateFromSession(courseId, messages, currentModel).catch(() => {})
```

## Testing Notes

- Mock LLM calls with deterministic JSON responses
- Test Zod validation with edge cases: missing fields, extra fields, wrong types
- Test the serialization function is pure (same input → same output)
- Test token count approximation (split by spaces, aim for 50-80 words)
- No E2E tests for background LLM calls — unit tests with mocked providers

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
