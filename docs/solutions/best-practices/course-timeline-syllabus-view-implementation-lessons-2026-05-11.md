---
title: "Course Timeline/Syllabus View — Implementation Lessons"
date: 2026-05-11
category: best-practices
module: course-timeline-syllabus-view
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Running the CE pipeline for a net-new feature with moderate scope (4 units, ~400-600 lines)
  - Deciding whether to extract a shared component or intentionally duplicate at 2 consumers
  - Adding a new value to a zustand store's union type that flows through a settings bridge to Supabase
  - Implementing a mobile-responsive timeline variant that differs from its desktop counterpart
  - Navigating the CE review loop and deciding when to stop iterating
tags:
  - ce-pipeline
  - plan-critic
  - plan-deepening
  - component-extraction
  - intentional-duplication
  - deferred-extraction
  - settings-bridge
  - engagement-prefs
  - course-view-mode
  - mobile-responsive
  - use-media-query
  - review-loop
  - quality-gates
  - implementation-lessons
related_components:
  - tooling
  - documentation
---

# Course Timeline/Syllabus View — Implementation Lessons

## Context

PR [#559](https://github.com/PedroLages/knowlune/pull/559) added a fourth "Timeline" view mode to the `/courses` page (feature branch `feature/ce-2026-05-11-course-timeline-syllabus-view`), letting users browse imported courses in a vertical syllabus tree with expandable module/lesson accordions. The implementation followed the full CE pipeline: plan (with two deepening rounds) -> work (4 units) -> review (3 rounds) -> merge.

Five non-obvious lessons emerged from this run that deserve documentation beyond the plan itself. They span pipeline discipline, component strategy, settings bridge mechanics, mobile responsive patterns, and review loop economics.

## Guidance

### 1. Plan Deepening: Two Rounds Caught 6 Issues Pre-Code

The plan went through two plan-critic rounds before approval, with scores shifting 83 -> 80 -> 92. Between rounds, 6 issues were caught and resolved before a single line of implementation code was written.

**The critical catch was the `isLoading` state.** The first plan draft did not account for the asynchronous fetch of per-course lesson data from Dexie. Without `isLoading`, the timeline would flash an empty state or render incomplete data on every page load. The plan critic flagged this as a missing state in Round 1, and it was added to Unit 3 (now with skeleton placeholders and a 300ms minimum display to prevent flash-of-content).

Other issues caught during deepening:
- The settings bridge checklist (8 steps) was identified as required but not initially enumerated in the plan
- Mobile responsiveness approach was underspecified (connector column handling at breakpoints)
- Edge case: courses with no videos should not be expandable
- Edge case: Dexie query failures required per-course degradation (not whole-timeline failure)
- The `study-log-updated` event listener integration was missing

**Key takeaway:** Plan deepening is not ceremonial overhead. The two-round structure (initial plan -> first critic -> revision -> second critic -> approval) caught roughly one issue per 70 lines of plan text. For a feature with 4 implementation units, this prevented at minimum two rework cycles during implementation. The score oscillation (83 -> 80 -> 92) is informative: the first critic correctly identified gaps that lowered the un-risked score, and the second critic confirmed the fixes restored confidence. A score that stays flat or declines across two rounds is a signal the plan needs a structural rethink, not a polish pass.

### 2. StatusCircle/LessonRow: Intentional Duplication Deferred to 3rd Consumer

The plan explicitly deferred extracting `StatusCircle` and `LessonRow` as shared components, choosing to duplicate them inside `CourseTimelineView` rather than refactoring `PathTimeline` to export them. This decision deliberately contradicts the "extract on second consumer" pattern documented in `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`.

**Why the exception was warranted:**

1. **Different ownership trajectory.** `StatusCircle` inside `PathTimeline` serves learning-path-specific variant logic (gap entries, manual completion). `StatusCircle` inside `CourseTimelineView` serves course-specific statuses (not-started, in-progress, completed, paused). These are structurally similar but semantically different — extracting now would create a component with conditionals for both domains, increasing complexity without reducing duplication.

2. **Extraction cost exceeds duplication risk.** `PathTimeline` has its own test suite. Extracting `StatusCircle` and `LessonRow` would require: (a) creating new files, (b) updating `PathTimeline` imports, (c) updating `PathTimeline` tests, (d) testing the new `CourseTimelineView` against the extracted components. The duplication is ~60 lines of JSX that is structurally stable (status dots and lesson rows are mature patterns). The extraction cost is real now; the duplication tax is hypothetical until a third consumer appears.

3. **The third consumer is the extraction signal.** The rule is not "always extract at 2" — it is "extract when a third consumer would make the duplication obvious." The existing doc's trigger condition is correct for module-specific primitives where divergence is likely (like `SectionHeading` in the Library). For cross-module primitives where the second consumer is in a different domain (learning-paths vs courses), deferring to the third consumer is safer because:
   - The second consumer reveals whether the abstraction is truly shared or merely looks similar
   - By the third consumer, the shared API surface is clear
   - Early extraction risks creating a leaky abstraction that serves neither domain well

**Documenting the decision.** The plan explicitly called out this deferral in its "Deferred to Separate Tasks" section. This is essential discipline: intentional duplication must be named, justified, and bounded. Undocumented duplication looks like an oversight; documented duplication is a conscious tradeoff.

### 3. Settings Bridge: The 8-Step Checklist Proved Its Value

Adding `'timeline'` to the `CourseViewMode` union type required exactly the 8 steps from the settings bridge checklist (`docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md`). Every step was followed sequentially:

1. Sanitizer in `loadPersistedPrefs`
2. State persistence in `setPreference`'s `prefs` object
3. `saveSettings` bridge branch
4. `saveSettingsToSupabase` bridge branch
5. Reset-defaults bridge entry
6. Sanitizer in `getSettings` (`settings.ts`)
7. `UserSettingsPatch` type extension (`settings.ts`)
8. Hydration block in `hydrateSettingsFromSupabase` (`settings.ts`)

**What made this smooth.** The checklist is file-scoped (two files: `useEngagementPrefsStore.ts` and `settings.ts`) and value-scoped (each step is a mechanical edit — add a branch, extend a union, add a case). No step required design decisions. The ordering is critical: steps 1-5 are in the store file, steps 6-8 are in the settings file. Opening both files side-by-side and walking the list top-to-bottom took approximately 8 minutes.

**What the checklist does NOT cover.** Two things that had to be figured out separately:

- **The `CourseViewMode` type itself** must be extended in its canonical definition (in the store file) before any of the 8 steps make sense. The checklist assumes the new value already exists in the type union.
- **The toggle component** (`ViewModeToggle`) needs updating separately. The checklist covers persistence, not UI rendering.

**Lesson:** For future preference additions, the workflow is:

```
Add value to type union → Run 8-step checklist → Update toggle component → Done
```

The checklist eliminates the need to reason about the bridge topology each time. It is a run-book, not a reminder.

### 4. Mobile Responsive: `useMediaQuery` Hook + Simplified Prop

The `CourseTimelineView` needed a mobile variant that hides the timeline connector column and uses smaller status dots (20px vs 28px). Two approaches were considered:

- **Boolean prop** (the PathTimeline approach from the existing learning-paths doc)
- **`useMediaQuery` hook** in the page component

**Why `useMediaQuery` won.** The `PathTimeline` component lives inside `LearningTrackDetail`, which is a mobile-first page where the simplified variant is always active below `md`. For `CourseTimelineView`, the timeline is one of four view modes inside `Courses.tsx`, where the page-level layout already changes at breakpoints (sidebar collapses, grid columns adjust). Placing the responsive logic at the page level via `useMediaQuery` keeps the timeline component agnostic of viewport size:

```typescript
// In Courses.tsx (page component)
const isMobile = useMediaQuery('(max-width: 767px)')

// Pass simplified as a prop derived from viewport
<CourseTimelineView
  simplified={isMobile}
  courses={filteredCourses}
  // ...
/>
```

```typescript
// In CourseTimelineView (presentational)
interface Props {
  simplified?: boolean  // controls connector visibility and spacing
  // ...
}
```

**The pattern that emerged:**

| Component | Responsive Strategy | Rationale |
|-----------|-------------------|-----------|
| `PathTimeline` in `LearningTrackDetail` | Boolean prop, set to `true` below `md` via CSS media query | Fixed page context, always-on mobile variant |
| `CourseTimelineView` in `Courses.tsx` | `useMediaQuery` hook in parent, passed as boolean prop | Variable page context, four view modes share the page |

Both approaches converge on the same component-level prop (`simplified?: boolean`). The difference is where the breakpoint decision lives. For page-embedded components where mobile is the dominant context, CSS-based breakpoints are fine. For components that share a page with other modes that have their own responsive behavior, the `useMediaQuery` hook at the page level is cleaner because it centralizes breakpoint logic.

### 5. Review Loop: R1 (5 Medium) -> R2 (2 Medium) -> R3 (0) = Stop

The review loop ran three rounds with this progression:

- **Round 1**: 5 medium findings — all addressed in fixes
- **Round 2**: 2 medium findings — both addressed in fixes
- **Round 3**: 0 findings (PASS) — accepted immediately

This is the ideal review loop pattern. Each round converged quickly because:
1. The plan was well-scoped (deepening caught major issues pre-code)
2. Each review finding was actionable (specific file:line references with concrete suggestions)
3. The implementation followed the plan closely (reviewers were validating against known requirements, not discovering scope gaps)

**The 3-round cap is correct.** (auto memory [claude]) The existing feedback to cap at 3 rounds is validated by this run. Round 3 returned 0 findings. Even if Round 3 had returned LOW/NIT-only items, the documented rule says to accept and proceed — and this run confirms that pattern works. The findings did not escalate in severity across rounds; they converged toward zero.

**What made reviews fast.** Two factors specific to this feature:

1. **Component isolation.** `CourseTimelineView` is a new file with no dependencies on existing component internals (intentional duplication from Lesson 2). Reviewers could assess it independently without tracing through `PathTimeline`'s conditional logic.

2. **Settings bridge checklist.** The 8-step bridge wiring is mechanical and well-documented. Reviewers could verify it with a checklist comparison rather than ad-hoc reasoning about sync topology.

## Why This Matters

These five lessons collectively demonstrate a maturing CE pipeline: the pre-code gates (plan deepening) and post-code gates (review loops) are catching issues at the right stage with the right granularity. The most expensive bugs are those found during review or worse, after merge — and this run had zero post-merge issues.

The intentional duplication decision is the most nuanced lesson. It shows that "extract on second consumer" is a useful default rule but not an absolute law. When the two consumers are in different domains, the cost of early extraction exceeds the cost of documented, bounded duplication. The key discipline is *documenting the deferral* — without the explicit deferred-task note in the plan, the duplication would be indistinguishable from an oversight.

The settings bridge checklist and mobile responsive pattern are repeatable templates. Every future preference addition should follow the same 3-step workflow (type -> checklist -> toggle). Every future page-level responsive decision should weigh `useMediaQuery` vs CSS breakpoint based on component context (shared page vs dedicated page).

## When to Apply

- Before writing code, run at least one plan-critic cycle. Stop when the score increases from the previous round. A declining score across two rounds means the plan needs restructuring, not polish.
- When deciding whether to duplicate a component pattern at 2 consumers, assess domain alignment first. If the consumers are in different modules/domains, document the intentional duplication and defer extraction until a third consumer reveals the true shared API.
- When adding a synced preference, follow the 3-step workflow: extend the type union -> run the 8-step settings bridge checklist -> update the toggle component. Do not attempt to reason about the bridge topology from scratch.
- For components that share a page with other responsive elements, put the `useMediaQuery` hook at the page level and pass a `simplified` boolean prop. For components that own their page, CSS-based breakpoints are simpler.
- Accept a PASS verdict at Round 3 even if LOW/NIT items remain. Findings converge toward zero across rounds in well-scoped features; escalating for LOW/NIT at Round 3 wastes review capacity.

## Examples

**Good: documented intentional duplication in the plan**
```
### Deferred to Separate Tasks
- Extracting StatusCircle and LessonRow as fully independent shared
  components: future refactor when a third consumer emerges
```

**Good: settings bridge checklist applied methodically**
```
Steps 1-8 from engagement-prefs-bridge-checklist.md
Files touched: useEngagementPrefsStore.ts (steps 1-5), settings.ts (steps 6-8)
Time to complete: ~8 minutes
```

**Good: useMediaQuery at page level for shared-context components**
```tsx
const isMobile = useMediaQuery('(max-width: 767px)')
return <CourseTimelineView simplified={isMobile} ... />
```

**Good: review loop convergence data in PR description**
```
R1: 5 medium findings (addressed)
R2: 2 medium findings (addressed)
R3: 0 findings (PASS)
```

## Related

- PR [#559](https://github.com/PedroLages/knowlune/pull/559) — Course Timeline/Syllabus View implementation
- Plan: `docs/plans/2026-05-10-003-feat-course-timeline-syllabus-view-plan.md`
- Settings bridge checklist: `docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md`
- Extract on second consumer: `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`
- Mobile timeline simplification: `docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md`
- CE pipeline quality gap: `docs/solutions/workflow-issues/ce-orchestrator-inline-review-bypass-quality-gap-2026-05-07.md`
- Review loop max 3 rounds: auto memory (auto memory [claude])
- CE orchestrator discipline: auto memory (auto memory [claude])
