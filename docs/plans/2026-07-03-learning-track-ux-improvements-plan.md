# Learning Track Detail — UX & UI Improvement Plan

**Date:** 2026-07-03
**Status:** Plan → Implementation
**Goal:** Transform the `/learning-tracks/:trackId` page into a premium learning GPS that immediately answers: *"You are here. This is next. This is why it matters. This is how far until the next milestone."*

---

## Current State Assessment

The current `LearningTrackDetail` page has strong fundamentals:
- Cinematic `PathHeroBanner` with cover image, gradient fallback, WCAG-compliant scrim
- `ContinueLearningBento` card for the in-progress course
- `PathTimeline` with status circles, accordion lesson rows, drag-and-drop
- `PathProgressSidebar` with progress ring and track info
- `ProgressionModeToggle` with "Free access" label

**Gaps identified:**
1. The "Continue Learning" area doesn't show the **exact next lesson title** or **remaining time**
2. Syllabus lesson rows are small, low-contrast, and lack visual distinction between lesson types
3. Module cards mix module number, title, stats, and actions with poor hierarchy
4. The right sidebar is too passive — shows a progress ring and not much else
5. Progress values can feel contradictory (1% track, 19% course, 0/16 completed) — labels needed
6. "Free access" label sounds like pricing, not a progression mode
7. No visual roadmap/phases showing the full learning journey
8. No "why this matters" context for each course
9. No motivational feedback after completing lessons/courses
10. No tabbed navigation — all info in one long scroll

---

## Implementation Plan

### Phase 1: Quick Wins (Labels & Clarity) — Files: 2

#### 1.1 Rename ProgressionModeToggle
**File:** `src/app/components/learning-path/ProgressionModeToggle.tsx`

- "Free access" → "Free navigation"
- Helper text: "Start any course without completing previous ones."
- When disabled: "Sequential mode" / "Complete each course to unlock the next one."
- Icon: Use `Unlock` when free, `Lock` when sequential

#### 1.2 Improve PathProgressSidebar with explicit labels
**File:** `src/app/components/learning-path/PathProgressSidebar.tsx`

Add explicit labeled sections:
- **Track progress:** X% (overall)
- **Current course:** X% (if in progress)
- **Courses completed:** X / Y
- **Estimated time left:** ~Xh
- **This week:** Xh studied / Goal: Xh
- **Next milestone:** "Finish Linux Basics" + estimated time

---

### Phase 2: Continue Learning UX — Files: 1

#### 2.1 Redesign ContinueLearningBento
**File:** `src/app/components/learning-path/ContinueLearningBento.tsx`

New content structure:
```
"Continue where you left off"
[Course Name]
"Next: [Lesson Title]"
[X]% complete · [N] lessons left · ~[H]h remaining
[Resume lesson] [View curriculum]
```

Changes:
- Add `nextLessonTitle` prop (compute in parent `LearningTrackDetail`)
- Add `lessonsRemaining` and `estimatedRemainingMinutes` props
- Show next lesson title prominently
- Show course progress with remaining lesson count
- Primary CTA: "Resume lesson" (not "Continue lesson")
- Secondary CTA: "View curriculum" (scrolls to syllabus)

---

### Phase 3: Syllabus Readability — Files: 2

#### 3.1 Improve PathTimeline course entries
**File:** `src/app/components/learning-path/PathTimeline.tsx`

- Increase lesson text size (text-sm → text-base)
- Improve contrast on lesson rows (muted-foreground → foreground/80)
- Add better spacing between lesson rows (py-3)
- Add lesson type icons: Video (PlayCircle), Reading (FileText), Quiz (HelpCircle), Project (Code)
- Show duration aligned right
- Current lesson visual highlight (brand-soft bg, ring)
- Completed lessons: checkmark + strikethrough or muted style

#### 3.2 Improve TimelinePrimitives LessonRow
**File:** `src/app/components/learning-path/TimelinePrimitives.tsx`

- Add `lessonType` prop: 'video' | 'reading' | 'quiz' | 'project'
- Add `isCurrent` prop for visual highlighting
- Show type-appropriate icon
- Increase padding and text size
- Duration always right-aligned

---

### Phase 4: Progress Sidebar Overhaul — Files: 1

#### 4.1 Redesign PathProgressSidebar
**File:** `src/app/components/learning-path/PathProgressSidebar.tsx`

New sections:
1. **Your Progress** card:
   - Progress ring (keep)
   - "Track progress: X%" label
   - "Current course: X%" (if in-progress course exists)
   - "Courses completed: X / Y"
   - "Estimated time left: ~Xh"

2. **This Week** card:
   - "Xh studied" / "Goal: Xh"
   - Simple progress bar
   - "Set weekly goal" button (if no goal set)

3. **Next Milestone** card:
   - Milestone name (e.g., "Finish Linux Basics")
   - Estimated time (e.g., "~2 weeks at current pace")
   - Progress bar to milestone

4. **Track Info** card (keep existing, with renamed toggle)

---

### Phase 5: Tabs & Structure — Files: 2

#### 5.1 Add tabbed navigation to LearningTrackDetail
**File:** `src/app/pages/LearningTrackDetail.tsx`

Tabs: **Overview** | **Roadmap** | **Syllabus** | **Projects** | **Notes**

- **Overview**: Hero + ContinueLearningBento + Progress sidebar (current layout)
- **Roadmap**: Visual phase component + course sequence
- **Syllabus**: Full PathTimeline with all courses expanded
- **Projects**: Placeholder for portfolio projects/labs
- **Notes**: Placeholder for per-course notes

Use shadcn/ui `Tabs` component.

#### 5.2 Create RoadmapPhases component
**New file:** `src/app/components/learning-path/RoadmapPhases.tsx`

Visual horizontal/flow phases showing the learning journey:
```
Foundation: Linux → Networking → Git → Python
Containers: Docker → Docker Compose → Kubernetes
Cloud & IaC: Azure/AWS → Terraform → CI/CD
Platform: Monitoring → Security → GitOps → Capstone
```

- Each phase is a horizontal card with phase name + course pills
- Courses link to their detail
- Completed courses show checkmark
- Current course highlighted
- Phase-based layout: section header + horizontal scroll of course pills

---

### Phase 6: Context & Motivation — Files: 2

#### 6.1 Add "Why This Matters" section
**File:** `src/app/components/learning-path/PathTimeline.tsx` (per course entry)

- Add collapsible "Why this matters" expander below course description
- Content from `LearningPathEntry.justification` (already in data model)
- If no justification exists, show a generic placeholder
- Styled as a subtle expandable callout with info icon

#### 6.2 Add motivational feedback
**File:** `src/app/pages/LearningTrackDetail.tsx`

- Contextual message in the hero or below hero:
  - First visit: "You started your DevOps path. Next goal: finish 5 Linux lessons."
  - After lessons completed today: "Nice work. You completed 3 lessons today."
  - After course: "Linux foundation complete. Next: Docker basics."
- Store in sessionStorage for session-level state

---

### Phase 7: Hero Polish — Files: 1

#### 7.1 PathHeroBanner CTA improvements
**File:** `src/app/components/learning-path/PathHeroBanner.tsx`

- Keep large hero height (do NOT reduce — explicit requirement)
- CTA: "Continue Learning" → "Resume [Course Name]" when in-progress
- Show next lesson title below CTA if available
- Keep the cinematic dark scrim, cover image, and gradient fallback
- No structural changes to the hero layout

---

## Files to Modify (Summary)

| File | Changes |
|------|---------|
| `src/app/pages/LearningTrackDetail.tsx` | Add tabs, compute next lesson data, add motivation message, restructure layout |
| `src/app/components/learning-path/PathHeroBanner.tsx` | Improve CTA label, show next lesson |
| `src/app/components/learning-path/ContinueLearningBento.tsx` | Major UX: next lesson, remaining time, clearer CTA |
| `src/app/components/learning-path/PathTimeline.tsx` | Better course card hierarchy, "why this matters" |
| `src/app/components/learning-path/TimelinePrimitives.tsx` | Better lesson rows: icons, current highlight, duration alignment |
| `src/app/components/learning-path/PathProgressSidebar.tsx` | Explicit labels, weekly goal, next milestone |
| `src/app/components/learning-path/ProgressionModeToggle.tsx` | Rename labels |
| `src/app/components/learning-path/RoadmapPhases.tsx` | **NEW** — Visual roadmap phases |

## Engineering Constraints

1. **No hero height reduction** — explicit requirement
2. **Design tokens only** — no hardcoded colors (ESLint enforced)
3. **Preserve dark theme** — all changes work in `.dark` mode
4. **No data model changes** — work within existing types
5. **Safe fallbacks** — when lesson duration or next lesson is unavailable, show graceful fallback
6. **Responsive** — desktop sidebar, tablet stack, mobile condensed
7. **Reuse existing components** — shadcn/ui Tabs, existing icons

## Success Criteria

After implementation, the user should immediately understand:
1. **What they are studying** (course name in hero + bento)
2. **Where they are in the roadmap** (progress ring + phases)
3. **What lesson to do next** (exact lesson title in bento)
4. **Why the current course matters** (justification expander)
5. **How far they are from the next milestone** (sidebar + motivation)
