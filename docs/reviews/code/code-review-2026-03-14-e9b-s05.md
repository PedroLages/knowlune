# Code Review: E9B-S05 — AI Note Organization and Cross-Course Links

**Date**: 2026-03-14
**Reviewer**: Claude Code (code-review agent)

## Blocker

- **`OrganizePreviewDialog.tsx:41-43`** (confidence: 95): `useMemo` used as side-effect hook. `setAccepted()` inside `useMemo` fires unpredictably in React Strict Mode. Fix: replace with `useEffect` or key-based reset.

## High Priority

- **`noteOrganizer.ts:154-156`** (confidence: 92): API key sent in request body as plaintext JSON. Existing pattern from `generateLearningPath` — flag as tech debt, not new to this story.
- **`OrganizePreviewDialog.tsx:68-100`** (confidence: 88): `applyChanges()` shows success toast even when some/all saves fail silently. Track failures and differentiate toast message.
- **`RelatedConceptsPanel.tsx:50`** (confidence: 90): `useEffect` dependency `note.tags.join(',')` creates new string each render, causing unnecessary re-fetches. Memoize the tag key.
- **`OrganizePreviewDialog.tsx:87`** (confidence: 85): `new Date().toISOString()` in production code. Existing pattern — flag but don't block.

## Medium

- **`OrganizeNotesButton.tsx:70`** (confidence: 78): Dead empty `<span>` on mobile. Remove.
- **`relatedConcepts.ts:152-168`** (confidence: 75): Linear scan in `findVectorMatches`. Pre-build Map for O(1) lookups.
- **`relatedConcepts.ts:135`** (confidence: 72): `extractKeyTerms` called for every candidate. Consider memoizing.
- **`OrganizePreviewDialog.tsx:99`** (confidence: 82): Toast says "Applied changes to 0 notes" when no changes needed. Differentiate message.

## Nits

- `OrganizePreviewDialog.tsx:2`: Touch target for Select/Deselect All buttons under 44px.
- `noteOrganizer.ts:15`: Side-effect import for type augmentation — consider `/// <reference>`.
- `RelatedConceptsPanel.tsx:50`: `allNotes.length` in deps re-fires on any note add/delete.
