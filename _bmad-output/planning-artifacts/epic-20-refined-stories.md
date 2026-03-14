---
stepsCompleted: ['step-01-validate-prerequisites', 'research-analysis-2026-best-practices']
inputDocuments:
  - 'docs/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - 'docs/planning-artifacts/epic-20-learning-pathways.md'
researchSources:
  - 'Web research on FSRS implementation best practices'
  - 'Web research on learning pathway features (LXPs)'
  - 'Web research on flashcard UX design patterns'
  - 'Web research on learning analytics visualization trends'
  - 'Web research on skill assessment radar chart patterns'
enhancementDecision: 'Option A - Added 3 stories (E20-S05, E20-S06, E20-S07) for comprehensive feature set'
scopeChange: '4 stories (38h) → 7 stories (62h)'
---

# Elearningplatformwireframes - Epic 20: Learning Pathways & Knowledge Retention

## Overview

This document provides the complete epic and story breakdown for **Epic 20: Learning Pathways & Knowledge Retention**, decomposing the requirements from the PRD, UX Design Specification, Architecture, and existing Epic 20 planning document into implementable stories.

## Requirements Inventory

### Functional Requirements (Epic 20 Scope)

**Career Paths System:**
- FR89: System can store course metadata using standard fields: title, creator, subject, description, language, date added, estimated duration, and difficulty level

**Flashcard System with Spaced Repetition:**
- FR20: User can create notes using Markdown syntax
- FR21: User can link notes to specific courses and videos
- FR22: User can add tags to notes for organization
- FR23: User can search notes using full-text search
- FR80: User can schedule notes for spaced review using a 3-grade rating system (Hard / Good / Easy) that adjusts the next review interval based on recall difficulty
- FR81: User can view a review queue showing notes due for review, sorted by predicted retention percentage (lowest retention first)
- FR82: User can view knowledge retention status per topic showing time since last review and estimated retention level: strong (≤100% of review interval elapsed), fading (100-200% elapsed), or weak (>200% elapsed)
- FR92: User can activate an interleaved review mode that surfaces notes from multiple courses in a mixed sequence, weighted by topic similarity and time since last review

**Analytics Visualizations:**
- FR43: User can view study time analytics broken down by daily, weekly, and monthly periods
- FR78: User can view learning velocity metrics — completion rate over time (videos completed per week), content consumed per hour (duration watched / time spent), and progress acceleration/deceleration trends (week-over-week comparison)
- FR93: User can view a learning activity heatmap showing daily study activity over the past 12 months, with color intensity indicating session duration

### Non-Functional Requirements (Epic 20 Scope)

**Performance:**
- NFR1: Initial app load completes in less than 2 seconds (cold start)
- NFR2: Route navigation completes in less than 200ms
- NFR4: Data queries (note search, progress loading) complete in less than 100ms

**Reliability:**
- NFR8: Zero data loss for notes, progress, or course metadata during standard workflows
- NFR9: All user data persists across browser sessions without requiring manual save actions

**Usability:**
- NFR18: Core workflows (import course, watch video, take notes) are completable by a new user within 2 minutes without consulting documentation
- NFR22: Navigation between courses, videos, and notes completes in under 200ms

**Accessibility:**
- NFR57: Application meets WCAG 2.2 Level AA success criteria
- NFR60: All progress indicators use `role="progressbar"` with ARIA attributes and visible text equivalent
- NFR61: Charts and data visualizations include alt text descriptions, provide data table alternatives, and never rely on color alone

**Data Portability:**
- NFR63: Full data export in structured, machine-readable format completes within 30 seconds
- NFR65: All data schemas include version identifier; schema changes apply non-destructive automatic migrations
- NFR67: Exported data can be re-imported with ≥95% semantic fidelity

### Additional Requirements from Architecture

**Dexie Schema Extensions (v7-v8):**
- Career paths table: `career_paths` (path metadata, stages, course associations)
- Path enrollments table: `path_enrollments` (user enrollment status per path)
- Flashcards table: `flashcards` (front/back content, FSRS state, next review date)
- Review schedule table: `review_schedule` (FSRS scheduling data per note)

**Zustand Stores:**
- `useCareerPathStore` - career path enrollment and progress tracking
- `useSpacedRepStore` - review schedule state and FSRS integration (extends existing store)
- `useAnalyticsStore` - analytics metrics and heatmap data (extends existing store)

**Services:**
- `careerPathService.ts` - path progress logic, prerequisite enforcement
- `fsrsService.ts` - FSRS algorithm implementation (ts-fsrs wrapper)
- `analyticsService.ts` - heatmap data aggregation, velocity metrics

**Components:**
- `CareerPaths.tsx` - career paths list page
- `CareerPathDetail.tsx` - individual path detail with stages
- `Flashcards.tsx` - review interface
- `ActivityHeatmap.tsx` - GitHub-style contribution graph
- `SkillRadarChart.tsx` - radar chart for skill proficiency

### Additional Requirements from UX Design

**Career Paths UX:**
- Progressive disclosure: List view → Detail view → Enrollment
- Prerequisite enforcement with clear messaging
- Progress visualization with completed checkmarks

**Flashcard/Review UX:**
- Mochi-inspired card design: beautiful note previews, not flashcard prompts
- 3-grade simplicity: Hard/Good/Easy buttons with next-review preview
- Card aesthetics: soft shadows, generous whitespace, warm colors
- Review queue with progress indicator and session summary

**Analytics Visualizations UX:**
- Activity heatmap: GitHub-style 52-week grid, warm color gradient, hover tooltips
- Responsive: 12 months (desktop), 6 months (tablet), 3 months (mobile)
- Skill radar: 5-7 skill axes with completion-based proficiency calculation

### FR Coverage Map

| Epic 20 Story | Functional Requirements Covered | NFRs Covered |
|---------------|----------------------------------|--------------|
| **E20-S01: Career Paths System** | FR89 (course metadata) | NFR1, NFR2, NFR4, NFR8, NFR18, NFR22, NFR57, NFR60, NFR65 |
| **E20-S02: Flashcard System** | FR20, FR21, FR22, FR23, FR80, FR81, FR82, FR92 | NFR1, NFR2, NFR4, NFR8, NFR9, NFR18, NFR22, NFR57, NFR60, NFR61, NFR65, NFR67 |
| **E20-S03: Activity Heatmap** | FR93 | NFR1, NFR2, NFR57, NFR60, NFR61 |
| **E20-S04: Skill Radar Chart** | FR43 (partial - analytics display) | NFR1, NFR2, NFR57, NFR60, NFR61 |
| **E20-S05: FSRS Config & Analytics** | FR43, FR78 (learning velocity), FR93 | NFR1, NFR2, NFR4, NFR63, NFR65, NFR67 |
| **E20-S06: Skill Development** | FR89 (enhanced with prerequisites) | NFR1, NFR2, NFR4, NFR57, NFR60, NFR61, NFR65 |
| **E20-S07: Flashcard Management** | FR20, FR21, FR22, FR23 (enhanced with tags/search) | NFR1, NFR2, NFR4, NFR63, NFR65, NFR67 |

## Epic List

### Epic 20: Learning Pathways & Knowledge Retention

**Goal:** Provide structured multi-course learning journeys with prerequisites, skill progression tracking, and long-term knowledge retention tools (Career Paths, Flashcards, Analytics Visualizations) to drive course completion rates and enhance LevelUp's core mission of analytics-driven learning.

**Business Value:**
- 40-60% higher completion rates for users in structured paths vs. ad-hoc learning
- 35% higher retention for flashcard users vs. passive review (spaced repetition research)
- 50%+ users check analytics monthly when visualizations are present

**Stories:**
1. **E20-S01**: Career Paths System (Multi-Course Journeys) - 16h
2. **E20-S02**: Flashcard System with Spaced Repetition - 12h
3. **E20-S03**: 365-Day Activity Heatmap - 4h
4. **E20-S04**: Skill Proficiency Radar Chart - 6h
5. **E20-S05**: FSRS Configuration & Learning Analytics Dashboard - 8h
6. **E20-S06**: Skill Development System (Gap Analysis & Recommendations) - 10h
7. **E20-S07**: Flashcard Management & Organization - 6h

**Total Effort:** 62 hours over 6-8 weeks

---

## Epic 20: Learning Pathways & Knowledge Retention

Provide structured multi-course learning journeys with prerequisites, skill progression tracking, and long-term knowledge retention tools to drive course completion rates.

### Story 20.1: Career Paths System (Multi-Course Journeys)

**User Story:**
As a learner without a clear learning direction,
I want to enroll in curated multi-course learning paths (e.g., "Web Development", "Data Science"),
So that I have a structured journey with prerequisites and skill progression tracking.

**Acceptance Criteria:**

**AC1: Browse Career Paths**
**Given** I am on the Career Paths page
**When** The page loads
**Then** I see a list of 3-5 curated paths with title, description, course count, estimated hours, and progress %
**And** Each path card shows an overview of the learning journey

**AC2: View Path Detail**
**Given** I click on a career path card
**When** The detail page loads
**Then** I see staged progression (e.g., Stage 1: Foundations, Stage 2: Frameworks)
**And** Each stage shows course cards with title, duration, and completion status
**And** The overall path progress percentage is displayed at the top

**AC3: Enroll in a Path**
**Given** I am viewing a career path detail page
**When** I click the "Start Path" button
**Then** My enrollment is saved to IndexedDB (`path_enrollments` table)
**And** The button changes to "Continue Path"
**And** The path appears in my "Active Paths" section on Overview

**AC4: Track Progress**
**Given** I have enrolled in a career path
**When** I complete a course that is part of the path
**Then** The course shows a green checkmark in the path detail view
**And** The overall path progress percentage updates
**And** The course card visually indicates completion (green border/background)

**AC5: Prerequisite Enforcement**
**Given** I am viewing a career path with multiple stages
**When** Stage 1 is not 100% complete
**Then** Stage 2 courses are locked/disabled
**And** A clear message explains "Complete Stage 1 to unlock Stage 2"
**And** Locked courses have a visual indicator (lock icon, grayed out)

**AC6: Course Navigation**
**Given** I am viewing an unlocked course in a career path
**When** I click the course card
**Then** I navigate to the course detail page
**And** I can start the first lesson or resume where I left off

**AC7: Data Model Integrity**
**Given** The `career_paths` and `path_enrollments` tables exist in Dexie
**When** I enroll in a path
**Then** A record is created in `path_enrollments` with `pathId`, `userId` (or device ID), `enrolledAt`, `lastAccessedAt`
**And** Progress is calculated dynamically from course completion data

**Technical Notes:**
- **Data Model:**
  ```typescript
  interface CareerPath {
    id: string
    title: string
    description: string
    stages: Array<{
      title: string
      courses: string[]      // Course IDs
      skills: string[]       // Skill tags
      estimatedHours: number
    }>
    totalEstimatedHours: number
  }

  interface PathEnrollment {
    id: string
    pathId: string
    enrolledAt: string      // ISO 8601
    lastAccessedAt: string
    completedStages: number[]
  }
  ```

- **Files to Create:**
  - `src/app/pages/CareerPaths.tsx` (list view)
  - `src/app/pages/CareerPathDetail.tsx` (detail view)
  - `src/lib/services/careerPathService.ts` (progress logic)
  - `src/stores/useCareerPathStore.ts` (path state)

- **Files to Modify:**
  - `src/db/schema.ts` (add Dexie v7: `career_paths`, `path_enrollments` tables)
  - `src/app/routes.tsx` (add `/career-paths` and `/career-paths/:id` routes)
  - `src/app/components/Layout.tsx` (add "Career Paths" to sidebar nav)

**Effort:** 16 hours

---

### Story 20.2: Flashcard System with Spaced Repetition

**User Story:**
As a learner who forgets concepts after completing courses,
I want to create flashcards from my notes and review them using spaced repetition,
So that I retain knowledge long-term.

**Acceptance Criteria:**

**AC1: Create Flashcard from Note**
**Given** I am viewing the Notes page
**When** I select text in a note and click "Create Flashcard"
**Then** A dialog opens with "Front" and "Back" input fields
**And** The selected text is pre-filled in the "Front" field
**And** I can enter the back content (answer/definition)

**AC2: Save Flashcard**
**Given** I have filled in front and back content in the flashcard dialog
**When** I click "Save Flashcard"
**Then** The flashcard is saved to IndexedDB (`flashcards` table)
**And** A review schedule is created using the FSRS algorithm (initial interval = 1 day)
**And** The flashcard is linked to the source note and course
**And** A success toast appears: "Flashcard created!"

**AC3: View Review Queue**
**Given** I have flashcards with scheduled reviews
**When** I navigate to the Flashcards page
**Then** I see a review queue showing cards due today
**And** Cards are sorted by retention prediction (lowest first)
**And** The queue shows a progress indicator: "3 of 12 cards reviewed"

**AC4: Review Flashcard**
**Given** I am viewing a flashcard in the review queue
**When** The card appears
**Then** I see the front content (question/prompt)
**And** I can reveal the back content by clicking "Show Answer"
**And** The back content displays with Markdown rendering
**And** The card shows course context (course name, note title)

**AC5: Grade Flashcard (Hard)**
**Given** I have revealed the back content of a flashcard
**When** I click the "Hard" button
**Then** The card is scheduled for review in 1 day (short interval)
**And** The FSRS algorithm updates `easeFactor` and `interval` in the `flashcards` table
**And** An orange flash animation appears
**And** The next card in the queue is shown

**AC6: Grade Flashcard (Good)**
**Given** I have revealed the back content of a flashcard
**When** I click the "Good" button
**Then** The card is scheduled for review based on FSRS normal interval (e.g., 3 days)
**And** A green flash animation appears
**And** The next card in the queue is shown

**AC7: Grade Flashcard (Easy)**
**Given** I have revealed the back content of a flashcard
**When** I click the "Easy" button
**Then** The card is scheduled for review with a longer interval (e.g., 7 days)
**And** A blue flash animation appears
**And** The next card in the queue is shown

**AC8: Review Session Complete**
**Given** I have reviewed all cards in the queue
**When** The last card is graded
**Then** A completion summary appears: "Review complete! 12 cards reviewed."
**And** The summary shows breakdown: "Hard: 2, Good: 8, Easy: 2"
**And** The queue view shows "No cards due today — next review tomorrow"

**AC9: FSRS Algorithm Integration**
**Given** The `ts-fsrs` library is integrated
**When** A flashcard is graded
**Then** The FSRS algorithm calculates the next review date based on:
  - Previous interval
  - Ease factor
  - Grade (Hard/Good/Easy)
**And** The `nextReviewDate` is updated in IndexedDB
**And** The card's retention prediction is recalculated

**AC10: Retention Prediction Display**
**Given** I am viewing a flashcard in the review queue
**When** The card loads
**Then** A retention prediction badge is shown (e.g., "85% retention")
**And** The prediction is calculated by FSRS based on time since last review

**Technical Notes:**
- **Data Model:**
  ```typescript
  interface Flashcard {
    id: string
    front: string
    back: string
    noteId: string          // FK to notes table
    courseId: string
    easeFactor: number      // FSRS state
    interval: number        // Days until next review
    nextReviewDate: string  // ISO 8601
    difficulty: 'easy' | 'medium' | 'hard'
    reviewHistory: Array<{
      date: string
      grade: 'hard' | 'good' | 'easy'
      retention: number
    }>
  }
  ```

- **Files to Create:**
  - `src/app/pages/Flashcards.tsx` (review interface)
  - `src/lib/services/fsrsService.ts` (ts-fsrs wrapper)
  - `src/app/components/figma/ReviewCard.tsx` (Mochi-inspired card)
  - `src/app/components/figma/GradeButtons.tsx` (Hard/Good/Easy buttons)
  - `src/stores/useSpacedRepStore.ts` (review queue state)

- **Files to Modify:**
  - `src/db/schema.ts` (add Dexie v8: `flashcards`, `review_schedule` tables)
  - `src/app/pages/Notes.tsx` (add "Create Flashcard" button with text selection)
  - `src/app/routes.tsx` (add `/flashcards` route)

- **FSRS Integration:**
  - Install `ts-fsrs` package
  - Wrapper service exposes: `schedule()`, `grade()`, `calculateRetention()`

**Effort:** 12 hours

---

### Story 20.3: 365-Day Activity Heatmap

**User Story:**
As a learner who values consistency,
I want to see a GitHub-style contribution graph of my study activity for the past year,
So that I can visualize my learning habits and identify gaps.

**Acceptance Criteria:**

**AC1: Heatmap Display**
**Given** I am on the Overview or Reports page
**When** The page loads
**Then** I see a 365-day calendar grid (52 weeks × 7 days)
**And** The heatmap uses a 5-level warm color gradient (`heatmap-0` to `heatmap-4`)
**And** Empty days show light neutral gray (`#F3F0EB`)

**AC2: Heatmap Data Aggregation**
**Given** I have study sessions logged in IndexedDB
**When** The heatmap renders
**Then** Each cell's color intensity reflects total study time for that day:
  - 0 minutes: `heatmap-0` (neutral gray)
  - 1-15 minutes: `heatmap-1` (light green)
  - 16-30 minutes: `heatmap-2` (moderate green)
  - 31-60 minutes: `heatmap-3` (dark green)
  - 60+ minutes: `heatmap-4` (intense green)

**AC3: Hover Tooltip**
**Given** I hover over a heatmap cell
**When** The hover event triggers
**Then** A tooltip appears showing:
  - Date (e.g., "March 7, 2026")
  - Study time (e.g., "45 min studied")
  - Notes taken count (e.g., "3 notes")
**And** The tooltip positions above the cell without overlapping adjacent cells

**AC4: Responsive Heatmap**
**Given** I am viewing the heatmap on different screen sizes
**When** The viewport changes
**Then** The heatmap adapts:
  - Desktop (≥1024px): Full 12-month view
  - Tablet (640–1023px): 6-month view
  - Mobile (<640px): 3-month view
**And** Month labels and legend scale proportionally

**AC5: Accessibility**
**Given** I am using a screen reader or keyboard navigation
**When** I navigate the heatmap
**Then** The heatmap has `role="img"` and `aria-label="Study activity over the past 12 months"`
**And** Each cell is keyboard navigable with arrow keys
**And** Focused cells trigger tooltip display
**And** Color intensity differences are distinguishable (3:1 contrast between levels)

**AC6: Empty State**
**Given** I am a new user with no study sessions
**When** The heatmap loads
**Then** All cells are `heatmap-0` (neutral gray)
**And** A message appears: "Study for a few days and your heatmap will fill in!"

**Technical Notes:**
- **Component:** `ActivityHeatmap.tsx` — custom SVG grid component
- **Data Source:** Aggregate from `sessions` table in IndexedDB:
  ```typescript
  const heatmapData = sessions.reduce((acc, session) => {
    const date = session.studyDate.split('T')[0] // YYYY-MM-DD
    acc[date] = (acc[date] || 0) + session.duration
    return acc
  }, {} as Record<string, number>)
  ```

- **Files to Create:**
  - `src/app/components/figma/ActivityHeatmap.tsx` (heatmap grid)

- **Files to Modify:**
  - `src/app/pages/Reports.tsx` (add heatmap section)
  - `src/app/pages/Overview.tsx` (optional: compact heatmap on dashboard)

**Effort:** 4 hours

---

### Story 20.4: Skill Proficiency Radar Chart

**User Story:**
As a learner tracking skill development,
I want to see a spider chart of my proficiency across different domains (Design, Coding, Marketing, etc.),
So that I can identify strengths and areas for improvement.

**Acceptance Criteria:**

**AC1: Radar Chart Display**
**Given** I am on the Overview dashboard
**When** The page loads
**Then** I see a radar chart with 5-7 skill axes (e.g., Design, Coding, Marketing, Business, Soft Skills)
**And** Each axis represents a skill domain
**And** The chart uses a warm color fill with semi-transparency

**AC2: Proficiency Calculation**
**Given** I have completed courses tagged with skill domains
**When** The radar chart calculates proficiency
**Then** Each skill's proficiency is calculated as:
  - (Completed courses in skill domain / Total courses in skill domain) × 100
**And** If no courses exist for a skill, proficiency = 0
**And** Proficiency scores are displayed as percentages (0-100%)

**AC3: Chart Interaction**
**Given** I hover over a skill axis on the radar chart
**When** The hover event triggers
**Then** A tooltip appears showing:
  - Skill name (e.g., "Coding")
  - Proficiency percentage (e.g., "75%")
  - Completed courses count (e.g., "3 of 4 courses")

**AC4: Skill Taxonomy**
**Given** The skill proficiency chart uses a fixed skill taxonomy
**When** Courses are imported with tags
**Then** Skills are mapped as follows (example):
  - **Design**: Courses tagged `#design`, `#ui`, `#ux`, `#figma`
  - **Coding**: Courses tagged `#programming`, `#react`, `#javascript`, `#typescript`
  - **Marketing**: Courses tagged `#marketing`, `#seo`, `#analytics`
  - **Business**: Courses tagged `#business`, `#strategy`, `#entrepreneurship`
  - **Soft Skills**: Courses tagged `#communication`, `#leadership`, `#productivity`

**AC5: Chart Responsiveness**
**Given** I am viewing the radar chart on different screen sizes
**When** The viewport changes
**Then** The chart scales proportionally
**And** On mobile (<640px), the chart uses compact labels and reduced padding

**AC6: Accessibility**
**Given** I am using a screen reader or keyboard navigation
**When** I navigate the radar chart
**Then** The chart has `role="img"` and `aria-label="Skill proficiency across 5 domains"`
**And** A data table alternative is available for screen readers
**And** Chart colors meet 3:1 contrast ratio (WCAG 2.2 AA)

**AC7: Empty State**
**Given** I am a new user with no completed courses
**When** The radar chart loads
**Then** All skill axes show 0% proficiency
**And** A message appears: "Complete courses to build your skill profile!"

**Technical Notes:**
- **Component:** `SkillRadarChart.tsx` — uses Recharts library (already installed)
- **Data Source:** Aggregate from `courses` table with completion status and tags:
  ```typescript
  const skillProficiency = calculateSkillProficiency(courses, skillTaxonomy)
  ```

- **Files to Create:**
  - `src/app/components/figma/SkillRadarChart.tsx` (radar chart component)

- **Files to Modify:**
  - `src/app/pages/Overview.tsx` (add skill radar section)

**Effort:** 6 hours

---

### Story 20.5: FSRS Configuration & Learning Analytics Dashboard

**User Story:**
As a learner optimizing my knowledge retention,
I want to configure my spaced repetition parameters and view comprehensive learning analytics in one place,
So that I can tune my review schedule and track my learning performance holistically.

**Acceptance Criteria:**

**AC1: FSRS Settings Page**
**Given** I navigate to Settings → FSRS Configuration
**When** The page loads
**Then** I see a slider to configure desired retention rate (70-97%)
**And** Each retention rate value shows an explanation (e.g., "85% - Balanced: moderate reviews, good retention")
**And** I see my optimization progress: "X/1000 reviews completed"
**And** I can reset FSRS weights to defaults with a "Reset to Defaults" button

**AC2: Save FSRS Configuration**
**Given** I adjust the desired retention rate slider
**When** I click "Save Settings"
**Then** The retention rate is persisted to IndexedDB
**And** Future flashcard review intervals are calculated using the new retention rate
**And** A success toast appears: "FSRS settings updated!"

**AC3: Unified Learning Analytics Dashboard**
**Given** I navigate to the Analytics page
**When** The page loads
**Then** I see a single dashboard combining:
  - Activity Heatmap (365-day GitHub-style grid)
  - Skill Proficiency Radar Chart (5-7 skill axes)
  - Learning Velocity Chart (new component)
**And** All visualizations use consistent styling and color scheme

**AC4: Learning Velocity Trends (FR78 Implementation)**
**Given** I am viewing the Learning Velocity Chart on the Analytics dashboard
**When** The chart renders
**Then** I see three trend lines:
  - Completion rate over time (videos completed per week)
  - Content consumed per hour (duration watched / time spent)
  - Progress acceleration/deceleration (week-over-week % change)
**And** Each trend line has visual indicators (↑/↓ arrows, color coding)
**And** The chart shows data for the past 12 weeks

**AC5: FSRS Performance Metrics Card**
**Given** I have completed at least 50 flashcard reviews
**When** I view the Analytics dashboard
**Then** I see an FSRS metrics card showing:
  - "Reviews saved" (estimated vs. traditional SM-2 spacing)
  - "Retention rate achieved" (target vs. actual %)
  - "Card difficulty distribution" (easy/medium/hard pie chart)
**And** The card updates daily based on review history

**AC6: Review History Timeline**
**Given** I have flashcard review history data
**When** I view the Analytics dashboard
**Then** I see a timeline chart showing:
  - Flashcard reviews per day (bar chart)
  - Average retention prediction (line overlay)
**And** The timeline covers the past 90 days
**And** Hovering over a bar shows: "12 reviews on March 7, 2026"

**AC7: Data Export to JSON/CSV**
**Given** I am on the Analytics dashboard
**When** I click the "Export Analytics Data" button
**Then** A modal appears with export format options (JSON or CSV)
**And** I can select data to export (heatmap, skill proficiency, FSRS stats, learning velocity)
**And** The export completes in <30 seconds (NFR63)
**And** The exported file is downloaded with filename `levelup-analytics-YYYY-MM-DD.json`

**AC8: Data Export Semantic Fidelity**
**Given** I export analytics data to JSON
**When** I examine the exported file
**Then** The data structure includes:
  - Version identifier (e.g., `"schemaVersion": "1.0"`)
  - Heatmap data (date → minutes studied mapping)
  - Skill proficiency (skill domain → percentage)
  - FSRS stats (reviews saved, retention rate, difficulty distribution)
  - Learning velocity (completion rate, content per hour, acceleration trends)
**And** The data can be re-imported with ≥95% semantic fidelity (NFR67)

**Technical Notes:**
- **Data Model:**
  ```typescript
  interface FSRSConfig {
    desiredRetention: number  // 0.70 - 0.97
    optimizationProgress: number  // 0 - 1000+ reviews
    lastModified: string  // ISO 8601
  }

  interface LearningVelocityMetrics {
    weekEnding: string  // ISO 8601 date
    videosCompleted: number
    contentConsumedPerHour: number  // minutes watched / minutes spent
    progressAcceleration: number  // % change week-over-week
  }
  ```

- **Files to Create:**
  - `src/app/pages/Analytics.tsx` (unified analytics dashboard)
  - `src/app/pages/Settings/FSRSSettings.tsx` (FSRS configuration UI)
  - `src/app/components/figma/LearningVelocityChart.tsx` (FR78 trend visualization)
  - `src/app/components/figma/FSRSMetricsCard.tsx` (performance stats)
  - `src/app/components/figma/ReviewHistoryTimeline.tsx` (review timeline)
  - `src/lib/services/analyticsExportService.ts` (export functionality)

- **Files to Modify:**
  - `src/lib/services/fsrsService.ts` (add `getConfig()`, `setConfig()`, `getPerformanceMetrics()`)
  - `src/lib/services/analyticsService.ts` (add `calculateVelocityMetrics()`, `exportAnalytics()`)
  - `src/db/schema.ts` (add Dexie v9: `fsrs_config`, `velocity_metrics` tables)
  - `src/app/routes.tsx` (add `/analytics` route)
  - `src/app/pages/Settings.tsx` (add link to FSRS settings)

**Effort:** 8 hours

---

### Story 20.6: Skill Development System

**User Story:**
As a learner with specific skill goals,
I want to set target proficiency levels, analyze skill gaps, and receive course recommendations,
So that I can systematically close skill gaps and track my growth over time.

**Acceptance Criteria:**

**AC1: Set Target Proficiency Goals**
**Given** I am viewing the Skill Development page
**When** I click "Set Targets" for a skill domain (e.g., Design)
**Then** A modal opens with a slider to set target proficiency (0-100%)
**And** The slider shows current proficiency as a baseline indicator
**And** I can save the target, which persists to IndexedDB

**AC2: Radar Chart with Target Overlay**
**Given** I have set target proficiency goals for 3+ skills
**When** I view the Skill Proficiency Radar Chart
**Then** The chart displays two overlays:
  - Solid filled area: Current proficiency
  - Dotted outline: Target proficiency
**And** The gap between current and target is visually apparent
**And** A legend explains: "Solid = Current | Dotted = Target"

**AC3: Skill Gap Analysis Summary**
**Given** I have target proficiency goals configured
**When** I view the Skill Development page
**Then** I see a gap analysis card showing:
  - List of skills sorted by gap size (largest first)
  - For each skill: "Design: 25% gap (current 50%, target 75%)"
  - Suggested action: "Complete 2 more Design courses to reach your target"
**And** Skills with 0% gap show a green checkmark: "Target achieved!"

**AC4: Course Recommendations to Close Gaps**
**Given** I have skill gaps identified
**When** I click "Get Recommendations" for a skill domain
**Then** I see a list of courses filtered by that skill domain
**And** Each course shows:
  - Estimated proficiency improvement (e.g., "+15% Design")
  - Difficulty level (Beginner/Intermediate/Expert)
  - Estimated hours
**And** Courses are sorted by relevance (largest proficiency improvement first)

**AC5: Historical Skill Progression**
**Given** I have been using LevelUp for 3+ months
**When** I view the Skill Development page
**Then** I see a time-series line chart showing skill proficiency over the past 12 months
**And** Each skill domain is a separate line with distinct color
**And** The chart shows monthly snapshots (e.g., Jan 2026: Design 45%, Feb 2026: Design 60%)
**And** Hovering over a data point shows: "Design: 60% (Feb 2026)"

**AC6: Skill Progression Snapshots (Background)**
**Given** It is the first day of a new month
**When** The system runs its monthly maintenance task
**Then** A skill proficiency snapshot is recorded to IndexedDB
**And** The snapshot includes current proficiency for all skill domains
**And** The snapshot is dated with YYYY-MM format
**And** Snapshots older than 24 months are archived

**AC7: Proficiency Level Definitions**
**Given** I am viewing skill proficiency data
**When** I see a proficiency percentage
**Then** A level badge is displayed:
  - 0-33%: "Beginner" (blue badge)
  - 34-66%: "Intermediate" (green badge)
  - 67-100%: "Expert" (gold badge)
**And** Level-up notifications appear when I cross a threshold (e.g., "You're now an Intermediate in Design!")

**AC8: Prerequisite Validation for Career Paths**
**Given** I am viewing a career path detail page
**When** The path has skill prerequisites (e.g., "Requires Intermediate Coding")
**When** I do not meet the prerequisite (I'm at Beginner level)
**Then** A warning banner appears: "This path requires Intermediate Coding (you're at Beginner)"
**And** A "View Prerequisites" button shows recommended courses to reach Intermediate level
**And** The "Enroll" button is disabled until prerequisites are met

**AC9: Growth Indicators**
**Given** I view the historical skill progression chart
**When** A skill has increased since last month
**Then** A growth indicator appears: "↑ +12% in Design since last month"
**And** The indicator is color-coded (green for growth, red for decline, gray for no change)

**Technical Notes:**
- **Data Model:**
  ```typescript
  interface SkillTarget {
    id: string
    skillDomain: string
    targetProficiency: number  // 0-100
    currentProficiency: number  // calculated dynamically
    createdAt: string
    lastUpdated: string
  }

  interface SkillSnapshot {
    id: string
    date: string  // YYYY-MM format
    skills: Record<string, number>  // { "Design": 75, "Coding": 60, ... }
    createdAt: string
  }

  interface SkillLevel {
    name: 'Beginner' | 'Intermediate' | 'Expert'
    range: [number, number]  // e.g., [0, 33] for Beginner
    badgeColor: string
  }
  ```

- **Files to Create:**
  - `src/app/pages/SkillDevelopment.tsx` (skill management page)
  - `src/app/components/figma/SkillGapAnalysis.tsx` (gap summary card)
  - `src/app/components/figma/SkillProgressionChart.tsx` (time-series line chart)
  - `src/app/components/figma/CourseRecommendations.tsx` (recommended courses list)
  - `src/lib/services/skillRecommendationService.ts` (course matching logic)
  - `src/lib/services/skillSnapshotService.ts` (monthly snapshot creation)

- **Files to Modify:**
  - `src/app/components/figma/SkillRadarChart.tsx` (add target overlay rendering)
  - `src/lib/services/careerPathService.ts` (add `validatePrerequisites()` method)
  - `src/db/schema.ts` (add Dexie v10: `skill_targets`, `skill_snapshots` tables)
  - `src/app/routes.tsx` (add `/skill-development` route)

**Effort:** 10 hours

---

### Story 20.7: Flashcard Management & Organization

**User Story:**
As a learner with a large flashcard collection,
I want to organize cards with tags, search/filter them, and import/export decks,
So that I can efficiently manage my flashcards and migrate data when needed.

**Acceptance Criteria:**

**AC1: Tag System for Flashcards**
**Given** I am creating a new flashcard
**When** The flashcard dialog opens
**Then** I see a tag input field (reusing the note tag system from FR22)
**And** I can add multiple tags (e.g., `#react`, `#hooks`, `#frontend`)
**And** Tags are saved to the `flashcards` table `tags` field (JSON array)
**And** Tags appear as badges on the flashcard review screen

**AC2: Filter Review Queue by Tag**
**Given** I have flashcards with various tags
**When** I navigate to the Flashcards page
**Then** I see a tag filter dropdown above the review queue
**And** I can select one or more tags to filter the queue
**And** Only flashcards matching the selected tags are shown
**And** The queue progress indicator updates: "3 of 7 cards reviewed (filtered by #react)"

**AC3: Search Flashcards by Content**
**Given** I am on the Flashcard Library page (new)
**When** I enter a search query in the search bar
**Then** A full-text search runs on front and back content
**And** Matching flashcards are displayed with highlighted search terms
**And** The search results show: front preview, tags, difficulty, next review date

**AC4: Advanced Filters**
**Given** I am viewing the Flashcard Library
**When** I open the filter panel
**Then** I can filter flashcards by:
  - Tag (multi-select)
  - Course (dropdown)
  - Difficulty (Easy/Medium/Hard)
  - Next review date (Today/This Week/Overdue)
**And** Filters can be combined (e.g., "Show all Hard cards from React course due this week")

**AC5: Bulk Import from CSV**
**Given** I have a CSV file with columns: `front`, `back`, `tags` (comma-separated)
**When** I click "Import Cards" and upload the CSV
**Then** The system validates the CSV format before import
**And** An import summary appears: "45 cards imported successfully, 2 skipped (invalid format)"
**And** Imported cards are created in IndexedDB with initial FSRS state (interval = 1 day)

**AC6: Bulk Export to CSV/JSON**
**Given** I am on the Flashcard Library page
**When** I click "Export Deck"
**Then** A modal opens with format options (CSV or JSON)
**And** I can select cards to export (All / Filtered / Selected)
**And** The export includes:
  - Front and back content
  - Tags
  - FSRS metadata (easeFactor, interval, nextReviewDate, reviewHistory)
**And** The exported file satisfies NFR67: ≥95% semantic fidelity on re-import

**AC7: Card Templates**
**Given** I am creating a new flashcard
**When** I click "Use Template" in the create dialog
**Then** I see template options:
  - **Definition:** Front = "Term", Back = "Definition"
  - **Code Snippet:** Front = "What does this code do?", Back = "```code block```"
  - **Question/Answer:** Front = "Question?", Back = "Answer."
**And** Selecting a template pre-fills the front/back fields with formatted placeholders
**And** I can customize the content before saving

**AC8: Card Difficulty Prediction**
**Given** I have flashcards with review history (10+ reviews)
**When** I view the Flashcard Library
**Then** Each card displays a difficulty badge:
  - **Easy:** Green badge (FSRS interval ≥7 days)
  - **Medium:** Yellow badge (FSRS interval 2-6 days)
  - **Hard:** Red badge (FSRS interval ≤1 day)
**And** I can sort/filter cards by predicted difficulty
**And** The difficulty prediction updates after each review

**Technical Notes:**
- **Data Model:**
  ```typescript
  interface FlashcardWithTags extends Flashcard {
    tags: string[]  // Added to existing Flashcard interface
  }

  interface FlashcardImport {
    front: string
    back: string
    tags?: string  // Comma-separated (CSV) or array (JSON)
  }

  interface FlashcardExport {
    front: string
    back: string
    tags: string[]
    fsrsMetadata: {
      easeFactor: number
      interval: number
      nextReviewDate: string
      reviewHistory: ReviewHistoryEntry[]
    }
  }

  type CardDifficulty = 'easy' | 'medium' | 'hard'
  ```

- **Files to Create:**
  - `src/app/pages/FlashcardLibrary.tsx` (browse/manage cards page)
  - `src/app/components/figma/FlashcardSearch.tsx` (search bar + filters)
  - `src/app/components/figma/CardTemplateSelector.tsx` (template picker modal)
  - `src/lib/services/flashcardImportService.ts` (CSV/JSON import logic)
  - `src/lib/services/flashcardExportService.ts` (export with fidelity validation)

- **Files to Modify:**
  - `src/app/pages/Flashcards.tsx` (add tag filter dropdown to review queue)
  - `src/db/schema.ts` (add `tags: '++, *tags'` index to `flashcards` table)
  - `src/lib/services/fsrsService.ts` (add `predictDifficulty(card: Flashcard): CardDifficulty`)
  - `src/app/components/figma/ReviewCard.tsx` (display tags on review screen)

**Effort:** 6 hours

---

## Success Metrics

**Phase 3 (Strategic Features - E20-S01, E20-S02, E20-S05, E20-S06, E20-S07):**
- 25%+ of users enroll in at least one Career Path
- 40-60% higher completion for users in Career Paths vs. ad-hoc learners
- 20%+ of users create flashcards
- 35% higher retention for flashcard users (compared to non-users)
- 15%+ of users configure FSRS desired retention rate (E20-S05)
- 50%+ of flashcard users export their decks within 6 months (data portability validation, E20-S07)
- 30%+ of users set skill proficiency targets (E20-S06)
- 60%+ of users in career paths meet skill prerequisites within target timeframe (E20-S06)

**Phase 5 (Polish & Analytics - E20-S03, E20-S04, E20-S05):**
- 50%+ of users view unified Analytics dashboard monthly
- 30%+ of users reference Skill Radar
- 20%+ of users track historical skill progression (E20-S06)
- Visualizations motivate consistent study habits
- 40%+ of users check FSRS performance metrics monthly (E20-S05)

## Risks & Mitigations

**Risk 1: Scope Increase (38h → 62h)**
- **Impact:** Epic duration extends from 4-5 weeks to 6-8 weeks
- **Mitigation:** All 3 new stories address critical gaps identified by industry research; prioritize E20-S05 and E20-S06 if timeline is constrained

**Risk 2: Career Paths curation burden**
- **Mitigation:** Start with 3-5 paths; gather user feedback before expanding

**Risk 3: Flashcard SRS algorithm complexity**
- **Mitigation:** Use battle-tested `ts-fsrs` library (wrapper around proven SM-2/FSRS algorithm); FSRS config (E20-S05) only exposes high-level parameters (desired retention rate)

**Risk 4: Flashcard integration with Epic 11**
- **Mitigation:** Consider merging E20-S02 into Epic 11-1 (spaced-review-system) to avoid duplication

**Risk 5: FSRS Optimization Requires 1,000+ Reviews**
- **Impact:** Users won't see optimization benefits until significant usage
- **Mitigation:** Default FSRS weights are effective; optimization is a progressive enhancement (E20-S05 tracks progress clearly)

**Risk 6: Skill Gap Analysis Accuracy**
- **Impact:** Simple proficiency calculation may not reflect true skill level
- **Mitigation:** Start with basic calculation `(completed / total) × 100`; gather user feedback; enhance with ML-based recommendations in future epic

## Dependencies & Integration

**Sequential Dependencies:**
- E20-S02 (Flashcards) depends on existing Notes system (Epic 3)
- E20-S05 (Analytics Dashboard) depends on E20-S03 (Heatmap) and E20-S04 (Radar Chart) being implemented first
- E20-S06 (Skill Development) depends on E20-S04 (Radar Chart) for visualization
- E20-S07 (Flashcard Management) extends E20-S02 (Flashcard Review)

**Parallel Opportunities:**
- E20-S01 and E20-S02 can be implemented in parallel (independent features)
- E20-S03 and E20-S04 can be implemented in parallel (independent analytics components)
- E20-S06 and E20-S07 can be implemented in parallel after their dependencies complete

**Integrates With:**
- Epic 3 (Notes): Flashcard creation from notes (E20-S02, E20-S07)
- Epic 4 (Progress): Course completion data for paths (E20-S01, E20-S06)
- Epic 8 (Analytics): Session data for heatmap and velocity metrics (E20-S03, E20-S05)
- Epic 9B (AI Features): AI-generated paths and skill recommendations (future enhancement to E20-S01, E20-S06)

**New Infrastructure:**
- Dexie schema v9-v10: `fsrs_config`, `velocity_metrics`, `skill_targets`, `skill_snapshots`
- Export/import services for data portability (NFR63/65/67 compliance)

## Acceptance Criteria

Epic is considered **complete** when:
- [ ] All 7 stories reach "done" status
- [ ] E20-S01: Career Paths - 3-5 curated paths seeded in IndexedDB with prerequisite enforcement
- [ ] E20-S02: Flashcards - `ts-fsrs` algorithm tested with 100+ review cycles
- [ ] E20-S03: Heatmap - 365 days displayed correctly with accurate study time data
- [ ] E20-S04: Skill Radar - 5-7 skills calculated accurately from course tags
- [ ] E20-S05: FSRS Config & Analytics - Unified dashboard displays all analytics, FSRS config working, data export validated
- [ ] E20-S06: Skill Development - Target proficiency goals, gap analysis, course recommendations functional
- [ ] E20-S07: Flashcard Management - Tags, search/filter, bulk import/export operational with ≥95% fidelity
- [ ] Data portability compliance: NFR63/65/67 validated through export/import tests
- [ ] E2E tests pass for all 7 stories
- [ ] Epic retrospective conducted with focus on research-driven feature development
