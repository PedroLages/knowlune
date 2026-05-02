---
title: Reports Page Redesign — Structured Layout and Design Patterns
date: 2026-05-02
category: best-practices
module: Reports
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - Redesigning a dashboard or reporting page with multiple data visualizations
  - Building a page where users need an "at a glance" summary before drilling into details
  - Selecting a message from a prioritized set of rules based on user metrics
  - Building reusable stat display components that appear across multiple tabs or sections
tags:
  - reports
  - redesign
  - design-patterns
  - react
  - typescript
  - component-extraction
  - layout-architecture
  - dexie
---

# Reports Page Redesign — Structured Layout and Design Patterns

## Context

The Reports page had 10+ flat, equal-weight widgets (cards, charts) assembled across 5+
separate stories with no visual hierarchy. The heatmap — the most personal visualization —
was buried at the bottom. Reading cards were five full-width stacks creating excessive
vertical scroll. The weekly goal ring sat alone off-center. There was no "at a glance"
answer to the user's core question: "How am I doing?"

The redesign restructured the page around a hero identity zone + 5 labeled sections,
creating visual hierarchy and reducing vertical footprint by 40%.

## Guidance

### 1. Zone-based page layout with a hero card

Structure the page as a hero zone (at-a-glance summary) followed by tabbed or scrolled
sections. The hero card sits at the top (`rounded-2xl border p-6 bg-card`), houses the
page title (h1), a dynamic insight message, a compact visualization, and key stat summaries.
This gives the user a one-location answer to their status.

### 2. Insight template chain pattern

Use a priority-ordered array of pure template functions instead of nested if/else or
switch statements. Each template receives a typed inputs object and returns `string | null`.
The first non-null match wins. This is declarative, easy to test, trivial to extend
(append a new template at the desired priority), and eliminates the arrow anti-pattern
of deeply nested conditionals.

```typescript
type TemplateFn = (inputs: StudyInsightInputs) => string | null

const templates: TemplateFn[] = [
  // No data at all
  (i) => i.totalCompletedLessons === 0
    ? 'Start studying to build your learning fingerprint' : null,

  // New record — consistent activity with no previous streak history
  (i) => i.activeDaysThisMonth > 15 && i.currentStreak > 0 && i.previousBestStreak === 0
    ? `You've been consistent. ${i.activeDaysThisMonth} active days this month — a new personal record.` : null,

  // Getting started — few lessons completed
  (i) => i.totalCompletedLessons < 10 && i.totalCompletedLessons > 0
    ? `${i.totalCompletedLessons} lesson${i.totalCompletedLessons !== 1 ? 's' : ''} down. Keep going — your fingerprint is forming.` : null,

  // Momentum — positive weekly change
  (i) => i.weeklyChange > 0 && i.totalCompletedLessons >= 10
    ? `Up ${i.weeklyChange} lesson${i.weeklyChange !== 1 ? 's' : ''} this week. Momentum is building.` : null,

  // Default fallback — always matches
  (i) => `Steady progress. ${i.totalCompletedLessons} lesson${i.totalCompletedLessons !== 1 ? 's' : ''} completed and counting.`,
]

export function generateStudyInsight(inputs: StudyInsightInputs): string {
  for (const template of templates) {
    const result = template(inputs)
    if (result !== null) return result
  }
  return 'Steady progress. Keep going.' // unreachable — last template always matches
}
```

### 3. Self-contained section components

Each page section should load its own data and listen to its own refresh events.
Avoid prop-drilling data from the parent page. Use `useEffect` for initial Dexie
query and `window.addEventListener('event-name', handler)` for reactivity.

```typescript
export function ThisWeekSection() {
  const [ringData, setRingData] = useState<RingData | null>(null)

  useEffect(() => {
    const monday = getMondayOfWeek()
    db.studySessions.where('startTime').aboveOrEqual(monday.toISOString()).toArray()
      .then(sessions => computeRingData(sessions))
      .then(setRingData)
  }, [])

  useEffect(() => {
    const handler = () => { /* re-fetch on study-log events */ }
    window.addEventListener('study-session-recorded', handler)
    return () => window.removeEventListener('study-session-recorded', handler)
  }, [])

  if (!ringData) return <Skeleton />
  return <Card>{/* ... */}</Card>
}
```

Benefits: sections load in parallel, independently testable, zero parent orchestration.

### 4. Prop-based layout variants

When a component needs to render in two contexts (full page vs compact card), add
a single boolean prop rather than duplicating the component or splitting into two.
Keep data loading shared; only the rendering diverges.

```typescript
interface ActivityHeatmapProps { compact?: boolean }
export function ActivityHeatmap({ compact = false }: ActivityHeatmapProps) {
  // Shared data loading (useEffect, Dexie query)
  // Conditional rendering:
  //   compact → 12px CSS Grid cells, 2px gaps, text-[8px] labels, hidden header
  //   default → aspect-square cells, 3px gaps, text-[10px] labels, visible header
}
```

### 5. Consistent section header pattern

Use a uniform `h2` pattern for all page sections after the hero, with semantic heading
hierarchy (h1 → h2 → h3 via CardTitle) and consistent margin spacing:

```tsx
<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
  This Week
</h2>
<motion.div variants={fadeUp} className="mt-3">
  <ThisWeekSection />
</motion.div>
```

### 6. Extract shared presentational components at the second consumer

When a stat display pattern appears in a second file, extract it to a shared component
rather than duplicating the layout markup. This keeps all tabs visually consistent.

```typescript
// HeroStat.tsx — extracted when QuizAnalyticsDashboard also needed stat display
export function HeroStat({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
      <Icon className="size-5 text-brand shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
      </div>
    </div>
  )
}
```

## Why This Matters

- **User experience**: A hero summary answers "How am I doing?" in one glance.
  Zone-based hierarchy guides the eye naturally from summary to details.
- **Maintainability**: Self-contained sections and a template chain are independently
  testable and extendable. Adding a new insight or section requires zero changes to
  existing code — just append to the array.
- **Performance**: Self-contained sections load in parallel rather than waiting for
  a parent orchestrator to fetch all data first.
- **Dead code hygiene**: Removing orphaned components (like `WeeklyGoalRing.tsx`,
  which had zero importers after the merge) prevents confusion and keeps the
  codebase lean.

## When to Apply

- Any dashboard or reporting page with multiple data visualizations
- Pages where users need an "at a glance" summary before drilling into details
- Any situation where you need to select a message from prioritized rules based
  on computed metrics
- When building reusable stat display components that appear across multiple tabs
  or sections
- When the same component needs both full-page and compact inline rendering
- When a page's content sections are independently data-driven (each loads its own
  data rather than being orchestrated by the parent)

## Examples

**Before:** 10+ flat widgets stacked vertically — heatmap at bottom, full-width
reading cards, orphaned `WeeklyGoalRing.tsx` still importable, no visual hierarchy,
EmptyState gate blocking the page for new users.

**After:** Hero card (h1 + insight + compact heatmap + 4 stats) at top, followed by
5 consistently-sectioned zones (This Week, Courses, Learning Behavior, Reading,
Activity) using h2 semantic headings. Self-contained `<ThisWeekSection />` loads
its own Dexie data. `<ReadingSection />` uses a 1+2+2 grid. Shared `<HeroStat />`
reused across quiz and AI tabs. Welcome hero replaces EmptyState for new users.

## Related

- Requirement source: `docs/brainstorms/2026-05-02-reports-page-redesign-requirements.md`
- Sibling redesign pattern (Library page): `docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md`
- Shared primitive extraction rule: `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`
- Heatmap architecture: `docs/planning-artifacts/heatmap-architecture.md`
- Tab persistence invariant: `docs/implementation-artifacts/27-1-add-analytics-tabs-to-reports-page.md`
- Pre-redesign baseline: `docs/reviews/audit/design-review-analytics-2026-03-26.md`
- Source implementation: `src/lib/insights.ts` (insight template chain)
- Source implementation: `src/app/components/reports/HeroStat.tsx` (shared stat component)
- Source implementation: `src/app/components/reports/ThisWeekSection.tsx` (self-contained component pattern)
- Source implementation: `src/app/components/reports/ActivityHeatmap.tsx` (compact mode prop)
