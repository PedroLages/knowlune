# CLAUDE.md Best Practices Review

**Date:** 2026-03-13
**Current File Size:** 917 lines
**Recommended Maximum:** <300 lines ([Anthropic best practices](https://code.claude.com/docs/en/best-practices))
**Status:** ⚠️ **EXCEEDS RECOMMENDATION BY 206%** (3.06x recommended size)

---

## Executive Summary

The current CLAUDE.md (917 lines) exceeds Anthropic's best practice recommendation (<300 lines) by 617 lines (206%). While the content is high-quality and comprehensive, **loading 917 lines into every conversation** consumes significant context window and may degrade performance.

**Key Research Finding** ([Anthropic official docs](https://www.humanlayer.dev/blog/writing-a-good-claude-md)):
> "Claude's context window fills up fast, and performance degrades as it fills... ensure that its contents are as universally applicable as possible."

**Critical Principle** ([HumanLayer best practices](https://www.humanlayer.dev/blog/writing-a-good-claude-md)):
> "Since CLAUDE.md goes into every single session, you should ensure that its contents are as universally applicable as possible. For example, avoid including instructions about how to structure a new database schema - this won't matter and will distract the model when you're working on something else that's unrelated."

---

## Anthropic Official Best Practices

### 1. Length Guidelines

**Source:** [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)

- **Recommended:** <300 lines (shorter is better)
- **Why:** Context window fills fast, performance degrades
- **LevelUp Status:** 917 lines (3.06x limit)

### 2. Content Strategy

**What to Include:**
- ✅ Build and test commands
- ✅ Coding standards
- ✅ Architectural decisions
- ✅ Naming conventions
- ✅ Common workflows

**What to Avoid:**
- ❌ Session-specific instructions (e.g., "how to structure a new database schema")
- ❌ Code snippets (use file:line references instead)
- ❌ Style guidelines (use linters/formatters instead)
- ❌ Verbose examples (prefer concise pointers)

### 3. Code References Over Snippets

**Source:** [HumanLayer CLAUDE.md Guide](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

> "Don't include code snippets in these files if possible - they will become out-of-date quickly. Instead, include file:line references to point Claude to the authoritative context."

**Good Example:**
```markdown
See [VideoPlayer.tsx:145-167](src/app/components/VideoPlayer.tsx#L145-L167) for PiP implementation
```

**Bad Example:**
```markdown
\`\`\`typescript
async function mockDateNow(page: Page) {
  await page.addInitScript(({ fixedTimestamp }) => {
    Date.now = () => fixedTimestamp
  }, { fixedTimestamp: new Date(FIXED_DATE).getTime() })
}
\`\`\`
```

### 4. Living Documentation

**Source:** [callmephilip Notes on CLAUDE.md](https://callmephilip.com/posts/notes-on-claude-md-structure-and-best-practices/)

> "When Claude gets something wrong — uses the wrong import path, breaks a naming convention, misunderstands your project structure — don't just fix it and move on. Tell Claude to add the correction to CLAUDE.md itself. Over time, your CLAUDE.md becomes a living record of your codebase's quirks and preferences."

**Recommendation:** Add this instruction to CLAUDE.md itself:
```markdown
## Maintaining CLAUDE.md

When you make a mistake due to missing context:
1. Fix the immediate issue
2. Add the correction to this file (or suggest where it belongs)
3. Keep entries concise (prefer file:line references over examples)
```

### 5. Hierarchical Structure (Advanced)

**Source:** [HumanLayer CLAUDE.md Guide](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

> "Claude automatically merges multiple CLAUDE.md files based on directory structure. This mirrors how senior engineers think: global principles + local constraints."

**Example:**
```
/CLAUDE.md                           # Global: build commands, tech stack, conventions
/src/app/components/CLAUDE.md        # Component-specific patterns
/tests/CLAUDE.md                     # Test-specific patterns (determinism, factories)
```

**Benefits:**
- Keeps root CLAUDE.md focused (<300 lines)
- Context loaded only when working in specific directories
- Easier to maintain (each file owns its domain)

---

## Current CLAUDE.md Analysis

### ✅ Strengths

1. **Comprehensive Coverage**
   - Excellent architecture overview
   - Clear build commands and development workflow
   - Well-documented test patterns
   - Strong automation catalog (newly added)

2. **Good File References**
   - Uses markdown links to docs: `[story-template.md](docs/implementation-artifacts/story-template.md)`
   - References specific files: `[eslint.config.js](eslint.config.js)`

3. **Universal Applicability**
   - Design token enforcement (applies to all UI work)
   - Test patterns (applies to all testing)
   - Story workflow (applies to all feature development)

4. **Living Documentation**
   - Epic retrospectives inform pattern updates
   - `engineering-patterns.md` referenced for extracted lessons

### ⚠️ Issues (Relative to Best Practices)

#### Issue #1: Excessive Length (917 lines vs 300 recommended)

**Sections Contributing to Bloat:**

| Section | Lines | Universally Applicable? | Recommendation |
|---------|-------|------------------------|----------------|
| E2E Test Patterns | ~240 | Partial (only when writing tests) | **Move to `/tests/CLAUDE.md`** |
| Deterministic Time Handling | ~45 | Partial (only E2E tests) | **Move to `/tests/CLAUDE.md`** |
| IndexedDB Seeding Best Practices | ~25 | Partial (only E2E tests) | **Move to `/tests/CLAUDE.md`** |
| Waiting & Polling Patterns | ~30 | Partial (only E2E tests) | **Move to `/tests/CLAUDE.md`** |
| Test Data Management | ~20 | Partial (only E2E tests) | **Move to `/tests/CLAUDE.md`** |
| Sidebar Test Gotcha | ~15 | Partial (only E2E tests) | **Move to `/tests/CLAUDE.md`** |
| Browser-Specific Test Handling | ~10 | Partial (only E2E tests) | **Move to `/tests/CLAUDE.md`** |
| Design Review Workflow | ~120 | Partial (only UI work) | **Condense to 20 lines, link to full doc** |
| Story Development Workflow | ~170 | Universal (applies to all work) | **Keep but condense to 60 lines** |
| **TOTAL MOVEABLE** | **~675 lines** | | **Reduces to ~240 lines** |

**Impact:**
- Moving test-specific content (385 lines) to `/tests/CLAUDE.md` would reduce root file to 532 lines
- Condensing Design Review (100 lines saved) and Story Workflow (110 lines saved) would further reduce to 322 lines
- **Final estimate: ~240-320 lines** (within recommended range)

#### Issue #2: Code Snippet Duplication

**Examples of code snippets that should be file:line references:**

1. **Deterministic Time Handling** (lines 236-251):
   ```markdown
   # ❌ Current (15 lines of code)
   ```typescript
   import { FIXED_DATE, FIXED_TIMESTAMP, getRelativeDate, addMinutes } from '@/tests/utils/test-time'

   // ✅ CORRECT - Deterministic dates
   const session = {
     startTime: FIXED_DATE,
     endTime: addMinutes(30),
     studyDate: getRelativeDate(-7)
   }
   ```

   # ✅ Recommended (3 lines with reference)
   **ALWAYS** use deterministic time from `tests/utils/test-time.ts`:
   - See [test-time.ts](tests/utils/test-time.ts) for utilities (FIXED_DATE, getRelativeDate, addMinutes)
   - Example usage: [story-e07-s04.spec.ts:45-52](tests/e2e/regression/story-e07-s04.spec.ts#L45-L52)
   ```

2. **IndexedDB Seeding** (lines 282-299):
   Similar issue — 17 lines of code example that should be a file:line reference

3. **Browser Context Date Mocking** (lines 264-276):
   12 lines of code that should reference actual implementation

**Total Code Snippets:** ~120 lines that could be 20-30 lines of file:line references

#### Issue #3: Redundant Content

**Design Token System appears twice:**

1. **Lines 104-130** (Design Token System section):
   - Quick reference table
   - Enforcement details
   - Why design tokens matter

2. **Lines 144-150** (Design Tokens section - legacy):
   - Primary colors and spacing
   - Hardcoded color values

**Recommendation:** Merge into single concise section (15 lines), remove redundancy (saves 20 lines)

#### Issue #4: Verbose Test Pattern Descriptions

**Example:**

**Current** (30 lines for Waiting & Polling Patterns):
```markdown
#### Waiting & Polling Patterns

**PREFER** Playwright's built-in waits over manual polling:

```typescript
// ✅ BEST - Playwright auto-retry
await expect(page.getByTestId('momentum-badge')).toBeVisible()

// ✅ GOOD - Conditional wait
await page.waitForFunction(() => {
  return window.myApp?.isReady === true
})

// ❌ WRONG - Hard wait
await page.waitForTimeout(1000)
```

**For Complex Polling**: Use `waitForCondition()` utility...
```

**Recommended** (5 lines with reference):
```markdown
#### Waiting & Polling Patterns

Use Playwright auto-retry (expect().toBeVisible(), waitForFunction()) over waitForTimeout().
See [test-quality.md](_bmad/tea/testarch/knowledge/test-quality.md#waiting-patterns) for examples.
ESLint rule `test-patterns/no-hard-waits` warns on unjustified waitForTimeout() usage.
```

**Savings:** 25 lines per verbose pattern × 6 patterns = 150 lines saved

---

## Recommended Restructuring

### Phase 1: Create Hierarchical CLAUDE.md Files

**Goal:** Reduce root CLAUDE.md from 917 → ~250 lines

#### 1.1. Create `/tests/CLAUDE.md` (385 lines of test-specific content)

**File:** `/tests/CLAUDE.md`

**Contents:**
- Deterministic Time Handling (move from root lines 232-259)
- IndexedDB Seeding Best Practices (move from root lines 279-306)
- Waiting & Polling Patterns (move from root lines 308-337)
- NFR Violations to Avoid (move from root lines 339-361)
- File Organization (move from root lines 363-381)
- Test Data Management (move from root lines 383-410)
- Sidebar Test Gotcha (move from root lines 412-428)
- Browser-Specific Test Handling (move from root lines 430-442)
- Test Execution Scopes (move from root lines 444-460)
- References (move from root lines 462-472)

**Benefits:**
- Test-specific content only loaded when working in `/tests` directory
- Reduces root CLAUDE.md by 385 lines (917 → 532)

#### 1.2. Condense Design Review Section (120 → 20 lines)

**Current** (lines 473-594): 120 lines with full workflow, checklist, command usage

**Recommended** (20 lines):
```markdown
## Design Review Workflow

Automated UI/UX quality assurance using Playwright browser automation.

**When Required:**
- Any changes to UI components (`.tsx` files in `components/`)
- Page-level modifications, styling changes, new components

**Trigger:**
- Manual: `/design-review` slash command
- Auto: GitHub Actions on PRs with UI changes

**Process:**
1. Analyzes git diff for modified files
2. Live tests at mobile/tablet/desktop viewports
3. Validates WCAG 2.1 AA+ accessibility
4. Generates severity-triaged report (Blockers → Nitpicks)

**Resources:**
- Full workflow: [design-review/design-principles.md](.claude/workflows/design-review/design-principles.md)
- Agent config: [design-review/agent-config.md](.claude/workflows/design-review/agent-config.md)
- Checklist: See "Design Review Checklist" in design-principles.md
```

**Savings:** 100 lines (120 → 20)

#### 1.3. Condense Story Development Workflow (170 → 60 lines)

**Current** (lines 595-767): 170 lines with detailed workflow, burn-in testing, branch naming

**Recommended** (60 lines):
```markdown
## Story Development Workflow

Three slash commands orchestrate branch creation → implementation → review → PR.

**Commands:**
- `/start-story E##-S##` — Creates branch, story file, optional ATDD tests
- `/review-story E##-S##` — Runs all quality gates (build, lint, tests, design/code review)
- `/finish-story E##-S##` — Validates, creates PR (auto-runs reviews if needed)

**Workflow Modes:**
- **Streamlined:** `/start-story` → implement → `/finish-story` (auto-reviews inline)
- **Comprehensive:** `/start-story` → implement → `/review-story` → fix → `/finish-story`

**Git Requirements:**
- `/review-story` and `/finish-story` require clean working tree (pre-review hook enforces)
- Uncommitted changes are NOT reviewed (runs `git diff main...HEAD`)

**Quality Gates** (run by `/review-story`):
1. Build, lint, type-check, format, unit tests, E2E tests (Chromium only)
2. Lessons learned gate (blocks if placeholder text remains)
3. Design review agent (Playwright MCP - UI/UX/accessibility)
4. Code review agent (architecture, security, silent failures)
5. Test coverage agent (AC mapping, edge cases, test quality)

**Burn-In Testing** (optional):
- Auto-suggested if test anti-patterns detected (Date.now(), waitForTimeout(), manual IDB seeding)
- Runs 10 iterations to validate stability
- Blocks review if flakiness detected

**Branch Naming:** `feature/e##-s##-slug` (lowercase, hyphens)
**Example:** `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`

**After Epic Completion:**
- `/testarch-trace` — Requirements-to-tests traceability matrix
- `/testarch-nfr` — Non-functional requirements validation
- `/retrospective` — Lessons learned and pattern extraction

**Key Files:**
- Story template: [story-template.md](docs/implementation-artifacts/story-template.md)
- Sprint tracking: [sprint-status.yaml](docs/implementation-artifacts/sprint-status.yaml)
- Review reports: `docs/reviews/{design,code}/`
- Skills: `.claude/skills/{start,review,finish}-story/SKILL.md`
```

**Savings:** 110 lines (170 → 60)

### Phase 2: Convert Code Snippets to File:Line References

**Goal:** Replace ~120 lines of code examples with 20-30 lines of references

**Examples:**

#### Before (15 lines):
```markdown
```typescript
import { FIXED_DATE, FIXED_TIMESTAMP, getRelativeDate, addMinutes } from '@/tests/utils/test-time'

// ✅ CORRECT - Deterministic dates
const session = {
  startTime: FIXED_DATE,
  endTime: addMinutes(30),
  studyDate: getRelativeDate(-7)
}
```
```

#### After (3 lines):
```markdown
**Deterministic Time:** Use utilities from [test-time.ts](tests/utils/test-time.ts) (FIXED_DATE, getRelativeDate, addMinutes).
Example: [story-e07-s04.spec.ts:45-52](tests/e2e/regression/story-e07-s04.spec.ts#L45-L52)
```

**Apply to:**
- Deterministic Time Handling (15 → 3 lines)
- IndexedDB Seeding (17 → 3 lines)
- Browser Context Date Mocking (12 → 3 lines)
- Waiting & Polling Patterns (30 → 5 lines)
- Test Data Management (20 → 5 lines)
- Factory Pattern example (15 → 3 lines)

**Total Savings:** ~90 lines (120 → 30)

### Phase 3: Remove Redundancy

**Goal:** Eliminate duplicate/overlapping content (20 lines saved)

1. **Design Token System** (appears twice):
   - Merge lines 104-130 and 144-150 into single section (30 → 15 lines)
   - **Savings:** 15 lines

2. **Git Hooks** (mentioned in two places):
   - Lines 161-188 (dedicated section)
   - Lines 635-642 (story workflow section)
   - Keep dedicated section, remove from story workflow
   - **Savings:** 7 lines

**Total Savings:** ~20 lines

---

## Proposed New Structure

### Root `/CLAUDE.md` (~250 lines)

```markdown
# CLAUDE.md

## Project Overview (10 lines)
[LevelUp description, tech stack summary]

## Development Commands (5 lines)
[npm scripts, Vite dev server]

## Architecture (40 lines)
- Tech Stack (10 lines)
- File Structure (20 lines - condensed tree)
- Import Alias (3 lines)
- Routing Architecture (7 lines)

## Styling System (30 lines)
- Tailwind CSS v4 (10 lines)
- Design Token System (15 lines - merged/deduplicated)
- UI Component Library (5 lines - list only, no examples)

## Key Conventions (10 lines)
[Page components, UI components, styling, icons, images]

## Automated Quality Enforcement (70 lines)
[Full automation catalog - newly added, keep as-is]

## Git Hooks (20 lines)
[Pre-review, pre-push installation and usage]

## Design Review Workflow (20 lines)
[Condensed from 120 lines, link to full docs]

## Story Development Workflow (60 lines)
[Condensed from 170 lines, core commands and gates]

## Test Cleanup Strategy (15 lines)
[Playwright context isolation, factory pattern summary]
[Link to /tests/CLAUDE.md for detailed patterns]

## Maintaining CLAUDE.md (10 lines)
[Living documentation instructions, when to update, how to keep concise]

**TOTAL: ~290 lines** (within 300-line recommendation)
```

### `/tests/CLAUDE.md` (~400 lines)

```markdown
# Test Patterns & Best Practices

This file is loaded when working in the `/tests` directory.
For general project guidance, see [/CLAUDE.md](../CLAUDE.md).

## E2E Test Patterns

### Deterministic Time Handling
[Move 45 lines from root]

### IndexedDB Seeding Best Practices
[Move 25 lines from root]

### Waiting & Polling Patterns
[Move 30 lines from root]

### NFR Violations to Avoid
[Move 25 lines from root]

### File Organization
[Move 20 lines from root]

### Test Data Management
[Move 25 lines from root]

### Sidebar Test Gotcha
[Move 15 lines from root]

### Browser-Specific Test Handling
[Move 10 lines from root]

### Test Execution Scopes
[Move 20 lines from root]

### References
[Move 15 lines from root]

**TOTAL: ~400 lines** (test-specific, only loaded when working in /tests)
```

---

## Implementation Plan

### Option A: Gradual Refactor (Recommended)

**Why:** Minimizes disruption, allows validation at each step

**Steps:**
1. **Create `/tests/CLAUDE.md`** (1 hour)
   - Move all test-specific content from root
   - Update cross-references
   - Test by running `/review-story` on a test file (verify context loads correctly)
   - Commit: "refactor: move test patterns to /tests/CLAUDE.md (385 lines → separate file)"

2. **Condense Design Review section** (30 min)
   - Reduce from 120 → 20 lines
   - Keep links to full docs
   - Test by running `/design-review` (verify still works)
   - Commit: "refactor: condense design review section in CLAUDE.md (100 lines saved)"

3. **Condense Story Workflow section** (30 min)
   - Reduce from 170 → 60 lines
   - Keep core commands and gates
   - Test by running `/start-story` and `/review-story` (verify still works)
   - Commit: "refactor: condense story workflow section in CLAUDE.md (110 lines saved)"

4. **Convert code snippets to file:line refs** (1 hour)
   - Replace ~120 lines of examples with 30 lines of references
   - Test a few references by clicking them (verify links work)
   - Commit: "refactor: replace code snippets with file:line refs in CLAUDE.md (90 lines saved)"

5. **Remove redundancy** (15 min)
   - Merge duplicate Design Token sections
   - Remove duplicate git hooks mention
   - Commit: "refactor: remove redundant content in CLAUDE.md (20 lines saved)"

6. **Verify final count** (5 min)
   ```bash
   wc -l CLAUDE.md  # Should be ~240-290 lines
   wc -l tests/CLAUDE.md  # Should be ~400 lines
   ```

**Total Effort:** ~3-4 hours
**Final Result:** Root CLAUDE.md: 917 → ~250-290 lines (72% reduction)

### Option B: Full Rewrite (Higher Risk)

**Why:** Clean slate, optimal structure, but risk of missing critical content

**Not recommended** unless you have comprehensive test coverage to validate nothing breaks.

---

## Anthropic Best Practices Compliance Checklist

### Length & Scope

- [ ] **Root CLAUDE.md < 300 lines** (currently 917 → target ~250)
- [ ] **Content is universally applicable** (test-specific → moved to /tests/CLAUDE.md)
- [ ] **Avoid session-specific instructions** (✅ mostly good, just verbose)

### Code References

- [ ] **Prefer file:line refs over code snippets** (⚠️ needs improvement)
- [ ] **Avoid code that goes stale** (⚠️ some test examples could be outdated)

### Style Guidelines

- [ ] **Don't include style rules** (✅ uses ESLint, not prose style guides)
- [ ] **Defer to linters/formatters** (✅ eslint.config.js, prettier config)

### Living Documentation

- [ ] **Update CLAUDE.md when Claude makes mistakes** (⚠️ no explicit instruction)
- [ ] **Add self-maintenance guidance** (❌ missing - should add)

### Hierarchical Structure

- [ ] **Use multiple CLAUDE.md files** (❌ not currently, but recommended)
- [ ] **Directory-specific context** (❌ all in root - should split)

---

## Measuring Effectiveness

### Before Refactor (Baseline)

Track these metrics for 3-5 conversations:
- **Time to first meaningful response** (how long until Claude gives useful output)
- **Context window consumption** (check `/tasks` or debug logs for token usage)
- **Relevance of initial suggestions** (does Claude cite irrelevant CLAUDE.md sections?)

### After Refactor (Validation)

Repeat measurement:
- **Expected improvement:** 10-20% faster first response (less context to process)
- **Expected improvement:** More focused suggestions (less distraction from irrelevant content)
- **Expected improvement:** Lower token usage per session start

### Success Criteria

**Phase 1 Success (Hierarchical Split):**
- ✅ Root CLAUDE.md < 300 lines
- ✅ `/tests/CLAUDE.md` loads only when working in tests/
- ✅ No regression in workflow functionality (all skills still work)

**Phase 2 Success (Code Ref Conversion):**
- ✅ Code snippets reduced by 75% (120 → 30 lines)
- ✅ File:line links work correctly (clickable, point to correct code)

**Phase 3 Success (Redundancy Removal):**
- ✅ No duplicate sections
- ✅ Single source of truth for each concept

---

## References

**Anthropic Official Documentation:**
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [How Claude remembers your project](https://docs.anthropic.com/en/docs/claude-code/memory)
- [How Anthropic teams use Claude Code (PDF)](https://www-cdn.anthropic.com/58284b19e702b49db9302d5b6f135ad8871e7658.pdf)

**Community Best Practices:**
- [Writing a good CLAUDE.md - HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Creating the Perfect CLAUDE.md - Dometrain](https://dometrain.com/blog/creating-the-perfect-claudemd-for-claude-code/)
- [CLAUDE.md Best Practices - Nick Babich (UX Planet)](https://uxplanet.org/claude-md-best-practices-1ef4f861ce7c)
- [Notes on CLAUDE.md Structure - callmephilip](https://callmephilip.com/posts/notes-on-claude-md-structure-and-best-practices/)

**Research Findings:**
- Context window management: "Claude's context window fills up fast, and performance degrades as it fills"
- Universal applicability: "Avoid including instructions about how to structure a new database schema - this won't matter and will distract the model when you're working on something else"
- Code snippet avoidance: "Don't include code snippets in these files if possible - they will become out-of-date quickly"
- Living documentation: "When Claude gets something wrong, tell it to add the correction to CLAUDE.md itself"

---

## Next Steps

**Immediate (High Priority):**
1. Review this analysis with stakeholders
2. Decide on Option A (Gradual) vs Option B (Rewrite)
3. If approved, implement Phase 1 (hierarchical split) this week

**Short-Term (This Sprint):**
1. Complete all 5 refactor steps
2. Measure effectiveness (before/after token usage)
3. Document results in Epic 8 retrospective

**Long-Term (Maintenance):**
1. Add "Maintaining CLAUDE.md" section to root file
2. Establish review cadence (quarterly check for bloat)
3. Update automation catalog when new rules added

---

**Status:** Ready for stakeholder review and approval.
