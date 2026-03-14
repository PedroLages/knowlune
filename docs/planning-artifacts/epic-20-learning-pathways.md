# Epic 20: Learning Pathways & Knowledge Retention

## Epic Goal

Provide structured multi-course learning journeys with prerequisites, skill progression tracking, and long-term knowledge retention tools (Career Paths, Flashcards, Analytics Visualizations) to drive course completion rates and enhance LevelUp's core mission of analytics-driven learning.

## Business Value

### Research-Backed Impact
- **40-60% higher completion rates** for users in structured paths vs. ad-hoc learning (industry research)
- **35% higher retention** for flashcard users vs. passive review (proven spaced repetition research)
- **50%+ users** check analytics monthly when visualizations are present (heatmap, radar chart)
- **Addresses key user pain point:** "I don't know what to learn next after completing a course"

### Strategic Opportunity
- **Current State:** LevelUp tracks progress well but lacks learning direction
- **Gap:** No structured learning journeys or long-term retention tools
- **Solution:** Career Paths give momentum scoring DIRECTION; Flashcards ensure knowledge RETENTION

## User Personas

### Primary
- **Directional Learner:** Wants clear path from beginner → advanced (e.g., "Web Development" path)
- **Knowledge Retainer:** Struggles with forgetting concepts after completing courses
- **Analytics Enthusiast:** Loves visualizing progress (heatmap, skill radar)

### Common Needs
- Curated multi-course learning paths with prerequisites
- Active recall system to combat forgetting curve
- Visual analytics to celebrate progress

## Scope

### In Scope
1. **Career Paths System** (Phase 3 - Strategic)
   - Multi-course learning journeys with staged progression
   - Prerequisite enforcement (Stage 2 requires Stage 1)
   - Progress tracking with visual overlays
   - 3-5 curated paths (Web Development, Data Science, Product Design, etc.)

2. **Flashcard System with Spaced Repetition** (Phase 3 - Strategic)
   - Create flashcards from notes (select text → create card)
   - SM-2 algorithm for spaced repetition scheduling
   - Review queue with 3-grade system (Hard/Good/Easy)
   - Integration with existing Notes system

3. **Analytics Visualizations** (Phase 5 - Polish)
   - 365-day activity heatmap (GitHub-style contribution graph)
   - Skill proficiency radar chart (5-7 skills)
   - Calculated from course completion % per skill domain

### Out of Scope
- Community-curated paths (maintain solo-learner focus)
- AI-generated custom paths (deferred to Epic 9B-S03)
- Quiz integration with paths (deferred to Epic 12-18)
- Social features (path sharing, leaderboards)

### Dependencies
- **Epic 3 (Smart Note System):** Complete (flashcard creation from notes)
- **Epic 4 (Progress Tracking):** Complete (course completion data)
- **Epic 8 (Analytics):** Complete (session data for heatmap)

## Stories

| Story ID | Name | Effort | Priority | Phase |
|----------|------|--------|----------|-------|
| **E20-S01** | Career Paths System (Multi-Course Journeys) | 16h | P1 (Strategic) | Phase 3 |
| **E20-S02** | Flashcard System with Spaced Repetition | 12h | P1 (Strategic) | Phase 3 |
| **E20-S03** | 365-Day Activity Heatmap | 4h | P2 (Polish) | Phase 5 |
| **E20-S04** | Skill Proficiency Radar Chart | 6h | P2 (Polish) | Phase 5 |

**Total Effort:** 38 hours over 4 weeks

## Story Summaries

### E20-S01: Career Paths System (Multi-Course Journeys) - 16h

**User Story:**
As a learner without a clear learning direction,
I want to enroll in curated multi-course learning paths (e.g., "Web Development", "Data Science"),
so that I have a structured journey with prerequisites and skill progression tracking.

**Key Features:**
- **List View:** Browse 3-5 curated paths with title, description, course count, estimated hours, progress %
- **Detail View:** Staged progression (Stage 1: Foundations, Stage 2: Frameworks, etc.) with course cards
- **Enrollment:** Click "Start Path" to mark as enrolled in IndexedDB
- **Progress Tracking:** Completed courses show checkmark; overall progress % updates
- **Prerequisites:** Stage 2 locked until Stage 1 complete (with clear messaging)

**Data Model:**
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
```

**Files to Create:**
- `src/app/pages/CareerPaths.tsx` (list view)
- `src/app/pages/CareerPathDetail.tsx` (detail view)
- `src/lib/careerPaths.ts` (data model + progress logic)

**Files to Modify:**
- `src/lib/db.ts` (add Dexie tables: career_paths, path_enrollments)
- `src/app/routes.tsx` (add routes)
- `src/app/components/Layout.tsx` (add "Career Paths" to nav)

**Research Justification:** Industry data shows 40-60% higher completion rates for structured paths vs. ad-hoc learning.

---

### E20-S02: Flashcard System with Spaced Repetition - 12h

**User Story:**
As a learner who forgets concepts after completing courses,
I want to create flashcards from my notes and review them using spaced repetition,
so that I retain knowledge long-term.

**Key Features:**
- **Create from Notes:** Select text in Notes page → "Create Flashcard" button → enter front/back
- **SM-2 Algorithm:** Spaced repetition scheduling (interval increases based on difficulty rating)
- **Review Queue:** Shows flashcards due today with 3-grade system (Hard/Good/Easy)
- **Progress Tracking:** Next review date updates based on rating
- **Integration:** Uses existing IndexedDB via Dexie

**Data Model:**
```typescript
interface Flashcard {
  id: string
  front: string
  back: string
  courseId: string
  easeFactor: number       // SM-2 algorithm state
  interval: number         // Days until next review
  nextReviewDate: string
  difficulty: 'easy' | 'medium' | 'hard'
}
```

**Files to Create:**
- `src/app/pages/Flashcards.tsx` (review interface)
- `src/lib/spacedRepetition.ts` (SM-2 algorithm implementation)

**Files to Modify:**
- `src/lib/db.ts` (add Dexie table: flashcards)
- `src/app/pages/Notes.tsx` (add "Create Flashcard" button)

**Research Justification:** Active recall + spaced repetition → 35% higher retention vs. passive review (proven research).

---

### E20-S03: 365-Day Activity Heatmap - 4h

**User Story:**
As a learner who values consistency,
I want to see a GitHub-style contribution graph of my study activity for the past year,
so that I can visualize my learning habits and identify gaps.

**Key Features:**
- 365-day calendar grid (52 weeks × 7 days)
- 5-level color intensity based on study time per day
- Hover tooltip shows date + hours studied
- Extends existing `StudyStreakCalendar` component

**Data Source:**
- Reuse session data from IndexedDB (Epic 4)
- Aggregate by date: `studyDate → totalDuration`

**Files to Modify:**
- `src/app/pages/Reports.tsx` (add new heatmap section)

**Research Justification:** Visualizations motivate 50%+ of users to check analytics monthly; habit visualization drives consistency.

---

### E20-S04: Skill Proficiency Radar Chart - 6h

**User Story:**
As a learner tracking skill development,
I want to see a spider chart of my proficiency across different domains (Design, Coding, Marketing, etc.),
so that I can identify strengths and areas for improvement.

**Key Features:**
- Radar chart with 5-7 skill axes
- Proficiency calculated from course completion % per skill domain
- Displayed on Overview dashboard
- Uses Recharts library (already installed)

**Skill Taxonomy (Example):**
- Design
- Coding
- Marketing
- Business
- Soft Skills

**Files to Create:**
- `src/app/components/SkillRadarChart.tsx` (Recharts radar component)

**Files to Modify:**
- `src/app/pages/Overview.tsx` (add skill radar section)

**Research Justification:** 30%+ of users reference skill visualizations; pairs well with Career Paths for skill gap identification.

---

## Success Metrics

### Phase 3 (Strategic Features)
- **25%+** of users enroll in at least one Career Path
- **40-60% higher completion** for users in Career Paths vs. ad-hoc learners
- **20%+** of users create flashcards
- **35% higher retention** for flashcard users (compared to non-users)

### Phase 5 (Polish)
- **50%+** of users view Activity Heatmap monthly
- **30%+** of users reference Skill Radar
- **Visualizations** motivate consistent study habits

## Risks & Mitigations

**Risk 1: Career Paths curation burden**
- **Mitigation:** Start with 3-5 paths; gather user feedback before expanding

**Risk 2: Flashcard SRS algorithm complexity**
- **Mitigation:** Use battle-tested SM-2 algorithm (public domain); test with 100+ review cycles

**Risk 3: Flashcard integration with Epic 11**
- **Mitigation:** Consider merging E20-S02 into Epic 11-1 (spaced-review-system) to avoid duplication

## Implementation Timeline

### Sprint 1-2 (Weeks 1-2) - Career Paths
- Week 1: Data model, list page, detail page - 10 hours
- Week 2: Enrollment logic, progress tracking, prerequisites - 6 hours
- **Outcome:** Structured learning journeys live

### Sprint 3 (Week 3) - Flashcards
- Days 1-3: SM-2 algorithm, flashcard creation - 8 hours
- Days 4-5: Review queue, rating system - 4 hours
- **Outcome:** Active recall system operational

### Sprint 4 (Week 4) - Analytics Visualizations
- Days 1-2: Activity Heatmap - 4 hours
- Days 3-5: Skill Radar Chart - 6 hours
- **Outcome:** Enhanced analytics dashboard

## Dependencies & Integration

**Sequential Dependencies:**
- E20-S02 (Flashcards) should come AFTER Epic 3 completion → Depends on existing Notes system

**Parallel Opportunities:**
- E20-S03 and E20-S04 can be implemented in parallel (independent analytics features)

**Integration with Epic 11:**
- **Option 1 (Recommended):** Merge E20-S02 (Flashcards) into Epic 11-1 (spaced-review-system)
  - Epic 11 is currently backlog
  - Avoids duplication of spaced repetition logic
  - Reduces Epic 20 from 38h → 26h
- **Option 2:** Keep separate
  - Epic 11 focuses on review scheduling/algorithms
  - Epic 20 focuses on flashcard UI and creation workflow

**Integrates With:**
- Epic 3 (Notes): Flashcard creation from notes
- Epic 4 (Progress): Course completion data for paths
- Epic 8 (Analytics): Session data for heatmap
- Epic 9B (AI Features): AI-generated paths (future)

## Acceptance Criteria

Epic is considered **complete** when:
- [ ] All 4 stories reach "done" status
- [ ] Career Paths: 3-5 curated paths seeded
- [ ] Flashcards: SM-2 algorithm tested with 100+ review cycles
- [ ] Heatmap: 365 days displayed correctly
- [ ] Skill Radar: 5-7 skills calculated accurately
- [ ] E2E tests pass for all new features
- [ ] Epic retrospective conducted

## References

### Research Sources
- Industry data: Structured paths → 40-60% higher completion rates
- Spaced repetition research: SM-2 algorithm → 35% higher retention
- Analytics visualization: 50%+ users check monthly when visualizations present

### Related Epics
- Epic 3: Smart Note System (flashcard creation)
- Epic 4: Progress Tracking (course completion data)
- Epic 8: Analytics & Reports (session data)
- Epic 9B: AI-Powered Learning Features (future AI path generation)
- Epic 11: Knowledge Retention (potential flashcard merge)

### Implementation Plan
- Full research-backed plan: `/Users/pedro/.claude/plans/hidden-fluttering-penguin.md`
- Story templates: See plan file "Story File Templates" section

### SM-2 Algorithm Reference
- Public domain spaced repetition algorithm
- Proven effective for long-term retention
- Will be implemented from scratch in `src/lib/spacedRepetition.ts`
