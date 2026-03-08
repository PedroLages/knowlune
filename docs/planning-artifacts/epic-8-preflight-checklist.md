# Epic 8 Pre-Flight Checklist

**Epic:** Progress Heatmap + Weekly Analytics
**Date:** 2026-03-08
**Status:** Pre-launch validation

---

## ✅ Epic 7 Closure

### Stories Completed

- [x] **E07-S01** - Momentum Score Calculation & Display
  - Status: ✅ Done, reviewed, shipped
  - Technical debt: ✅ Fixed (ImportedCourseCard momentum badge)
  - Burn-in validated: ⚠️  Check frontmatter

- [x] **E07-S02** - Recommended Next Dashboard Section
  - Status: ✅ Done, reviewed, shipped
  - Lessons learned: ✅ Complete

- [x] **E07-S03** - Next Course Suggestion After Completion
  - Status: ✅ Done, reviewed, shipped
  - Design tokens: ✅ Fixed (5 violations resolved)
  - Lessons learned: ✅ Complete

- [x] **E07-S04** - At-Risk Course Detection & Completion Estimates
  - Status: ✅ Done, reviewed, shipped
  - Current branch: `feature/e07-s04-at-risk-course-detection-completion-estimates`
  - Ready to merge: ⚠️  Verify main is up-to-date

- [x] **E07-S05** - Smart Study Schedule Suggestion
  - Status: ✅ Done, reviewed, shipped
  - Lessons learned: ✅ Complete (Hamilton allocation, custom events, etc.)

### Epic 7 Retrospective

- [x] Retrospective completed (2026-03-08)
- [x] Action items identified (6 items)
- [x] Process retrospective documented (0% follow-through analysis)
- [x] Automation infrastructure implemented (git hook, ESLint, test config)

**Epic 7 Completion:** ✅ 5/5 stories done

---

## 🔧 Automation Infrastructure

### Git Hooks

- [x] **Pre-push hook** installed (`.git/hooks/pre-push`)
  - Enforces clean working tree before push
  - Tested: ✅ Blocks uncommitted changes
  - Tested: ✅ Warns on untracked files

**Validation:**
```bash
# Should pass (clean tree)
git push --dry-run

# Should fail (with uncommitted changes)
# echo "test" >> test.txt && git push --dry-run
```

### ESLint Design Token Rule

- [x] **Custom plugin** created (`eslint-plugin-design-tokens.js`)
- [x] **Rule enabled** in `eslint.config.js` (`design-tokens/no-hardcoded-colors: error`)
- [x] **Pattern coverage:**
  - ✅ `bg-blue-*`, `text-blue-*`, `border-blue-*`, `ring-blue-*`
  - ✅ `bg-gray-*`, `text-gray-*`, `border-gray-*`
  - ✅ `bg-orange-*`, `text-orange-*`, `bg-amber-*`, `text-amber-*`
  - ✅ `bg-green-*`, `text-green-*`
  - ✅ `bg-red-*`, `text-red-*`

**Validation:**
```bash
# Should find 0 violations in Epic 7 components
npx eslint src/app/components/NextCourseSuggestion.tsx
npx eslint src/app/components/RecommendedNext.tsx
npx eslint src/app/components/figma/MomentumBadge.tsx
npx eslint src/app/components/figma/AtRiskBadge.tsx
npx eslint src/app/components/StudyScheduleWidget.tsx
```

### Test Coverage Configuration

- [x] **Configuration file** created (`.claude/code-review-testing-config.md`)
- [x] **Standard defined:** ≥80% AC coverage per story
- [x] **Blocker severity** documented (<60% = BLOCKER, 60-79% = BLOCKER, 80%+ = PASS)
- [x] **Agent integration:** code-review-testing agent configured

**Validation:**
```bash
# Verify file exists and is readable
cat .claude/code-review-testing-config.md | head -20
```

---

## 🧹 Technical Debt Status

### Epic 7 Technical Debt (Resolved)

- [x] **S03 lessons learned** - ✅ Completed (tag-based ranking, dismissal persistence, etc.)
- [x] **S05 lessons learned** - ✅ Completed (Hamilton allocation, custom events, etc.)
- [x] **S03 hardcoded colors** - ✅ Fixed (NextCourseSuggestion: 5 violations → 0)
- [x] **S01 ImportedCourseCard momentum** - ✅ Implemented (momentum badge displayed)

### Epic 1-6 Technical Debt (Deferred)

- [ ] **190 hardcoded color violations** in older components
  - **Strategy:** Fix incrementally when touching files, or batch in cleanup sprint
  - **Not blocking Epic 8:** These are in shipped, stable components
  - **Tracking:** ESLint will catch any new violations

**Decision:** Defer to post-Epic 8 cleanup sprint (low priority)

### Production Vulnerabilities

- [x] **Production dependencies:** 0 vulnerabilities ✅
- [ ] **Dev dependencies:** 7 vulnerabilities (1 critical, 2 high, 4 low)
  - All in dev tools: `@lhci/cli`, `@tailwindcss/vite`, `eslint`
  - Fix available: `npm audit fix`

**Action:** Run `npm audit fix` before Epic 8 Story 1 (5 min)

---

## 📐 Epic 8 Architecture

### Heatmap Design

- [x] **Architecture document** complete (`docs/planning-artifacts/heatmap-architecture.md`)
  - Data structure defined (HeatmapCell, HeatmapData)
  - Component architecture specified (ProgressHeatmap.tsx + useHeatmapData hook)
  - Algorithm designed (52-week grid, activity level tiers)
  - Performance validated (no virtualization needed, <100ms target)
  - Accessibility plan (keyboard nav, screen readers, ARIA)
  - Testing strategy (unit, E2E, visual regression)

### Dependencies Check

- [x] **Required libraries:** None! (Custom SVG heatmap, no chart library needed)
- [x] **Existing dependencies:**
  - ✅ Radix UI Tooltip (for cell hover tooltips)
  - ✅ date-fns (for date formatting, already installed)
  - ✅ IndexedDB (Dexie, for session queries)

**No new dependencies required** 🎉

### Theme Tokens

- [ ] **Add heatmap color scale** to `src/styles/theme.css`:
  ```css
  --heatmap-empty: hsl(var(--muted) / 0.3);
  --heatmap-level-1: hsl(var(--success) / 0.3);
  --heatmap-level-2: hsl(var(--success) / 0.5);
  --heatmap-level-3: hsl(var(--success) / 0.7);
  --heatmap-level-4: hsl(var(--success) / 1.0);
  ```

**Action:** Add before Story 1 implementation (2 min)

---

## 🎯 Epic 8 Story Breakdown

### Estimated Stories (Preliminary)

**Story 1: 52-Week Progress Heatmap Component** (5-7 SP)
- Create heatmap data generation (`src/lib/heatmap.ts`)
- Create data hook (`src/hooks/useHeatmapData.ts`)
- Create component (`src/app/components/ProgressHeatmap.tsx`)
- Unit tests + E2E tests
- Integrate into Reports page

**Story 2: Weekly Analytics Summary** (3-5 SP)
- Calculate weekly stats (sessions, minutes, courses studied)
- Create WeeklyStatsCard component
- Trend indicators (↑ ↓ vs previous week)
- Integration with heatmap

**Story 3: Monthly Comparison View** (3-4 SP)
- Month-over-month comparison cards
- Best/worst performing months
- Visual trend chart

**Story 4: Streak Detection & Display** (2-3 SP)
- Calculate current streak, longest streak
- Streak badge/indicator
- Streak calendar highlighting

**Story 5: Analytics Dashboard Integration** (2-3 SP)
- Combine all components into cohesive Reports page
- Responsive layout
- Export/share functionality

**Total Estimate:** 15-22 story points (~2-3 weeks at current velocity)

### Story Files

- [ ] Create story files in `docs/implementation-artifacts/`:
  - `8-1-52-week-progress-heatmap.md`
  - `8-2-weekly-analytics-summary.md`
  - `8-3-monthly-comparison-view.md`
  - `8-4-streak-detection-display.md`
  - `8-5-analytics-dashboard-integration.md`

**Action:** Generate story files using `/start-story` workflow (or manually)

---

## 🧪 Quality Gates

### Build & Lint

- [x] **Build passing:** `npm run build` (Vite production build)
- [x] **Linting passing:** `npx eslint src/` (TypeScript + design tokens)
- [x] **Type-check passing:** `npx tsc --noEmit`

**Validation:**
```bash
npm run build && npx tsc --noEmit && npx eslint src/ --ext .ts,.tsx
```

### Test Coverage

- [x] **Current coverage:** 73.3% lines (707 tests, 41 files)
- [x] **Threshold:** 70% (passing ✅)
- [x] **CI integration:** All gates green

**Epic 8 Target:** Maintain ≥70% coverage, ideally increase to 75%

### E2E Test Status

- [x] **Active smoke tests:** 3 specs (navigation, overview, courses)
- [x] **Epic 7 specs:** 5 specs in `tests/e2e/regression/` (archived)
- [x] **Playwright config:** Local = Chromium, CI = 6-project matrix

**Epic 8 Plan:** Add heatmap E2E spec, archive to regression after shipping

---

## 📊 Performance Baseline

### Current Metrics (Production Build)

- [x] **Lighthouse TBT:** 142ms (target: <200ms) ✅
- [x] **Lighthouse CLS:** 0.000 (target: <0.1) ✅
- [x] **Memory peak:** 15.35MB (stable, no leaks)
- [x] **Long tasks:** 1 task at 122ms (Overview initial load)

**Epic 8 Target:** Heatmap renders in <100ms, no memory leaks

---

## 👥 Team Readiness

### Roles & Assignments

- [x] **Product Manager (PM):** Story prioritization complete
- [x] **Scrum Master (SM):** Sprint planning ready
- [x] **Developer (Dev):** Architecture reviewed, ready to implement
- [x] **QA (Dana):** Test coverage standards documented
- [x] **Tech Writer (Paige):** Documentation templates ready

### Sprint Capacity

- **Epic 8 Estimated Effort:** 15-22 story points
- **Current Velocity:** ~5 stories per sprint (Epic 7 = 5 stories in 1 day, but included rework)
- **Realistic Timeline:** 2-3 weeks with quality gates

---

## 🚀 Pre-Flight Checklist Summary

### Critical (Must Complete Before Epic 8 Start)

- [x] Epic 7 all stories shipped
- [x] Epic 7 retrospective complete
- [x] Automation infrastructure tested
- [x] Heatmap architecture designed
- [ ] **Push prep sprint commits** (3 commits ready)
- [ ] **Fix dev vulnerabilities** (`npm audit fix`)
- [ ] **Add heatmap theme tokens** (`src/styles/theme.css`)

### Recommended (Complete Before Story 1)

- [ ] Create Epic 8 story files (5 stories)
- [ ] Update sprint-status.yaml (set epic-8: in-progress)
- [ ] Review Epic 8 acceptance criteria with PM
- [ ] Set up Epic 8 branch naming convention

### Optional (Can Defer)

- [ ] Fix 190 hardcoded color violations in Epic 1-6 components
- [ ] Create Epic 8 planning document
- [ ] Research alternative chart libraries (not needed, but nice to know)

---

## ✈️ Final Go/No-Go Decision

### Go Criteria

- ✅ All Epic 7 stories complete and reviewed
- ✅ Automation infrastructure in place and tested
- ✅ Heatmap architecture designed and validated
- ✅ No critical technical debt blocking Epic 8
- ✅ Team capacity available

### No-Go Criteria (None Detected)

- ❌ Unresolved Epic 7 blockers
- ❌ Critical production bugs
- ❌ Missing dependencies or architecture gaps
- ❌ Team capacity constraints

---

## 🎯 Recommendation

**Status:** ✅ **GO FOR EPIC 8**

**Next Steps:**
1. Push 3 prep sprint commits to remote
2. Run `npm audit fix` (5 min)
3. Add heatmap theme tokens to `theme.css` (2 min)
4. Create Epic 8 Story 1 file: "52-Week Progress Heatmap Component"
5. Run `/start-story E08-S01` to begin implementation

**Estimated Time to First Story:** 15 minutes of setup, then ready to code! 🚀

---

**Checklist Owner:** Pedro (Project Lead)
**Reviewed By:** Bob (Scrum Master), Claude Sonnet 4.5 (Dev Agent)
**Approved:** 2026-03-08
**Epic 8 Launch:** Ready when you are! 🎉
