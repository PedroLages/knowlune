## External Code Review: E109-S02 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-11
**Story**: E109-S02

### Findings

#### Blockers
- **[src/app/components/highlights/HighlightReviewCard.tsx:68 (confidence: 95)]**: `highlight.text` was renamed to `highlight.textAnchor` — this changes which field is displayed as the quoted text. `textAnchor` is likely an anchor/CFI reference (e.g., `/4/2/2[ch0]` per the test seed data), not the human-readable highlight passage. This will display raw locator strings instead of the actual highlighted quote text to users. Fix: Revert the display back to `highlight.text` (or whatever field holds the actual highlight content), and leave `textAnchor` for navigation/positioning purposes only.

- **[src/app/pages/HighlightReview.tsx:255 (confidence: 95)]**: Same `text` → `textAnchor` rename in the ClozeFlashcardModal props. Passing a locator string as `text` to the flashcard creator will create flashcards with garbled content like `/4/2/2[ch0]` instead of the actual highlighted passage. Fix: Revert to `clozeHighlight.text`.

#### High Priority
- **[src/app/pages/HighlightReview.tsx:68 (confidence: 80)]**: `lastReviewedAt` string comparison uses `localeCompare` for ISO 8601 dates, which breaks on timezone-offset-containing timestamps (e.g., `2025-01-15T10:00:00+05:00` vs `2025-01-15T08:00:00Z`). `localeCompare` compares lexicographically, so `+05:00` sorts after `Z`, producing wrong ordering. Fix: Compare with `<` / `>` operators on the raw strings (correct for ISO 8601 when all are UTC `Z`-terminated) or parse to `Date` objects:
  ```ts
  return new Date(a.lastReviewedAt!).getTime() - new Date(b.lastReviewedAt!).getTime()
  ```

#### Medium
- **[src/app/pages/HighlightReview.tsx:91-106 (confidence: 70)]**: `handleRate` updates `ratings` state optimistically but on persistence failure, the UI shows the wrong rating. Although annotated `silent-catch-ok`, the user sees "Dismiss" pressed but the data wasn't saved — next session the highlight reappears as unrated, causing confusion. Fix: Roll back the local `ratings` state on error:
  ```ts
  catch (err) {
    console.error('[HighlightReview] Failed to persist rating:', err)
    setRatings(prev => {
      const next = { ...prev }
      delete next[highlightId]
      return next
    })
  }
  ```

- **[src/app/pages/HighlightReview.tsx:43-58 (confidence: 60)]**: `loadDailyHighlights` loads **all** non-dismissed highlights into memory (`db.bookHighlights.toArray()`) then filters/sorts in JS. This will degrade as the highlight count grows into the thousands. Fix: Use Dexie's `where('lastReviewedAt')` index with `.sortBy()` or `.limit()` to push filtering/sorting to IndexedDB, or at minimum use `.filter()` on a cursor instead of loading everything.

#### Nits
- **[src/app/pages/HighlightReview.tsx:213 (confidence: 40)]**: `currentRating={ratings[currentHighlight.id] ?? currentHighlight.reviewRating}` — when the user rates "dismiss" and then navigates back to the same card, the optimistic `ratings` map returns `'dismiss'`, but the card is still shown (dismissed highlights are supposed to be excluded from review). The `loadDailyHighlights` filter only runs on mount, so already-visible cards remain even after being dismissed. This is a minor UX inconsistency rather than a bug.

---
Issues found: 6 | Blockers: 2 | High: 1 | Medium: 2 | Nits: 1
