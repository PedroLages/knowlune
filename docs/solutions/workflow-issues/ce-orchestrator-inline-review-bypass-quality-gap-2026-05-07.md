---
title: "Bypassing the CE orchestrator review loop with inline code edits lets through data corruption bugs that structured review would catch"
date: 2026-05-07
category: workflow-issues
module: development_workflow
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - "Bypassing Phase 2.3 of the CE orchestrator (review loop) in favor of inline code edits during the work phase"
  - "Shipping changes across 20+ files and 1000+ lines without a structured review pass"
  - "Running the CE orchestrator in autopilot mode that skips the review loop on large, multi-file diffs"
  - "The diff touches data persistence, content validation, or observable UX and review is skipped"
tags:
  - ce-orchestrator
  - review-loop
  - quality-gates
  - retrospective-review
  - silent-data-corruption
  - process-discipline
related_docs:
  - "docs/solutions/workflow-issues/ce-pipeline-visual-redesign-interactions-2026-05-06.md"
  - ".claude/skills/ce-orchestrator/SKILL.md"
---

# CE orchestrator inline review bypass quality gap

## Context

Three implementation plans (013, 014, 015) were shipped across five pull requests — 22 files, 1,072 lines — in a single session. Under time pressure, the orchestrator pipeline was shortcut: ce:work was done inline instead of invoking the formal skill, ce:review was performed ad-hoc without the tiered persona agents, and ce:compound was deferred.

The code was merged without a formal review pass. A retrospective review using the full ce:review pipeline subsequently found 13 issues that had been overlooked — including a P0 silent data corruption bug.

All findings were fixed in a single post-hoc commit (`bb0a676c`).

## What the retrospective found

| Severity | Count | Examples |
|----------|-------|----------|
| P0 | 1 | `createWritable()` without `keepExistingData: true` truncates file on resume — silent data corruption |
| P1 | 5 | cancelDownload ignores `retrying` status; BookContextMenu not awaited; checkpoint mutated via getState(); linkedBookId leak in similarity; OPFS path format mismatch |
| P2 | 4 | AbortController shared across retry frames; Map without eviction grows unboundedly; duplicate startDownload guard missing; totalSize from offset+Length instead of Content-Range |
| Testing | 3 | DownloadManager 0% coverage; useDownloadStore 0% coverage; pathCoverUpload test broken by message change |

## Why the review loop would have caught these

Each finding falls into a category that the ce:review agent swarm is specifically designed to detect:

- **Silent data corruption** (P0): The `keepExistingData` option is an obscure File System Access API detail. The correctness reviewer flags these — its prompt specifically asks about logic errors and edge cases in new code paths.
- **State machine gaps** (P1): cancelDownload only checking `downloading` — the testing reviewer catches incomplete state coverage automatically.
- **Store mutation discipline** (P1): Direct Zustand assignment bypasses React reconciliation — the maintainability reviewer flags shared-mutable-state patterns.
- **Cross-cutting concerns** (P1): linkedBookId leaking across store boundaries — only visible when the review sees the full diff across all files, which the orchestrator-level review provides.
- **Resource management** (P2): AbortController sharing, Map without eviction — the reliability reviewer catches these.
- **Zero test coverage** (Testing): The testing reviewer reports coverage gaps as CRITICAL_GAP findings.

A single human reviewer working quickly cannot match the breadth of 4+ persona agents, each applying a different lens. The correlation between time pressure and bug density is real — the pipeline is the antidote, not the casualty.

## Guidance

**Always run the full orchestrator pipeline.** The three mandatory gates after plan approval are:

1. **ce:work** — Formal work execution with proper branching, commits, and progress tracking
2. **ce:review** — Structured code review using tiered persona agents (correctness, testing, maintainability, security, reliability, adversarial, performance, kieran-typescript)
3. **ce:compound** — Solution extraction that captures lessons while context is fresh

In autopilot mode, the plan-approval gate still requires critic score ≥ 85 with zero blockers. The review loop still enforces zero-tolerance on P0, P1, and P2 findings. Only cosmetic choices are auto-answered — the quality gates themselves remain hard.

## When to apply

- **Always** when running the CE orchestrator for any session that produces code
- **Especially** in multi-PR sessions where velocity pressure is highest. The pipeline's value scales with diff size — more lines = more bugs = more need for structured review
- When a human reviewer is tempted to "quick scan" instead of dispatching the agent swarm. A single human cannot match 4+ specialized agents
- When ce:compound is deferred "until later." Institutional memory decays in hours, not days

## Prevention

- Do not bypass the Phase 2.3 review loop, regardless of autopilot mode or time pressure
- If review is the bottleneck, shorten the diff scope (smaller commits, fewer PRs per batch) rather than removing the gate
- Run ce:compound immediately post-merge while context is fresh — do not defer to end-of-session
- For large diffs (>20 files, >1000 lines), the adversarial and reliability reviewers become especially important — they detect cross-cutting concerns invisible to single-file review
