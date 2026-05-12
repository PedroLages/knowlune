---
title: "Course Detail Syllabus Unification -- Implementation Lessons"
date: 2026-05-12
category: best-practices
module: course-detail-syllabus
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Extracting a shared component at the third consumer when the first two already exist in different domains
  - Deciding whether Complete/Undo actions belong at the course level or module level in a timeline UI
  - Working with Vite/esbuild where missing TypeScript imports can go undetected during development
  - Adding shadcn/ui Button components with size="sm" and needing WCAG 2.5.8 touch target compliance
  - Running the CE pipeline for a follow-up feature that builds on recently extracted primitives
tags:
  - component-extraction
  - third-consumer
  - plan-critic
  - course-level-status
  - complete-undo
  - esbuild
  - type-erasure
  - vite
  - wcag
  - touch-target
  - shadcn-button
  - min-h-11
  - design-review
  - implementation-lessons
  - ce-pipeline
related_components:
  - tooling
  - documentation
  - accessibility
---

# Course Detail Syllabus Unification -- Implementation Lessons

## Context

PR [#561](https://github.com/PedroLages/knowlune/pull/561) unified the course detail page syllabus with the `PathTimeline` visual treatment (feature branch `feature/ce-2026-05-12-unify-course-syllabus-timeline`). This is the third in a three-PR series:

1. **PR #559** -- Added the "Timeline" view mode to the Courses listing page. *Intentionally duplicated* `StatusCircle`/`LessonRow` inside `CourseTimelineView` rather than extracting from `PathTimeline`.
2. **PR #560** -- Added course content separation and filtering sidebar.
3. **PR #561** (this run) -- Replaced the custom "Course Journey" timeline in `CourseOverview` with `StatusCircle`/`EntryActionButton`/`LessonRow` from a newly extracted `TimelinePrimitives.tsx`, and removed the unused "Timeline" view mode from the Courses listing page.

Four lessons emerged from this run that deserve documentation beyond the plan itself.

## Guidance

### 1. Extract at the Third Consumer: `TimelinePrimitives.tsx`

PR #559 intentionally duplicated `StatusCircle` and `LessonRow` inside `CourseTimelineView` when the second consumer appeared. The decision was documented with a rationale: the two consumers (learning-path domain vs. courses domain) were semantically different, and extraction would create a leaky abstraction.

PR #561 created the third consumer: the `CourseOverview` Syllabus section. This time, **extraction was the right call**.

**What happened.** A new `TimelinePrimitives.tsx` file was created with the exact implementations of `StatusCircle`, `EntryActionButton`, and `LessonRow` copied from `PathTimeline.tsx`. In `PathTimeline.tsx`, the local definitions were replaced with imports from `TimelinePrimitives.tsx`. The `CourseOverview` then imported these primitives to build its Syllabus section.

**Why the timing was right.** The third consumer revealed that the abstraction was genuinely shared -- not merely visually similar. All three consumers (learning track syllabus, course timeline view, and course detail syllabus) use the same status states, the same action button patterns, and the same lesson row structure. The duplication that was justified at 2 consumers became obviously wasteful at 3.

**Key properties of this extraction:**

- **Pure extraction, no redesign.** The extracted components kept identical APIs, types, and behavior. No renames, no prop changes, no refactoring of the rendering logic. This minimized regression risk -- existing tests on `PathTimeline` continued passing without modification because the components were imported, not reimplemented.
- **Same-module placement.** `TimelinePrimitives.tsx` lives in `src/app/components/learning-path/` alongside `PathTimeline.tsx`, following the "same module" rule from `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`.
- **Zero behavioral change for existing consumers.** `PathTimeline` was updated to re-export the same components from `TimelinePrimitives.tsx`, so importing from `PathTimeline` still works for any consumer that existed before the extraction.

```typescript
// TimelinePrimitives.tsx -- new shared file
export function StatusCircle({ status, simplified }: { ... }) { ... }
export function EntryActionButton({ status, isManuallyCompleted, onClick, onMarkComplete }: { ... }) { ... }
export function LessonRow({ video, courseId, isCompleted }: { ... }) { ... }

// PathTimeline.tsx -- updated to import from, not reimplement
import { StatusCircle, EntryActionButton, LessonRow } from './TimelinePrimitives'
```

**The extraction signal is the third consumer in a different domain.** The rule is nuanced:
- At 2 consumers in the same domain (e.g., both within the Library module): extract immediately (the existing `extract-shared-primitive-on-second-consumer` rule).
- At 2 consumers in different domains (e.g., learning-paths vs. courses): document the intentional duplication and defer extraction -- the shared API surface is not yet clear.
- At 3 consumers across domains: extract. The third consumer confirms the abstraction is genuinely shared.

### 2. Plan Critic Caught Course-Level vs. Module-Level Complete/Undo

The plan specified a course-level action area with "Complete Course" and "Undo Complete" buttons wired to `useCourseImportStore.updateCourseStatus()`. The plan critic flagged the alternative approach (module-level Complete/Undo on each entry card) and confirmed that the course-level design was correct.

**Why module-level Complete/Undo would have been wrong.** Each module group in the Syllabus section represents a chapter of the course. Adding "Complete" and "Undo" buttons per module would imply that completing a module toggles the entire course's status. This is semantically incorrect because:
- `updateCourseStatus()` operates on the course, not on individual modules
- Module-level completion is tracked by lesson progress, not by a status toggle
- Multiple "Complete" buttons on different module cards for the same course would all toggle the same course status, creating confusion about which one is authoritative

**The course-level design that was implemented:**

```typescript
// CourseOverview.tsx -- course-level action area between heading and module list
{courseStatus === 'completed' ? (
  <Button
    variant="outline"
    size="sm"
    className="px-5 py-2 rounded-xl text-sm font-bold min-h-11"
    onClick={() => updateCourseStatus(courseId, 'active')}
  >
    <Undo2 className="size-4 mr-1.5" />
    Undo Complete
  </Button>
) : (
  <Button
    variant="brand"
    size="sm"
    className="px-5 py-2 rounded-xl text-sm font-bold min-h-11"
    onClick={() => updateCourseStatus(courseId, 'completed')}
  >
    <CheckCircle2 className="size-4 mr-1.5" />
    Complete Course
  </Button>
)}
```

**What the plan critic prevented.** Without this design decision being validated pre-code, a developer might have added module-level Complete buttons matching the learning track's course-level pattern. This would have created incorrect behavior (toggling course status per module) and required a rework cycle to fix. The one-line justification in the plan ("Note: this is semantically correct because the course status maps 1:1 to a course-level toggle, unlike module-level Complete/Undo which would incorrectly toggle course status per-module") was the critical guardrail.

**The broader pattern:** When adding action buttons to a hierarchical data structure (course -> modules -> lessons), validate which level each action belongs to:
- Course-level actions: Complete Course, Undo Complete, Course Settings -- operate on the entire course
- Module-level actions: Start Module, Review, Mark Complete -- navigate to module content or mark progress
- Lesson-level actions: lesson links, video playback -- navigate to specific content

Mixing levels (e.g., module-level Complete that toggles course status) creates confusing UX and incorrect state.

### 3. esbuild Type Erasure Hides Missing Imports During `ce:work`

During implementation, `CourseOverview.tsx` used `CardContent` in the JSX but the initial import only included `Card`, not `CardContent`. The Vite dev server (powered by esbuild) compiled successfully because esbuild performs type erasure -- it strips TypeScript types and compiles to JavaScript without checking that imported values exist.

**How esbuild's type erasure works:**

```
Source: import { Card, CardContent } from '@/app/components/ui/card'
        // ... uses CardContent in JSX ...

esbuild compilation process:
  1. Parse TypeScript AST
  2. Strip all type annotations and type-only imports
  3. Compile remaining JavaScript
  4. ✅ Passes -- esbuild does NOT resolve whether CardContent is actually exported from the target module

What would catch it:
  - npx tsc --noEmit -- full TypeScript compiler catches missing named imports
  - Runtime -- Vite's dev server caches successfully, but the browser console shows undefined for CardContent
  - Production build -- Vite/Rollup may catch it during tree-shaking
```

**Why this is insidious.** The `npm run dev` command shows no errors. The page renders -- silently using `undefined` for `CardContent`, which means Radix's `CardContent` is `null`/`undefined` and the card body doesn't render. A developer might spend time debugging the wrong layer (CSS, props, state) before realizing it's a missing import.

**The fix that worked.** The import statement was corrected from:
```typescript
import { Card } from '@/app/components/ui/card'
```
to:
```typescript
import { Card, CardContent } from '@/app/components/ui/card'
```

**Prevention strategies:**

- Run `npx tsc --noEmit` as a pre-push or pre-commit check. This is the TypeScript compiler doing a full check without emitting output, and it catches all type errors including missing imports.
- The CE pipeline's `npm run build` step (which runs both esbuild and tsc) catches this -- but only if it's the full production build, not the dev server.
- For Vite projects specifically, consider adding `tsc --noEmit` as a separate script in `package.json`:
  ```json
  {
    "scripts": {
      "typecheck": "tsc --noEmit"
    }
  }
  ```
  Then run `npm run typecheck` alongside `npm run dev` during development, and always before PR submission.

**Related esbuild behavior.** This is not just about imports. esbuild's type erasure also:
- Misses unused import warnings (a tsc feature)
- Misses type-only import/export errors (importing a type from a module that doesn't export it as a type)
- Misses enum runtime shape mismatches (esbuild transpiles enums differently than tsc)
- Compiles through some syntax errors that tsc would flag

The lesson is: **do not rely on `npm run dev` for type correctness.** Use `npm run build` or `npx tsc --noEmit` for the type check. The CE quality gates include this step, but catching import errors during implementation (rather than during review) saves iteration time.

### 4. Design Reviewer Flagged WCAG Touch Targets on `size="sm"` Buttons

The design reviewer identified that `size="sm"` buttons in the `EntryActionButton` component do not meet WCAG 2.5.8 (Target Size, Minimum) AA requirements, which mandate minimum touch targets of 24x24px with additional spacing requirements.

**The specific issue.** shadcn/ui's `Button` component with `size="sm"` renders at approximately 32px (h-8) with padding that reduces the actual interactive area. The `px-3 py-2` classes add padding that further constrains the clickable region. The "Undo" button (`variant="ghost" size="sm"`) and the "Complete" button (`variant="outline" size="sm"`) both fell below the 44px recommendation.

**Existing workaround in the codebase.** Previous developers had already discovered this issue and added `min-h-11` (44px minimum height) to some `size="sm"` buttons, but not to all of them. A review of the `EntryActionButton` component showed inconsistent application:

| Button | variant | size | min-h-11 | WCAG pass? |
|--------|---------|------|----------|------------|
| Undo | ghost | sm | No | Fail -- 32px only |
| Start Module | brand | sm | Yes | Pass -- 44px min |
| Complete | outline | sm | No | Fail -- 32px only |
| Review | outline | sm | Yes | Pass -- 44px min |

The course-level "Complete Course" and "Undo Complete" buttons in `CourseOverview.tsx` had `min-h-11`, so they were compliant. The issue was isolated to the module-level action buttons.

**The fix.** The Start Module and Review buttons already had `min-h-11` from prior work. The Undo and Complete buttons needed the same treatment. The `min-h-11` class adds a CSS `min-height: 44px` that expands the clickable area to meet WCAG 2.5.8 without changing the visual appearance (the button's padding and typography remain the same).

**The general rule for shadcn/ui Button components in this codebase:**

```typescript
// ALWAYS add min-h-11 to size="sm" buttons that represent user actions
<Button size="sm" className="... min-h-11">Action</Button>

// EXCEPTIONS -- where min-h-11 is not needed:
// 1. Inline icon buttons within prose text (e.g., close buttons on badges)
// 2. Buttons that are NOT user-facing actions (e.g., hidden decorators)
// 3. Buttons with explicit size="icon" that are already 44x44
// 4. Buttons that are only visible on hover/focus and appear inside larger containers
```

**Why this matters for design reviews.** Touch target compliance is easy to miss during implementation because `size="sm"` looks proportional and feels fine on desktop with a mouse. The issue only becomes apparent on mobile or when measured against WCAG criteria. The design reviewer (using Playwright MCP for automated auditing) catches these systematically. Documenting the pattern (`min-h-11` on all `size="sm"` action buttons) turns a per-component finding into a codebase-wide convention.

## Why This Matters

These four lessons each highlight a different quality gate in the CE pipeline catching issues at the right stage:

1. **Component extraction discipline:** The three-PR series demonstrates the full lifecycle of a shared component -- intentional duplication at 2 consumers, extraction at 3. This is the practical application of the "extract on second consumer" rule with its documented exception for cross-domain duplication.

2. **Plan critic pre-code validation:** The course-level vs. module-level design decision was validated before a single line of code was written. This saved a rework cycle that would have been expensive after the full implementation was done.

3. **esbuild type erasure awareness:** A recurring gotcha in Vite projects. The missing `CardContent` import compiled silently in the dev server. Knowing this behavior means running `npx tsc --noEmit` (or `npm run build`) proactively during implementation, not just during review.

4. **Accessibility as a design review concern:** WCAG touch targets are easy to miss in implementation. The `min-h-11` pattern on `size="sm"` buttons is a simple, mechanical fix that the design reviewer catches automatically. Codifying it as a convention prevents the same finding from recurring in future PRs.

## When to Apply

- Before extracting a shared component, count the consumers and assess their domain alignment. At 2 consumers in different domains, document intentional duplication. At 3 consumers, extract.
- When designing action buttons in a hierarchical UI (course/module/lesson), validate which level each action operates on during planning -- not during implementation. The plan critic is the right gate for this check.
- During VS Code/Vite development, run `npx tsc --noEmit` alongside `npm run dev` to catch import errors that esbuild silently skips. Add a `typecheck` npm script for easy access.
- On every PR that adds shadcn/ui `size="sm"` buttons, verify each one has `min-h-11` unless it meets one of the documented exceptions. The design reviewer will catch failures, but preempting the finding saves a review cycle.

## Examples

**Good: Pure extraction at third consumer with no behavioral change**
```typescript
// PathTimeline.tsx -- after extraction, identical behavior
import { StatusCircle, EntryActionButton, LessonRow } from './TimelinePrimitives'
```

**Good: Course-level Complete/Undo with correct store wiring**
```typescript
<Button onClick={() => updateCourseStatus(courseId, 'completed')}>
  Complete Course
</Button>
```

**Bad: Missing CardContent import (compiles in esbuild, fails at runtime)**
```typescript
import { Card } from '@/app/components/ui/card'
// ... uses <CardContent> in JSX
// ✅ npm run dev succeeds (esbuild type erasure)
// ❌ CardContent is undefined at runtime
```

**Good: min-h-11 on size="sm" buttons for WCAG compliance**
```typescript
<Button variant="outline" size="sm" className="px-5 py-2 rounded-xl text-sm font-bold min-h-11">
  Review
</Button>
```

## Related

- PR [#561](https://github.com/PedroLages/knowlune/pull/561) -- Course Detail Syllabus Unification implementation
- Plan: `docs/plans/2026-05-11-001-feat-unify-course-syllabus-timeline-plan.md`
- PR #559 intentional duplication: `docs/solutions/best-practices/course-timeline-syllabus-view-implementation-lessons-2026-05-11.md` (Lesson 2)
- Extract on second consumer: `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`
- Course content separation lessons (PR #560): `docs/solutions/best-practices/courses-content-separation-implementation-lessons-2026-05-11.md`
- WCAG target size audit: `docs/solutions/best-practices/wcag-target-size-audit-2026-04-25.md`
- The extracted file: `src/app/components/learning-path/TimelinePrimitives.tsx`
