---
date: 2026-05-02
topic: reports-page-redesign
---

# Reports Page Redesign

## Problem Frame

The Reports page was assembled incrementally across 5+ stories (E08, E9B, E18, E27, E86, E112). Each story added a row of cards, producing a flat vertical stack of equal-weight widgets with no visual hierarchy, no headline insight, and no narrative arc. A user lands on the page and sees everything at once — no "glance test" answer, no invitation to explore deeper.

Specific pain points identified:
- No hero/header section — the page starts with a bare `<h1>Reports</h1>` and tabs
- The 365-day activity heatmap (the most personal, identity-forming visualization) is buried as row 9 of 9, rendered full-width with oversized cells on desktop
- The Weekly Study Goal ring sits alone in a card, off-center, with no supporting context
- Reading section uses 5 vertically-stacked full-width cards, creating excessive scroll and unpredictable layouts (each card conditionally returns null)
- Desktop view has unused horizontal space while the page scrolls excessively

## Requirements

### Hero + Identity Zone

- **R1.** The page opens with a hero block containing: a personalized headline insight about the user's recent activity, a compact GitHub-style contribution heatmap (365 days, ~12-13px cells, fixed container width), and a stat strip of 4 key metrics (lessons completed, courses active, current streak, quiz average).
- **R2.** The headline insight must change based on data — e.g., "You've been consistent. 18 active days this month — your best streak since March" vs "You're just getting started. 3 lessons completed this week." It must never show a generic fallback when data exists.
- **R3.** The heatmap must be compact and iconic: fixed cell size (~12-13px), ~720px total width on desktop, with a "Less ░▒▓█ More" legend and total-active-days summary. It must remain readable at tablet/mobile via horizontal scroll.

### Zone Structure

- **R4.** Content below the hero is organized into labeled sections with visual section headers, replacing the current undifferentiated card stack. Sections create intentional scrolling rhythm and let users find what they care about.
- **R5.** Proposed sections: "This Week" (goal ring + daily study breakdown), "Courses" (completion bars + category radar), "Learning Behavior" (30-day area chart + skills radar), "Reading" (reading stats/patterns/genres/goals/summary in a grid), "Activity" (recent timeline + quiz completion + export).
- **R6.** Section headers are simple text dividers (e.g., `text-sm font-semibold text-muted-foreground uppercase tracking-wide`), not interactive — they're navigation landmarks, not controls.

### This Week Section

- **R7.** The Weekly Goal ring and Study Time Analytics are merged into a single cohesive block. Layout: ring with percentage + hours on the left, daily breakdown bars on the right, supporting stats (days active, best day, time remaining) below or beside.
- **R8.** The ring must be properly centered within its half of the block, not floating off-center as it does today.
- **R9.** The block must answer, at a glance: "Am I on track this week? How much is left? Which days did I study?"

### Reading Section Grid

- **R10.** Reading cards (Stats, Patterns, Goals, Genre Distribution, Summary) are arranged in a predictable grid layout — not a vertical stack. Suggested: 2-row grid (3+2 or 2+2+1) so the section's vertical footprint is roughly halved.
- **R11.** Reading Patterns card (currently full-width, 4 progress bars spanning the entire page) must be constrained to a half-width or third-width card so it's scannable. Wide progress bars lose readability — narrower bars with tighter label+bar grouping are easier to parse.
- **R12.** Cards that conditionally return null must not break the grid. Use CSS grid with consistent column placement so visible cards fill in without leaving gaping holes.

### Cross-Cutting Design Improvements

- **R13.** The page must pass the "3-second glance test": a user opening the page should immediately see a headline insight, the heatmap pattern, and 4 key numbers — enough to understand their learning fingerprint without scrolling.
- **R14.** Desktop layout must use horizontal space intentionally. Full-width cards are reserved for hero and complex charts (area chart, bar chart). Simpler cards (reading patterns, quiz completion, weekly goal) are constrained to 2-3 column grids.
- **R15.** Consistent vertical rhythm: 24px (1.5rem) between sections, 16px (1rem) within sections. Card padding must be uniform across all cards in the same section.

### Tab Content Alignment

- **R16.** The zone structure (hero + sections) applies primarily to the Study Analytics tab. The Quiz and AI tabs should adopt the same zonal thinking in a future iteration, but are not redesigned in this pass.
- **R17.** The existing URL-driven tab pattern (`?tab=study|quizzes|ai`) and the `TabsList` component are preserved. Tab behavior, URL replace strategy, and legacy route redirects remain unchanged.

## Success Criteria

- User opens Reports and understands their learning status in under 3 seconds (glance test)
- The heatmap is recognizable and iconic, similar to GitHub's contribution graph
- The Weekly Study Goal ring is centered and shows contextual information beyond just a percentage
- The Reading section occupies roughly half its current vertical space on desktop
- No horizontal overflow on mobile; all sections read naturally on tablet
- Page feels intentional and designed, not assembled

## Scope Boundaries

- **Out of scope:** Server-side aggregation (E23 candidate epic). All data continues to come from client-side Dexie queries.
- **Out of scope:** Redesigning the Quiz Analytics or AI Analytics tabs beyond basic structural alignment.
- **Out of scope:** Adding new data sources or analytics dimensions not already tracked.
- **Out of scope:** Changing the navigation sidebar — Reports remains a single entry under "Track".
- **Out of scope:** Dashboard customization/drag-and-drop (that's an Overview page pattern).

## Key Decisions

- **Heatmap moves to hero**: It's the most personal, identity-forming visualization on the page. GitHub's profile page leads with it for a reason — consistency becomes part of your identity.
- **Zones over flat list**: Named sections create intentional scrolling. A user looking for reading stats scrolls to "Reading" — they don't hunt through 9 identical cards.
- **Reading stays on Reports**: Initially considered moving reading stats to a Books/Library page, but Reports is the analytics hub. Reading data is study data. It belongs here, just needs better layout.
- **Tabs preserved**: The three-tab structure (Study/Quiz/AI) is a good information architecture decision. Each tab has enough content to justify its existence. The redesign focuses on the Study tab as the primary and most content-rich view.

## Dependencies / Assumptions

- Assumes all existing data sources (`src/lib/reportStats.ts`, `src/lib/progress.ts`, `src/lib/studyLog.ts`, `src/services/ReadingStatsService.ts`) remain available and unchanged.
- Assumes the `StatsCard` component can be adapted for the hero's compact stat strip (or a new slimmer variant created).
- Assumes the `ActivityHeatmap` component can be refactored to support a compact mode with fixed cell sizes.

## Outstanding Questions

### Deferred to Planning

- [R1][Technical] Should the hero use a new `CompactHeatmap` component variant, or refactor `ActivityHeatmap` to accept a `variant` prop?
- [R4][Technical] Section headers: simple `<h2>` dividers or should they be sticky on scroll?
- [R5][Needs research] Are the proposed section groupings and labels the right ones, or should they differ based on what data is available?
- [R7][Technical] "This Week" block: does StudyTimeAnalytics already expose the daily breakdown data needed, or does a new aggregation function need to be added?
- [R10][Technical] Reading grid: CSS Grid with named areas (predictable placement) or auto-fill with min-width (flexible but less predictable)?
- [R12][Technical] How to handle cards that return null in a CSS grid — should empty slots show placeholder skeletons, collapse gracefully, or show a minimal "no data yet" state?

## Next Steps

-> `/ce:plan` for structured implementation planning
