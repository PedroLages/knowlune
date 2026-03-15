# E11-S03: Study Session Quality Scoring — Implementation Plan

## Context

LevelUp learners complete study sessions but have no feedback on *how effectively* they studied. This story adds a quality score (0-100) calculated from 4 weighted engagement factors, displayed after each session with a breakdown, and tracked over time with trend indicators in session history.

**Dependencies (all done):** Story 4.3 (session tracking), 11.1 (spaced review), 11.2 (retention dashboard)

**Key gap:** Current `StudySession` type lacks `interactionCount` and `breakCount` fields. Must extend both the type and DB schema.

---

## Plan

### Task 1: Types & Scoring Engine (pure logic, no UI)

**Files:**
- `src/data/types.ts` — extend `StudySession` with new fields, add `QualityScore` interface
- `src/lib/qualityScore.ts` — NEW: pure scoring functions
- `src/lib/__tests__/qualityScore.test.ts` — NEW: unit tests

**Changes to `StudySession` interface** (add optional fields for backward compat):
```typescript
// Add to existing StudySession interface:
interactionCount?: number    // Meaningful learning actions (seek, note, bookmark, navigate)
breakCount?: number          // Number of pause→resume cycles
qualityScore?: number        // 0-100 composite score (calculated on session end)
qualityFactors?: QualityFactors  // Individual factor scores
```

**New types:**
```typescript
export interface QualityFactors {
  activeTimeScore: number      // 0-100, weight 40%
  interactionDensityScore: number  // 0-100, weight 30%
  sessionLengthScore: number   // 0-100, weight 15%
  breaksScore: number          // 0-100, weight 15%
}

export type QualityTier = 'excellent' | 'good' | 'fair' | 'needs-improvement'
export type QualityTrend = 'improving' | 'stable' | 'declining'
```

**Scoring formula** (in `qualityScore.ts`):
- `calculateQualityScore(session: StudySession): { score: number; factors: QualityFactors; tier: QualityTier }`
- Follow `momentum.ts` pattern: pure function, no DB calls, 0-100 normalized
- `activeTimeScore`: `(duration / (duration + idleTime)) * 100` — ratio of active vs total time
- `interactionDensityScore`: `min(100, (interactionCount / activeMinutes) * 20)` — ~5 interactions/min = 100
- `sessionLengthScore`: bell curve peaking at 30-60min (short sessions and very long sessions score lower)
- `breaksScore`: 1-2 breaks for 30+ min session = optimal (100), 0 breaks or many breaks = lower
- `getQualityTier(score)`: ≥85 excellent, ≥70 good, ≥50 fair, <50 needs-improvement
- `calculateQualityTrend(recentScores: number[]): QualityTrend` — compare avg of last 5 vs previous 5

**Unit tests:** Edge cases for zero duration, no interactions, very long session, all-idle session, single break, many breaks. Follow `momentum.test.ts` pattern with local helper builders.

**Commit:** `feat(E11-S03): add quality score types and calculation engine`

---

### Task 2: Database Migration & Session Store Enhancement

**Files:**
- `src/db/schema.ts` — v14 migration (add quality score fields to studySessions)
- `src/stores/useSessionStore.ts` — add interaction tracking + score calculation on session end
- `src/stores/__tests__/useSessionStore.test.ts` — update tests

**DB Migration (v14):**
- No new indexes needed (quality score isn't queried by index)
- Upgrade handler: set `qualityScore: undefined` for existing sessions (no retroactive calculation — old sessions show "—")

**Session Store Changes:**
1. Add `recordInteraction()` action — increments `activeSession.interactionCount`
   - Called from: video seek, play/pause, note create/edit, bookmark create, lesson navigation, PDF page change
2. Add `recordBreak()` action — increments `activeSession.breakCount` when pause→resume detected
3. Modify `endSession()` — call `calculateQualityScore()` before persisting, store result in session
4. Modify `pauseSession()` — increment break counter
5. Dispatch `session-quality-calculated` custom event after score is saved (for UI to react)

**Interaction recording hook points** (call `recordInteraction()` from):
- `useSessionStore.updateLastActivity()` — NO, too noisy (every mouse move)
- Instead, add explicit calls in existing handlers:
  - Video player: seek, play/pause → already have event handlers in LessonPlayer
  - Notes: create/edit → already have save handlers
  - Navigation: lesson change → already has route change detection
  - Bookmarks: create → already has handler
  - PDF: page change → already has handler

**Commit:** `feat(E11-S03): add DB v14 migration and session tracking enhancements`

---

### Task 3: Quality Score Dialog (post-session UI)

**Files:**
- `src/app/components/session/QualityScoreDialog.tsx` — NEW: post-session score overlay
- `src/app/components/session/QualityScoreRing.tsx` — NEW: animated SVG score ring
- `src/app/components/session/FactorBreakdown.tsx` — NEW: 4-factor bar breakdown

**QualityScoreDialog:**
- Uses shadcn `Dialog` on desktop (≥640px), `Sheet` (bottom drawer) on mobile (<640px)
- Props: `open`, `onOpenChange`, `score`, `factors`, `tier`
- Layout: Score ring (large, centered) → tier label → 4 factor bars → "Continue" button
- Follow `CreateChallengeDialog` pattern for Dialog usage
- Animation: Score ring animates 0→value (0.8s), factor bars stagger with `fadeUp` from `motion.ts`

**QualityScoreRing:**
- SVG circle with `stroke-dasharray` animation
- Track: `var(--muted)`, fill: `var(--brand)`
- Score number: `font-heading text-4xl font-bold` centered
- Tier label below: color-coded (success/warning/destructive based on tier)
- `role="progressbar"` with full ARIA attributes

**FactorBreakdown:**
- 4 horizontal bars with labels, weights, and individual scores
- Colors: `--chart-1` through `--chart-4` for visual distinction
- Each bar: `role="meter"` with `aria-valuenow`, `aria-label`

**Trigger mechanism:**
- Listen for `session-quality-calculated` event in the Layout component or LessonPlayer page
- Show dialog automatically when score is calculated
- Store dialog state in component (not global) — dismiss on "Continue"

**Commit:** `feat(E11-S03): add quality score dialog with animated breakdown`

---

### Task 4: Session History Enhancement

**Files:**
- `src/app/pages/SessionHistory.tsx` — add quality score badge + trend indicator
- `src/app/components/session/TrendIndicator.tsx` — NEW: trend arrow component

**SessionHistory changes:**
- Extend `DisplaySession` interface with `qualityScore?`, `qualityFactors?`
- In collapsed row header: add quality badge after duration
  - Badge: `rounded-full px-2.5 py-0.5 text-xs font-medium`
  - Color: `bg-success-soft text-success` (≥70), `bg-gold-muted text-warning` (40-69), `bg-destructive/10 text-destructive` (<40)
  - No score: `text-muted-foreground` with "—"
- Add trend indicator at top of session list (above first row)

**TrendIndicator:**
- Props: `trend: QualityTrend`
- Uses lucide icons: `TrendingUp` (improving/success), `Minus` (stable/muted), `TrendingDown` (declining/warning)
- `aria-label="Session quality trend: {trend}"`

**Trend calculation:**
- Load last 10 sessions with quality scores
- Compare avg of sessions 1-5 vs 6-10
- >5pt increase = improving, >5pt decrease = declining, else stable

**Commit:** `feat(E11-S03): add quality scores and trend to session history`

---

### Task 5: Wire Up Interaction Recording

**Files:** (modify existing files — no new files)
- `src/app/pages/LessonPlayer.tsx` — add `recordInteraction()` calls
- `src/app/components/figma/NoteEditor.tsx` (or equivalent note component) — add call on save
- Any bookmark creation handler — add call

**Pattern:** Import `useSessionStore` and call `recordInteraction()` in existing event handlers. Minimal changes — just adding one line per handler.

**Commit:** `feat(E11-S03): wire interaction recording to learning events`

---

### Task 6: E2E Tests & Polish

**Files:**
- `tests/e2e/story-e11-s03.spec.ts` — fill in TODO placeholders with real seeding/assertions
- `tests/support/fixtures/factories/session-factory.ts` — extend with quality score fields
- `tests/support/helpers/study-session-test-helpers.ts` — add quality score helpers if needed

**Test approach:**
- Seed completed sessions with known metrics via IndexedDB
- Navigate to session history → verify score badges and trend
- Seed active session → verify score NOT shown during session
- End session → verify dialog appears with breakdown

**Commit:** `test(E11-S03): implement E2E tests for quality scoring`

---

## Verification

1. **Unit tests:** `npm run test:unit -- --grep qualityScore` — scoring formula edge cases
2. **Build:** `npm run build` — no TypeScript errors
3. **Lint:** `npm run lint` — no design token violations
4. **E2E:** `npx playwright test tests/e2e/story-e11-s03.spec.ts --project chromium`
5. **Manual:** Start a study session → interact with video/notes → end session → verify dialog shows score with breakdown → check session history for badge and trend
