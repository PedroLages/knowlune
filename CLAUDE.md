# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LevelUp is a personal learning platform featuring progress tracking, study streaks, course management, and achievement analytics. Originally designed from Figma wireframes, it's evolved into a comprehensive learning dashboard with seven main sections: Overview, My Class, Courses, Messages, Instructors, Reports, and Settings.

Original Figma design: https://www.figma.com/design/q4x6ttJD11avObQNFoeQ2D/E-learning-platform-wireframes (design foundation)

## Development Commands

- `npm i` - Install dependencies
- `npm run dev` - Start Vite development server (default: http://localhost:5173)
- `npm run build` - Build production bundle with Vite

**Worktree E2E Warning:** Before running E2E tests in a git worktree, kill any dev server on port 5173 (`lsof -ti:5173 | xargs kill`). Playwright's `reuseExistingServer: true` will silently reuse a dev server from the main workspace, causing tests to pass against stale code.

## Architecture

### Tech Stack

- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 6.3.5
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **Routing**: React Router v7
- **UI Components**: shadcn/ui components (Radix UI primitives)
- **Icons**: Lucide React

### File Structure

```
src/
├── main.tsx                    # App entry point
├── app/
│   ├── App.tsx                 # Root component with RouterProvider
│   ├── routes.tsx              # React Router configuration
│   ├── components/
│   │   ├── Layout.tsx          # Main layout with sidebar + header
│   │   ├── figma/              # Custom Figma-exported components
│   │   └── ui/                 # shadcn/ui component library (~50 components)
│   └── pages/                  # Route page components
│       ├── Overview.tsx
│       ├── MyClass.tsx
│       ├── Courses.tsx
│       ├── Messages.tsx
│       ├── Instructors.tsx
│       ├── Reports.tsx
│       └── Settings.tsx
└── styles/
    ├── index.css               # Main CSS entry (imports all styles)
    ├── tailwind.css            # Tailwind v4 configuration
    ├── theme.css               # CSS custom properties for theming
    └── fonts.css               # Font definitions

docs/
├── analysis/                   # Analysis documents
├── api/                        # API documentation and Mockoon data
├── docker/                     # Docker setup guides
├── implementation-artifacts/   # Story files, sprint tracking
├── planning-artifacts/         # Product briefs, epics, planning docs
├── plans/                      # Implementation plans
├── reviews/                    # Design and code review reports
│   ├── design/                 # Design review reports
│   └── code/                   # Code review reports
└── research/                   # Technical research

scripts/                        # Build and utility scripts
├── check-bundle-size.sh
├── wait-for-server.sh
└── worktree-*.sh              # Git worktree management
```

### Import Alias

The `@` alias resolves to `./src` (configured in vite.config.ts):
```typescript
import { Button } from '@/app/components/ui/button'
```

### Routing Architecture

React Router v7 with nested routes. Layout component wraps all pages and provides:
- Left sidebar navigation with active state management
- Top header with search bar, notifications, and user profile
- Main content area via `<Outlet />`

All routes defined in [src/app/routes.tsx](src/app/routes.tsx).

### Styling System

**Tailwind CSS v4** with important distinctions from v3:
- Uses `@tailwindcss/vite` plugin (no separate PostCSS config needed)
- Source scanning via `@source` directive in [src/styles/tailwind.css](src/styles/tailwind.css)
- Custom theme tokens in [src/styles/theme.css](src/styles/theme.css) using CSS variables
- Includes `tw-animate-css` for animation utilities

**Theme System**: Uses CSS custom properties for light/dark mode with OKLCH color space. All theme tokens defined in `--color-*` variables.

**Critical Note**: React and Tailwind plugins are both required in vite.config.ts even if Tailwind isn't actively being modified - do not remove them.

### UI Component Library

50+ shadcn/ui components in [src/app/components/ui/](src/app/components/ui/) including:
- Form controls (Input, Button, Select, Checkbox, Radio, Switch, Slider)
- Layout (Card, Tabs, Accordion, Separator, Scroll Area, Resizable)
- Overlays (Dialog, Sheet, Popover, Tooltip, Hover Card, Alert Dialog, Drawer)
- Navigation (Navigation Menu, Breadcrumb, Pagination, Command)
- Data display (Avatar, Badge, Calendar, Chart, Progress, Table)
- Advanced (Date Picker with date-fns, Carousel with Embla, Toast with Sonner)

All components follow shadcn/ui patterns with Radix UI primitives and class-variance-authority for variants.

### Design Tokens

Primary colors and spacing:
- Background: `#FAF5EE` (warm off-white)
- Primary blue: `blue-600` for CTAs and active states
- Border radius: `rounded-[24px]` for cards, `rounded-xl` for buttons
- Spacing: Consistent 24px (1.5rem) margins between major sections

## Key Conventions

- Page components are route-level components in [src/app/pages/](src/app/pages/)
- Reusable UI components live in [src/app/components/ui/](src/app/components/ui/)
- Custom Figma components in [src/app/components/figma/](src/app/components/figma/)
- All styling uses Tailwind utility classes
- Icons from lucide-react
- Images primarily from Unsplash (see ATTRIBUTIONS.md)

## Test Cleanup Strategy

### Automatic Cleanup via Playwright Context Isolation

LevelUp tests achieve excellent isolation (95/100 Grade A) through **automatic cleanup** provided by Playwright's browser context architecture. Manual cleanup hooks are intentionally avoided.

**Key Principles:**
- **No beforeAll/afterAll hooks** - Each test is fully independent
- **Browser context isolation** - Every test gets a fresh browser context with clean state
- **Factory pattern** - Test data generated per-test, no shared state mutation
- **100% parallelizable** - All tests can run simultaneously without conflicts

### How Playwright Handles Cleanup

When each test starts:
1. Playwright creates a new browser context (isolated cookies, localStorage, sessionStorage)
2. Test executes with clean slate
3. Context is automatically destroyed after test completes
4. No manual cleanup needed

### Factory Pattern for Data Independence

Test data factories (imported from `tests/utils/factories/*.ts`) generate fresh data for each test:
- `createCourse()` - Generates unique course data
- `createProgress()` - Generates progress records
- `createStudySession()` - Generates session data

Each factory accepts overrides for test-specific scenarios:
```typescript
const customCourse = createCourse({ title: 'Custom Title', duration: 120 })
```

### References

For detailed patterns, see:
- [test-quality.md](_bmad/tea/testarch/knowledge/test-quality.md) - Quality criteria
- [data-factories.md](_bmad/tea/testarch/knowledge/data-factories.md) - Factory patterns
- [overview.md](_bmad/tea/testarch/knowledge/overview.md) - Playwright fixture patterns

### E2E Test Patterns & Best Practices

LevelUp E2E tests follow strict determinism and maintainability patterns to ensure reliable, fast test execution.

#### Deterministic Time Handling

**ALWAYS** use test time utilities from `tests/utils/test-time.ts`:

```typescript
import { FIXED_DATE, FIXED_TIMESTAMP, getRelativeDate, addMinutes } from '@/tests/utils/test-time'

// ✅ CORRECT - Deterministic dates
const session = {
  startTime: FIXED_DATE,                    // 2025-01-15T10:00:00.000Z
  endTime: addMinutes(30),                  // +30 minutes from FIXED_DATE
  studyDate: getRelativeDate(-7)            // 7 days before FIXED_DATE
}

// ❌ WRONG - Non-deterministic (will cause test failures)
const session = {
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 1800000).toISOString()
}
```

**Available Utilities**:
- `FIXED_DATE` - Fixed ISO timestamp for consistent test data
- `FIXED_TIMESTAMP` - Unix timestamp version of FIXED_DATE
- `getRelativeDate(days)` - Get date N days relative to FIXED_DATE
- `addMinutes(minutes)` - Add minutes to FIXED_DATE
- `getRelativeDateWithMinutes(days, minutes)` - Combined offset

**Browser Context Date Mocking**:

For tests that depend on Date.now() in application code (e.g., momentum calculations):

```typescript
async function mockDateNow(page: Page) {
  await page.addInitScript(({ fixedTimestamp }) => {
    Date.now = () => fixedTimestamp
  }, { fixedTimestamp: new Date(FIXED_DATE).getTime() })
}

test('momentum badge displays', async ({ page }) => {
  await mockDateNow(page)  // Critical for momentum calculations
  await seedStudySessions(page, [{ startTime: FIXED_DATE, ... }])
  // ... test continues
})
```

#### IndexedDB Seeding Best Practices

**ALWAYS** use shared seeding helpers from `tests/support/helpers/indexeddb-seed.ts`:

```typescript
import { seedStudySessions, seedImportedVideos } from '../../support/helpers/indexeddb-seed'

// ✅ CORRECT - Shared helper with frame-accurate waits
await seedStudySessions(page, [{
  id: 'test-session-1',
  courseId: 'course-123',
  startTime: FIXED_DATE,
  endTime: addMinutes(30),
  duration: 1800
}])

// ❌ WRONG - Duplicating retry logic
await page.evaluate(async (data) => {
  const request = indexedDB.open('ElearningDB')
  // ... duplicated implementation
})
```

**Why Use Shared Helpers**:
- Frame-accurate waits (no Date.now() polling)
- Automatic retry logic for race conditions
- Consistent error handling
- No code duplication

#### Waiting & Polling Patterns

**PREFER** Playwright's built-in waits over manual polling:

```typescript
// ✅ BEST - Playwright auto-retry
await expect(page.getByTestId('momentum-badge')).toBeVisible()

// ✅ GOOD - Conditional wait for complex scenarios
await page.waitForFunction(() => {
  return window.myApp?.isReady === true
})

// ❌ WRONG - Hard wait (non-deterministic)
await page.waitForTimeout(1000)

// ❌ WRONG - Date.now() polling (already solved by shared helpers)
while (Date.now() - start < 5000) {
  await new Promise(resolve => requestAnimationFrame(resolve))
}
```

**For Complex Polling**: Use `waitForCondition()` utility (if created) or Playwright's `expect.toPass()`:

```typescript
await expect(async () => {
  const count = await page.getByTestId('badge').count()
  expect(count).toBeGreaterThan(0)
}).toPass({ timeout: 10000 })
```

#### NFR Violations to Avoid

**Critical Rules** (enforced by test architecture):

1. **Time Dependencies**
   - ❌ NEVER use `Date.now()` or `new Date()` directly in test code
   - ✅ ALWAYS import from `tests/utils/test-time.ts`
   - Exception: Browser context mocking via `page.addInitScript()`

2. **Hard Waits**
   - ❌ NEVER use `page.waitForTimeout()` or `setTimeout()` without justification
   - ✅ ALWAYS prefer `expect().toBeVisible()`, `waitForSelector()`, or `waitForFunction()`
   - Document any unavoidable hard waits with comments

3. **Magic Numbers**
   - ❌ AVOID hardcoded timeouts, delays, durations
   - ✅ DEFINE constants for reusable values
   - Example: `const SESSION_DURATION = 1800` vs `duration: 1800`

4. **Code Duplication**
   - ❌ NEVER copy-paste seeding logic, retry patterns, or wait functions
   - ✅ EXTRACT shared helpers to `tests/support/helpers/`
   - ✅ USE factory functions from `tests/support/fixtures/factories/`

#### File Organization

**Test File Size Limits**:
- Target: ≤300 lines per file
- Maximum: 400 lines (split if exceeded)
- Rationale: Maintainability and test discovery

**When to Split Large Files**:
- Group by acceptance criteria (1 AC = 1 file)
- Extract shared helpers to dedicated helper files
- Keep original file until splits verified
- Update imports after successful split

**Naming Conventions**:
```
story-{epic}-s{story}.spec.ts              # Single story tests
story-{epic}-s{story}-part{N}.spec.ts      # Split story tests
{feature}-{aspect}.spec.ts                 # Feature-focused tests
```

#### Test Data Management

**Factory Pattern** (see `tests/support/fixtures/factories/`):

```typescript
import { createCourse, createSession } from '@/tests/support/fixtures/factories'

// ✅ CORRECT - Factory with overrides
const course = createCourse({
  title: 'Custom Title',
  duration: 3600
})

// ❌ WRONG - Manual object creation (duplicates defaults)
const course = {
  id: 'test-id',
  title: 'Custom Title',
  duration: 3600,
  category: 'Programming',  // Should come from factory
  // ... 20 more fields
}
```

**Factory Benefits**:
- Consistent defaults across tests
- Override only what changes
- Single source of truth for test data structure
- Easier to maintain when data shape changes

#### Sidebar Test Gotcha

**Mobile/Tablet Sidebar Overlay**:

At 640-1023px viewports, the sidebar Sheet component defaults to `open: true` when localStorage is empty. This creates a fullscreen overlay blocking all pointer events.

```typescript
// ✅ CORRECT - Seed sidebar state before navigation
await page.evaluate(() => {
  localStorage.setItem('eduvi-sidebar-v1', 'false')
})
await page.goto('/courses')

// ❌ WRONG - Navigation before seeding (test will timeout on mobile/tablet)
await page.goto('/courses')
await page.click('[data-testid="course-card"]')  // Blocked by overlay!
```

#### Browser-Specific Test Handling

**WebKit (Safari) Limitations**:

```typescript
import { test } from '@playwright/test'

test('video picture-in-picture', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not support PiP API')

  // Test PiP functionality (Chrome/Firefox only)
})
```

#### Test Execution Scopes

**Local Development** (Chromium only):
```bash
npx playwright test                          # Runs Chromium only
npx playwright test --project=chromium      # Explicit Chromium
```

**CI/CD** (Full browser matrix):
```bash
CI=1 npx playwright test                    # 6-project matrix
```

**Active vs Archived Tests**:
- Active: `tests/e2e/*.spec.ts` (3 smoke tests) + current story spec
- Archived: `tests/e2e/regression/*.spec.ts` (manual execution only)
- Full regression: Opt-in at end-of-epic

#### References

**Test Utilities**:
- [tests/utils/test-time.ts](tests/utils/test-time.ts) - Deterministic time functions
- [tests/support/helpers/indexeddb-seed.ts](tests/support/helpers/indexeddb-seed.ts) - IndexedDB seeding
- [tests/support/fixtures/factories/](tests/support/fixtures/factories/) - Data factories

**Knowledge Base**:
- [_bmad/tea/testarch/knowledge/test-quality.md](_bmad/tea/testarch/knowledge/test-quality.md) - Quality criteria
- [_bmad/tea/testarch/knowledge/data-factories.md](_bmad/tea/testarch/knowledge/data-factories.md) - Factory patterns
- [_bmad/tea/testarch/knowledge/timing-debugging.md](_bmad/tea/testarch/knowledge/timing-debugging.md) - Wait strategies

## Design Review Workflow

### Automated Design Quality Assurance

This project uses an automated design review workflow to ensure UI/UX consistency, accessibility compliance, and adherence to design standards. The workflow leverages Claude Code agents and Playwright browser automation for comprehensive visual testing.

### When to Use Design Review

**Required Before Merge:**
- Any changes to UI components (`.tsx` files in `components/`)
- Page-level modifications (`src/app/pages/`)
- Styling changes (`tailwind.css`, `theme.css`, component styles)
- New component additions or significant refactors

**How to Trigger:**
1. **Manual Review**: Run `/design-review` slash command in Claude Code
2. **Automated PR Review**: GitHub Actions automatically reviews PRs with UI changes

### Design Review Process

After implementing UI changes, the design review agent:

1. **Analyzes Changes**: Reviews `git diff` to identify modified files
2. **Loads Standards**: Consults [.claude/workflows/design-review/design-principles.md](.claude/workflows/design-review/design-principles.md)
3. **Live Testing**: Uses Playwright to test at mobile (375px), tablet (768px), desktop (1440px)
4. **Interaction Testing**: Verifies hover, focus, active states work correctly
5. **Accessibility Audit**: Validates WCAG 2.1 AA+ compliance (contrast, keyboard nav, ARIA)
6. **Responsive Validation**: Ensures layouts work across all breakpoints
7. **Code Quality**: Reviews React/TypeScript best practices and Tailwind usage
8. **Generates Report**: Provides severity-triaged findings (Blockers → Nitpicks)

### Design Standards Reference

**Core Design Principles** (see [design-principles.md](.claude/workflows/design-review/design-principles.md) for full details):

- **Background**: Always `#FAF5EE` (warm off-white) - never hardcode
- **Primary Color**: `blue-600` for CTAs and active states
- **Spacing**: 8px base grid (use multiples of 0.5rem via Tailwind)
- **Border Radius**: `rounded-[24px]` for cards, `rounded-xl` for buttons/inputs
- **Typography**: System fonts, line-height 1.5-1.7, no center-aligned body text
- **Accessibility**: WCAG 2.1 AA+ minimum (4.5:1 contrast for text, keyboard navigable, proper ARIA)
- **Responsive**: Mobile-first design, breakpoints at 640px, 1024px, 1536px
- **Component States**: All interactive elements need hover, focus, active, disabled states

### Design Review Checklist

Before creating PRs with UI changes, verify:

**Visual Consistency:**
- [ ] Uses theme tokens from `theme.css` (no hardcoded colors)
- [ ] Follows 8px spacing grid
- [ ] Border radius matches component type
- [ ] Typography hierarchy clear

**Interaction Quality:**
- [ ] All interactive elements have hover states
- [ ] Focus indicators visible for keyboard navigation
- [ ] Active/pressed states provide feedback
- [ ] Animations smooth (150-500ms) and respect `prefers-reduced-motion`

**Accessibility (WCAG 2.1 AA+):**
- [ ] Text contrast ≥4.5:1 (3:1 for large text)
- [ ] All functionality keyboard accessible
- [ ] ARIA labels on icon-only buttons
- [ ] Form labels properly associated with inputs
- [ ] Semantic HTML (nav, main, button vs div)

**Responsive Design:**
- [ ] Tested at 375px (mobile), 768px (tablet), 1440px (desktop)
- [ ] No horizontal scroll on mobile
- [ ] Touch targets ≥44x44px
- [ ] Sidebar behavior correct (persistent desktop, collapsible mobile)

**Code Quality:**
- [ ] TypeScript interfaces for props
- [ ] No console errors or warnings
- [ ] Tailwind utilities (no inline styles or hardcoded values)
- [ ] Imports use `@/` alias
- [ ] Components in correct directory

### Using the `/design-review` Command

```bash
# In Claude Code, run:
/design-review

# The agent will:
# 1. Check git status and diff
# 2. Launch Playwright browser automation
# 3. Test affected pages at all viewports
# 4. Generate comprehensive report with:
#    - Severity-triaged findings (🔴 Blockers → ⚪ Nitpicks)
#    - Screenshots at 1440px desktop viewport
#    - Specific file paths and line numbers
#    - Accessibility audit results
#    - Responsive design verification
#    - Prioritized recommendations
```

### GitHub Actions Integration

PRs with UI changes are automatically reviewed via `.github/workflows/design-review.yml`. The workflow:
- Triggers on PRs modifying `.tsx`, `.css`, or styling files
- Runs Playwright tests in headless mode
- Posts review findings as PR comment
- Tags PR with severity labels (blocker, high-priority, etc.)

### Resources

- **Design Principles**: [.claude/workflows/design-review/design-principles.md](.claude/workflows/design-review/design-principles.md)
- **Agent Config**: [.claude/workflows/design-review/agent-config.md](.claude/workflows/design-review/agent-config.md)
- **Slash Command Skill**: [.claude/skills/design-review.md](.claude/skills/design-review.md)
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

### Best Practices

1. **Run Early**: Use `/design-review` during development, not just before PR
2. **Address Blockers**: Fix all 🔴 Blocker findings before requesting review
3. **Learn Patterns**: Review `design-principles.md` to internalize standards
4. **Iterate**: Use agent feedback to improve, then re-review
5. **Include Screenshots**: Add generated screenshots to PR descriptions

## Story Development Workflow

Per-story development loop with integrated quality gates. Three slash commands orchestrate the full cycle from branch creation to PR.

### Commands

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `/start-story E##-S##`  | Create branch, story file, optional ATDD tests, enter plan mode  |
| `/review-story E##-S##` | Run all quality gates: build, lint, tests, design review, code review |
| `/finish-story E##-S##` | Validate, create PR. Auto-runs reviews if not already done       |
| `/design-review`        | Standalone design review via Playwright MCP (also used by `/review-story`) |

### Workflow Modes

**Streamlined** (2 commands):

```text
/start-story E##-S##  →  implement  →  /finish-story
                                       (auto-runs reviews)
```

**Comprehensive** (3 commands):

```text
/start-story E##-S##  →  implement  →  /review-story  →  fix  →  /finish-story
                                       (dedicated)        loop    (lightweight)
```

### Burn-In Testing (Optional Stability Validation)

During `/review-story`, after E2E tests pass, the skill **intelligently suggests burn-in testing** when timing-sensitive patterns are detected. Burn-in runs the same test suite 10 times to validate stability and catch flakiness.

**When Recommended** (automatic detection):

🔴 **HIGH Confidence** — Anti-patterns detected (burn-in recommended):
- Uses `Date.now()` or `new Date()` directly in test code
- Contains `waitForTimeout()` without justification
- Manual IndexedDB seeding (not using shared helpers)
- Missing imports from `tests/utils/test-time.ts`

🟡 **MEDIUM Confidence** — Timing-sensitive features (burn-in offered):
- Imports from `test-time.ts` (date/time calculations)
- Uses `page.addInitScript()` for Date mocking
- Story involves animations, polling, or async patterns
- First story in epic (E##-S01)

✅ **LOW Risk** — Burn-in not suggested:
- Simple UI-only tests (clicks, navigation)
- Tests follow deterministic patterns
- Already validated (`burn_in_validated: true` in story frontmatter)

**User Experience**:
```
E2E tests passed (8 tests) ✓

⚠️  Anti-pattern detected: Test uses Date.now() directly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Burn-in test
E2E tests passed but anti-patterns detected. Run burn-in validation?

◯ Run burn-in — 10 iterations (Recommended)
  Anti-pattern detected: Date.now() in test code. Burn-in
  validates stability despite timing risks.

◯ Skip — proceed to reviews
  Tests may have flakiness risk. Consider fixing anti-patterns first.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If Burn-In Passes** (80/80 tests):
- Sets `burn_in_validated: true` in story frontmatter
- Continues to design/code review
- Story won't be prompted again

**If Burn-In Fails** (flakiness detected):
- Blocks review with specific failure report
- Identifies non-deterministic tests
- Suggests fixes (use FIXED_DATE, shared helpers, proper waits)
- User must fix anti-patterns and re-run `/review-story`

**Manual Burn-In** (outside `/review-story`):
```bash
# Run burn-in on specific spec
npx playwright test tests/e2e/story-e07-s04.spec.ts --repeat-each=10 --project=chromium

# Run burn-in on archived regression spec
RUN_REGRESSION=true npx playwright test tests/e2e/regression/story-e07-s04.spec.ts --repeat-each=10 --project=chromium
```

### After Epic Completion

When all stories in an epic are done, run:

- `/testarch-trace` — Requirements-to-tests traceability matrix
- `/testarch-nfr` — Non-functional requirements validation
- `/retrospective` — Lessons learned and pattern extraction

### Key Files

| File                                              | Purpose                                      |
| ------------------------------------------------- | -------------------------------------------- |
| `.claude/skills/start-story/SKILL.md`             | Story setup orchestrator                     |
| `.claude/skills/review-story/SKILL.md`            | Quality gate hub                             |
| `.claude/skills/finish-story/SKILL.md`            | Adaptive shipping skill                      |
| `.claude/agents/code-review.md`                   | Adversarial code reviewer (Opus, with memory) |
| `.claude/agents/design-review.md`                 | Playwright MCP design reviewer               |
| `docs/implementation-artifacts/story-template.md` | Story file template                          |
| `docs/implementation-artifacts/sprint-status.yaml` | Sprint tracking                             |
| `docs/reviews/design/`                            | Design review reports                        |
| `docs/reviews/code/`                              | Code review reports                          |

### Branch Naming

Format: `feature/e##-s##-slug` (lowercase, hyphens, no filler words)

Example: `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`
