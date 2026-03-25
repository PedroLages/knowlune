# Agent Prompt Templates

Copy-paste ready templates with `{VARIABLES}` to fill. Each template produces a self-contained sub-agent prompt.

---

## Story Agent (Start + Implement)

```
You are implementing story {STORY_ID} for the Knowlune learning platform.

STEP 1: Run `/start-story {STORY_ID}` which will:
- Create branch feature/{STORY_ID_LOWER}-{slug}
- Create story file from template
- Research codebase context (3 parallel agents)
- Generate implementation plan
- Enter plan mode for your approval

STEP 2: After the plan is ready, EXIT plan mode and implement it fully:
- Write all code, components, and tests
- Follow project conventions: design tokens (never hardcode colors), accessibility (WCAG AA), Tailwind CSS v4
- Use existing UI components from src/app/components/ui/
- Commit with descriptive messages as you go
- Run `npm run build` to verify before finishing

STEP 3: Return a brief summary:
- What was built (2-3 sentences)
- Key files created/modified (list)
- Any decisions or concerns
- Total commits made
```

---

## Review Agent

```
Run `/review-story {STORY_ID}` on the current branch.

This runs the full quality gate pipeline:
- Pre-checks: build, lint (auto-fix), type-check, format (auto-fix), unit tests, E2E tests
- Design review: Playwright MCP browser testing (mobile/tablet/desktop)
- Code review: architecture, security, silent failures
- Code review testing: AC coverage, test quality, edge cases

BEFORE reviewing, run this to identify which files the story changed:
  git diff --name-only main...HEAD

Use this file list to CLASSIFY every issue as either STORY-RELATED (in files the story changed) or PRE-EXISTING (in files the story did NOT touch).

After review completes, return a STRUCTURED summary in this exact format:

VERDICT: [PASS or ISSUES FOUND]

STORY-RELATED ISSUES (files changed by this story — must be fixed):
BLOCKER: [count]
HIGH: [count]
MEDIUM: [count]
LOW: [count]
NITS: [count]
TOTAL: [count]
- [SEVERITY] [description] — [file:line]
- [SEVERITY] [description] — [file:line]
...

PRE-EXISTING ISSUES (files NOT changed by this story — deferred to final report):
TOTAL: [count]
- [SEVERITY] [description] — [file:line]
- [SEVERITY] [description] — [file:line]
...

REPORT PATHS:
- Design: [path or "skipped"]
- Code: [path]
- Testing: [path]

IMPORTANT: Report ALL issues at every severity level. Classify each correctly.
Story-related issues will be fixed now. Pre-existing issues go in the final report for a later date.
```

---

## Fix Agent

```
You are fixing ALL STORY-RELATED review issues for story {STORY_ID}. Fix EVERY issue listed below — no exceptions, regardless of severity.

Note: Pre-existing issues (in files not changed by this story) are excluded — they will be reported separately.

STORY-RELATED ISSUES TO FIX:
{PASTE_STORY_RELATED_FINDINGS_ONLY}

INSTRUCTIONS:
For each issue:
1. Read the file at the specified location
2. Understand the root cause
3. Implement the correct fix following project conventions
4. Ensure the fix doesn't break anything else

After fixing ALL issues:
1. Run `npm run build` — must pass
2. Run `npm run lint` — must pass
3. Commit all fixes:
   git add [specific files]
   git commit -m "fix({STORY_ID}): address review findings — [brief summary]"

RETURN:
- Total issues fixed: [N]
- Issues that could NOT be fixed (with explanation): [list or "none"]
- Files modified: [list]
```

---

## Finish Agent

```
Run `/finish-story {STORY_ID}`.

This will:
1. Validate all 9 review gates passed
2. Update story file: status → done, completed → today's date
3. Update sprint-status.yaml: story → done
4. Commit changes
5. Push branch to remote
6. Create PR with description

When `/finish-story` asks interactive questions:
- "PR merge status?" → Answer: "Done — I'll cleanup manually later"
- "Lessons learned?" → Answer: "Claude, write them"

RETURN:
- PR URL
- PR title
- Branch name
```

---

## Sprint Status Agent

```
Run `/sprint-status` to verify all stories in Epic {EPIC_NUMBER} are marked as `done`.

Check for:
- Any orphaned stories (in-progress but should be done)
- Any stories not tracked in sprint-status.yaml
- Epic status consistency

RETURN:
- All stories done? [yes/no]
- Any risks or issues found: [list]
- Recommendation: [proceed to mark epic done / investigate issues]
```

---

## Testarch Trace Agent

```
Run `/testarch-trace` for Epic {EPIC_NUMBER}: {EPIC_NAME}.

Generate a requirements-to-tests traceability matrix covering:
- All acceptance criteria from the epic's stories
- Mapping to E2E tests, unit tests, and integration tests
- Coverage gaps and blind spots

RETURN:
- Coverage percentage: [N%]
- Gaps found: [list]
- Gate decision: [PASS / CONCERNS / FAIL]
- Report path: [file path]
```

---

## Testarch NFR Agent

```
Run `/testarch-nfr` for Epic {EPIC_NUMBER}: {EPIC_NAME}.

Assess non-functional requirements:
- Performance (build time, bundle size, rendering)
- Security (XSS, injection, auth patterns)
- Reliability (error handling, edge cases)
- Maintainability (code quality, test coverage)

RETURN:
- Overall assessment: [PASS / CONCERNS / FAIL]
- Key findings by category: [summary]
- Report path: [file path]
```

---

## Trace Fix Agent (Coverage Gaps)

```
You are fixing test coverage gaps identified by `/testarch-trace` for Epic {EPIC_NUMBER}: {EPIC_NAME}.

COVERAGE GAPS TO FIX:
{PASTE_TRACE_GAPS_LIST}

For each gap:
1. Read the acceptance criteria that lacks test coverage
2. Identify the correct test type (E2E, unit, integration)
3. Write the missing test following project patterns:
   - E2E tests: tests/e2e/ using Playwright, follow patterns in tests/e2e/support/
   - Unit tests: co-located with source files, using Vitest
4. Ensure tests pass: run `npm run test:unit -- --run` or `npx playwright test {spec}`

After writing all missing tests:
- Commit: `test(Epic {EPIC_NUMBER}): add missing tests for trace coverage gaps`

RETURN:
- Tests added: [count]
- Gaps that could NOT be covered (with explanation): [list or "none"]
- Files created/modified: [list]
```

---

## NFR Fix Agent (Non-Functional Issues)

```
You are fixing non-functional requirement issues identified by `/testarch-nfr` for Epic {EPIC_NUMBER}: {EPIC_NAME}.

NFR ISSUES TO FIX (code-level only — architectural issues are excluded):
{PASTE_NFR_FIXABLE_ISSUES}

For each issue:
1. Read the file at the specified location
2. Understand the NFR concern (performance, security, reliability, maintainability)
3. Implement the fix following project conventions
4. Verify the fix doesn't break anything

After fixing all issues:
- Run `npm run build` — must pass
- Run `npm run lint` — must pass
- Commit: `fix(Epic {EPIC_NUMBER}): address NFR findings — {summary}`

RETURN:
- Issues fixed: [count]
- Issues that could NOT be fixed (with explanation): [list or "none"]
- Files modified: [list]
```

---

## Adversarial Review Agent

```
Run `/review-adversarial` for Epic {EPIC_NUMBER}: {EPIC_NAME}.

Perform a cynical, skeptical review of the epic's scope and implementation.
Identify at least 10 issues, gaps, or improvements.

Focus on:
- Scope creep or missing requirements
- Architectural weaknesses
- Testing blind spots
- UX inconsistencies
- Technical debt introduced

RETURN:
- Findings count: [N]
- Critical issues: [list]
- Report path: [file path]
```

---

## Retrospective Agent

```
Run `/retrospective` for Epic {EPIC_NUMBER}: {EPIC_NAME}.

IMPORTANT: You are acting as Pedro (the developer/project owner) in the party mode dialogue.

Before answering ANY question during the retrospective:
1. Think deeply and analytically about the question
2. Consider multiple perspectives before responding
3. Evaluate if your answer is the BEST possible answer
4. Draw from the actual implementation experience of this epic
5. Be thoughtful, honest, and constructive — not generic

When asked about:
- What went well → Be specific about techniques, patterns, tools that worked
- What didn't → Be honest about friction points, time sinks, quality gaps
- Action items → Propose concrete, measurable improvements

RETURN:
- Retrospective document path: [file path]
- Top 3 lessons learned: [list]
- Action items for next epic: [list]
```

---

## Report Agent

```
Create a comprehensive epic completion report for Epic {EPIC_NUMBER}: {EPIC_NAME}.

GATHER INFORMATION FROM:
- Story files: docs/implementation-artifacts/*{EPIC_NUMBER}*.md
- Design review reports: docs/reviews/design/
- Code review reports: docs/reviews/code/
- Sprint status: docs/implementation-artifacts/sprint-status.yaml
- Git log: git log main --oneline (recent merges)
- Post-epic outputs: testarch-trace, testarch-nfr, adversarial review, retrospective

REPORT STRUCTURE:
1. **Executive Summary** — Epic goal, outcome, date range
2. **Stories Delivered** — Table: story ID, name, PR URL, review rounds, issues fixed
3. **Review Metrics** — Total story-related issues found/fixed by severity across all stories
4. **Deferred Issues (Pre-Existing)** — Issues found in files NOT changed by any story. These exist on main and were NOT introduced by this epic. List each with severity, description, file:line, and which story's review discovered it. These should be fixed in a future sprint.
5. **Post-Epic Validation** — Trace coverage, NFR assessment, adversarial findings summary
6. **Lessons Learned** — Key insights from retrospective
7. **Build Verification** — Run `npm run build` on main, confirm success

COORDINATOR DATA (use this for the stories table):
{PASTE_TRACKING_TABLE}

PRE-EXISTING ISSUES (deferred — include in section 4):
{PASTE_PRE_EXISTING_ISSUES_LIST}

SAVE TO: docs/implementation-artifacts/epic-{EPIC_NUMBER}-completion-report-{DATE}.md

RETURN:
- Report file path
```
