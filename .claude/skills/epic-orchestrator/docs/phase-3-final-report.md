# Phase 3: Final Report

## Overview

After all phases complete, spawn a **Report Agent** to compile a comprehensive epic completion report. This is the deliverable that summarizes everything done.

## Report Agent

Spawn a **general-purpose sub-agent** with the Report Agent template from [agent-prompt-templates.md](agent-prompt-templates.md).

**Critical**: Pass the coordinator's tracking table to the report agent. This table contains PR URLs, review round counts, and issue counts that the agent can't derive from files alone.

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

### 4. Deferred Issues (Pre-Existing)
Issues found in files NOT changed by any story during this epic. These exist on `main` already and should be addressed in a future sprint. Listed with severity, description, file:line, and which story's review discovered them.

### 5. Post-Epic Validation Results
- Testarch trace: coverage percentage, gaps, gate decision
- Testarch NFR: assessment summary, gate decision
- Adversarial review: key findings count, critical issues

### 5. Lessons Learned
From retrospective:
- Top insights
- Action items for next epic
- Patterns to repeat / avoid

### 6. Build Verification
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
