---
epic: 'Epic 10: Onboarding & First-Use Experience'
totalStories: 4
researchBased: true
researchAgents: 5
validatedAgainst:
  - 'Onboarding Best Practices (Duolingo, Coursera, Khan Academy)'
  - 'WCAG 2.2 AA Accessibility Standards'
  - 'Empty State Design Patterns (Material Design, SaaS leaders)'
  - 'Mobile/Responsive UX (iOS HIG, Material Design 3)'
  - 'Onboarding Analytics (Amplitude, Mixpanel best practices)'
enhancements:
  story10_1: '+ Step 5 (challenge), +14 accessibility ACs, +9 mobile ACs, +performance ACs'
  story10_2: '+ 2 empty states, +3 accessibility ACs, +3 mobile ACs, performance tightened'
  story10_3: 'NEW - Onboarding analytics & instrumentation'
  story10_4: 'NEW - Mobile onboarding adaptation'
effortEstimate: '28-35 hours (~4-5 days)'
---

# Epic 10: Onboarding & First-Use Experience - Refined Stories

## Overview

This document contains the **refined and enhanced** Epic 10 stories based on comprehensive research from 5 specialized agents. All refinements are **research-validated** and address critical gaps in accessibility, mobile support, and analytics.

---

## Story 10.1: First-Use Onboarding Flow (ENHANCED)

**Original Scope:** 4-step onboarding (import → watch → note → dashboard)
**Enhanced Scope:** 5-step onboarding + accessibility + mobile + performance
**Effort Estimate:** 12-15 hours (was 5-8 hours)

### User Story

As a first-time user,
I want a guided onboarding flow that walks me through importing a course, starting a study session, taking a note, viewing my dashboard, and creating a learning challenge,
So that I discover the platform's core value immediately without needing documentation and feel confident using all key features.

---

### Acceptance Criteria (Desktop - Core Flow)

#### AC1: Onboarding Trigger & Modal Structure

**Given** I am a new user with no courses imported and no onboarding completion flag in IndexedDB
**When** I land on the dashboard for the first time
**Then** an onboarding modal appears with:
- `role="dialog"` and `aria-modal="true"` (WCAG 2.2 AA)
- `aria-labelledby` pointing to heading "Welcome to LevelUp"
- Keyboard focus moves to the first interactive element (Get Started button)
- A welcome message and a 5-step progress indicator
**And** the steps are:
  1. "Import your first course"
  2. "Watch a lesson"
  3. "Take a note"
  4. "Check your dashboard"
  5. "Create a learning challenge"
**And** step 1 is highlighted as the active step
**And** the progress indicator has `role="progressbar"` with `aria-valuenow="1"`, `aria-valuemin="1"`, `aria-valuemax="5"`
**And** the checklist has `role="list"` with `aria-label="Setup progress: 0 of 5 complete"`

---

#### AC2: Step 1 - Import First Course

**Given** the onboarding is active on step 1 (Import a course)
**When** I view the prompt
**Then** a ContextualTooltip highlights the course import UI element
- Tooltip has `role="tooltip"` (WCAG 2.2 AA)
- Highlighted element has `aria-describedby` pointing to tooltip ID
- Tooltip appears on **both hover AND keyboard focus**
**And** I see a clear call-to-action directing me to the import workflow
**And** a "Skip setup" option is visible with `aria-label="Skip onboarding and go to dashboard"`
**And** the tooltip has a "Got it" dismiss action
**And** pressing **Escape key** dismisses the tooltip

**Given** I have completed step 1 by importing a course
**When** the import finishes successfully
**Then** a micro-celebration plays (checkmark animation, **respecting `prefers-reduced-motion`**)
**And** the checklist advances to step 2 "Watch a lesson"
**And** the progress bar updates:
- `aria-valuenow="2"`
- `aria-label` updates to "Setup progress: 1 of 5 complete"
- A `role="status"` element announces "Step 1 complete. Moving to step 2: Watch a lesson" (screen readers)
**And** a ContextualTooltip highlights the video player area

---

#### AC3: Step 2 - Watch First Lesson

**Given** I have completed step 2 by watching a video for at least 5 seconds
**When** the session registers
**Then** a micro-celebration plays (respecting `prefers-reduced-motion`)
**And** the checklist advances to step 3 "Take a note"
**And** progress updates to `aria-valuenow="3"` with status announcement
**And** the note editor area is highlighted with a ContextualTooltip

---

#### AC4: Step 3 - Take First Note

**Given** I have completed step 3 by creating a note
**When** the note is saved
**Then** the checklist advances to step 4 "Check your dashboard"
**And** progress updates to `aria-valuenow="4"`
**And** the dashboard overview area is highlighted

---

#### AC5: Step 4 - View Dashboard (Enhanced with Minimal Data Handling)

**Given** I have completed step 4 by viewing the dashboard
**When** I scroll through the overview
**Then** a congratulatory message appears with `role="status"` and `aria-atomic="true"`: "Great start! You've set up your learning workspace."
**And** the dashboard displays my first session data with **encouraging framing**:
- "You've started your learning journey!" (positive message)
- Streak counter shows "1 day" with visual indicator
- Course progress shows "[Course Name] - X% complete" with progress bar
- **"Continue Learning" CTA** is prominently displayed (links to Epic 4 Story 4-5 functionality)
- Empty or minimal charts show placeholder content with message: "Your analytics will appear here as you study"
**And** the checklist advances to step 5 "Create a learning challenge"
**And** the challenges section is highlighted

---

#### AC6: Step 5 - Create First Learning Challenge (NEW)

**Given** I am on step 5 (Create a learning challenge)
**When** I view the challenges section
**Then** a ContextualTooltip guides me to the challenge creation workflow
**And** I can create a challenge by specifying name, target metric, target value, and deadline (per FR32)

**Given** I have completed step 5 by creating a challenge
**When** the challenge is saved
**Then** a final congratulatory message appears: "Onboarding complete! You're ready to start learning."
**And** the onboarding completion flag is persisted to IndexedDB
**And** the onboarding modal dismisses
**And** the onboarding does not reappear on subsequent visits
**And** an **onboarding completion badge** is awarded (triggers micro-celebration)

---

#### AC7: Skip Functionality & Focus Management

**Given** the onboarding flow is active on any step
**When** I click "Skip setup" or press **Escape key**
**Then** the onboarding modal dismisses immediately
**And** the completion flag is persisted as "skipped" (not "completed")
**And** keyboard focus returns to the element that triggered onboarding
**And** the onboarding does not reappear on subsequent visits

**Given** the onboarding modal is open
**When** I press **Tab** key
**Then** focus is **trapped within the modal** (cycles through modal elements only)
**And** pressing **Tab** from the last element returns focus to the first element
**And** pressing **Shift+Tab** from the first element moves focus to the last element

---

#### AC8: Returning User Behavior

**Given** I previously completed or skipped onboarding
**When** I return to the dashboard
**Then** no onboarding modal appears
**And** the app loads directly into the normal dashboard view

---

#### AC9: Tooltip Positioning & Layout Shifts

**Given** the onboarding flow is active
**When** I interact with the highlighted UI element for the current step
**Then** the ContextualTooltip follows the element correctly even if the layout shifts or scrolls
**And** the tooltip is not fully obscured by sticky/fixed content (WCAG 2.4.11)
**And** the rest of the UI remains accessible but visually de-emphasized (overlay with reduced opacity)

---

### Acceptance Criteria (Accessibility - WCAG 2.2 AA)

#### AC-A1: Reduced Motion Support

**Given** I have `prefers-reduced-motion: reduce` enabled in my OS settings
**When** the onboarding transitions between steps
**Then** all animations are disabled or replaced with simple opacity fades
**And** the congratulatory confetti animation does not play
**And** a static success checkmark is shown instead

---

#### AC-A2: Focus Visibility

**Given** the onboarding spotlight is highlighting an element
**When** I focus that element with the keyboard
**Then** the focus indicator is visible and not obscured by the spotlight overlay
**And** the focus indicator has a minimum **2px outline** with **3:1 contrast** (WCAG 2.4.7, 2.4.13)

---

#### AC-A3: Screen Reader Compatibility

**Given** I am using a screen reader (NVDA, JAWS, VoiceOver)
**When** I navigate through the onboarding flow
**Then** all progress updates are announced via `role="status"` live regions
**And** all tooltips are announced when the associated element receives focus
**And** all interactive elements have clear, descriptive labels
**And** the modal dialog is announced as "dialog, Welcome to LevelUp"

---

### Acceptance Criteria (Mobile/Responsive - Touch Devices)

#### AC-M1: Mobile Breakpoint Adaptation (< 640px)

**Given** I am on a mobile device (viewport < 640px)
**When** the onboarding flow is active
**Then** the onboarding container is displayed as a **full-screen bottom sheet** (Material Design 3 pattern)
**And** the progress indicator shows **vertical dots** in the bottom-right corner with "Step 1 of 5" text
**And** the "Skip onboarding" button is positioned in the **bottom-left** (thumb zone)

---

#### AC-M2: Touch Target Sizing

**Given** I am on a mobile or tablet device (viewport < 1024px)
**When** interactive elements are displayed in the onboarding flow
**Then** all buttons and tappable areas are **≥44x44px** (iOS HIG minimum)
**And** spacing between adjacent interactive elements is **≥8px**
**And** the primary CTA is in the **bottom 30% of the screen** (thumb-friendly zone)

---

#### AC-M3: Mobile Tooltip Replacement

**Given** I am on a mobile device (viewport < 640px)
**When** a tooltip should appear to guide me
**Then** a **modal bottom sheet** appears instead of a tooltip
**And** the bottom sheet contains:
- A screenshot or illustration of the highlighted area
- Instructional text ("Tap 'Import Course' to add your first course")
- A "Got it" button (≥44x44px)
**And** tapping "Got it" advances to the next step

---

#### AC-M4: File System API Fallback (Mobile BLOCKER Fix)

**Given** I am on a mobile device OR non-Chromium desktop browser
**When** the onboarding flow reaches step 1 (Import a course)
**Then** a message appears:
- "Course import requires Chrome/Edge on desktop. Try our demo course instead!"
**And** a "Load Demo Course" button appears (≥44x44px)
**And** clicking "Load Demo Course" imports a sample course automatically
**And** the onboarding advances to step 2 (Start studying)
**And** the demo course is clearly labeled "Demo Course (Sample)" in the course library
**And** the demo course can be deleted like any other course

---

#### AC-M5: Tablet Sidebar Handling (640-1023px)

**Given** I am on a tablet device (viewport 640-1023px)
**When** the onboarding flow starts
**Then** the sidebar is automatically closed (`localStorage.setItem('eduvi-sidebar-v1', 'false')`)
**And** the sidebar remains closed until onboarding completes
**And** after onboarding, the sidebar state is restored to user preference

---

#### AC-M6: Haptic Feedback (Progressive Enhancement)

**Given** I am on a mobile device with vibration support
**When** I complete an onboarding step
**Then** haptic feedback (short vibration, ~50ms) confirms the action
**And** if vibration is not supported, no error occurs (graceful degradation)

---

### Acceptance Criteria (Performance)

#### AC-P1: Component Load Time

**Given** the onboarding modal is triggered
**When** it first appears
**Then** the modal renders within **<200ms** (NFR2 compliance)
**And** the first tooltip appears within **<100ms** of step activation

---

#### AC-P2: Celebration Animation Performance

**Given** a micro-celebration animation plays
**When** a step is completed
**Then** the animation completes within **<500ms**
**And** the animation does not block UI interactions
**And** if `prefers-reduced-motion` is enabled, the "animation" is a static checkmark (renders <50ms)

---

### Technical Notes

**Components to Create:**
- `OnboardingModal` (desktop: Dialog, mobile: BottomSheet)
- `OnboardingProgress` (progressbar with aria attrs)
- `ContextualTooltip` (desktop: tooltip with arrow, mobile: bottom sheet)
- `MicroCelebration` (confetti animation with reduced motion support)
- `DemoCourseLoader` (imports sample course for mobile/non-Chromium users)

**Zustand Store:**
```typescript
interface OnboardingStore {
  isComplete: boolean
  isSkipped: boolean
  currentStep: number // 1-5
  completedSteps: string[] // ['import', 'watch', 'note', 'dashboard', 'challenge']
  completionTimestamp?: string
}
```

**IndexedDB Schema (Dexie):**
```typescript
// Add to existing schema
onboarding: {
  id: 'singleton',
  isComplete: boolean,
  isSkipped: boolean,
  currentStep: number,
  completedAt?: string,
  skippedAt?: string
}
```

---

## Story 10.2: Empty State Guidance (ENHANCED)

**Original Scope:** 4 empty states (courses, notes, challenges, reports)
**Enhanced Scope:** 6 empty states + accessibility + mobile
**Effort Estimate:** 6-8 hours (was 4-6 hours)

### User Story

As a new or returning user viewing a section with no content,
I want contextual empty states that explain what belongs here, provide clear next steps, and are accessible to all users,
So that I always know my next action and can complete core workflows within 2 minutes without documentation.

---

### Acceptance Criteria (Core Empty States)

#### AC1: Empty Course Library

**Given** I have no courses imported
**When** I view the dashboard overview or courses page
**Then** an EmptyState component is displayed with:
- **Icon:** Folder or book icon (Lucide)
- **Heading:** "No courses yet" (semantic `<h2>` element)
- **Description:** "Import your first course to get started" (warm, encouraging tone)
- **CTA Button:** "Import Course" (semantic `<button>` or `<Link>` element)
**And** the CTA links directly to the course import workflow
**And** the empty state uses design tokens (`bg-brand-soft`, `text-brand`)
**And** the empty state follows voice guidelines (sentence case, "you/your" not "the user")

---

#### AC2: Empty Notes Section

**Given** I have no notes recorded
**When** I view the notes section or notes panel
**Then** an empty state is displayed with:
- **Icon:** NotebookPen or StickyNote icon
- **Heading:** "No notes yet"
- **Description:** "Start taking notes while watching lessons to capture key moments"
- **CTA Button:** "Start Learning" (links to course library)
**And** the empty state briefly describes what notes are for
**And** the empty state is within a `<section>` with `aria-labelledby` pointing to heading

---

#### AC3: Empty Learning Challenges

**Given** I have no learning challenges created
**When** I view the challenges section
**Then** an empty state is displayed with:
- **Icon:** Trophy or Target icon
- **Heading:** "No challenges yet"
- **Description:** "Create your first learning challenge to set concrete learning goals"
- **CTA Button:** "Create Challenge" (opens challenge creation flow)
**And** the empty state briefly describes the value of challenges (motivation, accountability)

---

#### AC4: Empty Study Sessions / Reports

**Given** I have no study sessions recorded
**When** I view the reports or activity section
**Then** an empty state is displayed with:
- **Icon:** BarChart or Activity icon
- **Heading:** "No study sessions yet"
- **Description:** "Your learning analytics will appear here as you study"
- **CTA Button:** "Browse Courses" (links to course library)
**And** the empty state message guides me to start studying

---

#### AC5: Empty Bookmarks (NEW)

**Given** I have no bookmarked lessons
**When** I view the bookmarks page
**Then** an empty state is displayed with:
- **Icon:** Bookmark icon
- **Heading:** "No bookmarks yet"
- **Description:** "Bookmark important lessons while watching to revisit them later"
- **CTA Button:** "Start Learning" (links to course library)
**And** the empty state explains the bookmarking feature (FR45)

---

#### AC6: Empty Study Calendar / Streak History (NEW)

**Given** I have no study history (0 study days)
**When** I view the study calendar or streak history section
**Then** an empty state is displayed with:
- **Icon:** Calendar or Flame icon
- **Heading:** "No study history yet"
- **Description:** "Complete your first study session to start tracking your learning streak"
- **CTA Button:** "Start Studying" (links to course library)
**And** the empty state encourages starting the first session

---

### Acceptance Criteria (Interaction & Navigation)

#### AC7: CTA Direct Navigation

**Given** any empty state is displayed
**When** I click the call-to-action button
**Then** I am navigated to the correct destination for that action **without intermediate steps**
**And** the transition completes within **<200ms** (tightened from 300ms per NFR2)
**And** no modal or dialog appears (direct navigation unless action requires input)

---

### Acceptance Criteria (Accessibility - WCAG 2.2 AA)

#### AC-A1: Semantic HTML Structure

**Given** an empty state is displayed
**When** a screen reader navigates to the section
**Then** the empty state uses **semantic HTML**:
- Container: `<section aria-labelledby="heading-id">`
- Heading: `<h2>` or `<h3>` element (not styled `<div>`)
- CTA: `<button>` or `<a>` element (not `<div>` with `onClick`)
**And** decorative icons have `alt=""` or `aria-hidden="true"`

---

#### AC-A2: Keyboard-Accessible CTAs

**Given** an empty state CTA button is displayed
**When** I navigate with keyboard only
**Then** the button is reachable via **Tab** key
**And** pressing **Enter** or **Space** activates the action
**And** the button has a visible focus indicator with **4.5:1 contrast**
**And** the button has descriptive `aria-label` if needed (e.g., "Import your first course to get started")

---

#### AC-A3: Keyboard-Only Workflow Completion

**Given** I am a new user with no courses imported
**When** I complete the entire core workflow using **only keyboard navigation** (no mouse)
**Then** all actions (import course, start session, create challenge) are completable
**And** no mouse/pointer interaction is required at any step
**And** the sequence is completable within **2 minutes** via keyboard alone (NFR18)

---

### Acceptance Criteria (Mobile/Responsive)

#### AC-M1: Mobile CTA Sizing

**Given** I am on a mobile or tablet device (viewport < 1024px)
**When** an empty state CTA is displayed
**Then** the button is **≥44x44px** in size (iOS HIG minimum)
**And** the button has **≥8px spacing** from adjacent elements

---

#### AC-M2: Thumb Zone CTA Placement

**Given** I am on a mobile device (viewport < 640px)
**When** an empty state with a primary CTA is displayed
**Then** the CTA is positioned in the **bottom 30% of the container** (thumb-friendly zone)
**Or** the empty state uses a bottom sheet layout with the CTA at the bottom

---

#### AC-M3: File System API Empty State Variant (Mobile)

**Given** I am on a mobile device OR non-Chromium browser
**When** I view the "no courses" empty state
**Then** the message is:
- "Import courses from Chrome/Edge on desktop, or try our demo course"
**And** the CTA button text is **"Load Demo Course"** (not "Import Course")
**And** clicking the CTA loads the sample course without file system access

---

### Technical Notes

**Reusable Component:**
```typescript
// src/app/components/ui/empty-state.tsx (already exists - ensure compliance)
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  variant?: 'default' | 'mobile-demo' // NEW for mobile File System API fallback
}
```

**Design Token Compliance:**
- Use `bg-brand-soft` for background tint
- Use `text-brand` for CTA buttons
- Avoid hardcoded colors (ESLint enforces this)

---

## Story 10.3: Onboarding Analytics & Instrumentation (NEW)

**Priority:** High
**Effort Estimate:** 3-4 hours

### User Story

As a product manager,
I want to track onboarding metrics and user activation,
So that I can measure onboarding effectiveness, identify drop-off points, and optimize the flow for higher completion and retention rates.

---

### Acceptance Criteria

#### AC1: Core Onboarding Events Tracked

**Given** a user starts the onboarding flow
**When** they interact with onboarding steps
**Then** the following events are logged with timestamps:
- `onboarding_started` (user begins flow)
- `onboarding_step_viewed` (properties: `step_number`, `step_name`)
- `onboarding_step_completed` (properties: `step_number`, `step_name`, `time_spent_seconds`)
- `onboarding_step_skipped` (properties: `step_number`, `step_name`)
- `onboarding_completed` (properties: `total_time_seconds`, `completion_timestamp`)
- `onboarding_abandoned` (properties: `last_step_number`, `time_elapsed_seconds`)

---

#### AC2: Activation Events Tracked

**Given** a user completes onboarding
**When** they perform core actions within 7 days of signup
**Then** the following activation events are logged:
- `first_course_enrolled` (properties: `course_id`, `days_since_signup`)
- `first_study_session` (properties: `session_duration_seconds`, `days_since_signup`)
- `first_streak_milestone` (properties: `streak_days`, `days_since_signup`)
- `dashboard_customized` (properties: `customization_type`, `days_since_signup`)
- `profile_completed` (properties: `fields_completed`, `days_since_signup`)

---

#### AC3: Rich Event Properties Captured

**Given** any onboarding/activation event is logged
**When** the event is stored
**Then** it includes the following properties:
- **User Properties:** `user_id`, `signup_date`, `user_segment` (if available)
- **Event Properties:** `timestamp`, `device_type`, `browser`, `viewport_size`
- **Step-Specific Properties:** As defined in AC1/AC2

---

#### AC4: IndexedDB Event Storage

**Given** an onboarding or activation event occurs
**When** the event is logged
**Then** it is stored in IndexedDB in the `analytics_events` object store
**And** the event includes:
```typescript
{
  event_id: string // UUID
  event_name: string
  timestamp: number // Unix timestamp
  user_id: string
  user_properties: { signup_date, user_segment }
  event_properties: { step_number, device_type, etc. }
}
```
**And** duplicate events are prevented via deduplication (event_id + timestamp)

---

#### AC5: Analytics Dashboard (Admin/Reports Page)

**Given** I navigate to the Reports page (or admin analytics section)
**When** I view the onboarding analytics tab
**Then** I see the following metrics:
- **Onboarding Completion Rate** (last 7/30 days)
- **Average Time-to-Complete** (median, p50/p90)
- **Step-by-Step Funnel** (completion rate per step, drop-off visualization)
- **Activation Rate** (users who performed ≥1 activation event within 7 days)
- **Top Abandonment Points** (which steps have highest exit rate)

---

#### AC6: Privacy & Opt-Out

**Given** a user opts out of analytics tracking (future enhancement)
**When** they interact with onboarding
**Then** no events are logged (respect `do_not_track` preference)
**And** existing events can be deleted if user requests data deletion

---

### Technical Notes

**Event Schema:**
```typescript
interface OnboardingEvent {
  event_id: string
  event_name: string
  timestamp: number
  user_id: string
  user_properties: {
    signup_date: string
    user_segment?: string
  }
  event_properties: {
    step_number?: number
    step_name?: string
    time_spent_seconds?: number
    device_type: 'mobile' | 'tablet' | 'desktop'
    browser: string
    viewport_size: string
  }
}
```

**Analytics Hook:**
```typescript
// src/hooks/useAnalytics.ts
export function useAnalytics() {
  const trackEvent = async (eventName: string, properties: Record<string, any>) => {
    // Save to IndexedDB
    // Future: Send to external analytics service (Amplitude, Mixpanel)
  }
  return { trackEvent }
}
```

**Dexie Schema Addition:**
```typescript
analytics_events: '++id, event_id, event_name, timestamp, user_id'
```

---

## Story 10.4: Mobile Onboarding Adaptation (NEW)

**Priority:** P0 (Blocker) - File System API doesn't work on mobile
**Effort Estimate:** 6-8 hours

### User Story

As a mobile user,
I want a fully functional onboarding experience that works without desktop-only features,
So that I can discover the platform's core value and complete onboarding on any device.

---

### Acceptance Criteria

#### AC1: Demo Course Auto-Creation

**Given** the platform detects I'm on a mobile device or non-Chromium browser
**When** the onboarding flow starts
**Then** a sample "Demo Course" is automatically created in my course library
**And** the demo course includes:
- Title: "LevelUp Demo Course"
- 3-5 sample videos (or video placeholders)
- 1-2 sample PDFs
- Sample course structure (sections/chapters)
- Clearly labeled "Demo Course" badge
**And** the demo course can be deleted like any other course

---

#### AC2: Step 1 Auto-Completion (Mobile)

**Given** I am on a mobile device
**When** the onboarding reaches step 1 (Import a course)
**Then** the step is automatically completed using the demo course
**And** a message appears: "Demo course loaded! On desktop, you can import your own courses."
**And** the onboarding advances to step 2 (Watch a lesson)

---

#### AC3: Full Onboarding Flow Completion (Mobile)

**Given** I am on a mobile device
**When** I complete all 5 onboarding steps using the demo course
**Then** I receive the same onboarding completion badge as desktop users
**And** all features work normally with the demo course (watch, note, dashboard, challenge)

---

#### AC4: Desktop Prompt After Mobile Onboarding

**Given** I completed onboarding on mobile using the demo course
**When** I later visit the platform on a desktop browser
**Then** a one-time prompt appears: "Import your own courses on desktop for the full experience!"
**And** the prompt has a "Import Courses" CTA
**And** the prompt can be dismissed permanently

---

#### AC5: Demo Course Indicators

**Given** I am viewing the demo course in my library
**When** I see the course card
**Then** it displays a "Demo Course" badge
**And** the course description includes: "This is a sample course. Import your own courses on desktop."

---

### Technical Notes

**Demo Course Data:**
```typescript
const DEMO_COURSE = {
  id: 'demo-course-001',
  title: 'LevelUp Demo Course',
  description: 'Sample course to explore LevelUp features',
  status: 'active',
  topic: 'Getting Started',
  isDemoCourse: true, // Flag for special handling
  sections: [
    {
      title: 'Introduction',
      videos: [
        { title: 'Welcome to LevelUp', duration: 120, url: '/demo/welcome.mp4' }
      ]
    }
  ]
}
```

**Browser Detection:**
```typescript
export const supportsFileSystemAccess = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  )
}
```

---

## Summary: Epic 10 Enhancements

| Story | Original Effort | New Effort | Key Additions |
|-------|----------------|------------|---------------|
| **10.1** | 5-8h | 12-15h | +Step 5 (challenge), +14 accessibility ACs, +9 mobile ACs, +performance |
| **10.2** | 4-6h | 6-8h | +2 empty states (bookmarks, calendar), +3 accessibility ACs, +3 mobile |
| **10.3** | N/A | 3-4h | NEW - Analytics & instrumentation |
| **10.4** | N/A | 6-8h | NEW - Mobile demo course adaptation |
| **Total** | **9-14h** | **28-35h** | **~4-5 days of work** |

---

## Research Validation Sources

- **Onboarding Best Practices:** Duolingo, Coursera, Khan Academy, Slack patterns
- **WCAG 2.2 AA:** W3C spec, ARIA Authoring Practices Guide
- **Empty States:** Material Design, Carbon Design, SaaS leaders (Notion, Linear)
- **Mobile UX:** iOS HIG, Material Design 3, mobile-first learning apps
- **Analytics:** Amplitude, Mixpanel, industry benchmarks (40-60% completion rate, <7 days TTFV)

---

## Next Steps

1. Review these refined stories
2. Approve or request modifications
3. I'll update the epics.md file with all refinements
4. Ready to proceed with implementation via `/start-story E10-S01`
