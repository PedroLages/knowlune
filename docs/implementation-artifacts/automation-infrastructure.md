# Automation Infrastructure

**Epic 7 Retrospective Actions #1, #2, #3**
**Implemented:** 2026-03-08
**Status:** Active (Effective Epic 8+)

---

## Overview

This document describes the automated enforcement mechanisms implemented to prevent process failures identified in Epic 7 retrospective. All mechanisms are **mandatory** and **automatically enforced** — manual compliance is no longer required.

### Why Automation?

**Epic 6 → Epic 7 Follow-Through:** 0%
- 6 action items committed in Epic 6
- 0 items completed in Epic 7
- **Root cause:** Manual process compliance has 0% success rate

**Epic 7 Findings:**
- Hardcoded colors in 4/5 stories (despite design token commitment)
- Empty lessons learned in 2/5 stories (despite DoD commitment)
- AC coverage gaps in 2/5 stories (despite ≥80% target)

**Solution:** Automated enforcement via git hooks, ESLint rules, and agent configuration.

---

## 1. Pre-Review Commit Enforcement (Action #1)

**Problem:** Code review examined committed changes but missed uncommitted files containing bugs or incomplete features.

**Solution:** Pre-review git hook that blocks `/review-story` when working tree is dirty.

### Implementation

**Hook:** `.git/hooks/pre-review`
**Wrapper Script:** `scripts/pre-review-check.sh`

**Checks:**
- ❌ Uncommitted changes (staged or unstaged)
- ❌ Untracked files (excluding .gitignore patterns)
- ❌ Staged but uncommitted changes

**Usage:**

```bash
# Manual check before review
./scripts/pre-review-check.sh

# Or run the hook directly
.git/hooks/pre-review

# Emergency bypass (NOT recommended)
SKIP_PRE_REVIEW=1 /review-story
```

**Integration with /review-story:**
The `/review-story` skill should call `.git/hooks/pre-review` as its first step, blocking execution if the check fails.

**Success Criteria:** Zero "uncommitted files" blockers in Epic 8 code reviews.

---

## 2. Design Token ESLint Enforcement (Action #2)

**Problem:** Hardcoded Tailwind colors (`bg-blue-600`, `text-gray-500`) broke dark mode and violated design system standards.

**Solution:** Custom ESLint plugin that flags hardcoded colors and enforces design token usage.

### Implementation

**Plugin:** `eslint-plugin-design-tokens.js`
**Config:** `eslint.config.js` (integrated)

**Rules:**
- `design-tokens/no-hardcoded-colors` — ERROR level
- Flags patterns: `bg-<color>-<number>`, `text-<color>-<number>`, `border-<color>-<number>`
- Suggests theme token alternatives

**Flagged Patterns:**

```typescript
// ❌ Flagged by ESLint
<div className="bg-blue-600 text-gray-500">

// ✅ Allowed
<div className="bg-primary text-muted">
```

**Usage:**

```bash
# Run ESLint to check for violations
npm run lint

# Auto-fix where possible
npm run lint -- --fix
```

**Success Criteria:** Zero hardcoded color violations in Epic 8 code reviews.

---

## 3. Test Coverage Gate Configuration (Action #3)

**Problem:** Stories marked "done" with <80% AC coverage despite Epic 6 commitment to ≥80%.

**Solution:** Code-review-testing agent configured to BLOCK stories with <80% AC coverage.

### Implementation

**Agent Config:** `.claude/agents/code-review-testing.md`
**Coverage Config:** `.claude/code-review-testing-config.md`

**Coverage Thresholds:**

| Coverage | Severity | Action |
|----------|----------|--------|
| <60% | BLOCKER | Critical gap, must fix before approval |
| 60-79% | BLOCKER | Must add tests to reach 80% minimum |
| 80-89% | HIGH | Recommend additional coverage |
| ≥90% | PASS | Meets standard, excellent coverage |

**Enforcement:**

The code-review-testing agent:
1. Parses story ACs from frontmatter or "## Acceptance Criteria" section
2. Maps E2E test cases to ACs via comments or test descriptions
3. Calculates coverage percentage: `(Tested ACs / Total ACs) × 100%`
4. **BLOCKS story approval** if coverage <80%

**Report Format:**

```markdown
### AC Coverage Summary

**Acceptance Criteria Coverage:** 3/6 ACs tested (**50%**)

**🚨 COVERAGE GATE:** 🔴 BLOCKER (<80%)

Stories cannot be marked "done" until coverage reaches ≥80%.
```

**Success Criteria:** All Epic 8 stories achieve ≥80% AC coverage before merging.

---

## 4. Pre-Push Hook (Already Implemented)

**Hook:** `.git/hooks/pre-push`

**Checks:**
- ❌ Uncommitted changes
- ⚠️ Untracked files (warns but allows push with confirmation)

**This hook was already active in Epic 7** and successfully blocked pushes with uncommitted changes.

---

## Verification Checklist

Before Epic 8 starts, verify all automation is active:

- [ ] Pre-review hook exists and is executable: `.git/hooks/pre-review`
- [ ] Pre-review wrapper script exists: `scripts/pre-review-check.sh`
- [ ] ESLint plugin exists: `eslint-plugin-design-tokens.js`
- [ ] ESLint config includes design-tokens plugin: `eslint.config.js`
- [ ] Code-review-testing agent enforces 80% gate: `.claude/agents/code-review-testing.md`
- [ ] Coverage config documented: `.claude/code-review-testing-config.md`
- [ ] Pre-push hook active: `.git/hooks/pre-push`

**Verification Commands:**

```bash
# Test pre-review hook
.git/hooks/pre-review

# Test ESLint design token rule
npm run lint src/app/components/ui/badge.tsx

# Verify code-review-testing agent config
cat .claude/agents/code-review-testing.md | grep "Coverage Gate"

# Test pre-push hook
git push --dry-run
```

---

## Team Workflow Changes

### Before Epic 8 (Manual Compliance — FAILED)

1. Developer implements feature
2. Developer remembers to commit all files ❌ (often forgotten)
3. Developer remembers to use design tokens ❌ (often forgotten)
4. Developer remembers to test all ACs ❌ (often incomplete)
5. Code review catches issues **after** implementation

**Result:** 2-3 review rounds per story, repeated violations

### Epic 8+ (Automated Enforcement — MANDATORY)

1. Developer implements feature
2. Developer runs `npm run lint` → **ESLint blocks hardcoded colors**
3. Developer runs `./scripts/pre-review-check.sh` → **Hook blocks uncommitted files**
4. Developer runs `/review-story` → **Agent blocks <80% AC coverage**
5. Code review focuses on logic, design, and edge cases (not compliance)

**Expected Result:** Fewer review rounds, zero compliance violations

---

## Success Metrics

**Epic 8 Goals:**

| Metric | Epic 7 Baseline | Epic 8 Target |
|--------|-----------------|---------------|
| Stories with hardcoded colors | 4/5 (80%) | 0/N (0%) |
| Stories with incomplete lessons learned | 2/5 (40%) | 0/N (0%) |
| Stories with <80% AC coverage | 2/5 (40%) | 0/N (0%) |
| Uncommitted files blockers | 1+ per epic | 0 |
| Review rounds per story | 2-3 | 1-2 |

**Measurement:** Track blockers in Epic 8 code reviews and compare to Epic 7 baseline.

---

## Maintenance

**Hook Updates:**
- Git hooks are not version-controlled. If hooks are updated, developers must manually copy them to `.git/hooks/`.
- Consider using [Husky](https://typicode.github.io/husky/) for shared hook management in future epics.

**ESLint Rule Updates:**
- Design token patterns are hardcoded in `eslint-plugin-design-tokens.js`
- If theme tokens change (new colors, renamed tokens), update the plugin's allowlist

**Agent Config Updates:**
- Coverage thresholds (80%, 90%) are in `.claude/agents/code-review-testing.md`
- Adjust thresholds based on Epic 8 outcomes

---

## Troubleshooting

### "Pre-review check failed but I've committed everything"

```bash
# Verify working tree status
git status

# Check for untracked files
git ls-files --others --exclude-standard

# If files are intentional (temp, local config), add to .gitignore
echo "*.local" >> .gitignore
git add .gitignore
git commit -m "chore: ignore local config files"
```

### "ESLint is flagging valid design tokens"

Check if the token is in the allowlist in `eslint-plugin-design-tokens.js`. If it's a new theme token, add it:

```javascript
// eslint-plugin-design-tokens.js
const ALLOWED_PATTERNS = [
  /^bg-primary$/,
  /^bg-secondary$/,
  /^bg-your-new-token$/,  // Add new token here
  // ...
]
```

### "Code-review-testing agent isn't calculating coverage correctly"

Ensure test files have AC mapping comments:

```typescript
// E2E test file
test('AC1: User can view momentum indicator', async ({ page }) => {
  // Test implementation
})

test('AC2: Sort by momentum reorders courses', async ({ page }) => {
  // Test implementation
})
```

The agent parses test names and comments to map tests to ACs. Use clear AC references.

---

## Related Documentation

- **Epic 7 Retrospective:** `docs/implementation-artifacts/epic-7-retro-2026-03-08.md`
- **Process Retrospective:** `docs/implementation-artifacts/process-retrospective-epic6-to-epic7.md`
- **Coverage Config:** `.claude/code-review-testing-config.md`
- **Code Review Standards:** `docs/reviews/code/README.md` (if exists)

---

**Effective Date:** 2026-03-08 (before Epic 8 starts)
**Last Updated:** 2026-03-08
**Next Review:** After Epic 8 completion (assess effectiveness)
