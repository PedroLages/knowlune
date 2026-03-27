---
name: app-audit
description: "ALWAYS use this skill when the user wants to review, audit, or assess the quality of the Knowlune application across multiple pages or the whole app. This is the RIGHT skill whenever the request involves checking MORE than a single story or single file — it dispatches parallel design-review, code-review, testing, and accessibility agents to produce a comprehensive severity-triaged audit report. You MUST use this skill — not just read files or run commands yourself — when you see ANY of these patterns: (1) reviewing the entire app or a section with multiple pages, (2) checking production readiness or overall quality, (3) assessing UI/UX consistency ACROSS pages, (4) app-wide accessibility compliance, (5) test coverage gaps across the codebase, (6) preparing for a demo or launch, (7) post-epic quality check. Trigger phrases include: 'audit', 'review the app', 'check the whole app', 'production readiness', 'full review', 'quality check', 'how does the app look', 'what needs fixing', 'check all pages', 'consistency check', 'comprehensive review', 'app assessment'. Also trigger when the user asks to review multiple features at once (e.g., 'check the premium features' or 'review the courses section'). Supports scoped audits (`/app-audit courses`) and deep code review (`--deep`). Do NOT use for single-story reviews (use /review-story), single-file reviews, bug fixes, or feature implementation."
argument-hint: "[scope] [--deep]"
background: true
memory: project
---

# App Audit

Comprehensive audit of the Knowlune web application. Dispatches parallel review agents to evaluate UI/UX, accessibility, code quality, and test coverage across all pages (or a scoped subset). Produces a single severity-triaged report and optionally generates tests for critical coverage gaps.

## Usage

```
/app-audit                     # Full-app audit (all pages, architecture-focused code review)
/app-audit courses             # Scoped audit (courses section only)
/app-audit premium --deep      # Scoped + deep section-by-section code review
/app-audit --deep              # Full-app + deep code review (most thorough, slowest)
```

## Orchestrator Discipline

This skill is an **orchestrator** — it coordinates work but does not perform deep analysis itself. Read `.claude/skills/_shared/orchestrator-principles.md` for the full pattern.

**Do**: Read state, make decisions, dispatch agents, collect results, update todos, communicate.
**Don't**: Do deep code analysis, retain raw output, read large files for exploration, perform review reasoning.

All sub-agents run with `run_in_background: true` to reduce noise. Extract only structured data (counts, verdicts, paths) from agent returns.

## Knowlune Route Map

| Batch | Pages | Routes |
|-------|-------|--------|
| **Core Navigation** | Overview, MyClass, Courses | `/`, `/my-class`, `/courses` |
| **Course Detail** | CourseDetail, CourseOverview, LessonPlayer, Quiz | `/courses/:id`, `/courses/:id/overview`, `/courses/:id/:lessonId`, quiz routes |
| **Import Flows** | ImportedCourseDetail, YouTubeCourseDetail + lessons | `/imported-courses/*`, `/youtube-courses/*` |
| **Content & Notes** | Authors, AuthorProfile, Notes, Challenges | `/authors`, `/authors/:id`, `/notes`, `/challenges` |
| **Analytics** | Reports, SessionHistory | `/reports`, `/session-history` |
| **Paths** | LearningPaths, LearningPathDetail, CareerPaths, CareerPathDetail | `/learning-paths`, `/learning-paths/:id`, `/career-paths`, `/career-paths/:id` |
| **Settings** | Settings | `/settings` |
| **Premium** | AILearningPath, KnowledgeGaps, ReviewQueue, InterleavedReview, RetentionDashboard, Flashcards, ChatQA | `/ai-learning-path`, `/knowledge-gaps`, `/review`, `/review/interleaved`, `/retention`, `/flashcards`, `/notes/chat` |
| **Legal** | PrivacyPolicy, TermsOfService | `/privacy`, `/terms` |

## Steps

**Immediately create TodoWrite** for full visibility. Adapt items based on scope:

```
[ ] Resolve scope and parse arguments
[ ] Read agent memory for previous audit patterns
[ ] Pre-flight checks (dev server, build, lint, typecheck)
[ ] Design review — Batch 1: Core Navigation
[ ] Design review — Batch 2: Course Detail Flow
[ ] Design review — Batch 3: Import Flows
[ ] Design review — Batch 4: Content & Notes
[ ] Design review — Batch 5: Analytics
[ ] Design review — Batch 6: Paths
[ ] Design review — Batch 7: Settings
[ ] Design review — Batch 8: Premium Features
[ ] Design review — Batch 9: Legal Pages
[ ] Code review (architecture / deep)
[ ] Edge case review
[ ] Test coverage analysis
[ ] Present test gaps for user selection
[ ] Generate tests for selected gaps
[ ] Aggregate findings into final report
[ ] Update agent memory with patterns
```

For scoped audits, include only the batches that match the scope.

---

### Phase 1 — Scope Resolution

Parse `$ARGUMENTS` to determine audit scope and mode:

1. **Scope detection**: Match arguments against batch names (case-insensitive):
   - `courses` → Core Navigation + Course Detail + Import Flows
   - `premium` → Premium batch only
   - `settings` → Settings batch only
   - `reports` or `analytics` → Analytics batch only
   - `paths` → Paths batch only
   - `content` or `notes` → Content & Notes batch only
   - `legal` → Legal batch only
   - No argument or `all` → Full-app audit (all batches)

2. **Mode detection**: Check for `--deep` flag:
   - Present → deep section-by-section code review (dispatches multiple code-review agents)
   - Absent → architecture-focused code review (single agent, cross-cutting concerns)

3. **Read agent memory** for previous audit findings. If this is a repeat audit, note which issues were previously flagged to detect regressions vs new findings.

4. **Output scope banner**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   APP AUDIT — Knowlune
   Scope: [Full App / Courses Section / etc.]
   Mode: [Standard / Deep]
   Batches: [N] page groups, [N] total routes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

**TodoWrite**: Mark "Resolve scope" → `completed`. Mark "Read agent memory" → `in_progress`.

---

### Phase 2 — Pre-flight Checks

Run these sequentially — stop on first failure:

1. **Dev server**: Check if `http://localhost:5173` is reachable:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
   ```
   - Not reachable → start `npm run dev` in background, wait up to 30s
   - Still unreachable → warn user, skip all design review batches (code review and test analysis can still proceed)

2. **Build**: `npm run build` — STOP on failure with error output.

3. **Lint**: `npm run lint` — note errors but do NOT stop (audit should proceed to capture full picture).

4. **Type check**: `npx tsc --noEmit` — note errors but do NOT stop.

**Output pre-flight summary**:
```
Pre-flight checks:
  Dev server: [running on :5173 / started / UNAVAILABLE]
  Build: [pass / FAIL — stopped]
  Lint: [pass / N errors noted]
  Type check: [pass / N errors noted]
```

**TodoWrite**: Mark "Pre-flight checks" → `completed`.

---

### Phase 3 — Parallel Design Review

Dispatch design-review agents for each in-scope batch. Run **up to 3 batches in parallel** (design-review agents use Playwright MCP which shares a single browser — dispatching too many at once causes contention).

**For each batch**, dispatch:

```
Agent({
  subagent_type: "design-review",
  run_in_background: true,
  description: "Design review — [Batch Name]",
  prompt: "You are conducting a FULL APP AUDIT (not a story review). Ignore any story-related instructions in your system prompt — there is no story file, no git diff to check, no acceptance criteria. Instead:

1. Load design principles from .claude/workflows/design-review/design-principles.md
2. Navigate to each of these routes and perform your full 7-phase review methodology:
   [List routes for this batch]
3. Test each route at THREE viewports: mobile (375px), tablet (768px), desktop (1440px)
4. Pay special attention to:
   - Cross-page consistency (do these pages look like they belong to the same app?)
   - Design token compliance (no hardcoded colors, proper spacing grid)
   - Accessibility (keyboard nav, contrast, ARIA, semantic HTML)
   - Empty states, loading states, error states
   - Dark mode appearance (toggle theme and verify)
5. Save your report to docs/reviews/audit/design-review-[batch-slug]-{YYYY-MM-DD}.md

Base URL: http://localhost:5173"
})
```

**Dispatch in waves** (3 at a time):
- Wave 1: Core Navigation + Course Detail + Import Flows
- Wave 2: Content & Notes + Analytics + Paths
- Wave 3: Settings + Premium + Legal

Wait for each wave to complete before starting the next. As each agent returns, mark its todo → `completed`.

If dev server is unavailable, skip all design review batches and add `design-review-skipped` note to the report.

---

### Phase 4 — Code Review

Dispatch based on mode:

#### Default Mode (Architecture-Focused)

Single code-review agent focused on systemic, cross-cutting concerns:

```
Agent({
  subagent_type: "code-review",
  run_in_background: true,
  description: "Code review — architecture audit",
  prompt: "You are conducting a FULL APP AUDIT of the Knowlune codebase (not a story review). Ignore story-related instructions — there is no story file or git diff to check.

Instead, perform an architecture-level review of the ENTIRE src/ directory. Focus on:

1. **State Management**: Zustand store design, stale closures, missing effect cleanup
2. **Error Handling**: Silent failures, swallowed errors, missing error boundaries, fire-and-forget patterns
3. **Security**: XSS vectors, unsafe innerHTML, unvalidated IndexedDB data, exposed secrets
4. **Design Token Compliance**: Hardcoded colors, inline styles, non-token spacing
5. **Import & Architecture**: @/ alias consistency, component boundaries, dead code, circular deps
6. **Performance**: Missing lazy loading, unnecessary re-renders, unindexed Dexie queries
7. **Accessibility**: Missing ARIA labels, non-semantic HTML, contrast issues in code
8. **Production Readiness**: Console.logs, TODO comments, incomplete features, missing error pages

Read key files:
- All files in src/app/pages/ (page components)
- src/app/components/Layout.tsx (main layout)
- src/app/routes.tsx (routing)
- src/styles/theme.css (design tokens)
- Key stores and lib files

Score each finding with confidence (0-100). Produce your standard severity-triaged report.
Save to docs/reviews/audit/code-review-architecture-{YYYY-MM-DD}.md"
})
```

#### Deep Mode (`--deep`)

Split src/ into sections and dispatch separate code-review agents:

```
// Dispatch in parallel:

Agent({ subagent_type: "code-review", description: "Code review — pages",
  prompt: "Full audit of src/app/pages/. Review every page component for correctness, error handling, state management, accessibility. Not a story review — no git diff. Save to docs/reviews/audit/code-review-pages-{YYYY-MM-DD}.md" })

Agent({ subagent_type: "code-review", description: "Code review — components",
  prompt: "Full audit of src/app/components/figma/. Review every custom component for reusability, prop types, accessibility, design token usage. Not a story review — no git diff. Save to docs/reviews/audit/code-review-components-{YYYY-MM-DD}.md" })

Agent({ subagent_type: "code-review", description: "Code review — stores & lib",
  prompt: "Full audit of src/app/stores/ and src/app/lib/. Review state management patterns, data access layer, error handling, IndexedDB usage, Zustand patterns. Not a story review — no git diff. Save to docs/reviews/audit/code-review-stores-{YYYY-MM-DD}.md" })
```

As each agent returns, mark its todo → `completed`.

---

### Phase 5 — Edge Case Review

Dispatch edge case hunter in parallel with code review:

```
Agent({
  subagent_type: "general-purpose",
  run_in_background: true,
  description: "Edge case review — full app",
  prompt: "Use the bmad-review-edge-case-hunter skill on the Knowlune application.

Target: Review ALL files in src/app/pages/ and src/app/components/figma/ for unhandled edge cases.

For each file, read it fully and walk every branching path and boundary condition. Report only UNHANDLED edge cases.

Format findings as a markdown report and save to docs/reviews/audit/edge-case-review-{YYYY-MM-DD}.md using this format:

## Edge Case Review — Full App Audit ({YYYY-MM-DD})

### Unhandled Edge Cases

For each finding:
**[file:line]** — `[trigger_condition]`
> Consequence: [potential_consequence]
> Guard: `[guard_snippet]`

---
**Total:** N unhandled edge cases found."
})
```

---

### Phase 6 — Test Coverage Analysis

Dispatch test coverage agent:

```
Agent({
  subagent_type: "code-review-testing",
  run_in_background: true,
  description: "Test coverage — full app",
  prompt: "You are conducting a FULL APP AUDIT of test coverage (not a story review). There is no story file or acceptance criteria to check.

Instead, perform a comprehensive test coverage analysis:

1. List ALL page components in src/app/pages/
2. List ALL test files in tests/ (both unit and e2e)
3. Map each page/feature to its test coverage:
   - Which pages have E2E tests? Which don't?
   - Which components have unit tests? Which don't?
   - Which user flows are tested end-to-end?
4. For untested pages/flows, assess criticality (high-traffic pages need tests more urgently)
5. Check test quality across existing tests:
   - Test isolation (shared state, cleanup)
   - Selector quality (data-testid vs brittle selectors)
   - Factory usage (inline data vs shared factories)
   - Assertion quality (outcomes vs implementation details)

Produce a coverage matrix and quality assessment. Save to docs/reviews/audit/test-coverage-{YYYY-MM-DD}.md

Format:
## Test Coverage Audit — Knowlune ({YYYY-MM-DD})

### Coverage Matrix
| Page/Feature | Unit Tests | E2E Tests | Coverage | Priority |
|---|---|---|---|---|
| Overview | [file or None] | [file or None] | Full/Partial/None | High/Medium/Low |

### Untested Critical Flows
[List flows with no test coverage that are high priority]

### Test Quality Summary
[Overall quality assessment with specific findings]

### Recommendations
[Prioritized list of tests to add]"
})
```

**TodoWrite**: Mark "Test coverage analysis" → `completed` when agent returns.

---

### Phase 7 — Test Generation (User-Directed)

After the test coverage agent returns with its report:

1. **Read the coverage report** and extract the list of untested critical flows and pages.

2. **Present gaps to the user** via AskUserQuestion:
   ```
   Question: "Test coverage analysis found N untested pages/flows. Which would you like me to generate tests for?"
   Header: "Test gaps"
   MultiSelect: true
   Options: [Top 4 most critical gaps from the report]
   ```

3. **If user selects gaps**, generate E2E test files:
   - Follow patterns from existing tests in `tests/e2e/`
   - Use factories from `tests/support/fixtures/factories/`
   - Use test-time helpers from `tests/utils/test-time.ts`
   - Follow conventions from `.claude/rules/testing/test-patterns.md`
   - Each test file covers one page/flow with multiple scenarios
   - Commit generated tests: `test: add E2E tests for [page/flow] (app-audit)`

4. **If user declines**, skip test generation and proceed to report aggregation.

**TodoWrite**: Mark "Generate tests" → `completed`.

---

### Phase 8 — Report Aggregation

Once ALL agents have returned, aggregate findings into a single comprehensive report.

1. **Read all agent reports** from `docs/reviews/audit/`

2. **Deduplicate with consensus scoring** (same pattern as `/review-story`):
   - If multiple agents flag the same file:line, keep the higher confidence score
   - Boost severity one level for consensus findings (Medium→High, High→Blocker)
   - Tag as `[Consensus: N agents]`

3. **Classify production readiness gaps**: Identify missing features that are NOT bugs but would be expected in a production app (auth, monitoring, error tracking, offline support, etc.)

4. **Generate the final report** and save to `docs/reviews/audit/app-audit-{YYYY-MM-DD}.md`:

```markdown
# App Audit Report — Knowlune ({YYYY-MM-DD})

## Executive Summary

**Audit scope**: [Full App / Scoped to X] | **Mode**: [Standard / Deep]
**Pages audited**: [N] | **Routes tested**: [N] | **Agents dispatched**: [N]

**Overall assessment**: [1-2 sentence quality summary]

**Verdict**: [PRODUCTION READY / NEEDS WORK (N blockers, N high) / NOT READY (N blockers)]

## Metrics

| Metric | Value |
|--------|-------|
| Total findings | N |
| Blockers | N |
| High priority | N |
| Medium | N |
| Nits | N |
| Test coverage | N/N pages covered |
| Accessibility issues | N |
| Design token violations | N |

## Critical Issues (Must Fix)

[All BLOCKER findings from all agents, deduplicated, with file:line, evidence, and fix suggestions]

## High Priority (Should Fix)

[All HIGH findings, deduplicated]

## Improvements (Medium)

[All MEDIUM findings, grouped by category]

## Nice-to-Have (Nits)

[All NIT findings, grouped by category]

## Missing Features for Production

[Features expected in a production learning platform that are absent or incomplete:
- Authentication / authorization
- Error monitoring / tracking
- Rate limiting / abuse prevention
- SEO / meta tags
- Analytics / telemetry
- Offline support
- Data backup / export
- etc.]

## Per-Page Breakdown

### [Page Name] ([route])

| Category | Status | Issues |
|----------|--------|--------|
| Design & Layout | [pass / N issues] | [summary] |
| Accessibility | [pass / N issues] | [summary] |
| Responsive (375/768/1440) | [pass / N issues] | [summary] |
| Code Quality | [pass / N issues] | [summary] |
| Test Coverage | [covered / partial / none] | [summary] |

[Repeat for each audited page]

## Test Coverage

**Overall**: [N]/[N] pages with tests ([N]%)
**E2E coverage**: [N] page flows tested
**Unit coverage**: [N] components with unit tests
**Critical gaps**: [List most important untested flows]
**Tests generated**: [N files, N tests] (if applicable)

## Cross-Cutting Observations

[Patterns that span multiple pages — recurring design inconsistencies, shared error handling issues, common accessibility gaps, state management concerns]

## Recommendations

[Ordered list of prioritized action items, grouped by effort:

### Quick Wins (< 1 hour each)
1. [Action item with file reference]

### Medium Effort (1-4 hours each)
1. [Action item]

### Larger Initiatives
1. [Action item with scope estimate]
]

---

**Audit completed**: {YYYY-MM-DD HH:MM}
**Agent reports**: [list of individual report file paths]
**Generated by**: Claude Code (app-audit skill)
```

5. **Update agent memory** with key recurring patterns discovered during this audit for future reference.

**TodoWrite**: Mark "Aggregate findings" → `completed`.

---

### Phase 9 — Completion Output

Display a summary to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APP AUDIT COMPLETE — Knowlune

Verdict: [PRODUCTION READY / NEEDS WORK / NOT READY]

Findings: [N] total
  Blockers: [N]
  High: [N]
  Medium: [N]
  Nits: [N]

Test Coverage: [N]% pages covered ([N] tests generated)

Report: docs/reviews/audit/app-audit-{YYYY-MM-DD}.md

Individual reports:
  Design: docs/reviews/audit/design-review-*.md ([N] files)
  Code: docs/reviews/audit/code-review-*.md
  Edge cases: docs/reviews/audit/edge-case-review-*.md
  Test coverage: docs/reviews/audit/test-coverage-*.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Recovery

- **Pre-flight fails**: Fix build errors, re-run `/app-audit`. No state to resume from — audits are fresh each time.
- **Design review agent fails**: Check dev server. Report will note which batches were skipped. Re-run to retry.
- **Code review agent fails**: Report proceeds with available data. Re-run for full coverage.
- **Partial completion**: Each agent saves its own report independently. Even if the orchestrator is interrupted, individual reports in `docs/reviews/audit/` are preserved.

## Scoping Examples

| Command | What gets audited |
|---------|-------------------|
| `/app-audit` | All 9 batches, architecture code review, full test coverage |
| `/app-audit courses` | Core Navigation + Course Detail + Import Flows batches, scoped code review |
| `/app-audit premium` | Premium features batch only |
| `/app-audit --deep` | All 9 batches, section-by-section deep code review |
| `/app-audit settings --deep` | Settings batch, deep code review of settings-related code |
