# Epic 5 Review: Insights & Learning Analytics

**Date:** 2026-02-14
**Stories Reviewed:** 6
**Sub-Agent Reviews:** 6 parallel adversarial reviews

---

## Epic-Level Verdict: **REVISE**

Three systemic issues affect the entire epic: (1) NFR3 is misattributed across 4 stories — PRD NFR3 is "video playback starts instantly," not "<100ms queries"; (2) no loading state specifications despite UX spec mandating skeleton loaders; (3) no query performance strategy for stories aggregating raw studySessions data. Additionally, 3 FR fulfillment claims are inaccurate.

**Important context note:** Multiple sub-agents flagged that Dexie.js and Zustand don't exist in the current codebase. This is expected — the epic header explicitly states "Epic 4 complete" and "Epic 1 complete" as prerequisites, which introduce these technologies. These are NOT story defects and are excluded from this report.

---

## Systemic Findings

### Critical (affects multiple stories)

- **NFR3 Misattribution** — Affects: Stories 5.1, 5.4, 5.5, 5.6. All cite "NFR3" for the <100ms query performance target. PRD NFR3 is actually "Video playback starts instantly with no buffering for local files." The <100ms target comes from the Architecture document's performance optimization section (line 874), not from any numbered NFR.

- **Missing Loading State Specifications** — Affects: Stories 5.2, 5.4, 5.5, 5.6. The UX spec mandates "Skeleton loaders for predictable content (stats cards), 500ms delay before showing" (line 1804). None of these stories specify what the loading skeleton looks like.

- **No Query Performance Strategy** — Affects: Stories 5.4, 5.5, 5.6. All three query raw `studySessions` across 7-30 day windows and aggregate in JavaScript without specifying indexed query patterns, caching, or the Architecture's midnight Web Worker pre-computation.

### Cross-Reference Issues

- FR37 misassigned (5.1 claims, 5.2 implements)
- FR42 stretch remap (timeline is informational, not scheduling suggestions)
- FR46 not implemented (no abandoned course comparison in 5.6)
- FR47 partially fulfilled (insights yes, recommendations no)
- Completion percentage definition conflict (3 definitions)
- StudyPatterns has no UX specification

---

## Verdict Summary

| Story | Verdict | Critical | High | Medium |
|-------|---------|----------|------|--------|
| 5.1 | REVISE | 0 | 2 | 3 |
| 5.2 | REVISE | 0 | 3 | 3 |
| 5.3 | REVISE | 0 | 2 | 2 |
| 5.4 | REVISE | 0 | 2 | 3 |
| 5.5 | REVISE | 1 | 3 | 2 |
| 5.6 | REVISE | 1 | 3 | 2 |

---

## FR Coverage Matrix

| FR | Epic Claims | Assigned To | PRD Original | Status |
|----|------------|-------------|--------------|--------|
| FR36 | Yes | Story 5.1 | "view momentum score as hot/warm/cold" | Covered |
| FR37 | Yes | Story 5.1 | "sort course list by momentum score" | MISASSIGNED — sort in 5.2 |
| FR38 | Yes | Story 5.2 | "calculate momentum" | Covered |
| FR39 | Yes | Story 5.3 | "course recommendations" | Remapped — covered |
| FR40 | Yes | Story 5.4 | "suggestions for next course" | Remapped — covered |
| FR41 | Yes | Story 5.4 | "courses at risk of abandonment" | Remapped — partial |
| FR42 | Yes | Story 5.5 | "adaptive study scheduling" | STRETCH |
| FR43 | Yes | Story 5.5 | "study time analytics by period" | Covered |
| FR44 | Yes | Story 5.6 | "completion rates over time" | Covered |
| FR46 | Yes | Story 5.6 | "retention: completed vs abandoned" | NOT IMPLEMENTED |
| FR47 | Yes | Story 5.6 | "insights and recommendations" | PARTIAL |
| FR64 | Yes | Story 5.2 | NOT IN PRD | Acknowledged in governance |
| FR65 | Yes | Story 5.2 | NOT IN PRD | Acknowledged in governance |

---

## Schema Consistency

| Element | Architecture Canonical | Story References | Match? |
|---------|----------------------|------------------|--------|
| courseMomentum PK | `courseId` (not ++id) | All stories | YES |
| courseMomentum indexes | `courseId, score, category, lastStudied` | Story 5.1 | YES |
| studySessions | `++id, courseId, startTime, endTime, duration` | Stories 5.4, 5.5, 5.6 | YES |
| progress | `++id, courseId, videoId, currentTime, completionPercentage` | Stories 5.1, 5.3, 5.5, 5.6 | YES |
| notes | `id, courseId, &videoId, *tags, createdAt, updatedAt` | Story 5.5 | YES |
| Compound index [courseId+startTime] | NOT IN SCHEMA | Stories 5.2, 5.4 need it | MISSING |

---

## Dependency Graph

```
Story 5.1 --> Epic 1, Epic 4
Story 5.2 --> Story 5.1
Story 5.3 --> Story 5.1, Epic 1
Story 5.4 --> Story 5.1, Story 5.3 (placement)
Story 5.5 --> Story 5.4 (extends store)
Story 5.6 --> Story 5.4 (extends store)
```

No circular or forward dependencies. Valid.

---

## Required Changes (Consolidated)

### Blockers
- [ ] Fix NFR3 misattribution across Stories 5.1, 5.4, 5.5, 5.6
- [ ] Resolve completion percentage definition (Story 5.6)
- [ ] Resolve midnight session rule contradiction (Story 5.5)
- [ ] Define watchedDuration aggregation (Story 5.6)

### High Priority
- [ ] Move FR37 from Story 5.1 to Story 5.2
- [ ] Address FR46 gap (Story 5.6)
- [ ] Clarify FR42 fulfillment (Story 5.5)
- [ ] Define trend comparison formula (Story 5.2)
- [ ] Add loading state ACs (Stories 5.2, 5.4, 5.5, 5.6)
- [ ] Add query performance strategy (Stories 5.4, 5.5, 5.6)
- [ ] Address QuickActions overlap (Story 5.3)
- [ ] Define MomentumScore interface (Story 5.1)
- [ ] Define ActivityEvent interface (Story 5.5)

### Medium Priority
- [ ] Specify sparkline per-bar aggregation (Story 5.4)
- [ ] Specify timezone for week boundaries (Story 5.4)
- [ ] Clarify trend window comparison (Story 5.4)
- [ ] Specify initialize() call site (Story 5.1)
- [ ] Acknowledge StudyPatterns UX gap (Story 5.5)
- [ ] Define "View all activity" target (Story 5.5)
- [ ] Define ProgressChart daily series (Story 5.6)
- [ ] Specify mobile toggle defaults (Story 5.6)
- [ ] Specify trend caching mechanism (Story 5.2)
- [ ] Relax NFR17 for Story 5.3

---

## Approval Gate

This epic cannot proceed to implementation until:

1. NFR3 misattribution is corrected across all 4 affected stories
2. Completion percentage definition is unified
3. FR37 is reassigned from Story 5.1 to Story 5.2
4. FR46 is either implemented or formally deferred
5. Loading state specifications are added to Stories 5.2, 5.4, 5.5, 5.6
6. Story 5.5's midnight session rule contradiction is resolved
7. Story 5.6's watchedDuration aggregation is defined
8. Trend comparison formula in Story 5.2 is made concrete
