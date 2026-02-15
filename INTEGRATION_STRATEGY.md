# Integration Strategy Analysis
## LevelUp ↔ OpsLog (The Operative Kit)

**Analysis Date:** February 13, 2026
**Analyst:** Claude Code

---

## Executive Summary

This document analyzes integration strategies between:
- **Project A**: LevelUp (generic course delivery UI)
- **Project B**: OpsLog (specialized NCI behavioral training tracker)

**Recommendation**: **Hybrid Integration** - Use wireframe components to enhance OpsLog's course delivery while preserving its specialized behavioral tracking capabilities.

---

## 1. Technical Comparison

### Project A: E-Learning Platform Wireframes

| Aspect | Details |
|--------|---------|
| **Purpose** | Generic e-learning course browsing and delivery |
| **Tech Stack** | React 18.3.1, Vite 6.3.5, Tailwind v4, React Router v7 |
| **UI Library** | shadcn/ui (50+ components), Radix UI primitives |
| **State** | No state management (presentation layer only) |
| **Data** | No backend, no database |
| **Features** | Course browsing, instructor profiles, messaging UI, reports, settings |
| **Styling** | Tailwind CSS v4 with custom design tokens |
| **Maturity** | Wireframes only, no functionality |

### Project B: OpsLog (The Operative Kit App)

| Aspect | Details |
|--------|---------|
| **Purpose** | NCI behavioral training tracker with field observation logging |
| **Tech Stack** | React 19.2.0, Vite 7.2.4, React Router v7 |
| **UI Library** | Custom components (no pre-built library) |
| **State** | TanStack React Query |
| **Data** | SQLite (better-sqlite3), local-first architecture |
| **Features** | Course tracking, observation logging, prediction calibration, BTE integration, spaced review, heatmaps |
| **Styling** | Vanilla CSS (App.css) |
| **Maturity** | MVP complete, 251/251 tests passing, actively developed |

### Compatibility Matrix

| Factor | Compatibility | Notes |
|--------|---------------|-------|
| **React Version** | ⚠️ Minor difference | A: 18.3.1, B: 19.2.0 (upgradeable) |
| **Vite Version** | ⚠️ Minor difference | A: 6.3.5, B: 7.2.4 (upgradeable) |
| **Router** | ✅ Compatible | Both use React Router v7 |
| **TypeScript** | ✅ Compatible | Both use TypeScript |
| **Icons** | ✅ Compatible | Both use Lucide React |
| **Build Tool** | ✅ Identical | Both use Vite |
| **Styling** | ⚠️ Different | A: Tailwind v4, B: Vanilla CSS |

---

## 2. Architecture Analysis

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│  E-Learning Wireframes (Project A)                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  UI Components (shadcn/ui)                         │    │
│  │  ├─ Courses.tsx (visual only)                      │    │
│  │  ├─ Overview.tsx (visual only)                     │    │
│  │  ├─ Instructors.tsx (visual only)                  │    │
│  │  └─ 50+ shadcn/ui components                       │    │
│  └────────────────────────────────────────────────────┘    │
│               ↓ (No data layer)                             │
│         [NO BACKEND]                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  OpsLog (Project B)                                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  UI Layer                                          │    │
│  │  ├─ Dashboard.tsx                                  │    │
│  │  ├─ Courses.tsx (functional)                       │    │
│  │  ├─ Observations.tsx                               │    │
│  │  ├─ Predictions.tsx                                │    │
│  │  └─ Custom components                              │    │
│  └────────────────────────────────────────────────────┘    │
│               ↓                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Service Layer                                     │    │
│  │  ├─ DatabaseService (CRUD)                         │    │
│  │  ├─ AutocorrelationService                         │    │
│  │  ├─ BTESuggestionService                           │    │
│  │  ├─ ExportService                                  │    │
│  │  ├─ HeatmapService                                 │    │
│  │  ├─ ReviewPromptsService                           │    │
│  │  ├─ SummarizationService                           │    │
│  │  └─ TranscriptionService                           │    │
│  └────────────────────────────────────────────────────┘    │
│               ↓                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Data Layer                                        │    │
│  │  └─ SQLite Database (opslog.db)                    │    │
│  │     ├─ courses, sections                           │    │
│  │     ├─ observations, predictions                   │    │
│  │     ├─ tags, settings                              │    │
│  │     └─ lessons, reviews                            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Key Differences

| Aspect | Wireframes | OpsLog |
|--------|------------|--------|
| **Data Persistence** | None | SQLite database |
| **Business Logic** | None | 8 specialized services |
| **Course Management** | Visual mockup | Full CRUD with progress tracking |
| **Behavioral Features** | None | Observation logging, prediction calibration, BTE integration |
| **Testing** | None | 251 tests, 100% passing |
| **Real Content** | Placeholder images/text | Chase Hughes course structure |

---

## 3. Integration Approaches

### Option 1: Replace OpsLog UI with Wireframe Components

**Description**: Port OpsLog's functionality into the wireframe project structure.

```
Wireframe Project
├─ Use shadcn/ui components for UI
├─ Add OpsLog's database layer
├─ Add OpsLog's service layer
└─ Wire up OpsLog functionality to wireframe pages
```

**Pros:**
- ✅ Modern UI library (shadcn/ui) with 50+ components
- ✅ Tailwind v4 for consistent styling
- ✅ Professional, polished design out of the box
- ✅ Better component reusability

**Cons:**
- ❌ Major rewrite of OpsLog's 251 passing tests
- ❌ Risk of breaking working functionality
- ❌ Lose OpsLog's custom-tailored UX for NCI methodology
- ❌ Significant development time (4-6 weeks)
- ❌ Need to upgrade React 18 → 19 (breaking changes)

**Effort:** 🔴 High (160-240 hours)

---

### Option 2: Extract UI Components into OpsLog

**Description**: Port shadcn/ui components from wireframes into OpsLog incrementally.

```
OpsLog Project
├─ Install Tailwind CSS v4
├─ Copy shadcn/ui components needed
│  ├─ Card, Button, Input, Select
│  ├─ Dialog, Popover, Tooltip
│  └─ Chart, Progress, Badge
├─ Refactor existing pages to use new components
└─ Keep all existing functionality intact
```

**Pros:**
- ✅ Preserve OpsLog's working functionality and tests
- ✅ Incremental migration (low risk)
- ✅ Cherry-pick only needed components
- ✅ Improve visual polish while maintaining UX
- ✅ No database/service changes needed

**Cons:**
- ❌ Tailwind CSS v4 adds build complexity
- ❌ Need to refactor existing CSS
- ❌ Component API differences require adjustment
- ❌ Some styling conflicts to resolve

**Effort:** 🟡 Medium (40-80 hours)

---

### Option 3: Hybrid Integration (RECOMMENDED)

**Description**: Create a unified system with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────┐
│  Unified Application                                        │
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │  Course Delivery     │    │  Field Practice      │     │
│  │  (Wireframe UI)      │    │  (OpsLog Features)   │     │
│  ├──────────────────────┤    ├──────────────────────┤     │
│  │ • Browse courses     │    │ • Log observations   │     │
│  │ • Watch lessons      │    │ • Track predictions  │     │
│  │ • View instructors   │    │ • BTE suggestions    │     │
│  │ • Progress reports   │    │ • Calibration        │     │
│  └──────────────────────┘    └──────────────────────┘     │
│           │                            │                    │
│           └────────────┬───────────────┘                    │
│                        ↓                                    │
│           ┌────────────────────────┐                       │
│           │  Shared Database       │                       │
│           │  • courses, sections   │                       │
│           │  • user_progress       │                       │
│           │  • observations        │                       │
│           │  • predictions         │                       │
│           └────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

1. **Keep OpsLog as primary project**
2. **Add new "Learning" section** using wireframe components:
   - `/learn` - Course catalog (from wireframes)
   - `/learn/:courseId` - Course detail page
   - `/instructors` - Instructor profiles
   - `/progress` - Visual progress reports
3. **Keep existing OpsLog sections** for behavioral tracking:
   - `/dashboard` - Existing dashboard
   - `/observations` - Existing observation logging
   - `/predictions` - Existing prediction calibration
   - `/tags`, `/review`, `/insights` - Existing features
4. **Share data** via DatabaseService:
   - Both sections read from same `courses` table
   - Progress updates from both flows
   - Unified settings and preferences

**Pros:**
- ✅ Best of both worlds: polished course UI + specialized behavioral tracking
- ✅ Clear separation: learning vs. field practice
- ✅ Preserve all OpsLog tests and functionality
- ✅ Add value without risk to existing features
- ✅ Scalable architecture for future features
- ✅ User gets full learning + practice workflow

**Cons:**
- ⚠️ Need to maintain two UI paradigms (Tailwind + vanilla CSS)
- ⚠️ Slightly larger bundle size
- ⚠️ Component library duplication initially

**Effort:** 🟢 Medium-Low (60-100 hours)

---

### Option 4: Keep Separate, Share Content

**Description**: Maintain two independent applications that share course content.

```
┌──────────────────────┐        ┌──────────────────────┐
│  Wireframe App       │        │  OpsLog App          │
│  (Course Delivery)   │◄──────►│  (Field Practice)    │
└──────────────────────┘        └──────────────────────┘
         │                               │
         └───────────┬───────────────────┘
                     ↓
          ┌────────────────────┐
          │  Shared Content    │
          │  (JSON/SQLite)     │
          │  • Course metadata │
          │  • Lesson data     │
          └────────────────────┘
```

**Pros:**
- ✅ No code changes to either project
- ✅ Zero integration risk
- ✅ Each app optimized for its purpose

**Cons:**
- ❌ User must switch between two apps
- ❌ Duplicate data entry and management
- ❌ No unified progress tracking
- ❌ Poor user experience

**Effort:** 🟢 Low (20-40 hours for content sync)

---

## 4. Feature Mapping

### Wireframe → OpsLog Feature Alignment

| Wireframe Page | OpsLog Equivalent | Integration Strategy |
|----------------|-------------------|---------------------|
| **Overview** | Dashboard | Keep OpsLog's metric-focused dashboard, add visual course cards from wireframes |
| **My Class** | Courses (filtered) | Use wireframe UI for "in progress" course view |
| **Courses** | Courses (all) | Replace OpsLog course list with wireframe's visual catalog |
| **Messages** | *(none)* | Skip - not needed for personal training tracker |
| **Instructors** | *(none)* | Add as new section - Chase Hughes profile, methodology intro |
| **Reports** | Dashboard + Insights | Enhance with wireframe's chart components |
| **Settings** | Settings | Keep OpsLog's settings, improve UI with wireframe components |

### Unique OpsLog Features (Preserve)

These features have no wireframe equivalent and must be preserved:

- **Observations** - Behavioral logging with tags, context, reflections
- **Predictions** - Pre-interaction hypothesis + outcome tracking
- **Insights** - Prediction accuracy, calibration metrics, heatmaps
- **Tags** - Behavioral tag management (BTE codes, custom tags)
- **Review** - Spaced repetition prompts for observations
- **Lessons** - AI-generated lesson summaries (via Whisper + MLX)

---

## 5. Data Architecture Considerations

### OpsLog Database Schema (Relevant Tables)

```sql
-- Core course tracking
courses (id, title, description, order_index, created_at)
sections (id, course_id, title, order_index, completed, completed_at)

-- Behavioral tracking
observations (id, date, context, behaviors, reflection, prediction_id, tags)
predictions (id, date, context, predicted_outcome, actual_outcome, accuracy, confidence)
tags (id, name, category, color, created_at)

-- Learning support
lessons (id, course_id, section_id, title, summary, key_concepts, field_markers)
lesson_reviews (id, lesson_id, reviewed_at, ease_rating, next_review)

-- User settings
settings (key, value, updated_at)
```

### Integration Points

1. **Shared Course Data**
   - Both UIs read from same `courses` and `sections` tables
   - Progress updates from either flow

2. **Linking Learning → Practice**
   - When watching a lesson (wireframe UI), prompt to create prediction
   - When logging observation (OpsLog UI), suggest related lessons

3. **Unified Progress Tracking**
   - Course completion % combines video watching + field practice
   - Dashboard shows both theoretical knowledge + practical application

---

## 6. UI/UX Integration Strategy

### Navigation Structure (Hybrid)

```
Main App
├─ 📊 Dashboard (OpsLog style with wireframe cards)
├─ 📚 Learn (NEW - wireframe UI)
│  ├─ Course Catalog
│  ├─ My Learning
│  └─ Instructors
├─ 🎯 Practice (OpsLog features)
│  ├─ Observations
│  ├─ Predictions
│  ├─ Insights
│  └─ Review
├─ 🏷️ Tags (OpsLog)
├─ 📖 Lessons (OpsLog)
└─ ⚙️ Settings (OpsLog with wireframe components)
```

### Styling Approach

**Phase 1: Coexistence**
- Keep OpsLog's vanilla CSS for existing pages
- Add Tailwind v4 for new "Learn" section only
- Use CSS modules to prevent conflicts

**Phase 2: Gradual Migration** (optional)
- Convert OpsLog components to Tailwind incrementally
- Use `@apply` directives to preserve existing layouts
- Maintain test coverage throughout

---

## 7. Implementation Roadmap (Hybrid Approach)

### Phase 1: Foundation (Week 1-2)

**Setup:**
- [ ] Add Tailwind CSS v4 to OpsLog project
- [ ] Install shadcn/ui CLI and core components
- [ ] Set up CSS isolation (Tailwind scope)
- [ ] Configure Vite for dual styling systems

**Components:**
- [ ] Port Card, Button, Badge components
- [ ] Port Dialog, Popover, Tooltip
- [ ] Test component rendering with existing pages

### Phase 2: Learning Section (Week 3-4)

**New Routes:**
- [ ] `/learn` - Course catalog page
  - Use wireframe's Courses.tsx layout
  - Connect to OpsLog's DatabaseService
  - Show progress from `sections` table
- [ ] `/learn/:courseId` - Course detail view
  - Video player placeholder
  - Section list with completion tracking
  - "Log Practice" button → Observations
- [ ] `/instructors` - Chase Hughes profile
  - Adapt wireframe's Instructors.tsx
  - Single instructor (not multi-instructor)

**Data Integration:**
- [ ] Extend DatabaseService with `getCourseDetails()`
- [ ] Add `markSectionWatched()` method
- [ ] Link lessons to sections

### Phase 3: Enhanced Dashboard (Week 5)

**Dashboard Improvements:**
- [ ] Add wireframe-style course cards (in progress)
- [ ] Use Chart components for metrics visualization
- [ ] Keep existing metric calculations
- [ ] Add "Recent Lessons" section

### Phase 4: Reports Enhancement (Week 6)

**Reports Page:**
- [ ] Use wireframe's chart components (recharts)
- [ ] Visualize prediction accuracy over time
- [ ] Show observation frequency heatmap
- [ ] Course completion progress

### Phase 5: Settings Polish (Week 7)

**Settings UI:**
- [ ] Replace form inputs with shadcn/ui components
- [ ] Better visual hierarchy with Card components
- [ ] Keep all existing functionality

### Phase 6: Testing & Refinement (Week 8)

- [ ] Update tests for new components
- [ ] Add tests for Learn section
- [ ] Visual regression testing
- [ ] Performance optimization
- [ ] Documentation updates

---

## 8. Migration Checklist

### Pre-Migration

- [ ] Backup OpsLog database
- [ ] Document current test coverage (251 tests)
- [ ] Create feature branch: `feature/wireframe-integration`
- [ ] Set up side-by-side comparison environment

### During Migration

- [ ] Run `npm test` after each component addition
- [ ] Maintain 100% test pass rate
- [ ] Document breaking changes
- [ ] Keep CHANGELOG.md updated

### Post-Migration

- [ ] User acceptance testing
- [ ] Performance benchmarking (bundle size, load time)
- [ ] Update documentation (README, CLAUDE.md)
- [ ] Create migration guide for users

---

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Breaking existing tests** | 🔴 High | Incremental changes, run tests after each step |
| **Bundle size increase** | 🟡 Medium | Tree-shaking, lazy loading, code splitting |
| **CSS conflicts** | 🟡 Medium | CSS modules, Tailwind scoping, namespace isolation |
| **User confusion (two UIs)** | 🟡 Medium | Clear navigation labels, onboarding tour |
| **Data inconsistency** | 🔴 High | Database constraints, transaction safety |
| **React version conflicts** | 🟡 Medium | Keep React 19, upgrade wireframe code if needed |

---

## 10. Success Metrics

### Technical Metrics

- ✅ Maintain 100% test pass rate (251 tests)
- ✅ Bundle size increase < 30%
- ✅ No CSS conflicts between styling systems
- ✅ Build time increase < 20%

### User Experience Metrics

- ✅ All existing OpsLog features work identically
- ✅ New "Learn" section intuitive for first-time users
- ✅ Navigation between Learn ↔ Practice feels natural
- ✅ Course progress tracking unified across both flows

### Feature Parity

- ✅ All 7 Chase Hughes courses accessible from both UIs
- ✅ Observations can reference lessons
- ✅ Lessons can prompt predictions
- ✅ Progress dashboard shows both learning + practice

---

## 11. Cost-Benefit Analysis

### Option Comparison

| Approach | Effort (hours) | Risk | UX Quality | Technical Debt | Recommended? |
|----------|---------------|------|------------|----------------|--------------|
| **Replace OpsLog UI** | 160-240 | 🔴 High | ⭐⭐⭐⭐⭐ | Low | ❌ No |
| **Extract UI to OpsLog** | 40-80 | 🟡 Medium | ⭐⭐⭐⭐ | Medium | ⚠️ Maybe |
| **Hybrid Integration** | 60-100 | 🟢 Low | ⭐⭐⭐⭐⭐ | Low | ✅ **Yes** |
| **Keep Separate** | 20-40 | 🟢 Low | ⭐⭐ | None | ❌ No |

---

## 12. Final Recommendation

### Primary Strategy: **Hybrid Integration (Option 3)**

**Rationale:**
1. **Preserves OpsLog's value** - All working features, tests, and specialized UX remain intact
2. **Adds significant value** - Professional course delivery UI improves user experience
3. **Low risk** - Additive changes only, no rewrites of working code
4. **Clear separation** - Learning (wireframe UI) vs. Practice (OpsLog UI) makes sense conceptually
5. **Scalable** - Easy to add more wireframe-based sections later
6. **Realistic timeline** - 60-100 hours (1.5-2.5 months part-time)

### Next Steps

1. **Immediate (Week 1)**
   - Set up Tailwind CSS v4 in OpsLog project
   - Install shadcn/ui CLI
   - Test component coexistence

2. **Short-term (Week 2-4)**
   - Build `/learn` route with course catalog
   - Port Card, Button, and basic components
   - Connect to existing DatabaseService

3. **Medium-term (Week 5-8)**
   - Add course detail pages
   - Enhance dashboard with wireframe components
   - Update documentation

4. **Long-term (Month 3+)**
   - Gradual migration of OpsLog components to Tailwind
   - Performance optimization
   - Advanced integrations (lesson → observation linking)

---

## 13. Alternative: Quick Win Strategy

If full hybrid integration is too much upfront, start with a **Minimal Viable Integration**:

### Phase 0: Component Library Only (20 hours)

1. Install Tailwind v4 + shadcn/ui in OpsLog
2. Replace ONLY the following with shadcn components:
   - Buttons (all existing buttons)
   - Cards (dashboard cards)
   - Dialogs (modals)
3. Keep everything else identical
4. **Result**: Immediate visual polish with minimal risk

This gives you a feel for the integration and provides quick visual improvements while you decide on the full strategy.

---

## Appendix A: File Migration Map

### Wireframe → OpsLog Port Candidates

| Wireframe File | Use in OpsLog | Priority |
|----------------|---------------|----------|
| `src/app/components/ui/card.tsx` | Dashboard, Courses | 🔴 High |
| `src/app/components/ui/button.tsx` | All pages | 🔴 High |
| `src/app/components/ui/badge.tsx` | Tags, Dashboard | 🔴 High |
| `src/app/components/ui/dialog.tsx` | Modals everywhere | 🔴 High |
| `src/app/components/ui/input.tsx` | Forms | 🟡 Medium |
| `src/app/components/ui/select.tsx` | Filters, Settings | 🟡 Medium |
| `src/app/components/ui/chart.tsx` | Reports, Insights | 🟡 Medium |
| `src/app/components/ui/progress.tsx` | Course progress | 🟡 Medium |
| `src/app/components/ui/tabs.tsx` | Course sections | 🟢 Low |
| `src/app/components/ui/calendar.tsx` | Date pickers | 🟢 Low |
| `src/app/pages/Courses.tsx` | `/learn` route | 🔴 High |
| `src/app/pages/Instructors.tsx` | `/instructors` route | 🟡 Medium |
| `src/app/components/Layout.tsx` | Reference for nav styling | 🟢 Low |

### Files to Keep from Wireframes

- All `src/app/components/ui/*.tsx` (50+ components)
- `src/styles/theme.css` (design tokens)
- `src/app/pages/Courses.tsx`, `Instructors.tsx`

### Files to Discard from Wireframes

- `src/app/pages/Messages.tsx` (not needed)
- `src/app/pages/Settings.tsx` (OpsLog has better version)
- `src/main.tsx`, `src/app/App.tsx` (use OpsLog's)

---

## Appendix B: Detailed Timeline (Hybrid Approach)

| Week | Focus | Deliverables | Hours |
|------|-------|--------------|-------|
| **1** | Setup & Foundation | Tailwind installed, shadcn/ui configured, test suite passing | 12 |
| **2** | Core Components | Card, Button, Badge, Dialog ported and tested | 12 |
| **3** | Learn Section - Part 1 | `/learn` route with course catalog working | 15 |
| **4** | Learn Section - Part 2 | Course detail pages, video player placeholder | 15 |
| **5** | Dashboard Enhancement | Wireframe cards integrated, charts added | 12 |
| **6** | Reports Upgrade | Chart components, visual analytics | 12 |
| **7** | Settings Polish | UI improvements, component replacements | 8 |
| **8** | Testing & Docs | Test updates, documentation, refinement | 14 |
| **Total** | | | **100 hrs** |

---

**Document Version:** 1.0
**Last Updated:** February 13, 2026
**Next Review:** After Week 2 implementation
