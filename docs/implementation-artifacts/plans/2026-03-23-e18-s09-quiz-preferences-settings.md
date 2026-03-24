# E18-S09: Configure Quiz Preferences in Settings — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Quiz Preferences" section to the Settings page that lets learners configure default quiz behavior (timer multiplier, immediate feedback, question shuffle). Preferences persist to localStorage and are consumed by the quiz initialization flow as overridable defaults.

**Architecture:** Create a `quizPreferences` module (`src/lib/quizPreferences.ts`) for type definitions and localStorage CRUD. Create a `QuizPreferencesForm` component that follows the existing self-contained Settings card pattern (like `ReminderSettings`). Wire quiz initialization (`Quiz.tsx` + `useQuizStore`) to read preferences as defaults while preserving per-quiz/per-lesson overrides.

**Tech Stack:** React 19, TypeScript, Zod (validation), shadcn/ui (`Card`, `Switch`, `RadioGroup`, `Label`), Sonner (toast), Vitest for unit tests, Playwright for E2E.

**FRs Fulfilled:** QFR43, QFR59

---

## Codebase Analysis

### Current State

1. **Timer accommodation**: Stored per-lesson as `quiz-accommodation-${lessonId}` in localStorage. Uses `TimerAccommodation` enum (`'standard' | '150%' | '200%' | 'untimed'`). Loaded in `Quiz.tsx:loadSavedAccommodation()`, passed to `startQuiz()`.

2. **Question shuffle**: Defined per-quiz in Dexie schema (`quiz.shuffleQuestions: boolean`). Read in `useQuizStore.ts:83` during `startQuiz()`. No user override exists.

3. **Immediate feedback**: `AnswerFeedback` component is always rendered when a question has been answered (`Quiz.tsx:453`). No toggle exists.

4. **Settings page structure**: Settings.tsx renders a vertical stack of Card sections: Profile, Appearance, Reminders, Course Reminders, AI Configuration, Data Management. Self-contained components like `ReminderSettings` manage their own state/persistence.

### Mapping Story Types to Existing Enums

The story specifies `timerMultiplier: 1 | 1.5 | 2` but the existing codebase uses `TimerAccommodation = 'standard' | '150%' | '200%' | 'untimed'`. The mapping:

| Story Value | TimerAccommodation | Multiplier |
|-------------|-------------------|------------|
| 1           | `'standard'`      | 1          |
| 1.5         | `'150%'`          | 1.5        |
| 2           | `'200%'`          | 2          |

**Decision:** Store preferences using the existing `TimerAccommodation` type (excluding `'untimed'` since it's not in the spec). This avoids a mapping layer and keeps the quiz initialization path simple. The UI shows user-friendly labels ("1x", "1.5x", "2x").

### Integration Points

| File | Change | Why |
|------|--------|-----|
| `src/lib/quizPreferences.ts` | **Create** | Type, defaults, load/save helpers |
| `src/app/components/settings/QuizPreferencesForm.tsx` | **Create** | Self-contained Settings card component |
| `src/app/pages/Settings.tsx` | **Modify** | Import and render `QuizPreferencesForm` |
| `src/app/pages/Quiz.tsx` | **Modify** | Read `timerAccommodation` default from preferences |
| `src/stores/useQuizStore.ts` | **Modify** | Read `shuffleQuestions` preference to override quiz-level flag |
| `src/app/pages/Quiz.tsx` | **Modify** | Conditionally render `AnswerFeedback` based on preference |
| `tests/e2e/quiz-preferences-settings.spec.ts` | **Create** | E2E test coverage |

---

## Task 1: Create `quizPreferences` module

**Files:**
- Create: `src/lib/quizPreferences.ts`
- Create: `src/lib/__tests__/quizPreferences.test.ts`

### Step 1: Write the failing unit tests

Create `src/lib/__tests__/quizPreferences.test.ts` with tests for:
- `getQuizPreferences()` returns defaults when localStorage is empty
- `getQuizPreferences()` returns saved preferences when they exist
- `getQuizPreferences()` returns defaults when localStorage contains invalid JSON
- `getQuizPreferences()` returns defaults when values fail Zod validation
- `saveQuizPreferences()` persists to localStorage under `levelup-quiz-preferences` key
- `saveQuizPreferences()` merges partial updates with existing preferences
- `DEFAULT_QUIZ_PREFERENCES` has correct default values (standard, false, false)

### Step 2: Implement the module

Create `src/lib/quizPreferences.ts`:

```typescript
import { z } from 'zod'
import { TimerAccommodationEnum } from '@/types/quiz'

/** Zod schema for quiz preferences (excludes 'untimed' from timer options) */
const QuizPreferencesSchema = z.object({
  timerAccommodation: z.enum(['standard', '150%', '200%']),
  showImmediateFeedback: z.boolean(),
  shuffleQuestions: z.boolean(),
})

export type QuizPreferences = z.infer<typeof QuizPreferencesSchema>

const STORAGE_KEY = 'levelup-quiz-preferences'

export const DEFAULT_QUIZ_PREFERENCES: QuizPreferences = {
  timerAccommodation: 'standard',
  showImmediateFeedback: false,
  shuffleQuestions: false,
}

export function getQuizPreferences(): QuizPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_QUIZ_PREFERENCES }
    const parsed = QuizPreferencesSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : { ...DEFAULT_QUIZ_PREFERENCES }
  } catch {
    return { ...DEFAULT_QUIZ_PREFERENCES }
  }
}

export function saveQuizPreferences(patch: Partial<QuizPreferences>): QuizPreferences {
  const current = getQuizPreferences()
  const updated = { ...current, ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}
```

**Key design decisions:**
- Uses Zod for runtime validation (consistent with `quiz.ts` patterns)
- Uses existing `TimerAccommodation` values minus `'untimed'` (per spec: only 1x, 1.5x, 2x)
- Follows `settings.ts` pattern: `get` merges defaults, `save` merges patch
- Returns new object from `get` to prevent accidental mutation

### Verification
```bash
npm run test:unit -- --run src/lib/__tests__/quizPreferences.test.ts
```

---

## Task 2: Create `QuizPreferencesForm` component

**Files:**
- Create: `src/app/components/settings/QuizPreferencesForm.tsx`

### Step 1: Implement the component

Follow the `ReminderSettings` pattern:
- Self-contained component that loads/saves its own state
- Card with icon header (use `SlidersHorizontal` from lucide-react)
- Auto-saves on each change (no Save button needed)
- Shows toast on save: "Quiz preferences saved"

**Component structure:**

```
Card
├── CardHeader (icon + title + description)
└── CardContent
    ├── Timer Accommodation Default
    │   └── RadioGroup (3 options: 1x / 1.5x / 2x)
    ├── Separator
    ├── Immediate Feedback
    │   └── Switch + Label + description text
    ├── Separator
    └── Shuffle Questions
        └── Switch + Label + description text
```

**UI details:**
- RadioGroup for timer: use the card-style radio pattern from the Appearance theme selector in Settings.tsx (labels with `border-2 rounded-xl` and active state `border-brand bg-brand-soft`)
- Switch toggles: horizontal layout with label left, switch right (consistent with ReminderSettings)
- Each option has a brief description in `text-xs text-muted-foreground`
- All controls use proper `htmlFor`/`id` associations and ARIA labels
- Touch targets >= 44x44px

**Timer option labels:**
- `standard` → "1x — Standard timing"
- `'150%'` → "1.5x — Extended time"
- `'200%'` → "2x — Maximum extension"

**Toast behavior:**
- On any preference change, call `toastSuccess.saved('Quiz preferences saved')`
- Toast appears immediately after localStorage write succeeds

### Verification
- Visual inspection at `/settings`
- All three controls render and respond to interaction

---

## Task 3: Integrate into Settings page

**Files:**
- Modify: `src/app/pages/Settings.tsx`

### Step 1: Add import and render

Add `import { QuizPreferencesForm } from '@/app/components/settings/QuizPreferencesForm'` to Settings.tsx.

Render `<QuizPreferencesForm />` between the AI Configuration section and the Data Management section. This placement groups "behavior" settings together (Reminders → Course Reminders → AI → Quiz Preferences) before the data management utilities.

**Changes:**
1. Add import statement
2. Add `<QuizPreferencesForm />` after `<AIConfigurationSettings />` and before the Data Management `<Card>`

This is a ~3-line change.

### Verification
```bash
npm run build
npm run dev  # visual check at /settings
```

---

## Task 4: Wire quiz initialization to read timer preference as default

**Files:**
- Modify: `src/app/pages/Quiz.tsx`

### Step 1: Use preference as default accommodation

Currently `loadSavedAccommodation()` checks per-lesson localStorage key (`quiz-accommodation-${lessonId}`). If no per-lesson preference exists, it returns `'standard'`.

**Change:** When no per-lesson accommodation is saved, fall back to the global quiz preference instead of hardcoded `'standard'`.

In `loadSavedAccommodation()` (Quiz.tsx:66-76):
```typescript
export function loadSavedAccommodation(lessonId: string): TimerAccommodation {
  try {
    const raw = localStorage.getItem(`quiz-accommodation-${lessonId}`)
    if (!raw) {
      // Fall back to global quiz preference
      const prefs = getQuizPreferences()
      return prefs.timerAccommodation
    }
    const result = TimerAccommodationEnum.safeParse(raw)
    return result.success ? result.data : getQuizPreferences().timerAccommodation
  } catch (e) {
    console.warn('[Quiz] Failed to load accommodation:', e)
    return 'standard'
  }
}
```

**Override behavior:** Once the user selects an accommodation on the QuizStartScreen for a specific lesson, it's saved per-lesson and takes priority over the global preference. This satisfies AC: "I can still override preferences per-quiz if the quiz UI allows it."

### Verification
```bash
npm run test:unit -- --run src/app/pages/__tests__/Quiz*.test.*
```

---

## Task 5: Wire shuffle preference into quiz store

**Files:**
- Modify: `src/stores/useQuizStore.ts`

### Step 1: Read shuffle preference in `startQuiz()`

Currently (useQuizStore.ts:83-85):
```typescript
const questionOrder = quiz.shuffleQuestions
  ? fisherYatesShuffle(quiz.questions.map(q => q.id))
  : quiz.questions.map(q => q.id)
```

**Change:** Apply user's shuffle preference as an override. The user preference takes precedence when enabled (user explicitly wants shuffle), but the quiz-level setting is respected when the user preference is off (some quizzes may have sequential question dependencies).

```typescript
import { getQuizPreferences } from '@/lib/quizPreferences'

// In startQuiz():
const prefs = getQuizPreferences()
const shouldShuffle = prefs.shuffleQuestions || quiz.shuffleQuestions
const questionOrder = shouldShuffle
  ? fisherYatesShuffle(quiz.questions.map(q => q.id))
  : quiz.questions.map(q => q.id)
```

**Logic:** Shuffle if EITHER the user preference OR the quiz definition requests it. This is an OR merge because:
- If user wants shuffle globally → always shuffle (user preference)
- If quiz requires shuffle but user hasn't enabled globally → still shuffle (quiz design intent)
- If neither wants shuffle → preserve order

### Verification
```bash
npm run test:unit -- --run src/stores/__tests__/useQuizStore.test.ts
```

---

## Task 6: Make AnswerFeedback conditional on preference

**Files:**
- Modify: `src/app/pages/Quiz.tsx`

### Step 1: Read feedback preference and conditionally render

Currently (Quiz.tsx:453-454):
```tsx
{!isUnanswered(currentAnswer) && (
  <AnswerFeedback question={currentQuestion} userAnswer={currentAnswer} />
)}
```

**Change:** Add a state variable initialized from quiz preferences, and conditionally render:

```tsx
// In Quiz component, add state:
const [showFeedback] = useState(() => getQuizPreferences().showImmediateFeedback)

// In render:
{showFeedback && !isUnanswered(currentAnswer) && (
  <AnswerFeedback question={currentQuestion} userAnswer={currentAnswer} />
)}
```

**Design note:** The preference is loaded once at component mount (via `useState` initializer) so it doesn't change mid-quiz if the user opens Settings in another tab. This prevents confusing UX where feedback suddenly appears/disappears during a quiz.

**Post-quiz review remains unaffected:** The `QuizReviewContent` component (used after submission) always shows `AnswerFeedback` — that's review mode, not active quiz mode. Only active-quiz feedback is gated by this preference.

### Verification
```bash
npm run dev  # Start quiz with preference off → no feedback; with preference on → feedback shown
```

---

## Task 7: Write E2E tests

**Files:**
- Create: `tests/e2e/quiz-preferences-settings.spec.ts`

### Test cases

1. **Settings section visibility**
   - Navigate to `/settings`
   - Assert "Quiz Preferences" section is visible
   - Assert all three controls are present: timer radio group, feedback toggle, shuffle toggle

2. **Default values**
   - Clear `levelup-quiz-preferences` from localStorage
   - Navigate to `/settings`
   - Assert timer shows "1x" selected, feedback switch off, shuffle switch off

3. **Persist timer preference**
   - Navigate to `/settings`
   - Select "1.5x" timer
   - Assert toast "Quiz preferences saved" appears
   - Reload page
   - Assert "1.5x" is still selected

4. **Persist toggle preferences**
   - Toggle immediate feedback on
   - Assert toast appears
   - Toggle shuffle on
   - Assert toast appears
   - Reload page
   - Assert both toggles are on

5. **Quiz reads timer preference** (integration)
   - Set timer preference to "1.5x" in localStorage
   - Navigate to a timed quiz
   - Assert the accommodation selector shows "150%"/"1.5x" as default

6. **Quiz reads feedback preference**
   - Set `showImmediateFeedback: true` in localStorage
   - Start a quiz
   - Answer a question
   - Assert `AnswerFeedback` is visible

7. **Quiz respects feedback off**
   - Ensure `showImmediateFeedback: false` (default)
   - Start a quiz
   - Answer a question
   - Assert `AnswerFeedback` is NOT visible

### E2E patterns
- Use `data-testid` attributes on controls for stable selectors
- Seed quiz data via IndexedDB helpers (follow existing test patterns)
- Clear localStorage in `beforeEach` for isolation
- Use `FIXED_DATE` pattern if any date assertions needed

### Verification
```bash
npx playwright test tests/e2e/quiz-preferences-settings.spec.ts --project=chromium
```

---

## Task Dependency Graph

```
Task 1 (quizPreferences module)
  ├── Task 2 (QuizPreferencesForm) ─── Task 3 (integrate in Settings.tsx)
  ├── Task 4 (wire timer default in Quiz.tsx)
  ├── Task 5 (wire shuffle in useQuizStore)
  └── Task 6 (conditional feedback in Quiz.tsx)
                                    └── Task 7 (E2E tests, after all wiring)
```

Tasks 2-6 all depend on Task 1. Tasks 2-6 are independent of each other. Task 7 depends on all.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing quiz tests break from shuffle logic change | Medium | Medium | `shouldShuffle = prefs.shuffleQuestions \|\| quiz.shuffleQuestions` — existing tests don't set preferences, so `getQuizPreferences()` returns defaults (shuffle: false), preserving existing behavior |
| Toast spam on rapid toggle changes | Low | Low | Each toggle fires one toast; Sonner deduplicates rapid toasts automatically |
| localStorage quota on preferences write | Very Low | Low | Preferences object is ~80 bytes; negligible compared to quiz progress data |
| Feedback preference read mid-quiz | Low | Medium | Using `useState` initializer freezes the value at mount; no mid-quiz changes |

---

## Files Summary

| Action | File | Lines (est.) |
|--------|------|-------------|
| Create | `src/lib/quizPreferences.ts` | ~35 |
| Create | `src/lib/__tests__/quizPreferences.test.ts` | ~60 |
| Create | `src/app/components/settings/QuizPreferencesForm.tsx` | ~120 |
| Modify | `src/app/pages/Settings.tsx` | +3 |
| Modify | `src/app/pages/Quiz.tsx` | +8 |
| Modify | `src/stores/useQuizStore.ts` | +4 |
| Create | `tests/e2e/quiz-preferences-settings.spec.ts` | ~150 |
| **Total** | **7 files** | **~380 lines** |
