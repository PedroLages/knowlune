---
epic: Epic 1B - Library Enhancements
stories: Story 1.6, 1.7, 1.8, 1.9
created: 2026-03-14
author: Pedro
testApproach: 3-phase (Automated + Manual + Design Review)
---

# Epic 1B Validation Plan: Library Enhancements

**Objective:** Validate Epic 1B stories (bulk import, metadata extraction, progress indicators, thumbnails) through automated E2E tests, real-world exploratory testing, and automated design review.

**Test Philosophy:** Hybrid approach balancing repeatable automation with real-world validation.

---

## Testing Strategy Overview

### **Phase 1: Automated Test Suite (Playwright E2E)**
- **What:** Controlled, repeatable E2E tests using test fixtures
- **When:** During development and in CI/CD pipeline
- **Duration:** 5-10 minutes per test run
- **Scope:** All acceptance criteria for Stories 1.6-1.9

### **Phase 2: Real-World Exploratory Testing**
- **What:** Manual testing with actual course data
- **When:** After automated tests pass
- **Duration:** 30-60 minutes per session
- **Scope:** Scalability, edge cases, UX friction

### **Phase 3: Design Review Agent Analysis**
- **What:** Automated UI/UX review via Playwright MCP
- **When:** After manual import completes
- **Duration:** 10-15 minutes
- **Scope:** Visual design, accessibility, responsive behavior

---

## Phase 1: Automated Test Suite

### Test Fixtures (Controlled Data)

All fixtures located in `tests/fixtures/courses/`:

| Fixture | Purpose | Files | Tests |
|---------|---------|-------|-------|
| `valid-course/` | Happy path | 5 MP4s, 2 PDFs, nested folders | Import, metadata, thumbnails |
| `large-course/` | Stress test | 100+ videos/PDFs | Bulk import, progress indicator |
| `empty-course/` | Edge case | 0 supported files | Error handling |
| `mixed-unsupported/` | Partial success | MP4, PDF, .txt, .zip | Selective import |
| `special-characters/` | Unicode | émojis, spaces, ñ, 日本語 | File handling |
| `missing-metadata/` | Corrupted files | Videos with missing duration | Graceful degradation |

See [Test Fixture Documentation](../../tests/fixtures/courses/README.md) for full details.

---

### Test Specifications

#### **Test File: `tests/e2e/story-e01b-s06.spec.ts`**

**Story 1.6: Bulk Course Import**

```typescript
test.describe('Story 1.6: Bulk Course Import', () => {
  test('should import multiple folders simultaneously', async ({ page }) => {
    // AC1: User can select multiple folders
    // AC2: System scans folders in parallel (max 5)
    // AC3: Courses appear via optimistic updates
  });

  test('should handle partial failures gracefully', async ({ page }) => {
    // AC4: Consolidated toast for failures
    // AC5: Successful imports complete despite failures
  });
});
```

**Acceptance Criteria Mapping:**
- ✅ AC1: Multi-select folder dialog
- ✅ AC2: Parallel scanning (max 5 concurrent)
- ✅ AC3: Optimistic Zustand updates
- ✅ AC4: Consolidated error toast
- ✅ AC5: Partial success handling

---

#### **Test File: `tests/e2e/story-e01b-s07.spec.ts`**

**Story 1.7: Auto-Extract Video Metadata**

```typescript
test.describe('Story 1.7: Auto-Extract Video Metadata', () => {
  test('should display total duration and video count', async ({ page }) => {
    // AC1: Extract duration, file size, resolution
    // AC2: Display "8h 24m" format
    // AC3: Silent failure for metadata errors
  });

  test('should show highest resolution badge', async ({ page }) => {
    // AC4: Resolution badge (720p, 1080p, 4K)
  });
});
```

**Acceptance Criteria Mapping:**
- ✅ AC1: Metadata extraction (duration, size, resolution)
- ✅ AC2: Human-readable duration format
- ✅ AC3: Graceful degradation (missing metadata)
- ✅ AC4: Resolution badge display

---

#### **Test File: `tests/e2e/story-e01b-s08.spec.ts`**

**Story 1.8: Import Progress Indicator**

```typescript
test.describe('Story 1.8: Import Progress Indicator', () => {
  test('should show real-time progress during import', async ({ page }) => {
    // AC1: Progress modal appears
    // AC2: Updates every 10 files
    // AC3: Estimated time after 20 files
  });

  test('should allow cancellation without corruption', async ({ page }) => {
    // AC4: Cancel button functionality
    // AC5: No partial data saved
  });

  test('should display bulk import progress', async ({ page }) => {
    // AC3b: Overall progress for multiple folders
  });
});
```

**Acceptance Criteria Mapping:**
- ✅ AC1: Progress modal display
- ✅ AC2: Update frequency (every 10 files)
- ✅ AC3: Estimated time remaining
- ✅ AC4: Cancellation support
- ✅ AC5: Data integrity on cancel

---

#### **Test File: `tests/e2e/story-e01b-s09.spec.ts`**

**Story 1.9: Course Card Thumbnails**

```typescript
test.describe('Story 1.9: Course Card Thumbnails', () => {
  test('should generate thumbnails from first video', async ({ page }) => {
    // AC1: Thumbnail at 10% video mark
    // AC2: 16:9 aspect ratio
    // AC3: Cached in IndexedDB
  });

  test('should show placeholder for failed thumbnails', async ({ page }) => {
    // AC3: Default placeholder icon
    // AC4: No error toast
  });

  test('should lazy load thumbnails for large libraries', async ({ page }) => {
    // AC5: Progressive rendering
  });
});
```

**Acceptance Criteria Mapping:**
- ✅ AC1: Thumbnail generation (10% mark)
- ✅ AC2: 16:9 aspect ratio, 200px width
- ✅ AC3: IndexedDB caching
- ✅ AC4: Placeholder fallback
- ✅ AC5: Lazy loading (50+ courses)

---

### Running Automated Tests

```bash
# Run all Epic 1B tests
npm run test:e2e -- --grep "Story 1\.[6-9]"

# Run specific story tests
npm run test:e2e tests/e2e/story-e01b-s06.spec.ts

# Run in headed mode for debugging
npm run test:e2e -- --headed --grep "Story 1.6"

# Run with specific browser
CI=1 npm run test:e2e -- --project=webkit --grep "Story 1.7"
```

---

## Phase 2: Real-World Exploratory Testing

### Test Data Source

**Primary:** `/Volumes/Academy/Health & Fitness`
- **Rationale:** Real course folders with varied structures, file sizes, naming conventions
- **Expected:** 10-20 courses, 500+ videos, 100+ PDFs

### Manual Test Session Checklist

#### **Preparation (5 minutes)**
- [ ] Clear IndexedDB (`Application > Storage > Clear Site Data`)
- [ ] Open Course Library page
- [ ] Start screen recording (optional)
- [ ] Prepare test notes document

#### **Import Testing (20 minutes)**
- [ ] **Single Folder Import:** Import 1 course, verify metadata displayed
- [ ] **Bulk Import:** Import 5 courses simultaneously, observe progress
- [ ] **Large Folder:** Import course with 50+ videos, monitor performance
- [ ] **Nested Folders:** Import course with 3+ subfolder levels
- [ ] **Special Characters:** Import course with non-ASCII characters

#### **Library Experience (15 minutes)**
- [ ] **Visual Consistency:** Check thumbnail quality and alignment
- [ ] **Long Titles:** Verify course names don't overflow cards
- [ ] **Responsive Design:** Test at 375px, 768px, 1440px viewports
- [ ] **Performance:** Library loads <100ms with 20+ courses
- [ ] **Search/Filter:** Quick sanity check on existing features

#### **Edge Cases (10 minutes)**
- [ ] **Missing Files:** Move a course folder, verify "file not found" badge
- [ ] **Duplicate Import:** Re-import same folder, check duplicate detection
- [ ] **Empty Folder:** Import folder with no videos/PDFs, verify error toast
- [ ] **Cancellation:** Cancel import mid-scan, verify no partial data

### Observation Template

For each observation, document:

```markdown
## Observation #1: [Title]
- **Severity:** High / Medium / Low
- **Category:** Bug / UX Friction / Enhancement Opportunity
- **Description:** [What happened]
- **Expected:** [What should happen]
- **Steps to Reproduce:** [If applicable]
- **Screenshot:** [Attach if visual issue]
- **Recommendation:** [Suggested fix or enhancement]
```

### Real-World Validation Report

Save findings to: `docs/reviews/real-world-validation-epic-1b-[date].md`

**Example Findings:**
- ✅ **Working Well:** Bulk import handled 10 courses smoothly
- ⚠️ **Improvement Needed:** Progress indicator jumps when metadata extraction is slow
- 🆕 **Enhancement Opportunity:** Users want to re-order courses after import

---

## Phase 3: Design Review Agent Analysis

### Running Design Review

After completing manual import (library populated with 10+ courses):

```bash
# Navigate to Course Library page
# Run design review agent
/design-review
```

### What the Agent Reviews

- ✅ **Course Card Layout:** Thumbnail placement, text hierarchy, spacing
- ✅ **Responsive Breakpoints:** Mobile (375px), Tablet (768px), Desktop (1440px)
- ✅ **Accessibility:** Color contrast, ARIA labels, keyboard navigation
- ✅ **Visual Consistency:** Card alignment, thumbnail aspect ratios
- ✅ **Data Density:** 1 course vs 50+ courses display
- ✅ **Edge Cases:** Long titles, missing thumbnails, special characters

### Design Review Output

**Report Saved To:** `docs/reviews/design/design-review-[date]-epic-1b.md`

**Expected Sections:**
- **BLOCKER Issues:** Must fix before release
- **HIGH Issues:** Should fix before release
- **MEDIUM Issues:** Nice to fix, not blocking
- **LOW Issues:** Polish, defer to backlog

### Triaging Design Review Findings

| Severity | Action | Timeline |
|----------|--------|----------|
| BLOCKER | Fix immediately | Before Epic 1B PR |
| HIGH | Fix if time permits | Before Epic 1B PR or follow-up story |
| MEDIUM | Create backlog story | Epic 12 (Polish) |
| LOW | Document, defer | Post-MVP |

---

## Test Exit Criteria

Epic 1B is **ready for release** when:

### ✅ Phase 1: Automated Tests
- [ ] All Playwright E2E tests pass (Stories 1.6-1.9)
- [ ] Tests run in CI/CD pipeline (Chromium only for local, full matrix in CI)
- [ ] Code coverage ≥80% for new Epic 1B code
- [ ] No failing accessibility checks (axe-core violations)

### ✅ Phase 2: Real-World Validation
- [ ] Manual import session completed with 10+ real courses
- [ ] Zero BLOCKER issues found
- [ ] All HIGH issues resolved or documented as follow-up stories
- [ ] Real-world validation report saved to `docs/reviews/`

### ✅ Phase 3: Design Review
- [ ] Design review agent run completed
- [ ] Zero BLOCKER design issues
- [ ] HIGH design issues resolved or documented
- [ ] Accessibility violations (if any) triaged

### ✅ Code Quality
- [ ] Code review passed (adversarial review by code-review agent)
- [ ] No hardcoded colors (ESLint design-tokens rule)
- [ ] No test anti-patterns (deterministic time, no hard waits)
- [ ] Lessons learned documented

---

## Test Metrics & Reporting

### Automated Test Metrics

Track in CI/CD and `docs/implementation-artifacts/sprint-status.yaml`:

- **Total Tests:** Count of E2E tests for Epic 1B
- **Pass Rate:** % of tests passing
- **Execution Time:** Time to run full Epic 1B suite
- **Flakiness:** Tests with inconsistent results (target: 0%)

### Manual Test Metrics

Track in Real-World Validation Report:

- **Import Success Rate:** % of courses imported without errors
- **Performance:** Average import time per course
- **Issues Found:** Count by severity (BLOCKER/HIGH/MEDIUM/LOW)
- **Enhancement Opportunities:** Count of new feature ideas

### Design Review Metrics

Track in Design Review Report:

- **Total Issues:** Count of all design findings
- **By Severity:** BLOCKER/HIGH/MEDIUM/LOW breakdown
- **Accessibility Violations:** Count of WCAG failures
- **Resolution Rate:** % of issues fixed before release

---

## Continuous Improvement

### Post-Release Validation

After Epic 1B ships:

- **Week 1:** Monitor for user-reported issues (if applicable)
- **Week 2:** Re-run real-world validation with 50+ courses
- **Week 4:** Retrospective: update test fixtures based on findings

### Test Fixture Maintenance

- **After each Epic 1B bug fix:** Add regression test fixture
- **After each story:** Update fixture READMEs with actual sample files
- **Quarterly:** Review fixtures for staleness, update as needed

### Test Plan Improvements

- **After Epic 1B:** Document what worked, what didn't
- **Update this plan:** Based on lessons learned
- **Share findings:** Update `docs/engineering-patterns.md` with testing insights

---

## Appendix: Related Documentation

- [Epic 1B Stories](_bmad-output/planning-artifacts/epics.md#epic-1b-library-enhancements)
- [Test Fixture Documentation](../../tests/fixtures/courses/README.md)
- [E2E Test Patterns](.claude/rules/testing/test-patterns.md)
- [Design Review Workflow](.claude/rules/workflows/design-review.md)
- [Story Workflow](.claude/rules/workflows/story-workflow.md)

---

## Quick Reference: Test Commands

```bash
# Automated Tests (Phase 1)
npm run test:e2e -- --grep "Story 1\.[6-9]"

# Real-World Testing (Phase 2)
# Manual import from /Volumes/Academy/Health & Fitness
# Document findings in docs/reviews/real-world-validation-epic-1b-[date].md

# Design Review (Phase 3)
/design-review
# Output: docs/reviews/design/design-review-[date]-epic-1b.md

# Full Epic 1B Validation Pipeline
npm run test:e2e -- --grep "Story 1\.[6-9]"  # Phase 1
# [Manual session]                            # Phase 2
/design-review                                # Phase 3
# Review all reports, triage findings, ship! 🚀
```
