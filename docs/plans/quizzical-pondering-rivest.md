# Implementation Plan: E9B-S03 - AI Learning Path Generation

## Context

**Why this change**: LevelUp users accumulate courses but struggle with "what should I study next?" This feature solves the sequencing problem by using AI to analyze course content and suggest an optimal learning path based on prerequisite relationships.

**Problem addressed**:
- Users don't know which course to start first when they have 10+ imported courses
- Knowledge gaps form when advanced courses are taken before foundational ones
- No way to visualize the recommended learning journey

**Intended outcome**:
- AI generates a sequenced course list with justifications (e.g., "Python Basics before Django")
- Users can manually reorder paths and regenerate with confirmation
- Empty state guidance when < 2 courses exist
- Graceful AI timeout fallback (2s) without disrupting page functionality

**Dependencies**:
- ✅ E9B-S01 (AI Video Summary) - Provides streaming AI pattern, timeout handling
- 🔄 E9B-S02 (Chat Q&A with RAG) - Provides Vercel AI SDK migration pattern (in-progress)
- ✅ E09-S01 (AI Provider Config) - API key encryption, consent toggles
- ✅ E09-S03 (Vector Store) - BruteForceVectorStore for semantic course analysis

---

## Implementation Approach

### Architecture Decision: RAG-Enhanced LLM vs Pure LLM

**Chosen**: **Pure LLM with course metadata** (no vector search)

**Reasoning**:
- Vector search (from E09-S03) is optimized for **note retrieval**, not course analysis
- Course metadata is already structured (title, topics, status, completion %) - no need for embeddings
- Simpler approach: pass all course metadata to LLM in single prompt
- Aligns with "Simple over clever" principle (Epic 9 memory lesson)

**Alternative rejected**: RAG with course embeddings
- Over-engineered for small dataset (10-50 courses)
- Adds complexity without benefit (courses already well-structured)
- Vector search shines with 1000s of unstructured notes, not dozens of courses

### Tech Stack

| Component | Technology | File Pattern |
|-----------|-----------|--------------|
| Page | React Router v7 route | `src/app/pages/AILearningPath.tsx` |
| State | Zustand store + IndexedDB | `src/stores/useLearningPathStore.ts` |
| AI Integration | Vercel AI SDK `streamText()` | `src/ai/learningPath/generatePath.ts` |
| Drag-and-drop | @dnd-kit/core + sortable | Install via npm |
| Animation | motion/react | Existing, use `fadeUp` + `staggerContainer` |
| UI Components | shadcn/ui (Card, Button, Alert, Badge) | `src/app/components/ui/` |

---

## Implementation Steps

### Step 1: Install Dependencies

**Action**: Add @dnd-kit for drag-and-drop reordering

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Why**: Accessible drag-and-drop with keyboard support, touch-friendly (AC3)

---

### Step 2: Create Zustand Store for Learning Path State

**File**: `src/stores/useLearningPathStore.ts`

**State Structure**:
```typescript
interface LearningPathCourse {
  courseId: string
  position: number          // 1-indexed
  justification: string     // AI-provided reasoning
  isManuallyOrdered: boolean // User dragged it
}

interface LearningPathState {
  courses: LearningPathCourse[]
  generatedAt: string | null
  isGenerating: boolean
  error: string | null

  // Actions
  generatePath: () => Promise<void>
  reorderCourse: (fromIndex: number, toIndex: number) => void
  regeneratePath: () => Promise<void>
  clearPath: () => void
}
```

**Persistence**: Use Zustand `persist` middleware with IndexedDB (pattern from `useNoteStore.ts:35-53`)

**Pattern to follow**: `src/stores/useQAChatStore.ts` (E9B-S02 chat state management)

---

### Step 3: Implement AI Path Generation Logic

**File**: `src/ai/learningPath/generatePath.ts`

**Function Signature**:
```typescript
export async function generateLearningPath(
  courses: ImportedCourse[],
  onUpdate: (course: LearningPathCourse) => void,
  signal?: AbortSignal
): Promise<LearningPathCourse[]>
```

**Implementation**:
1. **Prompt Engineering**: Design system prompt that analyzes course titles, topics, and completion status to infer prerequisites
   - Example: "React Hooks" → "Introduction to React" (foundational dependency)
   - Output format: JSON array with `{ courseId, position, justification }`

2. **Vercel AI SDK Pattern** (from E9B-S02):
   ```typescript
   import { streamText } from 'ai'
   import { openai } from '@ai-sdk/openai'

   const result = streamText({
     model: openai('gpt-4-turbo'),
     messages: [{ role: 'user', content: prompt }],
     abortSignal: signal,
   })

   for await (const delta of result.textStream) {
     // Parse partial JSON and call onUpdate()
   }
   ```

3. **Timeout Protection**: 2-second timeout with `Promise.race()` (AC6, pattern from `ragCoordinator.ts:52-58`)

4. **Error Handling**:
   - Network timeout → return empty array, set error state
   - Malformed LLM response → log error, show retry button
   - No consent → early return with message "AI features disabled in Settings"

**Reuse Pattern**: `src/ai/rag/ragCoordinator.ts` (coordinator pattern for AI operations)

---

### Step 4: Create AI Learning Path Page Component

**File**: `src/app/pages/AILearningPath.tsx`

**Component Structure**:
```tsx
export function AILearningPath() {
  const {
    courses,
    isGenerating,
    error,
    generatePath,
    reorderCourse
  } = useLearningPathStore()

  const importedCourses = /* fetch from useCourseImportStore */
  const courseCount = importedCourses.length

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  return (
    <div className="container mx-auto max-w-3xl py-12">
      {/* Page Header */}
      <header className="mb-12">
        <h1 className="font-heading text-4xl">Your Learning Path</h1>
        <p className="text-muted-foreground">
          {hasPath
            ? "AI-suggested course sequence based on prerequisites"
            : "Let AI analyze your courses and suggest an optimal learning order"}
        </p>
      </header>

      {/* Action Buttons */}
      <ActionBar
        courseCount={courseCount}
        isGenerating={isGenerating}
        hasPath={courses.length > 0}
        onGenerate={generatePath}
        onRegenerate={handleRegenerate}
      />

      {/* Error State */}
      {error && <ErrorAlert error={error} onRetry={generatePath} />}

      {/* Empty State */}
      {courseCount < 2 && <EmptyState />}

      {/* Learning Path List */}
      {courses.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={courses.map(c => c.courseId)}>
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              {courses.map((course, index) => (
                <CourseWaypoint
                  key={course.courseId}
                  course={course}
                  index={index}
                  total={courses.length}
                />
              ))}
            </motion.div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
```

**Animation**: Use `staggerContainer` + `fadeUp` from `src/lib/motion.ts` (150ms stagger delay per design guidance)

**Responsive**: Max-width 800px on desktop, full-width on mobile (design guidance section 3.1)

---

### Step 5: Build Course Waypoint Card Component

**File**: `src/app/components/figma/CourseWaypoint.tsx`

**Component Features**:
- Position badge (gold gradient, circular, -top-4 -left-4)
- Drag handle (GripVertical icon, visible on hover)
- Course title (DM Serif Display, 24px)
- AI justification (DM Sans, italic, muted)
- Manual override badge (info blue, conditional)

**Drag-and-drop Integration**:
```tsx
const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
  id: course.courseId
})

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
}
```

**Accessibility**:
- Keyboard navigation (Arrow Up/Down to reorder)
- Screen reader announces "Moved to position 3 of 5"
- Focus indicators on all interactive elements

**Pattern to follow**: `src/app/components/figma/CourseCard.tsx` (existing course card styling)

---

### Step 6: Add Route to Router Configuration

**File**: `src/app/routes.tsx`

**Add route**:
```tsx
{
  path: '/ai-learning-path',
  lazy: async () => {
    const { AILearningPath } = await import('./pages/AILearningPath')
    return { Component: AILearningPath }
  }
}
```

**Navigation**: Add link to sidebar or Overview page (optional for this story)

---

### Step 7: Handle Regenerate Confirmation Dialog

**Component**: Use shadcn/ui `AlertDialog` for confirmation (AC4)

**Pattern**:
```tsx
function RegenerateConfirmDialog({ open, onConfirm, onCancel }) {
  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate Learning Path?</AlertDialogTitle>
          <AlertDialogDescription>
            This will replace your current path with a fresh AI-generated sequence.
            Any manual reordering will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Regenerate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Trigger**: "Regenerate" button only visible when `courses.some(c => c.isManuallyOrdered)`

---

### Step 8: Implement E2E Tests

**File**: `tests/e2e/story-e9b-s03.spec.ts` (already created via ATDD step)

**Test Helpers Needed**:
1. **Mock AI API route**:
   ```typescript
   await page.route('**/api/ai/generate-learning-path', async route => {
     await route.fulfill({
       status: 200,
       body: JSON.stringify({
         learningPath: [/* mock courses */]
       })
     })
   })
   ```

2. **Seed test courses**: Use `seedImportedCourses(page, [course1, course2, course3])`

3. **Seed AI configuration**: Use `seedAIConfiguration(page, { provider: 'openai', learningPath: true })`

**Test Coverage**:
- AC1: Button visible when 2+ courses (assertion: `toBeVisible` + `toBeEnabled`)
- AC2: Ordered list with justifications (assertion: verify text content)
- AC3: Drag-and-drop reordering (use `dragTo()` method)
- AC4: Regenerate confirmation dialog (assertion: dialog appears, warning text)
- AC5: Empty state < 2 courses (assertion: disabled button, message visible)
- AC6: AI timeout fallback (mock route with 3s delay, expect error in 2s)

**Pattern to follow**: `tests/e2e/story-e09b-s01.spec.ts` (AI streaming, timeout handling, data-testid conventions)

---

## Critical Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/app/pages/AILearningPath.tsx` | Create | Main page component |
| `src/app/components/figma/CourseWaypoint.tsx` | Create | Draggable course card |
| `src/stores/useLearningPathStore.ts` | Create | State management + persistence |
| `src/ai/learningPath/generatePath.ts` | Create | AI generation logic |
| `src/app/routes.tsx` | Edit | Add `/ai-learning-path` route |
| `tests/e2e/story-e9b-s03.spec.ts` | Already exists | E2E test suite (ATDD) |
| `package.json` | Edit | Add @dnd-kit dependencies |

---

## Utilities to Reuse

| Utility | File | Usage |
|---------|------|-------|
| `useCourseImportStore` | `src/stores/useCourseImportStore.ts` | Fetch imported courses |
| `staggerContainer`, `fadeUp` | `src/lib/motion.ts` | Reveal animations |
| `cn()` | `src/app/components/ui/utils.ts` | Class merging |
| `toast()` | Sonner | Success/error notifications |
| `seedImportedCourses()` | `tests/support/helpers/indexeddb-seed.ts` | Test data seeding |
| `seedAIConfiguration()` | `tests/support/helpers/ai-summary-mocks.ts` | AI config in tests |

---

## Design Tokens

Use tokens from `src/styles/theme.css`:

| Token | Hex | Usage |
|-------|-----|-------|
| `--gold` | #f59e0b | Position badges (AI-suggested order) |
| `--info` | #3b82f6 | Manual override badges |
| `--brand` | #2563eb | Generate button (primary CTA) |
| `--muted-foreground` | #5b6a7d | Justification text |
| `--destructive` | #d4183d | Error states |
| `--card` | #ffffff | Card background |
| `--border` | rgba(0,0,0,0.1) | Card borders |

**Typography**:
- Page title: `font-heading` (DM Serif Display)
- Course titles: `font-heading text-2xl`
- Justifications: `font-body text-base italic text-muted-foreground`

---

## Edge Cases to Handle

1. **Single course remaining**: Show empty state (AC5), explain need for 2+
2. **AI timeout during generation**: Show error within 2s (AC6), preserve page functionality
3. **Malformed LLM response**: Log error, show "Try again" button
4. **No AI consent**: Show message "Enable AI features in Settings" with link
5. **All courses same topic**: AI may struggle with sequencing—graceful fallback to alphabetical order
6. **Very long justifications** (200+ words): Truncate with "Read more" expansion (optional polish)
7. **Drag-and-drop on touch devices**: Ensure 44x44px touch targets (mobile accessibility)

---

## Verification Steps

### Manual Testing

1. **Generate Path Flow** (AC1-AC2):
   ```
   - Import 3+ courses via /courses page
   - Navigate to /ai-learning-path
   - Verify "Generate Learning Path" button enabled
   - Click button
   - Observe loading state ("Analyzing courses...")
   - Verify ordered list appears with justifications (stagger animation)
   ```

2. **Drag-and-Drop Reordering** (AC3):
   ```
   - Drag course from position 3 to position 1
   - Verify course reorders
   - Verify manual override badge appears (blue, "Manual")
   - Reload page
   - Verify custom order persists
   ```

3. **Regenerate Confirmation** (AC4):
   ```
   - Manually reorder a course
   - Click "Regenerate" button
   - Verify confirmation dialog with warning
   - Click "Regenerate"
   - Verify fresh AI-generated order
   - Verify manual override badges removed
   ```

4. **Empty State** (AC5):
   ```
   - Import only 1 course
   - Navigate to /ai-learning-path
   - Verify empty state message visible
   - Verify button disabled
   ```

5. **AI Timeout Fallback** (AC6):
   ```
   - Disable internet or configure invalid API key
   - Click "Generate Learning Path"
   - Verify "AI unavailable" error appears within 2s
   - Verify retry button visible
   - Verify page remains functional (can navigate away)
   ```

### Automated Testing

```bash
# Run E2E tests for this story only
npx playwright test tests/e2e/story-e9b-s03.spec.ts --project=chromium

# Expected: 6 tests pass (AC1-AC6)
```

### Accessibility Testing

1. **Keyboard Navigation**:
   - Tab through all interactive elements
   - Use Arrow Up/Down to reorder courses
   - Verify focus indicators visible

2. **Screen Reader**:
   - Navigate with VoiceOver/NVDA
   - Verify course positions announced
   - Verify reorder actions announced

3. **Contrast Ratios**:
   - Use browser DevTools to verify 4.5:1 minimum
   - Gold badges on white background: verify readability

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| E9B-S02 not yet complete | Vercel AI SDK patterns unclear | Use E9B-S01 manual fetch() pattern as fallback |
| LLM produces invalid JSON | App crashes | Wrap JSON.parse in try-catch, show retry button |
| Drag-and-drop breaks on mobile | Poor UX | Add "Reorder" modal picker as fallback |
| AI suggests nonsense ordering | User confusion | Add disclaimer "AI suggestions may vary" + manual override |
| Timeout too aggressive (2s) | False negatives | Allow configuration via `window.__LEARNING_PATH_TIMEOUT__` for tests |

---

## Implementation Notes

**Granular Commits**: Make save-point commits after each step:
- ✅ "feat(E9B-S03): add @dnd-kit dependencies"
- ✅ "feat(E9B-S03): create learning path Zustand store"
- ✅ "feat(E9B-S03): implement AI path generation logic"
- ✅ "feat(E9B-S03): build AILearningPath page component"
- ✅ "feat(E9B-S03): add drag-and-drop reordering"
- ✅ "feat(E9B-S03): add regenerate confirmation dialog"
- ✅ "test(E9B-S03): verify E2E tests pass"

**Code Review Checklist** (pre-review):
- No hardcoded colors (use design tokens)
- No error swallowing (log AND surface errors)
- Timeout protection on AI calls (2s max)
- useEffect cleanup for AbortController
- Type guards on LLM response parsing
- Accessibility attributes (ARIA labels, keyboard support)

---

## Success Criteria

**Functional**:
- ✅ All 6 E2E tests pass (AC1-AC6)
- ✅ Path generation completes in < 5s for 10 courses
- ✅ Timeout fallback triggers within 2s
- ✅ Manual reordering persists across page reloads

**Design**:
- ✅ Course waypoints feel substantial (not cramped list items)
- ✅ Stagger animation creates "plotting on map" effect
- ✅ Gold badges distinguish AI-suggested from manual order
- ✅ Drag-and-drop feels smooth with magnetic snap points

**Accessibility**:
- ✅ Keyboard users can reorder via Arrow keys
- ✅ Screen readers announce position changes
- ✅ All touch targets ≥44x44px on mobile
- ✅ Contrast ratios meet WCAG 2.1 AA (4.5:1 minimum)
