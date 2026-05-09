---
title: "Learning Path Detail DevOps Design Alignment — Implementation Lessons"
date: 2026-05-09
category: docs/solutions/best-practices
module: learning-paths
problem_type: best_practice
component: frontend
severity: medium
applies_when:
  - "Extracting a reusable component from duplicated collapsible section wrappers"
  - "Naming props by what they actually filter on (data field), not what they conceptually represent (entry identity)"
  - "Adding a new size preset to a well-designed constant lookup rather than modifying an existing one"
  - "Translating hardcoded Tailwind colors from a reference design into design tokens"
  - "Deepening a plan through iterative critic reviews (3 rounds, multiple blockers)"
tags:
  - learning-paths
  - collapsible-card-section
  - component-extraction
  - techdebt-dedup
  - prop-naming
  - design-tokens
  - plan-deepening
  - visual-alignment
  - path-progress-ring
related_components:
  - CollapsibleCardSection
  - ControlCenter
  - PathTimeline
  - PathProgressRing
  - PathProgressSidebar
  - LearningPathDetail
related_docs:
  - docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md
  - docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md
  - docs/solutions/workflow-issues/ce-pipeline-visual-redesign-interactions-2026-05-06.md
---

# Learning Path Detail DevOps Design Alignment — Implementation Lessons

## Context

The `/learning-paths/:pathId` page was redesigned to match the visual design of an external DevOps roadmap reference page. This was not a ground-up rewrite -- it was an alignment pass on top of the existing hero redesign (see related doc). The scope covered: a white-card Syllabus container with status dots replacing the old timeline, a 128px progress ring in the sidebar, design token translation from DevOps hardcoded colors, ControlCenter collapsible section deduplication, and a prop naming fix caught during code review.

Several implementation insights emerged that are worth capturing because they were non-obvious at plan time and represent reusable patterns.

## Guidance

### 1. CollapsibleCardSection Extraction: When Dedup Finds the Pattern Before You Do

The ControlCenter sidebar had three collapsible sections (Focus Session, AI Ordering, Study Tip), two of which were structurally identical: a `Collapsible` wrapping a `Card > CardContent > CollapsibleTrigger > chevron > CollapsibleContent`. The `/techdebt` Phase 1-2 dedup scan flagged the duplication before code review would have caught it.

The extracted component (`CollapsibleCardSection.tsx`) is minimal:

```tsx
interface CollapsibleCardSectionProps {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}
```

**Key detail**: The Study Tip section was NOT refactored to use `CollapsibleCardSection` because it has a different visual treatment (gradient background, white/translucent badge, italic quote text). The dedup was correct -- two out of three, not all three. Always verify that extracted components share both structure AND visual treatment before extracting.

**Lesson**: Run `/techdebt` Phase 1-2 early in a feature branch, not as a separate chore. The dedup scan found the pattern while we were actively modifying ControlCenter, making extraction part of the same branch rather than a separate refactor PR. This keeps the diff clean and avoids merge conflicts.

### 2. skipEntryId to skipCourseId: Name by What You Filter On, Not What You Think It Is

The plan specified a `skipEntryId` prop on `PathTimeline` to prevent duplication between `ContinueLearningBento` and the syllabus timeline. The implementation filtered by `courseId`:

```tsx
// In the plan: skipEntryId?: string
// In implementation:
const filteredEntries = useMemo(
  () => (skipEntryId ? entries.filter(e => e.courseId !== skipEntryId) : entries),
  [entries, skipEntryId]
)
```

Code review flagged the mismatch: the prop name says "entry ID" but the filter checks `courseId`. The entry's `id` field is unique per `LearningPathEntry` row, while `courseId` references the actual course. `ContinueLearningBento` needed to exclude the course, not the entry row.

Renamed to `skipCourseId` in commit `902f9abd`. This was a one-line change but the naming was misleading enough that a future reader would have been confused.

**Lesson**: When a prop filters a data field, name it after that field. If the initial name _feels_ wrong during implementation, it probably is. Trust that feeling and rename before commit rather than needing a fixup commit.

### 3. PathProgressRing size='xl' 128px: Extensibility Pays Off

The DevOps reference uses a 128px progress ring. The existing `SIZES` constant had `sm: 48`, `md: 72`, `lg: 96`. Adding a `xl` preset was straightforward:

```tsx
const SIZES = {
  sm: { size: 48, stroke: 3, fontSize: 'text-[10px]' },
  md: { size: 72, stroke: 3, fontSize: 'text-xs' },
  lg: { size: 96, stroke: 4, fontSize: 'text-lg' },
  xl: { size: 128, stroke: 6, fontSize: 'text-2xl' },
} as const
```

Key design decisions baked into the component:
- The `size` prop accepts `keyof typeof SIZES | number`, so raw numeric values work too
- Stroke width scales with size (3px for sm/md, 4px for lg, 6px for xl)
- The `as const` assertion preserves literal types for autocomplete

**Lesson**: Never modify an existing preset (`lg`) when a new one (`xl`) is semantically correct. The SIZES lookup pattern made addition trivial. The component's `number` fallback for size means even if a preset doesn't exist, consumers aren't blocked.

### 4. Design Token Translation: Semantic Mapping, Not 1:1

The DevOps reference uses hardcoded Tailwind colors. Knowlune uses design tokens. Translation required semantic mapping, not direct substitution:

| DevOps Color | Knowlune Token | Rationale |
|---|---|---|
| `bg-white` (syllabus card) | `bg-card` | Card surfaces use `bg-card`, not `bg-background` (which is `#faf5ee`) |
| `bg-slate-100` (sidebar border) | `border-border` | Generic border token adapts to theme |
| `bg-green-500` (completed dot) | `bg-success` | Semantic, not literal -- success could be a different hue in another scheme |
| `bg-blue-600` (in-progress dot) | `bg-brand` | Primary action/accent maps to brand |
| `text-slate-500` (metadata) | `text-muted-foreground` | Secondary text token |
| `border-4 border-white` (dot ring) | `border-4 border-card` | The ring needs to match the card background, which is `bg-card` |
| `shadow-lg` (sidebar) | `shadow-lg` | Shadow tokens are already design-agnostic |

**Key insight**: The dot ring (`border-4 border-white` in DevOps) translates to `border-4 border-card` in Knowlune. This is because the DevOps card is always `bg-white`, but Knowlune's card color changes with theme (light professional = white, dark = `#1c1917`). Using `border-card` ensures proper dark mode support.

The ESLint `design-tokens/no-hardcoded-colors` rule catches missed translations at save-time. Running `npm run build` before committing catches any remaining violations.

**Lesson**: When translating a reference design, map colors to semantic tokens, not literal equivalents. A green-500 success state might map to `bg-success` in one project and a different color in another. The semantic token is what preserves meaning across themes.

### 5. Plan-Deepening Cycle: 3 Rounds, 7 Blockers

The CE plan critic review found 7 blockers across 3 rounds before the plan reached approval threshold. This was not a sign of a bad plan -- it was the critic doing its job of surfacing edge cases the initial plan missed.

Blockers found (in order surfaced):
1. No design token audit scope -- plan mentioned tokens but didn't specify which files to audit
2. No tablet responsive strategy -- plan covered mobile and desktop but not the 768-1024px range
3. Drag handle positioning on restyled cards -- plan specified card layout but not how DnD grip would coexist with the new visual structure
4. Gap deduplication -- ContinueLearningBento + timeline could show the same gap entry twice
5. Timing of "Path Complete" banner when CTA also uses the space
6. InlineCoursePicker animation spec -- transition details were missing
7. Removed completed-courses strip and its information-equivalent replacement

**Lesson**: Plan-deepening is expected, not a failure. Each round surfaces narrower questions. The pattern to follow is: write the plan, submit to critic, resolve ALL blockers before implementation. Implementation-time discoveries are more expensive than plan-time ones. See `docs/solutions/workflow-issues/ce-pipeline-visual-redesign-interactions-2026-05-06.md` for the general workflow pattern.

### 6. Unused Variable Cleanup After Extraction

After extracting `CollapsibleCardSection`, the `ChevronDown` import became unused in `ControlCenter` because the extracted component handles the chevron internally. Code review caught this as a dead import, fixed in commit `ec3746e6`.

**Lesson**: Extraction commits should include a cleanup pass for unused imports and variables from the original location. Run `npx tsc --noEmit` after extraction to catch these automatically.

## Why This Matters

- **Component extraction discipline** reduces duplication but requires verifying that all candidates share both structure AND visual treatment
- **Prop naming accuracy** prevents misleading mental models in the codebase -- the cost of a rename is zero at implementation time but grows exponentially as the component gains consumers
- **Design token translation with semantic mapping** ensures the app works across all color schemes (Professional, Vibrant, Clean) without per-theme overrides
- **Plan deepening** catches expensive implementation surprises before implementation begins
- **The SIZES constant pattern** (`as const` lookup + `| number` fallback) is reusable for any component with preset sizes

## When to Apply

- Any feature where multiple sections share a collapsible-card pattern -- check for dedup early with `/techdebt`
- Any prop whose name describes intent rather than mechanism -- rename to match the actual data field
- Any reference design translation -- map colors to semantic tokens, not literal equivalents
- Any plan with complex cross-cutting changes -- expect 2-3 critic rounds and budget for them
- Any component with preset values (sizes, variants, themes) -- use the `as const` lookup + type union pattern

## Examples

**CollapsibleCardSection extraction pattern** -- dedup scan found 2 identical wrappers; extracted to shared component:

```
Before (ControlCenter.tsx, ~40 lines per section):
  <Collapsible open={focusSessionOpen} onOpenChange={setFocusSessionOpen}>
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer select-none">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Focus Session
            </h3>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform",
              focusSessionOpen && "rotate-180")} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Button variant="brand" className="w-full">Start focus session</Button>
        </CollapsibleContent>
      </CardContent>
    </Card>
  </Collapsible>

After:
  <CollapsibleCardSection title="Focus Session" open={focusSessionOpen}
    onOpenChange={setFocusSessionOpen}>
    <Button variant="brand" className="w-full">Start focus session</Button>
  </CollapsibleCardSection>
```

**Prop naming fix** -- rename to match the data field:

```
Before:  entries.filter(e => e.courseId !== skipEntryId)   // name suggests entry.id
After:   entries.filter(e => e.courseId !== skipCourseId)   // name matches courseId
```

**PathProgressRing size addition** -- add to SIZES rather than modify:

```
Before:  lg: { size: 96, stroke: 4, fontSize: 'text-lg' }  // consumers use size="lg"
After:   lg: { size: 96, stroke: 4, fontSize: 'text-lg' }  // existing unchanged
         xl: { size: 128, stroke: 6, fontSize: 'text-2xl' } // new preset added
```

## Related

- docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md -- Previous iteration (hero banner, sticky sidebar, layout breakout); moderate overlap on LearningPathDetail
- docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md -- Collapsible panel user-preference persistence pattern
- docs/solutions/workflow-issues/ce-pipeline-visual-redesign-interactions-2026-05-06.md -- General CE pipeline workflow patterns including plan deepening
