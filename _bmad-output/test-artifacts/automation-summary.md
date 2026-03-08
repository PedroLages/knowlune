---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets']
lastStep: 'step-02-identify-targets'
lastSaved: '2026-03-08'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/test-priorities-matrix.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/selective-testing.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/overview.md'
  - '_bmad/tea/testarch/knowledge/selector-resilience.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - 'docs/implementation-artifacts/sprint-status.yaml'
  - '.claude/agent-memory/code-review/story-details.md'
  - 'playwright.config.ts'
  - 'package.json'
---

# Test Automation Expansion Summary

**Generated**: 2026-03-08
**User**: Pedro
**Project**: LevelUp (E-learning Platform)
**Mode**: BMad-Integrated + Standalone Analysis
**Coverage Target**: Critical Paths

---

## Step 1: Preflight & Context Loading ✅

### Stack Detection

**Detected Stack**: `frontend`

**Evidence**:
- `package.json` with React 19, Vite 6, TypeScript dependencies
- `playwright.config.ts` exists and configured
- No backend indicators (no `pyproject.toml`, `go.mod`, etc.)

**Framework Verification**: ✅ PASSED
- Playwright config: `playwright.config.ts`
- Test dependencies: `@playwright/test@1.58.2`, `vitest@4.0.18`
- E2E directory: `tests/e2e/`

---

### Execution Mode

**Mode**: BMad-Integrated + Standalone Analysis

**BMad Artifacts Found**:
- ✅ Sprint status tracking (`sprint-status.yaml`)
- ✅ Epic/story structure (Epic 7 in-progress, Story 7-4 active)
- ✅ Code review findings (`.claude/agent-memory/code-review/story-details.md`)
- ✅ Gap coverage opportunities (Stories 7-6 through 7-11)

**User Argument**: "Automation expansion opportunities"

**Decision**: Perform **full codebase analysis** beyond just the current story to identify all automation gaps and expansion opportunities.

---

### Context Loaded

#### BMad Integration Context

**Current Sprint Status**:
- **Epic 7**: Course Momentum & Learning Intelligence (in-progress)
- **Story 7-4**: At-Risk Course Detection & Completion Estimates (in-progress)
- **Completed Epics**: 1-6 (all stories done, retrospectives complete)
- **Backlog Epics**: 8-18 (various features pending)

**Identified Gap Coverage Stories** (from `sprint-status.yaml`):
1. **7-6**: E2E test for course suggestion tiebreaker (E07-S03-AC2)
2. **7-7**: Error path corrupted IndexedDB sessions (E07-S01)
3. **7-8**: Error path empty/corrupted allCourses (E07-S02)
4. **7-9**: Error path Zustand persist failure (E07-S03-AC4)
5. **7-10**: Error path malformed study log data (E07-S05)
6. **7-11**: Error path invalid study goal values (E07-S05)

**Code Review Patterns** (from `.claude/agent-memory/code-review/story-details.md`):
- Recurring issue: Hardcoded colors instead of theme tokens
- Recurring issue: Missing E2E test coverage for edge cases
- Recurring issue: No unit tests for calculation functions
- Recurring issue: Hard waits in E2E tests (non-deterministic)

#### Test Framework Context

**Playwright Configuration**:
- **Test directory**: `tests/`
- **Timeout**: 60s (standardized)
- **Expect timeout**: 10s
- **Projects**: 6 browser configurations (Chromium, Mobile Chrome, Mobile Safari, Tablet, a11y-mobile, a11y-desktop)
- **Web server**: Dev server on `http://localhost:5173`
- **Parallel execution**: ✅ Enabled (`fullyParallel: true`)
- **Regression tests**: Ignored by default (`testIgnore: **/regression/**` unless `RUN_REGRESSION=1`)

**Current Test Structure**:

```
tests/
├── e2e/
│   ├── overview.spec.ts                        # Active smoke test
│   ├── navigation.spec.ts                      # Active smoke test
│   ├── courses.spec.ts                         # Active smoke test
│   ├── story-e07-s04.spec.ts                   # Current story test
│   ├── offline-smoke.spec.ts                   # Offline capability test
│   ├── accessibility-overview.spec.ts          # Accessibility test
│   ├── accessibility-courses.spec.ts           # Accessibility test
│   └── regression/
│       ├── story-e03-s08.spec.ts               # Archived
│       ├── story-e04-s04.spec.ts               # Archived
│       ├── story-e05-s02.spec.ts               # Archived
│       ├── story-e06-s01.spec.ts               # Archived
│       ├── story-e07-s05.spec.ts               # Archived
│       └── ... (20+ archived story tests)
├── support/
│   ├── helpers/
│   │   └── indexeddb-seed.ts                   # Shared seeding helpers
│   └── fixtures/
│       └── factories/                          # Data factories
└── utils/
    └── test-time.ts                            # Deterministic time utilities
```

**Test Coverage Summary**:
- ✅ **E2E smoke tests**: 3 specs (overview, navigation, courses)
- ✅ **E2E accessibility tests**: 2 specs
- ✅ **Current story test**: 1 spec (E07-S04)
- ✅ **Regression suite**: 20+ archived specs
- ❌ **Unit tests**: **MISSING** (critical gap - no unit tests found)

#### TEA Configuration Flags

From `_bmad/tea/config.yaml`:

- `tea_use_playwright_utils`: ✅ `true`
- `tea_use_pactjs_utils`: ✅ `true` (not relevant for frontend-only)
- `tea_pact_mcp`: `mcp` (not relevant)
- `tea_browser_automation`: `auto`
- `test_stack_type`: `auto` (detected as `frontend`)
- `risk_threshold`: `p1`

**Playwright Utils Profile**: **Full UI+API** (based on existing E2E tests with `page.goto`, `page.locator`)

---

### Knowledge Base Fragments Loaded

#### Core Tier (Always Load)

1. ✅ **test-levels-framework.md** - Guidelines for choosing unit/integration/E2E coverage
2. ✅ **test-priorities-matrix.md** - P0-P3 criteria, coverage targets, execution ordering
3. ✅ **data-factories.md** - Factories with overrides, API seeding, cleanup discipline
4. ✅ **selective-testing.md** - Tag/grep usage, spec filters, diff-based runs
5. ✅ **test-quality.md** - Execution limits, isolation rules, green criteria

#### Playwright Utils (Full UI+API Profile)

6. ✅ **overview.md** - Installation, design principles, fixture patterns
7. ✅ **selector-resilience.md** - Robust selector strategies and debugging
8. ✅ **test-healing-patterns.md** - Common failure patterns and automated fixes

#### Extended Tier (Available on-demand)

- `ci-burn-in.md` - Staged jobs, shard orchestration, burn-in loops
- `timing-debugging.md` - Race condition identification and fixes
- `network-first.md` - Intercept-before-navigate workflow, HAR capture
- `fixture-architecture.md` - Composable fixture patterns
- `playwright-cli.md` - Token-efficient CLI for AI agents

---

---

## Step 2: Automation Targets & Coverage Plan ✅

### Target Identification

#### Automation Gaps Discovered

**Unit Test Coverage Analysis**:
- ✅ **21 lib files WITH unit tests** (good existing coverage)
- ❌ **15 lib files MISSING unit tests** (automation gap)

**Critical Missing Unit Tests** (P0 Priority - Current Story E07-S04):
1. **`atRisk.ts`** - At-risk course detection logic
   - Uses `Date.now()` (blocks deterministic testing)
   - Needs edge case coverage (boundary conditions, empty sessions)

2. **`completionEstimate.ts`** - Completion estimation logic
   - **Known bug**: Division by zero when `averageSessionMinutes = 0` (code review H2)
   - **Known bug**: No clamp on negative `remainingContentMinutes` (code review H3)
   - Uses `Date.now()` (blocks deterministic testing)
   - Needs edge case coverage (no sessions, negative values)

**High-Priority Missing Unit Tests** (P1 Priority):
3. **`dateUtils.ts`** - Date formatting utilities (foundational, high usage)
4. **`format.ts`** - Timestamp formatting utilities (foundational, high usage)
5. **`api.ts`** - API utilities (critical infrastructure)

**Medium-Priority Missing Unit Tests** (P2 Priority):
- `textUtils.ts`, `persistWithRetry.ts`, `fireMilestoneToasts.tsx`, `scroll.ts`
- `media.ts`, `motion.ts`, `pdfWorker.ts`, `performanceMonitoring.ts`
- `instructors.ts`, `suggestions.ts`

**E2E Test Gaps** (from `sprint-status.yaml` gap coverage stories):

**P0 - Critical Error Paths**:
- **Story 7-7**: Error path for corrupted IndexedDB sessions (E07-S01)
- **Story 7-8**: Error path for empty/corrupted allCourses (E07-S02)
- **Story 7-9**: Error path for Zustand persist failure (E07-S03-AC4)
- **Story 7-10**: Error path for malformed study log data (E07-S05)
- **Story 7-11**: Error path for invalid study goal values (E07-S05)

**P1 - High Priority Edge Cases**:
- **Story 7-6**: E2E test for course suggestion tiebreaker (E07-S03-AC2)

**Code Quality Issues** (from `.claude/agent-memory/code-review/story-details.md`):
- ❌ Hard waits in E2E tests (`waitForTimeout`) - non-deterministic
- ❌ Magic numbers (e.g., `15` minutes per lesson)
- ❌ `Date.now()` in calculation functions blocks unit testing

---

### Test Level Selection

Following **Test Levels Framework** (`test-levels-framework.md`):

#### Unit Tests (P0 - CRITICAL)

**Target**: Pure calculation functions with business logic

| File | Functions to Test | Priority | Justification |
|------|------------------|----------|---------------|
| `atRisk.ts` | `calculateAtRiskStatus` | P0 | Current story logic, uses Date.now() |
| `completionEstimate.ts` | `calculateCompletionEstimate` | P0 | Current story logic, has 2 known bugs (division by zero, negative clamp) |
| `dateUtils.ts` | `toLocalDateString` | P1 | Foundational utility, simple pure function |
| `format.ts` | `formatTimestamp` | P1 | Foundational utility, edge cases (0s, large values) |
| `api.ts` | (analyze exported functions) | P1 | Critical infrastructure, error handling |

**Coverage Target**: >90% for P0, >80% for P1

#### E2E Tests (P0 - CRITICAL)

**Target**: Error paths and edge cases (gap coverage)

| Test Scenario | Story | Priority | Justification |
|--------------|-------|----------|---------------|
| Corrupted IndexedDB sessions | 7-7 | P0 | Data integrity, error resilience |
| Empty/corrupted allCourses | 7-8 | P0 | Data integrity, error resilience |
| Zustand persist failure | 7-9 | P0 | State management failure recovery |
| Malformed study log data | 7-10 | P0 | Data validation, error handling |
| Invalid study goal values | 7-11 | P0 | Input validation, boundary conditions |
| Course suggestion tiebreaker | 7-6 | P1 | Edge case for recommendation algorithm |

**Coverage Target**: All critical error paths (P0), main edge cases (P1)

#### Component Tests (P2 - MEDIUM)

**Target**: Complex UI components with state management

| Component | Priority | Justification |
|-----------|----------|---------------|
| VideoPlayer | P2 | Complex state, keyboard shortcuts, PiP |
| NoteEditor | P2 | Rich text editing, autosave, timestamp links |
| CourseCard | P2 | Dynamic data, multiple states (at-risk badge, momentum) |

**Coverage Target**: Happy paths + critical user interactions

---

### Priority Assignment

Following **Test Priorities Matrix** (`test-priorities-matrix.md`):

#### P0 - Critical (Must Test)

**Criteria**: Revenue-impacting, security-critical, data integrity, regulatory compliance, previously broken

**Tests**:
1. ✅ Unit: `atRisk.ts` - Business logic for current story
2. ✅ Unit: `completionEstimate.ts` - Business logic for current story (2 known bugs)
3. ✅ E2E: Corrupted IndexedDB sessions (Story 7-7) - Data integrity
4. ✅ E2E: Empty/corrupted allCourses (Story 7-8) - Data integrity
5. ✅ E2E: Zustand persist failure (Story 7-9) - State management resilience
6. ✅ E2E: Malformed study log data (Story 7-10) - Data validation
7. ✅ E2E: Invalid study goal values (Story 7-11) - Input validation

**Execution**: Run on every commit (< 5 min), blocks merge

#### P1 - High (Should Test)

**Criteria**: Core user journeys, frequently used features, complex logic

**Tests**:
1. ✅ Unit: `dateUtils.ts` - Foundational utility, high usage
2. ✅ Unit: `format.ts` - Foundational utility, high usage
3. ✅ Unit: `api.ts` - Critical infrastructure
4. ✅ E2E: Course suggestion tiebreaker (Story 7-6) - Edge case coverage

**Execution**: Run pre-merge (< 15 min)

#### P2 - Medium (Nice to Test)

**Criteria**: Secondary features, admin functionality, supporting tools

**Tests**:
1. Unit: Remaining lib files (`textUtils.ts`, `persistWithRetry.ts`, etc.)
2. Component: VideoPlayer, NoteEditor, CourseCard

**Execution**: Full regression (< 30 min)

#### P3 - Low (Test if Time Permits)

**Criteria**: Rarely used features, cosmetic issues, experimental

**Tests**:
1. Visual regression tests
2. Performance benchmarks
3. Accessibility deep-dive

**Execution**: Nightly or weekly

---

### Coverage Plan Summary

**Scope**: Critical Paths (focused on current story + gap coverage + foundational utilities)

**Test Distribution**:

| Level | P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low) | Total |
|-------|---------------|-----------|-------------|----------|-------|
| **Unit** | 2 files | 3 files | 10 files | - | 15 |
| **E2E** | 5 stories | 1 story | - | - | 6 |
| **Component** | - | - | 3 components | - | 3 |
| **Visual/Perf** | - | - | - | TBD | TBD |
| **TOTAL** | **7** | **4** | **13** | **TBD** | **24+** |

**Execution Strategy** (from `selective-testing.md`):
- **Pre-commit** (2 min): P0 unit tests only
- **CI PR** (10 min): P0 + P1 tests
- **CI Merge** (30 min): Full regression (P0 + P1 + P2)
- **Nightly** (60 min): All tests including P3

**Justification**:
- **Current Story Focus**: 2 P0 unit tests for `atRisk.ts` and `completionEstimate.ts` address immediate needs
- **Gap Coverage**: 6 E2E error path tests close identified gaps from sprint planning
- **Foundation**: 3 P1 unit tests for utilities ensure long-term maintainability
- **Quality**: Addresses code review findings (division by zero, Date.now() issues, hard waits)

---

## Next Steps

**Step 03**: Generate test implementations (prioritized by P0 → P1 → P2)

