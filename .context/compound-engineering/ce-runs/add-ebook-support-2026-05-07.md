---
slug: add-ebook-support
status: active
stage: phase-1-brainstorm
runMode: autopilot
startedAt: 2026-05-07T00:00:00.000Z
updatedAt: 2026-05-07T00:00:00.000Z
schemaVersion: 1
lastGreenSha: 5268d7e2bb431873f3b463b4944da716b9eb8303
branch: feature/ce-2026-05-07-course-card-actions
stagesCompleted: []
artifacts: {}
supportingSkills:
  episodicMemory:
    topMatch: "Knowlune has complete EPUB reader infra (E83-E88, E103-E115) and Audiobookshelf integration for audiobooks (E101). Library page already has ABS settings, browser-direct Bearer auth, and ebook reading pipeline. The gap is surfacing ABS ebooks alongside audiobooks in the library UI."
errors: []
---

## Phase 0.0 — Initialize

Run started from bare idea: "Add ebook support to Knowlune"

## Phase 1.1 — Brainstorm (reclassified)

Brainstorm agent found: ebook infrastructure already extensively built (EPUB reader, ABS sync detecting ebooks, ebook shelves, format tabs, BookContentService for remote EPUBs). This is NOT a ground-up feature — it's a specific integration gap preventing ebooks from surfacing. Dispatched codebase investigation to identify the actual missing piece.

## Phase 0.5 — Episodic Memory

Key finding: Knowlune has complete EPUB reader infra (E83-E88, E103-E115) + ABS audiobook integration (E101). Library page has ABS settings, browser-direct Bearer auth. Gap: surfacing ABS ebooks alongside audiobooks in library UI.

## Phase 0.4 — Classification

- **Stage:** brainstorm (non-path string, feature idea — high confidence)
- **Rationale:** Bare feature idea describing ebook support extension to existing audiobook-only library
