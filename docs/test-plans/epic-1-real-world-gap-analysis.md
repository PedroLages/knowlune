---
title: Epic 1/1B Real-World Gap Analysis Plan
type: Exploratory Testing + Feature Discovery
testData: /Volumes/Academy/Health & Fitness
created: 2026-03-14
author: Pedro
objective: Uncover missing features, UX friction, and improvement opportunities through real-world testing
---

# Epic 1/1B Real-World Gap Analysis Plan

**Mission:** Import real courses from `/Volumes/Academy/Health & Fitness`, analyze the complete user journey, and identify what's missing, broken, or needs improvement.

**Philosophy:** Test not just what we built, but what we **didn't** build. Think like a user, not a developer.

---

## Executive Summary

### Current Epic 1/1B Coverage (What We Have)

✅ **Import & Viewing:**
- Single/bulk folder import
- Course library grid view
- Auto-metadata extraction
- Thumbnails and progress indicators

✅ **Organization:**
- Status management (Active/Completed/Paused)
- Topic categorization
- Missing file detection

### Suspected Gaps (What We're Missing)

❓ **CRUD Operations:**
- ❌ Delete courses
- ❌ Edit course metadata (title, creator, description)
- ❌ Refresh/re-import course

❓ **Navigation & Discovery:**
- ❌ Sort courses (by date, title, duration, status)
- ❌ Search courses (full-text)
- ❌ Course details page (where do users see full metadata?)

❓ **Batch Operations:**
- ❌ Bulk delete
- ❌ Bulk edit (assign topic to multiple courses)

❓ **User Guidance:**
- ❌ Onboarding for first-time users
- ❌ Help text for empty states
- ❌ Tutorial on organizing courses

---

## Testing Methodology: 4-Phase Approach

### **Phase 1: Real-World Import Session** (Manual + Playwright Monitoring)

**Duration:** 30-60 minutes
**Test Data:** `/Volumes/Academy/Health & Fitness` (10-20 courses)

#### **1A: Initial Import (First-Time User Experience)**

**Scenario:** User with empty library imports their first courses.

**Test Steps:**
1. Clear IndexedDB (simulate first-time user)
2. Navigate to Course Library page
3. Import 5 courses from `/Volumes/Academy/Health & Fitness`
4. Observe and document:
   - ✅ **What worked well:** Import flow, visual feedback
   - ⚠️ **Friction points:** Confusing UI, unclear next steps
   - 🆕 **Missing features:** What did you expect to do but couldn't?

**Key Questions to Answer:**
- Where do I see my imported courses? (Library page obvious?)
- What can I do with a course after import? (Click? Right-click? Hover?)
- How do I organize 5 courses? (Topics? Status? Folders?)
- What if I imported the wrong folder? (Delete? Undo?)
- What if a course has a generic name? (Edit title?)

#### **1B: Library Management (Power User Experience)**

**Scenario:** User with 10+ courses tries to manage their library.

**Test Steps:**
1. Import 10 more courses (total 15)
2. Try to organize them (by topic, status, etc.)
3. Try to find a specific course (search?)
4. Try to clean up unwanted courses (delete?)
5. Try to view course details (metadata, file list)

**Key Questions to Answer:**
- How do I find a course when I have 20+? (Search? Sort? Filter?)
- How do I delete courses I don't want? (Delete button? Context menu?)
- How do I edit a course with a bad name? (Edit metadata?)
- How do I see what's inside a course before opening it? (Details page? Preview?)
- How do I keep my library organized as it grows? (Folders? Tags? Collections?)

#### **1C: Edge Cases & Error Scenarios**

**Scenario:** User encounters problems and needs to recover.

**Test Steps:**
1. Import a course, then move the folder on disk (missing files)
2. Import a duplicate course (same folder twice)
3. Import a course with 100+ videos (performance test)
4. Try to undo an accidental import (undo/delete?)

**Key Questions to Answer:**
- What happens if I move a course folder after import?
- Can I re-import a course to refresh metadata?
- What if I import the same folder twice? (Duplicate detection?)
- What if I made a mistake? (Undo? Delete? Recover?)

---

### **Phase 2: Automated UI/UX Analysis** (Design Review Agent)

**Duration:** 10-15 minutes
**Tool:** `/design-review` (Playwright MCP)

After manual import completes (library has 10-20 courses):

```bash
# Navigate to Course Library page with populated data
/design-review
```

#### **What the Design Review Agent Will Check:**

**Visual Design:**
- ✅ Course card layout consistency
- ✅ Thumbnail quality and alignment
- ✅ Typography hierarchy (title, metadata, status)
- ✅ Spacing and whitespace balance

**Responsive Design:**
- ✅ Mobile (375px): Cards stack, thumbnails resize
- ✅ Tablet (768px): 2-column grid
- ✅ Desktop (1440px): 3-4 column grid

**Accessibility:**
- ✅ Color contrast (WCAG AA)
- ✅ Keyboard navigation (tab through cards)
- ✅ ARIA labels on interactive elements
- ✅ Focus indicators visible

**Data Density:**
- ✅ 1 course vs 20 courses display
- ✅ Long course titles (overflow handling)
- ✅ Missing thumbnails (placeholder consistency)
- ✅ Special characters in titles

**Interaction Design:**
- ✅ What happens on card click? (Go to course? Details page?)
- ✅ What happens on card hover? (Preview? Actions?)
- ✅ Where are course actions? (Context menu? Toolbar? Card buttons?)

#### **Expected Output:**

**Report:** `docs/reviews/design/design-review-[date]-real-world.md`

**Findings Categories:**
- BLOCKER: Broken UI, unusable features
- HIGH: Major UX friction, confusing flows
- MEDIUM: Polish issues, inconsistent design
- LOW: Nice-to-haves, future enhancements

---

### **Phase 3: Deep Gap Analysis** (Feature Discovery)

**Duration:** 60-90 minutes
**Approach:** Systematic feature audit using real-world lens

#### **3A: Feature Inventory Audit**

Compare **what exists** vs **what users expect** in a course library.

##### **CRUD Operations Matrix**

| Operation | Current State | User Need | Gap? |
|-----------|---------------|-----------|------|
| **Create** | ✅ Import folders | Import single files? | Maybe |
| **Read** | ✅ View library grid | View course details page? | **YES** |
| **Update** | ⚠️ Edit status/topic only | Edit title, creator, description? | **YES** |
| **Delete** | ❌ Not available | Delete unwanted courses? | **YES** |

##### **Organization Features Matrix**

| Feature | Current State | User Need | Gap? |
|---------|---------------|-----------|------|
| **Sort** | ❌ Not available | Sort by date, title, duration? | **YES** |
| **Search** | ❌ Not available | Search titles, topics, creators? | **YES** |
| **Filter** | ⚠️ By status/topic only | Filter by duration, date range? | Maybe |
| **Group** | ⚠️ Topics only | Collections, folders, playlists? | Maybe |

##### **Discoverability Features Matrix**

| Feature | Current State | User Need | Gap? |
|---------|---------------|-----------|------|
| **Recently Added** | ❌ Not available | See newest courses first? | **YES** |
| **Recently Viewed** | ❌ Not available | Resume where I left off? | Epic 2 |
| **Recommended** | ❌ Not available | Suggest courses to study? | Epic 7 |
| **Bookmarked** | ❌ Not available | Mark favorites? | Maybe |

##### **Batch Operations Matrix**

| Operation | Current State | User Need | Gap? |
|-----------|---------------|-----------|------|
| **Bulk Import** | ✅ Story 1.6 | Import 10+ folders | ✅ Covered |
| **Bulk Delete** | ❌ Not available | Delete 10+ courses | **YES** |
| **Bulk Edit** | ❌ Not available | Assign topic to 10+ courses | **YES** |
| **Bulk Export** | ❌ Not available | Backup library data | Priority 2 |

#### **3B: User Journey Mapping**

Map the **complete user journey** and identify missing steps.

##### **Journey 1: First-Time User (Library Setup)**

```
1. [ ] User opens app for first time
   ❓ Missing: Welcome screen? Tutorial? Import prompt?

2. [✅] User clicks "Import Course"
   ✅ Working: Import dialog opens

3. [✅] User selects course folder
   ✅ Working: Folder picker (File System Access API)

4. [✅] Course imports successfully
   ✅ Working: Course appears in library

5. [ ] User wants to organize courses
   ❓ Missing: Guided onboarding? Suggested topics? Auto-tag?

6. [ ] User wants to edit course title (folder name is "course-2024-01")
   ❌ Missing: Edit metadata feature

7. [ ] User wants to delete test import
   ❌ Missing: Delete course feature
```

##### **Journey 2: Power User (Managing Large Library)**

```
1. [✅] User has 20+ courses in library
   ✅ Working: Library displays all courses

2. [ ] User wants to find specific course
   ❌ Missing: Search bar

3. [ ] User wants to see newest courses first
   ❌ Missing: Sort by date added

4. [ ] User wants to see total library stats
   ❓ Missing: Library summary (total courses, hours, files)

5. [ ] User wants to clean up old courses
   ❌ Missing: Bulk delete feature

6. [ ] User wants to see course details before opening
   ❌ Missing: Course details page or preview

7. [ ] User wants to re-organize multiple courses at once
   ❌ Missing: Bulk edit (assign topic to multiple)
```

##### **Journey 3: Error Recovery (Things Go Wrong)**

```
1. [ ] User imported wrong folder
   ❌ Missing: Undo import or quick delete

2. [ ] User moved course folder on disk
   ⚠️ Partial: "File not found" badge, but no re-import feature

3. [ ] User imported same folder twice
   ❌ Missing: Duplicate detection (Priority 2, Story 1.10)

4. [ ] User wants to restore deleted course
   ❌ Missing: Trash/recycle bin or undo delete

5. [ ] User wants to backup before major changes
   ❌ Missing: Export library metadata (Priority 2, Story 1.13)
```

#### **3C: Competitive Feature Analysis**

Compare LevelUp to leading platforms:

##### **vs Udemy (Course Library)**

| Feature | Udemy | LevelUp | Gap? |
|---------|-------|---------|------|
| Search courses | ✅ | ❌ | **YES** |
| Sort by various criteria | ✅ | ❌ | **YES** |
| Course details page | ✅ | ❌ | **YES** |
| Remove from library | ✅ | ❌ | **YES** |
| Collections/playlists | ✅ | ⚠️ Topics | Maybe |
| Progress tracking | ✅ | Epic 4 | Future |

##### **vs Plex (Media Library)**

| Feature | Plex | LevelUp | Gap? |
|---------|------|---------|------|
| Library stats (total items, size) | ✅ | ❌ | **YES** |
| Edit metadata (title, poster) | ✅ | ❌ | **YES** |
| Refresh/re-scan library | ✅ | ❌ | **YES** |
| Remove item | ✅ | ❌ | **YES** |
| Sort by multiple criteria | ✅ | ❌ | **YES** |
| Recently added shelf | ✅ | ❌ | **YES** |

##### **vs Notion (Content Organization)**

| Feature | Notion | LevelUp | Gap? |
|---------|--------|---------|------|
| Database views (table, gallery, list) | ✅ | ⚠️ Grid only | Maybe |
| Custom properties | ✅ | ⚠️ Topics only | Maybe |
| Templates | ✅ | ❌ | Low priority |
| Trash/recycle bin | ✅ | ❌ | **YES** |

---

### **Phase 4: Feature Prioritization & Story Creation**

**Duration:** 30-60 minutes
**Approach:** Convert gaps into prioritized stories

#### **4A: Categorize Discovered Gaps**

Group findings into categories:

##### **Category A: Critical Gaps (Must-Have for MVP)**

Missing features that make the library **unusable** or **frustrating**:

- ❌ **Delete courses** — Can't remove unwanted courses
- ❌ **Edit course title** — Generic folder names are confusing
- ❌ **Course details page** — Can't see what's in a course before opening
- ❌ **Sort courses** — Can't find courses in large library

**Recommendation:** Add to Epic 1C (Critical Library Operations)

##### **Category B: High-Value Enhancements (Should-Have for V1)**

Features that significantly improve UX but aren't blocking:

- ❌ **Search courses** — Already in Priority 2 (Story 1.12)
- ❌ **Bulk delete** — Already in Priority 2 (Story 1.11)
- ❌ **Recently added view** — Easy sort feature
- ❌ **Library stats** — Total courses, hours, storage

**Recommendation:** Add to Epic 1C or Epic 12 (Polish)

##### **Category C: Nice-to-Have (Future/Post-MVP)**

Features that add polish but aren't essential:

- ❌ **Trash/recycle bin** — Undo delete
- ❌ **Course templates** — Pre-configured topics
- ❌ **Multiple library views** — Grid, list, table
- ❌ **Custom course properties** — User-defined fields

**Recommendation:** Backlog for Epic 12+ or V2

#### **4B: Create New Story Candidates**

For each Category A/B gap, create a story candidate:

##### **Story 1C.1: Delete Course** (Category A - Critical)

**User Story:**
> As a learner,
> I want to delete courses I no longer need,
> So that my library stays clean and organized.

**Acceptance Criteria:**
- User can delete a course via context menu or card action
- Confirmation dialog: "Delete '[Course Title]'? This will remove it from your library but won't delete the files on disk."
- Deletion removes course from IndexedDB and Zustand
- Toast notification: "Course deleted"
- Deleted course disappears from library immediately

**Rationale:** Users **will** import wrong folders, test imports, or change their mind. Without delete, library becomes cluttered.

**Effort:** 3 hours
**Priority:** CRITICAL (Category A)

---

##### **Story 1C.2: Edit Course Metadata** (Category A - Critical)

**User Story:**
> As a learner,
> I want to edit course titles, creators, and descriptions,
> So that I can give courses meaningful names and add context.

**Acceptance Criteria:**
- User can edit course metadata via context menu or details page
- Editable fields: title, creator, subject, description, language, difficulty level
- Changes save immediately (optimistic update + IndexedDB persist)
- Edited title displays on course card
- Toast notification: "Course updated"

**Rationale:** Folder names like "course-2024-01" or "download (3)" are not user-friendly. Users need to customize.

**Effort:** 5 hours
**Priority:** CRITICAL (Category A)

---

##### **Story 1C.3: Course Details Page** (Category A - Critical)

**User Story:**
> As a learner,
> I want to view full course details before starting a course,
> So that I can see what's inside and decide if it's worth my time.

**Acceptance Criteria:**
- Clicking a course card opens a details page (or modal)
- Details page shows:
  - Course title, creator, subject, description
  - Total videos, total PDFs, total duration, file size
  - Thumbnail/cover image
  - File list (videos, PDFs with names and durations)
  - Status, topics, date added
  - Action buttons: Start Course, Edit, Delete
- Responsive design (mobile/tablet/desktop)
- Back button returns to library

**Rationale:** Users need to **preview** what's in a course before committing to study it. Currently, clicking a card does... what? Undefined behavior.

**Effort:** 8 hours
**Priority:** CRITICAL (Category A)

---

##### **Story 1C.4: Sort & Filter Courses** (Category A - Critical)

**User Story:**
> As a learner,
> I want to sort and filter my course library,
> So that I can quickly find courses I'm looking for.

**Acceptance Criteria:**
- Sort options: Date Added (newest/oldest), Title (A-Z), Duration (shortest/longest), Status
- Filter options: Status (Active/Completed/Paused), Topic, Has Thumbnails
- Sort/filter controls appear in library toolbar
- Library updates immediately when sort/filter changes
- Current sort/filter persists across sessions (localStorage)

**Rationale:** With 20+ courses, users **cannot** find what they need without sort/search. This is table stakes for any library UI.

**Effort:** 6 hours
**Priority:** CRITICAL (Category A)

---

##### **Story 1C.5: Library Overview Stats** (Category B - High Value)

**User Story:**
> As a learner,
> I want to see summary statistics about my course library,
> So that I understand my overall learning commitment and progress.

**Acceptance Criteria:**
- Library header shows summary stats:
  - Total courses
  - Total videos
  - Total hours of content
  - Total storage used (file size)
- Stats update when courses are added/removed
- Stats use human-readable formats (e.g., "45.2 hours", "2.3 GB")

**Rationale:** Users want to see the **big picture** of their library. This builds excitement and commitment.

**Effort:** 3 hours
**Priority:** HIGH VALUE (Category B)

---

##### **Story 1C.6: Recently Added View** (Category B - High Value)

**User Story:**
> As a learner,
> I want to see my most recently imported courses first,
> So that I can quickly access new content.

**Acceptance Criteria:**
- Default library view sorts by "Date Added (Newest First)"
- User can change sort to other criteria
- "Recently Added" section shows last 5 courses imported
- Section appears above main library grid

**Rationale:** First thing users do after import is look for the course they just added. Make it easy.

**Effort:** 2 hours
**Priority:** HIGH VALUE (Category B)

---

#### **4C: Prioritization Framework**

Use this matrix to decide what to build:

| Story | Impact | Effort | ROI | Priority | Epic |
|-------|--------|--------|-----|----------|------|
| **1C.1: Delete Course** | HIGH | 3h | 10/10 | P0 | Epic 1C |
| **1C.2: Edit Metadata** | HIGH | 5h | 9/10 | P0 | Epic 1C |
| **1C.3: Course Details** | HIGH | 8h | 8/10 | P0 | Epic 1C |
| **1C.4: Sort & Filter** | HIGH | 6h | 9/10 | P0 | Epic 1C |
| **1C.5: Library Stats** | MED | 3h | 7/10 | P1 | Epic 1C or 12 |
| **1C.6: Recently Added** | MED | 2h | 8/10 | P1 | Epic 1C or 12 |
| **1.12: Search** | HIGH | 4h | 9/10 | P1 | Epic 12 |
| **1.11: Bulk Ops** | MED | 6h | 6/10 | P2 | Epic 12 |

**Recommendation:** Create **Epic 1C: Critical Library Operations** with Stories 1C.1-1C.4 (22 hours total).

---

## Test Execution Checklist

Use this checklist during the real-world testing session:

### **Pre-Test Setup**
- [ ] Clear IndexedDB (simulate first-time user)
- [ ] Verify `/Volumes/Academy/Health & Fitness` has 10-20 course folders
- [ ] Open Course Library page in browser
- [ ] Open screen recording software (optional)
- [ ] Prepare notes document for observations

### **Phase 1: Import & Initial Experience**
- [ ] Import 5 courses (observe import flow, progress, metadata)
- [ ] Document first impressions: What's confusing? What's missing?
- [ ] Try to organize courses (status, topics)
- [ ] Try to find a specific course (how?)
- [ ] Try to delete a test course (can you?)
- [ ] Try to edit a course title (can you?)

### **Phase 2: Library Management**
- [ ] Import 10 more courses (total 15)
- [ ] Try to sort courses (by date, title, etc.)
- [ ] Try to search for a course (search bar exists?)
- [ ] Try to view course details (click card? right-click?)
- [ ] Try to batch delete 5 courses (can you?)
- [ ] Try to see library statistics (total courses, hours)

### **Phase 3: Design Review**
- [ ] Run `/design-review` on populated library page
- [ ] Review design report for BLOCKER/HIGH issues
- [ ] Document UI inconsistencies
- [ ] Test responsive breakpoints (375px, 768px, 1440px)
- [ ] Test keyboard navigation (tab through cards)

### **Phase 4: Gap Analysis**
- [ ] Complete CRUD Operations Matrix
- [ ] Complete Organization Features Matrix
- [ ] Complete User Journey Mapping
- [ ] Identify top 5 missing features
- [ ] Draft story candidates for each gap

### **Post-Test Documentation**
- [ ] Save real-world validation report to `docs/reviews/`
- [ ] Save design review report to `docs/reviews/design/`
- [ ] Create Epic 1C story proposals
- [ ] Update `epics.md` with new stories (if approved)

---

## Expected Outcomes

### **Test Reports**

1. **Real-World Validation Report**
   - Location: `docs/reviews/real-world-validation-epic-1-[date].md`
   - Contents: Observations, friction points, missing features
   - Format: Observation template (severity, category, recommendation)

2. **Design Review Report**
   - Location: `docs/reviews/design/design-review-[date]-real-world.md`
   - Contents: UI/UX issues, accessibility violations
   - Format: BLOCKER/HIGH/MEDIUM/LOW findings

3. **Gap Analysis Report**
   - Location: `docs/reviews/gap-analysis-epic-1-[date].md`
   - Contents: Feature matrix, user journeys, story candidates
   - Format: Categorized gaps with prioritization

### **New Epic Proposal: Epic 1C**

**Epic 1C: Critical Library Operations**

Users can delete unwanted courses, edit course metadata, view detailed course information, and sort/filter their library — completing the essential CRUD and organization features needed for a functional course library.

**Stories (22 hours total):**
- Story 1C.1: Delete Course (3h)
- Story 1C.2: Edit Course Metadata (5h)
- Story 1C.3: Course Details Page (8h)
- Story 1C.4: Sort & Filter Courses (6h)

**Rationale:** These are **table-stakes features** for any library UI. Without them, Epic 1/1B is incomplete.

**Effort:** 22 hours (similar to Epic 1B)
**Priority:** P0 (Must-Have for MVP)
**Phase:** 1 (Foundation — shipped alongside or right after Epic 1B)

---

## Decision Criteria: Ship Epic 1C or Defer?

Use this rubric to decide:

### **Ship Epic 1C Immediately If:**
- ✅ Real-world testing reveals users **cannot** manage their library without these features
- ✅ Deletion/editing are mentioned as blockers in user feedback
- ✅ Library with 10+ courses is unusable without sort/search
- ✅ Course details page is needed to understand what's in a course

### **Defer Epic 1C to Epic 12 If:**
- ❌ Real-world testing shows Epic 1/1B is sufficient for basic usage
- ❌ Users can work around missing features (e.g., manually track courses in notes)
- ❌ Sort/search only needed for 50+ courses (rare initially)
- ❌ Time constraints require focusing on Epic 2 (video player)

### **Hybrid Approach: Ship Critical Subset**
- ✅ Ship Stories 1C.1 (Delete) and 1C.4 (Sort) immediately (9 hours)
- 🔄 Defer Stories 1C.2 (Edit) and 1C.3 (Details) to Epic 12 (13 hours)
- **Rationale:** Delete + Sort are bare minimum, Edit + Details are polish

---

## Next Steps: Execution Plan

1. **Execute Real-World Testing Session** (60 minutes)
   - Import 15 courses from `/Volumes/Academy/Health & Fitness`
   - Document observations in real-time
   - Complete all checklist items

2. **Run Design Review Agent** (15 minutes)
   - `/design-review` on populated library
   - Save report, triage findings

3. **Conduct Gap Analysis** (90 minutes)
   - Complete all feature matrices
   - Map user journeys
   - Draft story candidates

4. **Decision Point: Create Epic 1C?** (15 minutes)
   - Review findings with Pedro
   - Decide: Ship immediately, defer, or hybrid?
   - Update `epics.md` if approved

5. **Implement Epic 1C** (22 hours if approved)
   - `/start-story E01C-S01` (Delete Course)
   - `/start-story E01C-S02` (Edit Metadata)
   - `/start-story E01C-S03` (Course Details)
   - `/start-story E01C-S04` (Sort & Filter)

---

## Success Metrics

### **Test Session Success:**
- [ ] 15+ courses imported successfully
- [ ] All checklist items completed
- [ ] 10+ observations documented
- [ ] 3+ BLOCKER issues identified (if any)
- [ ] 5+ story candidates created

### **Epic 1C Success (If Created):**
- [ ] Users can delete unwanted courses
- [ ] Users can edit course titles
- [ ] Users can view course details before opening
- [ ] Users can sort/filter library with 20+ courses
- [ ] All tests pass (E2E + design review)
- [ ] No BLOCKER issues in code review

---

## Appendix: Quick Reference

### **Key Documents**
- [Epic 1 Stories](_bmad-output/planning-artifacts/epics.md#epic-1-course-import--library-management)
- [Epic 1B Stories](_bmad-output/planning-artifacts/epics.md#epic-1b-library-enhancements)
- [Epic 1B Validation Plan](epic-1b-validation-plan.md)
- [Test Fixtures](../../tests/fixtures/courses/README.md)

### **Test Commands**
```bash
# Clear IndexedDB (simulate first-time user)
# Open DevTools > Application > Storage > Clear Site Data

# Import real courses
# Navigate to /Volumes/Academy/Health & Fitness
# Click "Import Course" button

# Run design review
/design-review

# Save observations
# docs/reviews/real-world-validation-epic-1-[date].md
```

### **Observation Template**
```markdown
## Observation #X: [Title]
- **Severity:** BLOCKER / HIGH / MEDIUM / LOW
- **Category:** Missing Feature / UX Friction / Bug / Enhancement
- **Description:** [What happened / what's missing]
- **Expected:** [What should happen]
- **User Impact:** [How this affects users]
- **Recommendation:** [Story candidate or fix]
```

---

**Ready to execute this plan, Pedro?** Let me know when you want to start the real-world testing session, and I'll guide you through each phase! 🚀
