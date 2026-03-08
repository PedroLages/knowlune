---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests']
lastStep: 'step-02-discover-tests'
lastSaved: '2026-03-08'
workflowType: 'testarch-trace'
inputDocuments:
  - 'docs/implementation-artifacts/plans/e07-s04-at-risk-course-detection-completion-estimates.md'
  - 'tests/e2e/story-e07-s04.spec.ts'
---

# Traceability Matrix & Gate Decision - Story E07-S04

**Story:** At-Risk Course Detection & Completion Estimates
**Date:** 2026-03-08
**Evaluator:** Pedro

---

Note: This workflow does not generate tests. If gaps exist, run `*atdd` or `*automate` to create coverage.

## PHASE 1: REQUIREMENTS TRACEABILITY

### Step 1: Context Loaded

**Knowledge Base Loaded:**
- ✅ test-priorities-matrix.md - Test prioritization P0-P3 framework
- ✅ risk-governance.md - Risk scoring and gate decision rules
- ✅ probability-impact.md - Risk assessment matrix (1-9 scale)
- ✅ test-quality.md - Test quality definition of done
- ✅ selective-testing.md - Test selection and execution strategies

**Artifacts Loaded:**
- ✅ **Story Plan**: `docs/implementation-artifacts/plans/e07-s04-at-risk-course-detection-completion-estimates.md`
  - Story E07-S04: At-Risk Course Detection & Completion Estimates
  - Context: Adds visual warnings for neglected courses (14+ days, momentum < 20)
  - Dependencies: E07-S01, E07-S02, E07-S03, E07-S05 (all completed)
  - Implementation approach: 2 calculation modules + 2 UI components + integration

- ✅ **E2E Test File**: `tests/e2e/story-e07-s04.spec.ts`
  - 6 test cases covering all acceptance criteria
  - Uses deterministic time utilities (test-time.ts)
  - IndexedDB seeding with factory patterns
  - Tests for badge display, removal, completion estimates, layout, and sorting

**Story Branch:** `feature/e07-s04-at-risk-course-detection-completion-estimates`

**Acceptance Criteria Identified from Tests:**
- AC1: At-risk badge displays when 14+ days inactivity AND momentum < 20
- AC2: Badge removes when momentum score increases to 20+
- AC3: Completion estimate based on remaining content and average pace
- AC4: Default 30-minute pace for new users with no sessions
- AC5: Both indicators visible without visual overlap
- AC6: At-risk courses appear at bottom when sorted by momentum

---

*Ready to proceed to Step 2: Discover Tests*
