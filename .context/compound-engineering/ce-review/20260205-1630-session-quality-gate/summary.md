# ce-review run: session quality course gate

**Scope:** Standalone review on `main` worktree. BASE merge-base: `ceb1ca193c65242f9fd3a6150b1bcab04133b307` (origin/main).

**Files in scope (intent):**
- `src/stores/useSessionStore.ts` (tracked, modified)
- `src/lib/sessionQualityCourseGate.ts` (untracked — **stage before PR**)
- `src/lib/__tests__/sessionQualityCourseGate.test.ts` (untracked)

**Excluded:** Numerous other untracked `docs/`, `.context/`, and scratch files — not part of this diff.

**Intent:** Gate `session-quality-calculated` so `QualityScoreDialog` appears only when the course is fully complete (all imported videos + PDFs marked completed), not after every long session.

**Plan:** No matching `docs/plans/*` found for this change — requirements verification skipped.

**Verdict (synthesis):** Ready with fixes — address PDF/lesson-set alignment and optionally add end-to-end dispatch coverage before merge.
