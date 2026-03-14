# E9B-S06: AI Feature Analytics & Auto-Analysis

## Context

LevelUp's Epic 9B AI features (video summaries, Q&A, learning paths, note organization) are all implemented but have no usage tracking or analytics. Users can't see how they've used AI features over time, and new courses require manual triggering of each AI feature. This story adds:
1. **AI usage event tracking** — records when AI features are used
2. **AI Analytics dashboard** — new tab in Reports showing usage stats with trend indicators
3. **Auto-analysis on import** — automatically runs AI analysis when courses are imported

**Key constraint**: E9B-S04 (Knowledge Gap Detection) is still `backlog` — show as disabled/"Coming soon" in the analytics dashboard.

## Task 1: Dexie Schema v12 + AIUsageEvent Type

**Files to create/modify:**
- `src/data/types.ts` — Add `AIUsageEvent` type
- `src/db/schema.ts` — Add v12 migration with `aiUsageEvents` table

```typescript
// New type in types.ts
export type AIFeatureType = 'summary' | 'qa' | 'learning_path' | 'note_organization' | 'knowledge_gaps'

export interface AIUsageEvent {
  id: string                    // UUID
  featureType: AIFeatureType
  courseId?: string              // Optional — not all features are course-scoped
  timestamp: string             // ISO 8601
  durationMs?: number           // How long the AI operation took
  status: 'success' | 'error'
  metadata?: Record<string, unknown>  // Feature-specific data (e.g., noteCount, questionLength)
}
```

```typescript
// In schema.ts — new v12
db.version(12).stores({
  // ... all existing stores unchanged ...
  aiUsageEvents: 'id, featureType, timestamp, courseId',
})
```

**Commit after this task.**

## Task 2: AI Event Tracking Service

**Files to create:**
- `src/lib/aiEventTracking.ts` — Event recording + aggregation queries

**Key functions:**
- `trackAIUsage(featureType, metadata?)` — Records an event to Dexie (checks `isFeatureEnabled('analytics')` + `isAIAvailable()`)
- `getAIUsageStats(period: 'daily' | 'weekly' | 'monthly')` — Aggregates events by feature type for the selected period
- `getAIUsageTrend(featureType, period)` — Compares current vs previous period, returns `'up' | 'down' | 'stable'`

**Reuse existing:**
- `isFeatureEnabled('analytics')` from `src/lib/aiConfiguration.ts:276`
- `isAIAvailable()` from `src/lib/aiConfiguration.ts:286`

**Consent check**: If `analytics` consent is disabled, `trackAIUsage` is a no-op (doesn't store events).

**Commit after this task.**

## Task 3: Instrument Existing AI Features

Add `trackAIUsage()` calls to each AI feature's completion point:

| Feature | File | Hook Point |
|---------|------|------------|
| Video Summary | `src/lib/aiSummary.ts` | After streaming completes successfully |
| Q&A from Notes | `src/lib/noteQA.ts` or QAChatPanel | After `generateQAAnswer()` completes |
| Learning Path | `src/stores/useLearningPathStore.ts` | After `db.learningPath.bulkAdd()` (~line 77) |
| Note Organization | `src/app/components/notes/OrganizeNotesButton.tsx` | After `organizeNotes()` returns (~line 29) |

Each call:
```typescript
await trackAIUsage('summary', { courseId, durationMs: Date.now() - startTime })
```

Also track errors — wrap existing error handlers to call `trackAIUsage(type, { status: 'error', error: message })`.

**Commit after this task.**

## Task 4: AI Analytics Dashboard UI

**Files to create:**
- `src/app/components/reports/AIAnalyticsTab.tsx` — Main analytics tab component

**File to modify:**
- `src/app/pages/Reports.tsx` — Add "AI Analytics" tab using existing Tabs component

**Component structure:**
```
AIAnalyticsTab
├── Period toggle (daily/weekly/monthly) — Button group with role="group"
├── Stat cards grid (5 cards, one per AI feature)
│   ├── Each card: icon + feature name + count + trend indicator
│   └── Knowledge gaps card: disabled/"Coming soon" state
└── Usage trend AreaChart — Shows all features over time
```

**Design patterns to follow:**
- Stat cards: Follow `StatsCard.tsx` pattern with NumberFlow for animated counts
- Period toggle: Follow `StudyTimeAnalytics.tsx` button group pattern
- Chart: `ChartContainer` + Recharts `AreaChart` with `var(--chart-1)` through `var(--chart-5)`
- Cards: `rounded-[24px] border bg-card p-6`
- Trends: `text-success` (up) / `text-destructive` (down) / `text-muted-foreground` (stable)
- Empty state: "No AI usage data yet" centered message
- Loading: Skeleton with `aria-busy="true"`

**Accessibility:**
- `aria-live="polite"` on stat values
- `role="group" aria-label="Time period selection"` on toggle
- Chart: `role="img" aria-label="AI feature usage over time"`
- Smooth transition: Use `min-h-[value]` to prevent layout shift when switching periods

**Responsive grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4`

**Commit after this task.**

## Task 5: Auto-Analysis on Course Import

**Files to modify:**
- `src/lib/courseImport.ts` — Add auto-analysis trigger after successful import (~line 191)

**Files to create:**
- `src/lib/autoAnalysis.ts` — Orchestrates background AI analysis on imported courses

**Flow:**
1. After `importCourseFromFolder()` completes (after Zustand store update, line 191)
2. Check `isFeatureEnabled('analytics')` AND `isAIAvailable()`
3. If enabled: call `triggerAutoAnalysis(course)` (non-blocking, fire-and-forget with error handling)
4. `triggerAutoAnalysis`:
   - Updates course card with "Analyzing..." status via a new `autoAnalysisStatus` field on `useCourseImportStore`
   - Runs summary generation + topic tag extraction in background
   - On success: updates course tags in Dexie, shows Sonner toast with Sparkles icon, dispatches notification
   - On failure: shows status message with "Retry" action in toast, preserves course without AI enrichment
   - Timeout: AbortController with 30s timeout (reuse existing pattern from architecture)

**Store changes:**
- `src/stores/useCourseImportStore.ts` — Add `autoAnalysisStatus: Record<string, 'analyzing' | 'complete' | 'error' | null>`

**Course card UI:**
- Add progress indicator (shimmer/spinner) when `autoAnalysisStatus[courseId] === 'analyzing'`
- Show "AI analyzed" badge when complete
- Show "Analysis failed - Retry" when error

**Commit after this task.**

## Task 6: Consent Toggle + Error Fallback

**Files to modify:**
- `src/lib/autoAnalysis.ts` — Ensure consent check gates all auto-analysis
- `src/app/components/reports/AIAnalyticsTab.tsx` — Show "AI not configured" banner if `!isAIAvailable()`

**Error handling (AC5):**
- Auto-analysis catches errors within 2 seconds (AbortController timeout + try/catch)
- On failure: `toast.error('Auto-analysis could not complete', { action: { label: 'Retry', onClick: ... } })`
- Course import is NEVER blocked by auto-analysis failure (fire-and-forget pattern)

**Consent (AC6):**
- `triggerAutoAnalysis()` checks `isFeatureEnabled('analytics')` before proceeding
- If disabled: no-op, course imports normally, no data sent to AI provider

**Commit after this task.**

## Task 7: Flesh Out ATDD E2E Tests

**File to modify:**
- `tests/e2e/story-e09b-s06.spec.ts` — Replace `test.fail()` stubs with real test logic

**Test patterns:**
- Seed AI configuration with `seedAIConfiguration()` helper
- Seed `aiUsageEvents` in IndexedDB for analytics display tests
- Mock LLM responses with `mockLLMClient()` for auto-analysis tests
- Use `[data-sonner-toast]` selector for notification assertions
- Use `page.route()` to mock/block AI provider for failure tests

**Commit after this task.**

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/data/types.ts` | Modify | Add `AIUsageEvent`, `AIFeatureType` types |
| `src/db/schema.ts` | Modify | Add v12 with `aiUsageEvents` table |
| `src/lib/aiEventTracking.ts` | Create | Event tracking service + aggregation |
| `src/lib/autoAnalysis.ts` | Create | Auto-analysis orchestrator |
| `src/app/components/reports/AIAnalyticsTab.tsx` | Create | AI Analytics dashboard tab |
| `src/app/pages/Reports.tsx` | Modify | Add AI Analytics tab |
| `src/lib/courseImport.ts` | Modify | Hook auto-analysis after import |
| `src/stores/useCourseImportStore.ts` | Modify | Add `autoAnalysisStatus` field |
| `src/lib/aiSummary.ts` | Modify | Add usage tracking call |
| `src/lib/noteQA.ts` | Modify | Add usage tracking call |
| `src/stores/useLearningPathStore.ts` | Modify | Add usage tracking call |
| `src/app/components/notes/OrganizeNotesButton.tsx` | Modify | Add usage tracking call |
| `tests/e2e/story-e09b-s06.spec.ts` | Modify | Flesh out ATDD tests |

## Verification

1. `npm run build` — Verify clean build with no type errors
2. `npm run lint` — No ESLint violations (especially design token rule)
3. `npx tsc --noEmit` — Type check passes
4. `npx playwright test tests/e2e/story-e09b-s06.spec.ts --project=chromium` — ATDD tests pass
5. Manual: Navigate to Reports → AI Analytics tab, verify stat cards render
6. Manual: Import a course, verify auto-analysis triggers and progress shows on card
7. Manual: Toggle off analytics consent in Settings, verify no events tracked
