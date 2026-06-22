---
title: "Retrospective: Epics 68, 77A, and 77B (Coordinated Run)"
type: retrospective
date: 2026-06-22
epics:
  - E68: On-Device Embedding Hardening (gap-fill)
  - E77A: Export & Archive (Disaster Recovery)
  - E77B: Google Drive as Remote Course Source
stories_shipped: 11 (E68: 3, E77A: 4, E77B: 4)
phase: mid-execution (~70% complete)
---

# Retrospective: Epics 68, 77A, and 77B

## Executive Summary

This coordinated run shipped 11 stories across three distinct domains — embedding pipeline hardening, disaster-recovery backup/restore, and Google Drive as a remote course source. The execution demonstrated real strength in architectural discipline (planning audit correctly split E77 into two independent epics, E68 was descoped to gap-fill only) and review infrastructure (catching AC coverage gaps, dead code, and correctness bugs across multiple rounds). It also revealed a recurring weakness: first-review quality is consistently too low, with every story requiring 2-4 review rounds. The pattern of R1 issues is repetitive — scope mismatch, missing tests, AI-generated dead code — suggesting the pre-review self-check is weak.

As of 2026-06-22, ~70% of the work is complete. E68-S03 is ready-for-dev, E77A-S03/S04 have passed review, and E77B-S04 is in-progress.

## What Went Well

### 1. Planning Audit Prevented Major Waste

The 2026-04-24 codebase audit correctly identified that the original E68 spec (7 stories) described a greenfield `src/ai/embeddings/` abstraction layer that didn't exist — the working code had grown organically across 6 files during Epics 9, 57, and 62. Descoping to 3 gap-fill stories avoided an expensive refactor with zero user value. Similarly, splitting E77 into E77A (disaster recovery) and E77B (remote course file access) separated two fundamentally different user intents that had been conflated. This is now an established pattern: audit first, descope aggressively, ship bounded additions.

### 2. Infrastructure Reuse Accelerated Delivery

- E77A reused `exportService.ts` (battle-tested by E119 GDPR Article 20 export) and `importService.ts` — the backup format is the existing `KnowluneExport` JSON at schema version 14, unchanged
- E77B reused the Audiobookshelf remote-source pattern (E101-E102): remote library connection -> browse -> import references -> stream on demand -> cache locally, with Google Drive API replacing the ABS HTTP API
- The Supabase Edge Function proxy pattern from E35 was reused for Drive media CORS mitigation
- E77B's `resolveFileUrl()` is a single seam between all players and file sources, designed for future source plug-in

### 3. Review Pipeline Caught Critical Issues

The 6-agent review swarm (code-review, code-review-testing, security-review, design-review, performance-benchmark, exploratory-qa) caught real bugs and quality gaps:

- **E68-S01 R1**: False error toast on every visit to low-memory devices (HIGH) — would have shipped a UX regression
- **E68-S01 R2**: Flaky test with underlying bug where worker-crash handler fired false error toast (BLOCKER)
- **E68-S02**: Error `reason` stripped at worker message boundary — AC8 not met in production (HIGH); 6/8 ACs tested (BLOCKER)
- **E77-S02 R1**: 0% AC coverage — story scope mismatched the PR (BLOCKER)
- **E77B-S02 R1**: `pdfCount` zeroed, `source:drive` flag missing, `fileId` validation needed (all fixed)
- **E77B-S04**: `updateCourseDetails` return value ignored, stale state risk (MEDIUM); toast denominator inflated with non-video files (MEDIUM)

### 4. Institutional Knowledge Transfer Worked

E77A-S04's code review explicitly praised the `finally`-block pattern for React 19 closure safety — the team adopted a pattern documented in `docs/solutions/` from E77A-S03's lessons learned. This confirms the solutions database is reducing repeat mistakes.

### 5. Clean Architecture Choices

- **E68**: Minimal `EmbeddingProvider` interface (3 members: `name`, `embed()`, `isAvailable()`) — no factory, no registry, no `FallbackProvider` class; per-request fallback (not sticky) so mid-session API key configuration is immediately effective
- **E77A**: Pre-restore safety backup default-on with opt-out, atomic Dexie transaction for restore
- **E77B**: File-less import (references only, not files), `drive.readonly` scope requested incrementally (not at sign-in), premium gate before any API call; reconnect flow maps new IDs by filename match preserving all notes and progress

## What Didn't Go Well

### 1. First-Review Quality Consistently Low (Recurring Pattern)

Every story needed 2-4 review rounds:

| Story | Rounds | Issues Fixed | R1 Breakdown |
|-------|--------|-------------|--------------|
| E68-S01 | 4 | 33 | R1: 17, R2: 9, R3: 7 |
| E68-S02 | 1+ (ongoing) | ~8 | 2 BLOCKER, 4 HIGH (testing gap) |
| E77-S02 | 2 | 7 | 1 BLOCKER, 2 HIGH, 3 MEDIUM |
| E77A-S04 | 1 | 2 HIGH, 4 MEDIUM, 3 NIT | Passed in 1 round (best) |
| E77B-S01 | 2 | 6 | PremiumGate, keyboard nav, format, aria, error handling, tests |
| E77B-S02 | 1 | 4 | `pdfCount`, `source:drive`, `fileId` validation, tests |

E68-S01's 4 rounds and 33 fixes is the most costly story in the run. The R1 issues follow a repetitive pattern: scope mismatch, missing tests, incomplete error handling, and AI-generated dead code. This suggests the pre-review self-check is not thorough enough. If even 1-2 rounds could be saved per story, the run would be substantially faster.

### 2. AI-Generated Dead Code Slipped Through

E68-S01's code review found a 115-line `useModelDownloadProgress` hook with zero production callers and misleading documentation — an AI smell. The component's header comment claimed the hook was used, but the component implemented its own ref-based logic. This was cleaned up in R2 but should have been caught in the pre-review self-check. The root cause is incomplete cleanup of AI-generated abstractions.

### 3. Test Drift from Concurrent Branches

During E77A-S04's review pre-checks, `settings.test.ts` had stale expectations because `colorScheme` default changed from `'professional'` to `'clean'` and `fontSize` was removed in a parallel story on a diverged branch. This is a coordination problem inherent to the epic orchestrator approach: multiple stories in the same epic run in (near-)parallel, and when branches diverge from `main` for different lengths of time, test expectations drift. The mitigation (running unit tests before opening PR) is manual and easy to forget.

### 4. Execution Tracker Drifted from Reality

The tracking file (`epic-68-77-tracking-2026-06-21.md`) showed most stories as "queued" even after they were implemented and merged. This is documentation hygiene: the tracker needs to be updated as part of the `/finish-story` workflow, not batched at the end.

### 5. Pre-Existing E2E Flakiness Created Review Friction

Three Overview page E2E tests (`stats-grid` selector timeout) fail intermittently. These were noted in multiple review pre-checks but are unrelated to these epics. They added noise to every review round's pre-check output and required manual verification that failures were pre-existing. This is a known-issue that should be prioritized for a dedicated fix pass.

### 6. Story Scope Mismatch Between Spec and PR (E77-S02 R1)

E77-S02's story file specified 9 acceptance criteria for a full Google Drive service layer, but the PR only implemented the foundational infrastructure (token helper + OAuth scope). The testing review flagged this as a BLOCKER with 0% AC coverage. The root cause was that the story file was never updated after the E77 split — it still described the original E77-S02 scope from the pre-audit spec. The story file and implementation diverged, and nobody caught it before review. This was fixed in R2 by trimming the story to 7 ACs matching the actual PR.

## Key Metrics

| Metric | Value |
|--------|-------|
| Epics in run | 3 (E68, E77A, E77B) |
| Total stories | 11 (E68: 3, E77A: 4, E77B: 4) |
| Stories shipped (done) | 6 (E68-S01/S02, E77A-S01/S02, E77B-S01/S02) |
| Stories in review/in-progress | 4 (E68-S03 ready, E77A-S03/S04 review, E77B-S04 in-progress) |
| Total review rounds across shipped stories | ~11 |
| Total issues fixed across shipped stories | ~50+ |
| Total commits | ~69 (E68: 10, E77A: 34, E77B: 25) |
| Total merged PRs | 10+ (E68: 2, E77A: 4, E77B: 4+) |
| AC coverage at R1 (worst) | 0% (E77-S02) |
| AC coverage at R1 (best) | 100% (E77A-S04) |
| Review rounds per story (average) | ~2.2 |
| Issues per story (average) | ~9 |

## Top 3 Lessons Learned

### 1. Build a Pre-Review Self-Check into the Workflow

Every story went through 2-4 review rounds. The R1 issues follow a repetitive pattern: scope mismatch, missing tests, AI-generated dead code. A mandatory pre-review checklist — placed in the story file or as a workflow step before dispatching `/review-story` — would catch the most common issues:

- [ ] Story file scope matches the PR diff (AC coverage >= 80%)
- [ ] No dead code (zero-caller exports, unused abstractions)
- [ ] All new error paths tested (not just happy paths)
- [ ] Test expectations not stale from parallel branches (run unit tests against current `main`)
- [ ] No AI smells (unused hooks, hallucinated APIs, misleading comments)
- [ ] Working tree is clean

Run this checklist before opening the `/review-story` PR. If E68-S01 had caught the dead hook and false toast at this stage, it would have saved 2 review rounds and ~20 issues.

### 2. Run Testing Review as a Gate Before the Full Review Swarm

The testing-review agent is the one that catches AC coverage gaps. In this run, those gaps were consistently the most expensive fixes (E68-S02: 2 BLOCKER for untested ACs, E77-S02: BLOCKER for 0% coverage). Running testing-review as a standalone first gate — before dispatching the other 5 agents — would catch the most impactful issues fastest without consuming the full review budget. This is a workflow change, not a tool change: the order of agents within `/review-story`.

### 3. Update Tracking Documentation Within the Finish-Story Workflow

The execution tracker drifted from reality because it was only updated in batches, not per-story. Add a step to `/finish-story` that updates the tracking file immediately upon merge. This prevents the "what's actually done?" confusion that happened with E77A-S01 (shown as "queued" for 3 days after it was merged).

## Action Items for Next Epic

| Priority | Action | Owner | Epic/File |
|----------|--------|-------|-----------|
| HIGH | Create pre-review checklist (see Lesson 1) and add as a workflow step before `/review-story` dispatch | Workflow | `.claude/skills/review-story/SKILL.md` |
| HIGH | Reorder review agents: run testing-review as first gate, block other agents if AC coverage < 80% | Workflow | `.claude/skills/review-story/SKILL.md` |
| MEDIUM | Add tracking-file update step to `/finish-story` skill | Workflow | `.claude/skills/finish-story/SKILL.md` |
| MEDIUM | Add a pre-PR branch sync step: merge `main` and run unit tests before the review cycle | Workflow | `.claude/rules/workflows/story-workflow.md` |
| LOW | Schedule a fix pass for pre-existing E2E flakiness (Overview `stats-grid` selector) | Tech Debt | `docs/known-issues.yaml` KI prefix |
| LOW | Deduplicate warm-up gate logic into a shared utility (`src/ai/lib/workerCapabilities.ts`) | Tech Debt | E68-S03 or fix pass |
| LOW | Consider auto-updating the tracking tracker from git history to prevent drift | Automation | Future infrastructure story |
