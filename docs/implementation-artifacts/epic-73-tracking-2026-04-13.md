# Epic 73: Tutoring Modes (ELI5, Quiz Me, Debug) — Execution Tracker

Generated: 2026-04-13
Last Updated: 2026-04-13

## Progress Summary

| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
| E73-S01 | queued | — | — | — |
| E73-S02 | queued | — | — | — |
| E73-S03 | queued | — | — | — |
| E73-S04 | queued | — | — | — |
| E73-S05 | queued | — | — | — |

## Story Details

### E73-S01: Mode Architecture — Registry, Budget Allocator, Mode Switching
**Status:** queued
#### Errors
_(none yet)_
#### Review Findings
_(none yet)_
#### Fixes Applied
_(none yet)_
#### Notes
- TutorMode union already has all 5 modes in types.ts:9 — do NOT re-extend
- modeLabels.ts:5 has TODO(E73-S01) marker — must replace with MODE_REGISTRY
- No Dexie migration needed

---

### E73-S02: ELI5 Mode — Simple Explanations with Analogies
**Status:** queued
#### Errors
_(none yet)_
#### Review Findings
_(none yet)_
#### Fixes Applied
_(none yet)_
#### Notes
- Depends on S01 MODE_REGISTRY

---

### E73-S03: Quiz Me Mode — Adaptive Questioning with Score Tracking
**Status:** queued
#### Errors
_(none yet)_
#### Review Findings
_(none yet)_
#### Fixes Applied
_(none yet)_
#### Notes
- ChatMessage.quizScore field already exists in rag/types.ts
- Depends on S01 MODE_REGISTRY

---

### E73-S04: Debug My Understanding — Gap Analysis with Traffic Light Feedback
**Status:** queued
#### Errors
_(none yet)_
#### Review Findings
_(none yet)_
#### Fixes Applied
_(none yet)_
#### Notes
- ChatMessage.debugAssessment field already exists in rag/types.ts
- Depends on S01 MODE_REGISTRY

---

### E73-S05: Conversation History & Session Continuity
**Status:** queued
#### Errors
_(none yet)_
#### Review Findings
_(none yet)_
#### Fixes Applied
_(none yet)_
#### Notes
- Uses existing chatConversations table (v49)
- Keyboard shortcuts: Cmd+H, Cmd+M, Cmd+1-5

---

## Post-Epic Validation

| Command | Status | Result | Notes |
|---------|--------|--------|-------|
| Sprint Status | pending | — | — |
| Mark Epic Done | pending | — | — |
| Testarch Trace | pending | — | — |
| Testarch NFR | pending | — | — |
| Adversarial Review | pending | — | — |
| Retrospective | pending | — | — |
| Fix Pass Planning | pending | — | — |
| Fix Pass Execution | pending | — | — |
| Gate Check | pending | — | — |

## Non-Issues (False Positives)
_(none yet)_

## Known Issues Cross-Reference

### Matched (already in register)
_(none yet)_

### New (to be added to register in Phase 2)
_(none yet)_

## Epic Summary
- Started: 2026-04-13
- Completed: --
- Total Stories: 5
- Total Review Rounds: --
- Total Issues Fixed: --
