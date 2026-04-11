# Agent Prompt Templates

Copy-paste ready templates with `{VARIABLES}` to fill. Each template produces a self-contained sub-agent prompt.

---

## Story Agent (Start + Implement)

```
You are implementing story {STORY_ID} for the Knowlune learning platform.

STEP 0: Activate `/auto-answer autopilot` to handle plan mode questions autonomously without blocking.

STEP 1: Run `/start-story {STORY_ID}` which will:
- Create branch feature/{STORY_ID_LOWER}-{slug}
- Create story file from template
- Research codebase context (3 parallel agents)
- Generate implementation plan
- Enter plan mode for your approval

STEP 1.5: Verify branch — run `git branch --show-current` and confirm it matches the expected `feature/{STORY_ID_LOWER}-*` pattern. If not, STOP and report the mismatch.

STEP 2: After the plan is ready, EXIT plan mode and implement it fully:
- Write all code, components, and tests
- Follow project conventions: design tokens (never hardcode colors), accessibility (WCAG AA), Tailwind CSS v4
- Use existing UI components from src/app/components/ui/
- **If you add a Dexie migration** (new version in schema.ts): ALSO update `src/db/checkpoint.ts` (CHECKPOINT_VERSION + schema), `src/db/__tests__/schema.test.ts` (expected version + tables/indexes), and `src/db/__tests__/schema-checkpoint.test.ts` (expected version + tables) to match. Failing to do this breaks schema tests at review time.
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
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

Run `/review-story {STORY_ID}` on the current branch.

NOTE: OpenAI and GLM adversarial reviews are enabled via `.claude/settings.json` env block. Ensure `/review-story` dispatches both when API keys are available.

KNOWN ISSUES (already tracked in docs/known-issues.yaml — do NOT re-flag these):
{KNOWN_ISSUES_SUMMARY}

If a pre-existing issue matches one of the above known issues (same file or same category
of problem), classify it as KNOWN, not PRE-EXISTING. This prevents duplicate reporting.

This runs the full quality gate pipeline from `review-story/config/gates.json` — pre-checks (build, lint (auto-fix), type-check, format (auto-fix), unit-tests, e2e-tests) followed by agent gates (design-review, code-review, code-review-testing, performance-benchmark, security-review, exploratory-qa).

Gates may be skipped based on canonical skip conditions (no UI changes → design-review-skipped, exploratory-qa-skipped; lightweight diff → performance-benchmark-skipped; no E2E spec → e2e-tests-skipped).

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

KNOWN ISSUES (already in known-issues.yaml — no action needed):
TOTAL: [count]
- KI-NNN: [matched description]
...

NON-ISSUES (verified false positives — not actual problems):
TOTAL: [count]
- [ORIGINAL_SEVERITY] [description] — [why it's not an issue]

REPORT PATHS:
- Design: [path or "skipped"]
- Code: [path]
- Testing: [path]
- Performance: [path or "skipped"]
- Security: [path]
- QA: [path or "skipped"]

IMPORTANT: Report ALL issues at every severity level. Classify each into one of four tiers:
- STORY-RELATED: in files changed by this story — will be fixed now
- PRE-EXISTING (NEW): in untouched files, NOT in known-issues.yaml — goes in final report
- KNOWN: matches an entry in known-issues.yaml — acknowledged, no action needed
- NON-ISSUES: verified false positives — not actual problems
```

---

## Fix Agent

```
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

STEP 0.5: Verify branch — run `git branch --show-current` and confirm it matches the expected `feature/{STORY_ID_LOWER}-*` pattern. If not, STOP and report the mismatch.

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

If an issue is a FALSE POSITIVE (not actually a problem), do NOT change code for it.
Instead, explain WHY it's not an issue in your return. The coordinator will classify it as NON-ISSUE.

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
1. Validate all 12 canonical review gates passed (from `review-story/config/gates.json` `required_for_reviewed_true`)
2. Update story file: reviewed → true. DO NOT set status → done yet.
3. Update sprint-status.yaml: story → review. DO NOT set to done yet — done only after PR merge.
4. Commit changes
5. Push branch to remote
6. Create PR with description
7. After PR is created and merged: update story status → done, sprint-status → done, set completed date

Activate `/auto-answer autopilot` before running /finish-story to handle any interactive questions automatically.

RETURN:
- PR URL
- PR title
- Branch name
```

---

## Sprint Status Agent

```
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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

## Fix Pass Planning Agent

```
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

You are the FIX PASS PLANNER for Epic {EPIC_NUMBER}: {EPIC_NAME}.

Your job is to READ and ANALYZE — do NOT modify any code. Produce a structured fix plan that execution agents will implement.

AUDIT REPORTS TO READ:
- Testarch Trace: {TRACE_REPORT_PATH}
- Testarch NFR: {NFR_REPORT_PATH}
- Adversarial Review: {ADVERSARIAL_REPORT_PATH} (or "not run")
- Known Issues Register: docs/known-issues.yaml (for cross-reference — don't re-flag known issues)

ALREADY FIXED (skip these — resolved in trace/NFR embedded fix cycles):
{PASTE_ALREADY_FIXED_SUMMARY}

INSTRUCTIONS:
1. Read each audit report and extract ALL unresolved findings
2. Cross-reference with known-issues.yaml — skip already-tracked items
3. Cross-reference with the "already fixed" list — skip items resolved in trace/NFR cycles
4. For each remaining finding, READ the source code at the specified location
5. Determine the specific fix approach (not just "fix this" — explain HOW)
6. Identify dependencies between fixes (e.g., fixing A in file X also resolves B)
7. Group findings by file/area for efficient execution (not just severity)
8. Triage LOW/NIT: mark as QUICK FIX (< 5 min, include approach) or DEFER (explain why)
9. Identify false positives with clear reasoning

RETURN a structured fix plan in this exact format:

FIX PLAN FOR EPIC {EPIC_NUMBER}

SUMMARY:
- Total unresolved findings: [N]
- BLOCKER: [N], HIGH: [N], MEDIUM: [N], LOW: [N], NIT: [N]
- False positives identified: [N]
- Dependencies found: [list or "none"]
- Recommended execution groups: [N]

GROUP 1: [area/theme] — [severity mix, e.g. "2 HIGH + 1 MEDIUM"]
Files: [list of files this group touches]
Findings:
- [ID] [SEVERITY] [description] — file:line — FIX: [specific approach with enough detail for sonnet to implement]
- [ID] [SEVERITY] [description] — file:line — FIX: [specific approach]
Dependencies: [any ordering constraints within this group, or "none"]
Estimated complexity: [simple / moderate / complex]

GROUP 2: [area/theme] — [severity mix]
...

LOW/NIT TRIAGE:
- [ID] [description] — file:line — QUICK FIX: [approach] (< 5 min)
- [ID] [description] — file:line — DEFER: [reason] → known-issues.yaml

FALSE POSITIVES:
- [ID] [SEVERITY] [description] — REASON: [why this is not an actual issue]
```

---

## Fix Pass Execution Agent

```
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

You are implementing fixes from the Fix Pass Plan for Epic {EPIC_NUMBER}: {EPIC_NAME}.

You have been assigned GROUP {GROUP_NUMBER}: {GROUP_THEME}

DO NOT re-analyze or second-guess the plan — the planning agent (opus) already read the code and determined the approach. Follow the fix instructions precisely.

FILES IN THIS GROUP:
{PASTE_GROUP_FILES_LIST}

FIXES TO IMPLEMENT:
{PASTE_GROUP_FINDINGS_WITH_FIX_INSTRUCTIONS}

INSTRUCTIONS:
For each fix:
1. Read the file at the specified location
2. Implement the fix EXACTLY as described in the plan
3. If the planned approach doesn't work (code has changed, approach is wrong), explain why and implement the best alternative
4. Ensure the fix doesn't break related code

After implementing all fixes in this group:
1. Run `npm run build` — must pass
2. Run `npm run lint` — must pass
3. Commit:
   git add [specific files]
   git commit -m "fix(Epic {EPIC_NUMBER}): post-epic fixes — {GROUP_THEME}"

RETURN:
- Fixes implemented: [N] / [total in group]
- Fixes that diverged from plan (with explanation): [list or "none"]
- Fixes that could NOT be implemented (with explanation): [list or "none"]
- Files modified: [list]
```

---

## Adversarial Review Agent

```
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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

Activate `/auto-answer autopilot` to handle retrospective dialogue autonomously.

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
Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

Create a comprehensive epic completion report for Epic {EPIC_NUMBER}: {EPIC_NAME}.

GATHER INFORMATION FROM:
- Persistent tracking file: docs/implementation-artifacts/epic-{EPIC_NUMBER}-tracking-{DATE}.md (primary data source)
- Story files: docs/implementation-artifacts/*{EPIC_NUMBER}*.md
- Design review reports: docs/reviews/design/
- Code review reports: docs/reviews/code/
- Sprint status: docs/implementation-artifacts/sprint-status.yaml
- Git log: git log main --oneline (recent merges)
- Post-epic outputs: testarch-trace, testarch-nfr, adversarial review, retrospective
- Known issues register: docs/known-issues.yaml (cross-reference deferred issues)
- Fix pass tracking: from tracking file's Post-Epic Validation table (Fix Pass Planning, Fix Pass Execution, Gate Check rows)

REPORT STRUCTURE:
1. **Executive Summary** — Epic goal, outcome, date range
2. **Stories Delivered** — Table: story ID, name, PR URL, review rounds, issues fixed
3. **Review Metrics** — Total story-related issues found/fixed by severity across all stories
4. **Deferred Issues**
   - **4a. Known Issues (Already Tracked)** — Pre-existing issues that matched entries in `docs/known-issues.yaml`. Reference by KI-NNN. These need no new action.
   - **4b. New Pre-Existing Issues** — Genuinely new issues NOT in `known-issues.yaml`. Listed with assigned KI-NNN (added to register in Phase 2), severity, description, file:line, and discovering story.
5. **Post-Epic Validation** — Trace coverage, NFR assessment, adversarial findings summary
5b. **Fix Pass Results** — Severity breakdown, fix counts, deferred items, false positives, gate check result
6. **Lessons Learned** — Key insights from retrospective
7. **Suggestions for Next Epic** — Actionable recommendations based on observed patterns:
   - Process improvements (e.g., "add error boundary boilerplate to /start-story template")
   - Review pipeline tuning (e.g., "security review found 0 issues across all stories — consider skipping for UI-only epics")
   - Spec quality feedback (e.g., "E60-S04 took 3 rounds — story may have been too large")
   - Codebase health (e.g., "pre-existing issues cluster in src/stores/ — consider a cleanup epic")
8. **Build Verification** — Run `npm run build` on main, confirm success

COORDINATOR DATA (use this for the stories table):
{PASTE_TRACKING_TABLE}

KNOWN ISSUES MATCHED (reference only — already tracked):
{PASTE_KNOWN_ISSUES_MATCHED}

NEW PRE-EXISTING ISSUES (added to known-issues.yaml in Phase 2):
{PASTE_NEW_PRE_EXISTING_ISSUES_WITH_KI_IDS}

OBSERVED PATTERNS (coordinator passes these for the Suggestions section):
{PASTE_OBSERVED_PATTERNS}

Example patterns to look for:
- Common issue types across stories (e.g., "3/5 stories had missing error boundaries")
- Stories with 2+ review rounds and why (complexity, unclear spec, cascading fixes)
- Recurring false positives (indicates over-sensitive review rules)
- Fix agent effectiveness (how often fixes introduced new issues)
- Review agents that consistently found nothing (may be skippable for similar epics)
- Patterns in pre-existing issues (clustered in specific areas of codebase)

SAVE TO: docs/implementation-artifacts/epic-{EPIC_NUMBER}-completion-report-{DATE}.md

RETURN:
- Report file path
```
