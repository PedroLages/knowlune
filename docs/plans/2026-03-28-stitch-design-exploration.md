# Stitch Design Exploration — UI Enhancement Candidates

> **Date:** 2026-03-28
> **Source:** Stitch Design Catalog (project `13761390259782802368`)
> **Status:** Exploration — not yet scheduled for implementation

---

## Selected Designs

Four Stitch-generated design pages were identified as having the strongest ideas for upgrading Knowlune's UI:

| # | Page | Stitch Preview | Local File |
|---|------|---------------|------------|
| 1 | Gamification & Engagement | [Preview](https://stitch.withgoogle.com/preview/13761390259782802368?node-id=d25957c520654ac1b444e9d9ede7d014&raw=1) | `docs/plans/stitch-designs/11-gamification.html` |
| 2 | Learning Path Visualizations | [Preview](https://stitch.withgoogle.com/preview/13761390259782802368?node-id=ee02f274ea6e4cedacc984dacafc51d8&raw=1) | `docs/plans/stitch-designs/07-learning-paths.html` |
| 3 | Activity Visualizations | [Preview](https://stitch.withgoogle.com/preview/13761390259782802368?node-id=72515316e1704f9ea3b1cd6d4f41a3a3&raw=1) | `docs/plans/stitch-designs/04-activity-visualizations.html` |
| 4 | Progress Indicators ("Visualizing Mastery") | [Preview](https://stitch.withgoogle.com/preview/13761390259782802368?node-id=63766ac931d64a4eb773ef3322fdf5c3&raw=1) | `docs/plans/stitch-designs/03-progress-indicators.html` |

Full catalog index: `docs/plans/stitch-designs/index.html` (12 pages total)

---

## Widget Upgrade Candidates

### 1. Deep Focus Mode + Today's Focus Stats

**Pedro's reaction:** "The Deep Focus Mode widget is great" / "as well Today's Focus Stats"

**Current state:** `PomodoroTimer.tsx` — popover-based, small countdown, minimal controls

**Stitch design (Section E of Gamification page):**
- Large circular SVG timer ring (~192px) showing 18:42 countdown
- Start / Pause / Reset button row
- Tab selector: `25m Work | 5m Break | 15m Break`
- Session counter: "3 of 4 sessions completed today"
- Companion sidebar card "Today's Focus Stats":
  - Total Focus: 2h 45m (with timer icon)
  - Deep Work: 82% (with brain icon)
  - Break Efficiency: High (with moon icon)
  - Motivational quote at bottom

**What would change:**
- Replace popover trigger with inline dashboard widget
- Large animated SVG ring with stroke-dashoffset progress
- Companion stats card pulling from study session data
- Track focus stats in IndexedDB (extend `studySessions` or new table)

**Files involved:** `PomodoroTimer.tsx`, `Overview.tsx`

---

### 2. Enhanced Streak Calendar

**Current state:** `StudyStreakCalendar.tsx` — heatmap grid, flame pulse, confetti milestones, freeze days

**Stitch design (Section B of Activity Visualizations):**
- Month-view calendar (7-column grid with day numbers)
- Study days highlighted with solid indigo background + white text
- Large header: flame icon + "26 Day Streak" in bold
- "Longest Streak: 42 Days" badge with trophy icon below calendar
- Cleaner visual hierarchy than current heatmap approach

**What would change:**
- Add month-view mode alongside existing heatmap grid
- Larger, more prominent streak counter header
- "Longest streak" badge with trophy
- Keep existing freeze days + milestone confetti functionality

**Files involved:** `StudyStreakCalendar.tsx`

---

### 3. Activity Timeline Feed

**Current state:** `RecentActivity.tsx` — simple list of recent items

**Stitch design (Section C of Activity Visualizations):**
- Vertical timeline with thin connecting line between entries
- Circular colored icons per activity type:
  - Book icon (lesson completion)
  - Checkmark (quiz taken)
  - Play circle (video watched)
  - Edit note (note created)
  - Forum (community post)
- Day grouping headers: "Today", "Yesterday"
- Timestamp labels: "2h ago", "5h ago"

**What would change:**
- Replace flat list with timeline layout (vertical line + nodes)
- Circular type-colored icons instead of plain list items
- Day grouping with collapsible sections
- "Load more" or virtual scroll for history

**Files involved:** `RecentActivity.tsx` or new `ActivityTimeline.tsx`, `Overview.tsx`

---

### 4. Vertical Timeline for Learning Paths

**Current state:** `TrailMap.tsx` — SVG winding Bezier path with waypoint circles (3 states: completed, current, upcoming)

**Stitch design (Section A of Learning Paths):**
- Clean vertical timeline with straight connecting line
- Three node states:
  - Completed: green circle with check icon, course title + completion date
  - Current: indigo circle with pulse animation + book icon, "Currently Studying" label
  - Locked: gray circle with lock icon, "Prerequisite required" label, reduced opacity
- Side-by-side layout: description panel left, timeline right
- Completion progress bar in description panel

**What would change:**
- Add alternative "timeline" view mode (toggle with current TrailMap)
- Simpler, more scannable than winding SVG path
- Better for paths with many courses (scales vertically)
- Keep TrailMap as a visual/fun option

**Files involved:** `TrailMap.tsx` or new `VerticalPathTimeline.tsx`, `LearningPathDetail.tsx`

---

### 5. Progress Composites from "Visualizing Mastery"

**Current state:** Basic `ProgressRing.tsx` (single SVG ring), `CompletionEstimate.tsx` (text badge), `StatsCard.tsx`

**Stitch design highlights (Progress Indicators page):**

| Widget | Description |
|--------|-------------|
| **Large hero metric** | Giant "73%" number with blurred gradient orb behind, thin progress bar below |
| **Remaining Focus card** | Indigo bg card with "3h 20m" large text + clock icon |
| **Segmented chapter bar** | Individual pill segments per chapter, filled (gradient) or empty |
| **Milestone progress bar** | Horizontal bar with checkpoint dots at 25%/50%/75%/100% + labels |
| **Dashboard metrics strip** | Horizontal row: icon circle + large number + label (streak, badges, notes) |
| **Course composite card** | Status badge + title + progress ring + stats grid (time, rank) + CTA button |

**Highest impact candidates:**
- Segmented chapter bar — replaces plain progress bar on course cards
- Dashboard metrics strip — horizontal KPI row for Overview
- Course composite card — richer `CourseCard.tsx` layout

**Files involved:** `CourseCard.tsx`, `Overview.tsx`, new `SegmentedProgressBar.tsx`

---

## Design Principles from Stitch

The Stitch-generated designs consistently used these patterns worth adopting:

1. **Tonal layering** — definition through background color shifts (`surface` → `surface-container-low` → `surface-container-lowest`) instead of borders
2. **Ambient shadows** — multi-layer shadows with indigo tint: `0px 20px 40px rgba(29,28,24,0.06)`
3. **Label hierarchy** — `10px uppercase tracking-widest` for category labels above bold headlines
4. **Icon circles** — icons inside colored circular backgrounds (not bare icons)
5. **Gradient CTAs** — `linear-gradient(135deg, primary, primary-container)` for primary buttons

---

## Implementation Notes

- All upgrades are **visual layer changes** on existing data infrastructure
- Each is independent and can be a separate story/PR
- Must use design tokens from `src/styles/theme.css` — no hardcoded colors
- Stitch used Manrope/Inter fonts; Knowlune uses system fonts — adapt accordingly
- Stitch used Material Symbols; Knowlune uses Lucide — substitute equivalent icons

## Suggested Priority

1. **Deep Focus Mode** — most dramatic upgrade, Pedro's explicit favorite
2. **Streak Calendar** — high visibility on Overview, enhances engagement
3. **Activity Timeline** — new visual pattern, replaces plain list
4. **Vertical Path Timeline** — alternative view for learning paths
5. **Progress Composites** — polish pass on existing widgets
