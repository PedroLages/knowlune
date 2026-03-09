# Code Review Testing Configuration

**Epic 7 Retrospective Action Item #3**

## Test Coverage Requirements

### Acceptance Criteria Coverage Standard

**MANDATORY MINIMUM:** ≥80% AC coverage per story

### Coverage Calculation

```
AC Coverage = (Tested ACs / Total ACs) × 100%
```

**Tested AC Definition:**
- Has explicit E2E test case covering the AC scenario
- Test case passes and verifies the expected behavior
- Edge cases within the AC are covered

### Enforcement

The `code-review-testing` agent MUST:

1. **Count total ACs** from story file
2. **Identify tested ACs** from E2E spec file
3. **Calculate coverage percentage**
4. **BLOCK stories with <80% coverage**

### Blocker Severity

| Coverage | Severity | Action |
|----------|----------|--------|
| <60% | BLOCKER | Must fix before review approval |
| 60-79% | BLOCKER | Must add tests to reach 80% |
| 80-89% | HIGH | Recommend additional coverage |
| ≥90% | PASS | Meets standard |

### Example Review Output

```markdown
## Test Coverage Analysis

**Acceptance Criteria Coverage:** 3/6 ACs tested (50%)

### Tested ACs:
- ✅ AC1: Course card displays momentum indicator
- ✅ AC2: Sort by momentum option present
- ✅ AC4: Empty state shows message

### Untested ACs:
- ❌ AC3: Momentum indicator shows hot/warm/cold
- ❌ AC5: Momentum recalculates without reload
- ❌ AC6: Sort actually orders by score

**🔴 BLOCKER: Coverage is 50% (below 80% threshold)**

Stories cannot be marked "done" until coverage reaches ≥80%.
```

### Edge Case Requirements

Beyond AC coverage, tests should cover:
- **Boundary conditions** (exactly 14 days, momentum exactly 20, etc.)
- **Error states** (division by zero, empty arrays, null values)
- **User flow variations** (new user vs existing, no data vs full data)

### Implementation

**Story checklist before `/review-story`:**
- [ ] All ACs have corresponding test cases
- [ ] E2E spec file has comments mapping tests to ACs (e.g., `// AC1: ...`)
- [ ] Coverage ≥80% verified
- [ ] Edge cases identified and tested

**Code review testing agent:**
- Parses story ACs from frontmatter or "## Acceptance Criteria" section
- Maps E2E test cases to ACs via comments or test descriptions
- Calculates coverage percentage
- Reports BLOCKER if <80%

---

## Historical Context

### Why 80%?

Epic 5 and Epic 6 committed to ≥80% AC coverage but achieved only 33-50% in practice because there was no enforcement.

### Epic 7 Failures

- Story 7-1: AC5 had zero coverage (event never dispatched)
- Story 7-5: AC6 untested (auto-update reactivity)

Both issues were caught in code review, but would have been prevented by enforced coverage gates.

### Success Criteria

Epic 8 should have **zero stories** marked "done" with <80% AC coverage. This requires the code-review-testing agent to be configured to BLOCK low coverage, not just warn.

---

**Effective Date:** Before Epic 8 starts
**Owner:** Dana (QA) + code-review-testing agent configuration
**Review Frequency:** Every story in Epic 8+
