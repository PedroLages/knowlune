# Epic 4 Review: Habit Formation & Streaks

**Date:** 2026-02-14
**Stories Reviewed:** 6
**Sub-Agent Reviews:** 6 parallel adversarial reviews

---

## Epic-Level Verdict: **REVISE**

All 6 stories received REVISE verdicts. Three systemic issues affect the entire epic: (1) FR28-35 have been silently redefined from the PRD, making traceability reports meaningless — the original PRD requirements for reminders and learning challenges are completely dropped; (2) the Dexie schema deviation and new `settings` table are undocumented in Architecture, with no coordinated version increment strategy; (3) neither `dexie` nor `zustand` packages exist in the project, meaning the entire data and state management foundation is phantom.

---

## Systemic Findings

### Critical (affects multiple stories)

- **FR Numbering Divergence from PRD** — Affects: ALL stories. The epics.md redefined FR28-35 to different requirements than the PRD. The original PRD's FR30 (reminders), FR32 (learning challenges), FR33 (challenge progress), FR34 (challenge types) are not implemented by any story. Story 4.6 implements PRD FR31 (pause) but claims no FR.

- **Phantom Infrastructure — dexie and zustand not installed** — Affects: ALL stories. Neither package in `package.json`. No `src/stores/` or `src/db/` directories exist.

- **Dexie Version Increment Not Coordinated** — Affects: Stories 4.1, 4.6. Both add tables but neither specifies version numbers.

- **No IndexedDB Failure Handling (NFR15)** — Affects: Stories 4.1, 4.2, 4.3, 4.4, 4.6. Epic claims NFR15 but no story implements fallback.

- **Missing Accessibility Criteria** — Affects: Stories 4.2, 4.3, 4.4. Project mandates WCAG 2.1 AA+.

### Cross-Reference Issues

- Architecture Schema Mismatch: `++id` vs `&date` for streaks table
- UX Gradient Conflict: 2-stop vs 3-stop
- CSS vs Framer Motion Conflict in celebrations
- Milestone Set Mismatch: UX lists 3, story lists 8
- Existing User Data Migration Gap

---

## Verdict Summary

| Story | Verdict | Critical | High | Medium |
|-------|---------|----------|------|--------|
| 4.1 | REVISE | 2 | 3 | 3 |
| 4.2 | REVISE | 1 | 3 | 2 |
| 4.3 | REVISE | 2 | 2 | 3 |
| 4.4 | REVISE | 0 | 3 | 4 |
| 4.5 | REVISE | 1 | 3 | 3 |
| 4.6 | REVISE | 2 | 2 | 2 |

---

## FR Coverage Matrix

| FR | Epic Claims | Assigned To | PRD Original | Status |
|----|------------|-------------|--------------|--------|
| FR28 | Yes | Story 4.1 | "view daily study streak counter" | Remapped to "track daily study time" |
| FR29 | Yes | Story 4.2 | "view visual calendar" | Remapped to "calculate study streak" |
| FR30 | Yes | Story 4.3 | "configure reminders" | REMAPPED — reminders NOT implemented |
| FR31 | Yes | Story 4.2 | "pause streak without losing history" | REMAPPED — pause is in Story 4.6, not 4.2 |
| FR32 | Yes | Story 4.5 | "create learning challenges" | REMAPPED — challenges NOT implemented |
| FR33 | Yes | Story 4.4 | "track challenge progress" | REMAPPED — challenges NOT implemented |
| FR34 | Yes | Story 4.2 | "challenge types" | REMAPPED — challenges NOT implemented |
| FR35 | Yes | Story 4.3 | "milestone visual feedback" | Remapped to "study consistency heatmap" |
| — | No | Story 4.6 | FR31: "pause streak" | ORPHANED — functionality exists, no FR |

---

## Schema Consistency

| Element | Architecture Canonical | Story References | Match? |
|---------|----------------------|------------------|--------|
| streaks PK | `++id` | 4.1, 4.2, 4.3: `&date` | MISMATCH (documented deviation) |
| streaks fields | `date, minutesStudied` | All stories | YES |
| studySessions | `++id, courseId, startTime, endTime, duration` | Story 4.1 | YES |
| settings | NOT DEFINED | Story 4.6: `&key` | NEW (undocumented) |

---

## Dependency Graph

```
Story 4.1 --> Epic 1 (Dexie DB, VideoPlayer), Story 3.3 (retryWithBackoff)
Story 4.2 --> Story 4.1
Story 4.3 --> Story 4.2
Story 4.4 --> Story 4.2, Story 4.1
Story 4.5 --> Story 4.2
Story 4.6 --> Story 4.2, Story 4.1
```

No circular or forward dependencies. Valid.

---

## Required Changes (Consolidated)

### Blockers
- [ ] Resolve FR numbering divergence with documented decision
- [ ] Add Dexie and Zustand as prerequisites
- [ ] Coordinate Dexie version increment between Stories 4.1 and 4.6
- [ ] Resolve useVideoPlayerStore dependency in Story 4.1
- [ ] Assign FR to Story 4.6

### High Priority
- [ ] Add IndexedDB failure handling (NFR15) across all stories
- [ ] Define localStorage to Dexie migration path (Stories 4.2, 4.3)
- [ ] Add accessibility criteria (Stories 4.2, 4.3, 4.4)
- [ ] Resolve gradient conflict (Story 4.2)
- [ ] Add visibilitychange handler (Story 4.1)
- [ ] Fix streaks upsert to read-modify-write (Story 4.1)
- [ ] Define streakId generation (Story 4.5)
- [ ] Resolve 365-to-30 day max change (Story 4.6)

### Medium Priority
- [ ] Resolve CSS vs Framer Motion conflict (Story 4.5)
- [ ] Confirm expanded milestone set (Story 4.5)
- [ ] Specify particle counts for Day 50 and 200 (Story 4.5)
- [ ] Add empty/error/loading states (Stories 4.3, 4.4)
- [ ] Specify history view container type (Story 4.4)
- [ ] Mandate architecture document update (Stories 4.1, 4.6)
- [ ] Specify retryWithBackoff resolution (Story 4.1)
- [ ] Define partial week handling (Story 4.3)
- [ ] Specify extend pause interaction (Story 4.6)
- [ ] Add lessonId to studySessions index (Story 4.1)

---

## Approval Gate

This epic cannot proceed to implementation until:

1. FR numbering divergence is formally resolved
2. Infrastructure prerequisites are established (dexie, zustand)
3. Dexie version coordination is documented
4. IndexedDB failure handling is specified
5. localStorage to Dexie migration path is defined
6. Accessibility criteria are added to Stories 4.2, 4.3, 4.4
