# Epic 73 Retrospective — Tutoring Modes: ELI5, Quiz Me, Debug My Understanding

**Date:** 2026-04-13
**Scope:** 5 stories (S01–S05), tutoring mode architecture + 3 pedagogical modes + conversation history
**Review stats:** 12 total review rounds (S01:2, S02:1, S03:2, S04:2, S05:3), 27 issues fixed
**Final state:** All stories shipped, quality gates green

---

## 1. What Went Well

### 1.1 Marker Pattern Scalability

The SCORE/ASSESSMENT marker pattern (tagged tokens in AI response text that drive UI state) proved robust across two stories. Both S03 (Quiz Me) and S04 (Debug My Understanding) independently adopted the same convention with no coordination overhead, and the pattern held up under Bloom's Taxonomy progression (S03) and gap-analysis grading (S04). The marker syntax is lightweight and survives round-trips through the conversation pruner without data loss.

### 1.2 S02 One-Round Clean Pass

ELI5 Mode (S02) shipped in a single review round — the cleanest story in the epic. The mode's scope was well-bounded (analogies + EmptyState, no scoring state), which made implementation and review straightforward. Clear scope boundaries predict review efficiency better than story complexity alone.

### 1.3 Token Budget Architecture (S01) Held Up Under Load

The budget allocator and conversation pruner designed in S01 successfully absorbed the bloomLevel addition in S03 without requiring architectural changes. The system bent (prompt exceeded original spec budget) rather than broke, and the deviation was accepted as justified. Designing budget allocation as a first-class concern in S01 paid dividends in subsequent stories.

### 1.4 Keyboard Shortcut Completeness (S05)

ConversationHistorySheet shipped with Cmd+H/M/1-5 shortcuts on day one. Adding shortcuts in the same PR as the feature prevents the common pattern of "shortcuts deferred to a follow-up story that never lands."

---

## 2. What Could Be Improved

### 2.1 Marker Stripping Missed Twice

The SCORE marker stripping step (removing tagged tokens before rendering response text to the user) was omitted in both S03 and S04 initial implementations and caught only in review. This is the same gap appearing independently in two consecutive stories — a process failure, not a knowledge gap.

**Root cause:** The marker pattern is defined in agent prompt configuration, but the corresponding stripping logic lives in the rendering layer. There is no co-location signal to remind the implementer that a marker definition requires a strip step.

**Action:** Add a checklist item to the story template for marker-based features: "If AI response includes parsed markers, confirm stripping logic is present in the render path before opening review."

### 2.2 S05 Three-Round Loop from Type Mismatch Introduced by Fix Agent

S05 needed three review rounds. Rounds 2 and 3 were caused by a `TutorMessage` vs `ChatMessage` type mismatch introduced when the fix agent corrected a different issue in round 1. The fix agent resolved the target issue but broke the adjacent type contract.

**Root cause:** Fix agents operate on a diff slice and can introduce regressions in adjacent types that are not in scope for the immediate fix. TypeScript catches this at compile time, but only if the fix agent runs `tsc --noEmit` as part of its correction cycle.

**Action:** Require fix agents to run `npx tsc --noEmit` after every correction and resolve all new errors before submitting the round. Add this to the code review agent's fix instructions.

### 2.3 KI-057 Pre-Existing Type Errors Contaminate Review Signal

Pre-existing type errors (KI-057) repeatedly confused review agents, which flagged them as new issues introduced by the current story. This consumed review cycles investigating non-issues and adds noise to severity assessments.

**Root cause:** Review agents run `tsc --noEmit` against the full codebase and cannot easily distinguish errors from the current diff vs pre-existing baseline errors.

**Action:** Create a `tsc-baseline-errors.txt` snapshot (analogous to the existing `tsc-baseline.txt`) listing known pre-existing errors by file:line. Update the code review agent prompt to diff new errors against this baseline and suppress baseline-matching errors from the report. Refresh the snapshot whenever a known issue is resolved.

### 2.4 Token Budget Design Tension Not Surfaced Until Review

The bloomLevel addition in S03 pushed the quiz prompt over the spec's token budget. This was discovered in review rather than during implementation planning.

**Root cause:** Token budget implications of incremental prompt additions are not evaluated at story scoping time. The budget allocator design in S01 defined totals but did not document per-feature headroom.

**Action:** When a story adds content to an existing prompt, add a budget impact line to the story's technical notes section estimating the token delta and confirming it fits within the current budget or requesting a budget increase.

---

## 3. Patterns to Carry Forward

| Pattern | Where It Proved Out | Recommendation |
|---------|-------------------|----------------|
| Marker tokens (SCORE/ASSESSMENT) in AI responses | S03, S04 | Standardize marker syntax in a shared `markerPatterns.ts` constants file; co-locate stripping utilities |
| Budget allocator as first-class concern | S01 → S03, S04 | Document per-feature headroom in architecture stories so downstream stories can self-check |
| Keyboard shortcuts in same PR as feature | S05 | Add keyboard shortcut checklist item to story template's Definition of Done |
| EmptyState per mode | S02 | Continue pattern — each mode should own its EmptyState for correct nil-state messaging |

---

## 4. Key Metrics

| Metric | Value | Benchmark (prev epics) |
|--------|-------|----------------------|
| Stories shipped | 5/5 | — |
| Review rounds total | 12 | ~8–10 for 5-story epics |
| Avg rounds/story | 2.4 | Target: ≤2.0 |
| Issues fixed | 27 | — |
| S02 one-round pass | 1 of 5 stories | Target: ≥3/5 |
| Marker stripping misses | 2 (S03, S04) | Target: 0 |
| Type regressions from fix agents | 1 (S05 R2) | Target: 0 |

---

## 5. Action Items for Next Epic

1. **Add marker stripping checklist item to story template.** Any story implementing a marker-token pattern must confirm strip logic in the render path before opening review. Update `docs/implementation-artifacts/story-template.md`.

2. **Require fix agents to run `tsc --noEmit` after every correction.** Update `.claude/agents/code-review.md` fix instructions to include a mandatory type-check step before submitting the corrected diff for re-review.

3. **Create `tsc-baseline-errors.txt` and update review agent prompt to suppress baseline-matching errors.** This eliminates KI-057 noise from future review cycles. Maintain the snapshot in `docs/implementation-artifacts/tsc-baseline-errors.txt` and refresh it as known issues are resolved.
