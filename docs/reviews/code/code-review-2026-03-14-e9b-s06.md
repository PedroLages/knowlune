# Code Review — E9B-S06: AI Feature Analytics & Auto-Analysis (Round 2)

**Review Date**: 2026-03-14
**Reviewer**: Code Review Agent (Architecture)

## Summary

All 6 round-1 fixes verified and correct. The `.catch(() => {})` additions, `cn()` migration, `'auto_analysis'` featureType, module-level `CHART_CONFIG`, and `parseTagsFromResponse` logging are properly applied.

## Findings

### HIGH (confidence ≥ 90)

1. **Gemini API auth bug** (autoAnalysis.ts:144-162, confidence: 92)
   - Sends `Authorization: Bearer` header, but Gemini requires `?key=API_KEY` as query param
   - Other files handle this correctly (aiSummary.ts:340, thumbnailService.ts:152)
   - Fix: Add Gemini-specific handling matching aiSummary.ts pattern

2. **Retry button is no-op** (AIAnalyticsTab.tsx:188, confidence: 95)
   - `setPeriod(p => p)` returns identical value — React skips re-render
   - Fix: Add `retryCount` state or extract `loadData()` and call directly

### MEDIUM (confidence 70-89)

3. **Hard wait in AC3 test** (story-e09b-s06.spec.ts:194, confidence: 80)
   - `setTimeout(r, 500)` without justification comment
   - Fix: Add comment or remove (consent check is synchronous)

4. **Provider helper duplication** (autoAnalysis.ts:136-163, confidence: 72)
   - Three files maintain independent provider switch statements
   - Fix: Extract shared `aiProviderClient.ts` (not blocking)

### NITS

5. Schema version mismatch in docs (9b-6 story file:155, confidence: 60)
   - References "Dexie schema v13" but actual is v12
