# Phase 3: Final Report

## Overview

After all phases complete, spawn a **Report Agent** to compile a comprehensive epic completion report. This is the deliverable that summarizes everything done.

## Report Agent

Spawn a **general-purpose sub-agent** with the Report Agent template from [agent-prompt-templates.md](agent-prompt-templates.md).

**Critical**: Pass the coordinator's tracking table to the report agent. Also reference the **persistent tracking file** (`docs/implementation-artifacts/epic-{N}-tracking-{DATE}.md`) as the primary data source — it contains PR URLs, review round counts, issue counts, per-story findings, fixes applied, and non-issues that the agent can't derive from files alone.

```
{PASTE_TRACKING_TABLE_HERE}
```

## Report Structure

The report agent creates a markdown file with:

### 1. Executive Summary
- Epic number and name
- Goal (from epics.md)
- Outcome (all stories shipped / N stories parked)
- Date range (first start to last merge)

### 2. Stories Delivered
Table with columns:
| Story ID | Name | PR URL | Review Rounds | Issues Fixed | Status |

### 3. Review Metrics
Aggregate across all stories:
- Total issues found by severity
- Total issues fixed
- Average review rounds per story
- Stories that needed 2+ rounds (and why)

### 4. Deferred Issues

#### 4a. Known Issues (Already Tracked)
Pre-existing issues that matched entries in `docs/known-issues.yaml` at epic start. Reference by KI-NNN with a brief note of which story re-encountered them. These require no new action — they're in the triage pipeline. This section demonstrates awareness without re-flagging.

#### 4b. New Pre-Existing Issues (Added to Register)
Genuinely new issues found in files NOT changed by any story that were NOT in `known-issues.yaml` at epic start. These were added to the register in Phase 2 with KI-NNN IDs. Listed with: KI-NNN, severity, description, file:line, discovering story, and disposition (open for future triage).

### 4c. Non-Issues (False Positives)
Items flagged by review agents that were verified as not actual problems. Listed for transparency with original severity, description, and reason for classification.

### 5. Post-Epic Validation Results
- Testarch trace: coverage percentage, gaps, gate decision
- Testarch NFR: assessment summary, gate decision
- Adversarial review: key findings count, critical issues

### 6. Lessons Learned
From retrospective:
- Top insights
- Action items for next epic
- Patterns to repeat / avoid

### 7. Suggestions for Next Epic
Based on patterns observed during execution:
- Process improvements derived from recurring issues
- Review pipeline tuning based on agent effectiveness
- Story sizing feedback for stories that needed excessive rounds
- Codebase health recommendations from clustered pre-existing issues

### 8. Build Verification
The report agent runs `npm run build` on main to confirm the final state builds successfully.

## Save Location

```
docs/implementation-artifacts/epic-{N}-completion-report-{DATE}.md
```

Where `{DATE}` is today's date in `YYYY-MM-DD` format.

## Coordinator After Report

1. Read the report file path from agent result
2. Commit the report:
   ```bash
   git add docs/implementation-artifacts/epic-{N}-completion-report-*.md
   git commit -m "docs(Epic {N}): add completion report"
   git push
   ```
3. Display the report path and a brief summary to the user
4. Mark Phase 3 complete in TodoWrite
