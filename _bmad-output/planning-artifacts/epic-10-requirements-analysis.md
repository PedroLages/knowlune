---
stepsCompleted: ['step-01-validate-prerequisites']
inputDocuments:
  - 'docs/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - 'docs/planning-artifacts/epic-21-engagement-adaptive-experience.md'
  - 'docs/planning-artifacts/epic-20-learning-pathways.md'
  - '_bmad-output/planning-artifacts/epics.md'
epicFocus: 'Epic 10: Onboarding & First-Use Experience'
currentState: 'Epic 10 exists with 2 stories - refinement mode'
---

# Epic 10 Requirements Analysis & Gap Assessment

## Current Epic 10 Stories (From epics.md)

### Story 10.1: First-Use Onboarding Flow
**Current Scope:**
- 4-step guided onboarding checklist (Import → Watch → Note → Dashboard)
- Contextual tooltips with progressive reveal
- Micro-celebrations with reduced motion support
- Skip option
- IndexedDB persistence of onboarding completion flag
- Accessibility: role="list", aria-labels, keyboard navigation

### Story 10.2: Empty State Guidance
**Current Scope:**
- Empty states for: course library, notes, challenges, reports
- Each empty state has: illustration + heading + description + CTA
- Direct navigation to relevant actions
- Warm, encouraging copy (sentence case, "you/your" voice)
- Fast transitions (<300ms)

---

## Functional Requirements Coverage for Epic 10

### Primary FRs (Directly Related to Onboarding)

**FR96: System can display onboarding prompts during first use**
- ✅ **COVERED** by Story 10.1 (4-step onboarding checklist)
- Requirement: Guide through importing course, starting session, creating challenge
- Current Implementation: Matches exactly

**FR95: User can resume their last study session from "Continue Learning" action**
- ⚠️ **PARTIALLY RELATED** - Not an onboarding feature per se, but critical for "Arrive → Act" loop in first use
- Question: Should Epic 10 include a story for implementing the "Continue Learning" CTA on dashboard?
- Current State: Not explicitly covered in Epic 10 stories

### Supporting FRs (Enhanced by Good Onboarding)

**FR1-FR6: Course Library Management**
- Onboarding should guide through FR1 (import course folders)
- ✅ Covered in Story 10.1 step 1

**FR7-FR13: Content Consumption**
- Onboarding should guide through FR7 (play video)
- ✅ Covered in Story 10.1 step 2

**FR20-FR27: Note Management**
- Onboarding should guide through FR20 (create notes)
- ✅ Covered in Story 10.1 step 3

**FR32-FR35: Learning Challenges**
- Onboarding guides through FR32 (create challenge)
- ✅ Covered in Story 10.1 (mentioned in user story)
- ❌ **GAP**: Story 10.1 ACs only cover steps 1-4 (import, watch, note, dashboard) but DON'T include creating a challenge as a step
- **Issue**: User story says "creating a learning challenge" but ACs end at "Check your dashboard" (step 4)

---

## Non-Functional Requirements Coverage for Epic 10

### Critical NFRs for Onboarding

**NFR18: Core workflows completable in 2 minutes without documentation**
- ✅ **ADDRESSED** by Stories 10.1 + 10.2
- Story 10.1 ensures guided first-use
- Story 10.2 ensures contextual help via empty states

**NFR19: Primary tasks in under 3 clicks**
- ✅ **ADDRESSED** by Story 10.2 (CTAs link directly to actions)
- Each empty state CTA navigates directly without intermediate steps

**NFR17: Resume last session within 1 click**
- ⚠️ **NOT COVERED** in Epic 10
- This is FR95 functionality - should there be a story for this?

**NFR36-NFR49: Accessibility Requirements**
- ✅ **ADDRESSED** in Story 10.1 ACs (role, aria-labels, keyboard nav, reduced motion)
- ✅ **ADDRESSED** in Story 10.2 (semantic structure implied)

**NFR1-NFR2: Performance (Load time, Navigation)**
- ✅ **ADDRESSED** in Story 10.2 (transitions <300ms)
- Question: Should onboarding checklist have performance ACs? (e.g., tooltip render <200ms)

---

## UX Design Specification Requirements

### The Daily Return Loop
**Arrive → See momentum in <2 seconds**
- ⚠️ **PARTIALLY COVERED**: Story 10.1 shows dashboard in step 4, but doesn't specify what "momentum" looks like for first-time users
- Question: Should there be a story about "First Dashboard View" showing meaningful data even with minimal usage?

**Act → One click to resume**
- ❌ **NOT COVERED**: FR95 "Continue Learning" action not in Epic 10

**Close → See today's impact**
- ⚠️ **IMPLICIT**: Dashboard view (step 4) would show this, but no specific AC about it

### Critical Success Moments for Onboarding

**"First course import" moment**
- ✅ **COVERED** by Story 10.1 step 1 + Story 10.2 empty state
- Success feel: "That was easy — my course is here"

**"First study session" moment**
- ✅ **COVERED** by Story 10.1 step 2
- But: No AC about session quality (did they just click play and skip, or actually watch?)

**"Dashboard after setup" moment**
- ⚠️ **PARTIALLY COVERED**: Story 10.1 step 4 shows dashboard, but no AC about what makes it valuable for first-time users
- Success feel: "Clear next action, not overwhelming"

### Onboarding Philosophy (from UX Spec)

**Checklist-based onboarding > product tours**
- ✅ **IMPLEMENTED** in Story 10.1

**Contextual tooltips when user reaches each feature organically**
- ✅ **IMPLEMENTED** in Story 10.1 (ContextualTooltip component)

**Progressive disclosure (don't overwhelm on first load)**
- ✅ **IMPLEMENTED** in Story 10.1 (step-by-step reveal)
- ✅ **IMPLEMENTED** in Story 10.2 (empty states instead of overwhelming full UI)

---

## Architecture Requirements for Epic 10

### State Management
**Pattern**: Zustand store with individual selectors
- **Required**: `useOnboardingStore` or integrate into existing store
- **Data**: `{ isOnboardingComplete: boolean, currentStep: number, skippedAt?: string }`
- ✅ **IMPLICIT** in Story 10.1 (mentions IndexedDB persistence)

### Data Persistence
**Pattern**: Dexie schema migration
- **Required**: New table or field for onboarding state
- **Schema**: `onboarding: { id: 'singleton', isComplete: boolean, completedAt?: string, skippedAt?: string, currentStep: number }`
- ✅ **IMPLICIT** in Story 10.1 (mentions "completion flag persisted to IndexedDB")

### Component Architecture
**Required Components**:
1. `OnboardingChecklist` - ✅ Mentioned in Story 10.1
2. `ContextualTooltip` - ✅ Mentioned in Story 10.1
3. `EmptyState` (per-section variant) - ✅ Mentioned in Story 10.2
4. `MicroCelebration` - ✅ Mentioned in Story 10.1 (checkmark animation)

**Component Library**: shadcn/ui
- Question: Which existing components can be reused? (Dialog, Tooltip, Card, Badge?)

### Accessibility
**WCAG 2.2 AA mandatory**
- ✅ **ADDRESSED** in Story 10.1 ACs
- Questions:
  - Are all empty states keyboard accessible? (Story 10.2 doesn't have accessibility ACs)
  - Do tooltips follow ARIA Authoring Practices Guide tooltip pattern?

---

## Gap Assessment

### 🔴 CRITICAL GAPS

1. **Story 10.1 AC Mismatch**
   - **Issue**: User story mentions "creating a learning challenge" but ACs only cover 4 steps (import, watch, note, dashboard) without a challenge creation step
   - **Impact**: User story promise not fulfilled
   - **Fix**: Add step 5 "Create a challenge" or clarify that challenge is shown on dashboard as next action

2. **FR95 "Continue Learning" Not Covered**
   - **Issue**: Critical for "Arrive → Act" loop, but no story in Epic 10
   - **Impact**: First-time users won't see the primary CTA on subsequent visits
   - **Fix**: Add Story 10.3 or integrate into Story 10.1 step 4 (dashboard view)

### 🟡 MODERATE GAPS

3. **Empty State Accessibility Missing**
   - **Issue**: Story 10.2 has no accessibility ACs (keyboard nav, ARIA, screen reader support)
   - **Impact**: May fail NFR47 (Lighthouse 100) and NFR48 (keyboard-only workflows)
   - **Fix**: Add accessibility ACs to Story 10.2

4. **First Dashboard View Not Optimized for First-Time Users**
   - **Issue**: Story 10.1 step 4 "Check your dashboard" has no AC about what the dashboard shows for minimal data
   - **Impact**: Dashboard might feel empty/underwhelming after setup
   - **Fix**: Add AC about first-dashboard state (show one course, zero sessions, encouragement message)

5. **Performance ACs Missing for Onboarding**
   - **Issue**: No performance criteria for checklist, tooltips, or celebrations
   - **Impact**: May fail NFR2 (navigation <200ms) if onboarding components are slow
   - **Fix**: Add performance ACs (checklist load <200ms, tooltip render <100ms)

### 🟢 MINOR GAPS

6. **Empty State for Bookmarks Not Mentioned**
   - **Issue**: Story 10.2 covers course library, notes, challenges, reports — but not bookmarks (FR45)
   - **Impact**: Inconsistent empty state experience
   - **Fix**: Add bookmarks empty state to Story 10.2

7. **Empty State for Study History Calendar Not Mentioned**
   - **Issue**: FR29 (visual calendar) would have an empty state for first-time users
   - **Impact**: Missing empty state for streak/calendar section
   - **Fix**: Add calendar empty state to Story 10.2

8. **Onboarding Doesn't Address AI Features**
   - **Issue**: FR48-FR53 (AI features) have no first-use guidance
   - **Impact**: Users might not discover AI features
   - **Note**: Intentional? AI is in Epic 9B, onboarding in Epic 10 — maybe defer AI onboarding to Epic 9B?

---

## Recommended Enhancements

### Option B: Refine Existing Stories

**Story 10.1 Enhancements:**
1. ✅ Fix AC mismatch: Add step 5 "Create your first challenge" OR clarify dashboard shows challenge CTA
2. ✅ Add performance ACs: Checklist load <200ms, tooltip render <100ms, celebration animation <500ms
3. ✅ Add AC for "first dashboard view" content (show progress with minimal data)
4. ✅ Add AC for tooltip positioning (follows element on scroll/layout shift) — already present!

**Story 10.2 Enhancements:**
1. ✅ Add accessibility ACs: keyboard navigation, ARIA labels, screen reader announcements
2. ✅ Add empty states for: bookmarks, study calendar, streak history
3. ✅ Add performance AC: CTA navigation completes <200ms (currently says <300ms, tighten to match NFR2)

### Option C: Create Additional Stories

**Proposed Story 10.3: Continue Learning Dashboard Action**
- Implement FR95 "Continue Learning" CTA on dashboard
- One-click resume to last course/video/position
- Show context (course title, video name, progress %)
- Accessibility: keyboard accessible, ARIA label "Resume {course} at {video} ({progress}%)"
- Performance: Resume loads within 1 second (NFR20)

**Proposed Story 10.4: First-Use Dashboard Optimization**
- Optimize dashboard for users with minimal data (1 course, 0-1 sessions)
- Show encouraging metrics (e.g., "1 course imported, ready to start!")
- Highlight next actions (watch first video, create first note)
- Avoid showing empty charts (or show placeholder with "Start studying to see analytics")

---

## Questions for Pedro

1. **Story 10.1 Challenge Mismatch**: Should we add "Create a challenge" as step 5, or show it as a dashboard CTA in step 4?

2. **FR95 "Continue Learning"**: Should this be Story 10.3 in Epic 10, or does it belong elsewhere (Epic 4 Progress Tracking)?

3. **AI Feature Onboarding**: Should Epic 10 include AI onboarding, or defer to Epic 9B stories?

4. **Empty State Scope**: Should Story 10.2 cover ALL possible empty states (8+ sections), or focus on the 4 core ones (courses, notes, challenges, reports)?

5. **Performance Targets**: Should we tighten Story 10.2 CTA navigation from <300ms to <200ms to match NFR2?

6. **First Dashboard Optimization**: Is Story 10.4 necessary, or is this implicit in Story 10.1 step 4?

---

## Next Steps

Once you answer the questions above, I'll:

1. **Refine Story 10.1** with enhanced ACs (fix challenge mismatch, add performance, add first-dashboard context)
2. **Refine Story 10.2** with accessibility ACs and expanded empty state coverage
3. **Create Story 10.3** (Continue Learning) if you confirm it belongs in Epic 10
4. **Create Story 10.4** (First Dashboard Optimization) if you confirm it's needed
5. **Update epics.md** with all refinements

Ready to proceed when you are!
