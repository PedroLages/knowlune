# Adversarial Review — Epic 109: Knowledge Pipeline (Highlights, Vocabulary, Export)

**Date:** 2026-04-11  
**Reviewer:** Adversarial Review Agent (cynical, skeptical)  
**Stories Reviewed:** E109-S01 (Vocabulary Builder), E109-S02 (Daily Highlight Review), E109-S03 (Highlight Export), E109-S04 (Annotation Summary), E109-S05 (Cross-book Search)  
**Verdict:** 17 findings across scope, architecture, UX, testing, and technical debt

---

## Findings

### 1. "Spaced Repetition" Is Marketing, Not Implementation

**Severity: HIGH | Stories: E109-S02**

The story is marketed as "spaced repetition," which implies an SM-2 or similar scheduling algorithm that computes review intervals based on prior performance. What was actually built is priority-sorted queue selection: unreviewed items first, then least-recently-reviewed items, capped at 20, with "keep" and "dismiss" as the only feedback signals. There are no intervals, no ease factors, no next-review dates, and no scheduling logic. The `lastReviewedAt` field is recorded, but it is only used for sort order — not for computing when a highlight should next surface. A user who marks every highlight "keep" will see the same 20 highlights in every session until they accumulate more than 80 candidates. This is a queue, not spaced repetition. The AC, story name, and code comments all misrepresent the feature. Either rename it accurately ("daily review queue") or implement real scheduling.

---

### 2. Vocabulary Flashcard Review Has No Spaced Repetition Either

**Severity: HIGH | Stories: E109-S01**

`getReviewableItems()` returns `items.filter(i => i.masteryLevel < 3)`. That is every non-mastered word, every single session. There is no scheduling, no `lastReviewedAt` filter, no interval multiplier. A learner with 200 vocabulary items at mastery level 1 will be served all 200 every time they open review mode. The flashcard feature is described using mastery progression metaphors ("New → Learning → Familiar → Mastered") that imply progressive difficulty reduction, but there is no mechanism preventing the same word from appearing in consecutive sessions once it reaches "Familiar." The `lastReviewedAt` field exists on the `VocabularyItem` type but is not queried in `getReviewableItems()`.

---

### 3. Cross-Book Search Loads the Entire Database Into RAM on Every Page Visit

**Severity: HIGH | Stories: E109-S05**

`SearchAnnotations.tsx` runs `db.bookHighlights.limit(500).toArray()` and `db.vocabularyItems.limit(500).toArray()` on every mount — before the user has typed a single character. This eager load of up to 1,000 records exists so that subsequent filtering can run in-memory via `useMemo`. The NFR assessment already flagged this, but the limit of 500 is arbitrary and not justified by any documented threshold. A user with 501 highlights will silently miss results. More critically, the `useMemo` filter runs synchronously on every keystroke state change; there is no `useDeferredValue` or debounce on the filter memo itself (only on the URL sync). On low-end devices with many items, this will cause main-thread jank on every character typed.

---

### 4. HighlightExportDialog Uses `modal={false}` — an Accessibility Regression

**Severity: HIGH | Stories: E109-S03**

`HighlightExportDialog.tsx` passes `modal={false}` to the shadcn `<Dialog>`. Non-modal dialogs do not trap focus, which means keyboard users can tab out of the dialog into background content while it is open. For an export action — where the user is making a format selection and confirming a destructive-ish data operation — this is an accessibility defect. The WCAG 2.1 SC 1.3.1 pattern for dialogs requires focus containment. There is no documented rationale for `modal={false}` in the codebase. If the intent was to allow interaction with background content (e.g., scrolling the highlight list), that use case is not evident from the UX. This should be `modal={true}` (the default) unless there is an explicit design decision to the contrary.

---

### 5. Vocabulary Context Field Is Populated at Add-Time but Never Shown in Search Results

**Severity: MEDIUM | Stories: E109-S01, E109-S05**

When a word is added to vocabulary via "Add to Vocabulary" in the reader, the `context` field captures the surrounding sentence or passage. This context is displayed in the `ReviewCard` (flashcard mode) to help the learner recall where they encountered the word. However, `SearchAnnotations.tsx` does not search the `context` field when matching vocabulary items — it only searches `word`, `definition`, and `note`. A user searching for a word they remember by context ("the passage about entropy") will get no match even if the context string contains the search term. The search field coverage is inconsistent with the data model.

---

### 6. E109-S03 Has No Dedicated Story File — It Was Built Implicitly

**Severity: MEDIUM | Stories: E109-S03**

There is no `docs/implementation-artifacts/stories/E109-S03.md` file. The `epic-107-109-tracking-2026-04-08.md` tracker lists E109-S03 as "Highlight Export," and the implementation clearly exists (`HighlightExportDialog.tsx`, `highlightExport.ts`, `story-e109-s03.spec.ts`), but the canonical story artifact is absent. The code-review records for E109-S03 are also missing from `docs/reviews/code/`. This means the story has no documented AC, no pre-review checklist, no lessons learned, and no traceability from requirements to tests. If a future regression is introduced, there is nothing to diff against.

---

### 7. Annotation Summary Navigation Breaks the Back Button Contract

**Severity: MEDIUM | Stories: E109-S04**

`AnnotationSummary.tsx` uses `navigate('/library')` for its back button (`handleBack`), hardcoding the destination rather than using `navigate(-1)`. This breaks expected browser/app navigation when the annotation summary is reached from a context other than the library page (e.g., from a cross-book search result or a deep link). The `SearchAnnotations.tsx` component links to `/library/${bookId}/annotations`, meaning a user who clicks through from search will find the back button takes them to the library root rather than back to search. This is a UX contract violation: the back affordance should undo the navigation that brought the user here, not reset them to a fixed location.

---

### 8. The `loadDailyHighlights` Limit of 80 Is Undocumented and Scientifically Arbitrary

**Severity: MEDIUM | Stories: E109-S02**

`HighlightReview.tsx` caps the candidate pool at `.limit(80)` before sorting and slicing to 20 for review. The comment says "Cap at 80 records for safety," but there is no documented reasoning for 80. A user with 200 highlights, where highlights 81–200 are older and more urgently due for review, will never see those items because the Dexie `.toCollection()` returns rows in insertion order (not by `lastReviewedAt`), meaning the limit cuts off older highlights systematically. The sort happens after the limit, so the selection is biased toward recently-added highlights rather than most-due-for-review highlights. This inverts the intended priority: the user sees their newest highlights, not their oldest-unreviewed ones.

---

### 9. Obsidian Export Duplicates `groupByBook` Logic Inline Instead of Using the Shared Helper

**Severity: MEDIUM | Stories: E109-S03**

`highlightExport.ts` defines a shared `groupByBook()` helper function at line 59, but `exportHighlightsAsObsidian()` re-implements the same group-by logic inline using a `Map` loop (lines 132–138) instead of calling the helper. This duplication means that if the grouping logic ever needs to change (e.g., to handle deleted books differently), it must be updated in two places. The NFR assessment flagged this but it remains in the shipped code. It is a minor consistency defect that signals the export module was assembled incrementally without a final coherence pass.

---

### 10. Vocabulary Page Filter Silently Applies to Deleted Books

**Severity: MEDIUM | Stories: E109-S01**

The vocabulary page populates the "Filter by book" dropdown using `[...new Set(items.map(i => i.bookId))]`, resolved to titles via `bookTitleMap`. If a book is deleted from the library while vocabulary items sourced from it remain (Dexie does not enforce foreign-key constraints), those items will appear in the list under "Unknown book" and the filter dropdown will also contain an "Unknown book" entry. However, `bookTitleMap` is built from `useBookStore(s => s.books)`, which reflects the current library state. There is no warning, no orphan cleanup, and no documentation of this behavior. A user who deletes a book and then opens vocabulary is likely confused by "Unknown book" entries with no path to the source context.

---

### 11. Cross-Book Search Result Links Point to `/library/:bookId/read` — Not to the Annotation

**Severity: MEDIUM | Stories: E109-S05**

Each search result for highlights and vocabulary items includes a `<Link>` to `/library/${r.item.bookId}/read` (the reader). But the reader opens at the beginning of the book, not at the CFI range of the highlight. There is no `?cfi=...` param, no scroll-to-highlight behavior, and no deep-link mechanism that would position the reader at the annotation in question. The AC states "each result links to the source book's annotation/reader view" — what was built links to the reader view with no annotation targeting. For vocabulary items the situation is even worse: the link goes to the reader rather than to the annotation summary, which is the more useful destination since vocabulary items don't have CFI positions.

---

### 12. Testing Deferred for All Data-Dependent Vocabulary Flows

**Severity: MEDIUM | Stories: E109-S01**

E109-S01's Testing Notes explicitly state: "Data-dependent flows (review, edit, delete, mastery) deferred to follow-up stories." The flashcard review mode, inline editing, delete-with-undo, and mastery advancement — the four core interactive behaviors of the vocabulary feature — have zero E2E test coverage at the time the story was marked `done` and `reviewed: true`. This is not a gap discovered by adversarial review; it is documented self-deferral. The follow-up story referenced does not appear in the E109 epic, and no known issue ticket tracks this debt. If coverage is not written before the next refactor of the vocabulary store, these flows will be tested only by clicking through the UI manually.

---

### 13. `HighlightExportDialog` Has No Story-Level Tests for Actual File Content

**Severity: MEDIUM | Stories: E109-S03**

The E2E test for export (`story-e109-s03.spec.ts`) tests that a download event fires and that the suggested filename is correct. It does not verify the content of the downloaded file. A regression that produces an empty JSON file, malformed CSV, or a Markdown file missing the author line would pass all current tests. The unit test suite (`src/lib/__tests__/highlightExport.test.ts`) presumably covers the format functions, but the integration between the dialog's format selection, the export function dispatch, and the actual file content is untested end-to-end.

---

### 14. Daily Highlight Review Error on Load Is Visually Indistinguishable from Empty State

**Severity: MEDIUM | Stories: E109-S02**

When `loadDailyHighlights()` throws, the catch handler in `HighlightReview.tsx` logs the error and sets `isLoading(false)` — which causes the component to render the empty state: "No highlights yet. Highlight passages while reading." A user who hits a Dexie error (e.g., storage quota exceeded, corrupted IDB) sees a friendly message implying they have no highlights, rather than an error message. This is a silent failure. The NFR assessment identified this as HIGH priority, yet the story was marked `done` with this known defect unresolved.

---

### 15. Color Filter Badges Use `aria-pressed` on `<Badge>` Divs — Wrong Element

**Severity: LOW | Stories: E109-S04**

`AnnotationSummary.tsx` applies `aria-pressed={colorFilter === color}` to `<Badge>` components (rendered as `<div>` elements by shadcn/ui). `aria-pressed` is valid only on elements with `role="button"` or native `<button>` elements. A `<div>` with `aria-pressed` and an `onClick` handler is not keyboard accessible and will not be announced correctly by screen readers. These color filter badges should use `<button>` elements or have an explicit `role="button"` added alongside the `aria-pressed` attribute.

---

### 16. `SearchAnnotations` Does Not Search Vocabulary `context` or Highlight `chapterHref`

**Severity: LOW | Stories: E109-S05**

In addition to the context field gap noted in finding #5, the search function also ignores the `chapterHref` of highlights. A user looking for highlights from a specific chapter (e.g., "chapter 3") cannot find them by chapter name. The search is limited to the text content of the highlight itself and its note. Given that the page is branded as "search annotations," users will reasonably expect to be able to find content by chapter, author, or other metadata — none of which is searched.

---

### 17. No Sidebar Entry for Daily Highlight Review or Cross-Book Search

**Severity: LOW | Stories: E109-S02, E109-S05**

`navigation.ts` contains an entry for Vocabulary (`/vocabulary`) added in E109-S01. The Daily Highlight Review (`/highlight-review`) and Cross-Book Search (`/search-annotations`) routes are reachable only via direct URL navigation or internal links — they have no sidebar entries. This creates an inconsistent information architecture: one of three new Knowledge Pipeline features is discoverable via sidebar navigation; two are not. Users who close a tab or clear history lose their entry points. The IA implies these are less important than Vocabulary, which was not a stated product decision.

---

## Summary

| # | Finding | Severity | Story |
|---|---------|----------|-------|
| 1 | "Spaced repetition" is a mislabeled queue with no scheduling | HIGH | S02 |
| 2 | Vocabulary review has no scheduling either — serves all non-mastered items | HIGH | S01 |
| 3 | Cross-book search loads entire DB into RAM, unbounded, pre-query | HIGH | S05 |
| 4 | `modal={false}` in export dialog breaks focus trapping (a11y regression) | HIGH | S03 |
| 5 | `context` field not searched in vocabulary search results | MEDIUM | S01, S05 |
| 6 | No story file, no AC, no lessons learned for E109-S03 | MEDIUM | S03 |
| 7 | Annotation summary back button hardcodes `/library` instead of `navigate(-1)` | MEDIUM | S04 |
| 8 | `loadDailyHighlights` limit-80 cap silently biases selection toward recent items | MEDIUM | S02 |
| 9 | Obsidian export duplicates `groupByBook` helper inline | MEDIUM | S03 |
| 10 | Deleted-book vocabulary items appear as "Unknown book" with no warning | MEDIUM | S01 |
| 11 | Search result links open reader at start, not at the annotation | MEDIUM | S05 |
| 12 | All data-dependent vocabulary flows explicitly deferred from test coverage | MEDIUM | S01 |
| 13 | Export E2E tests verify filename, not file content | MEDIUM | S03 |
| 14 | Load failure in HighlightReview is indistinguishable from empty state | MEDIUM | S02 |
| 15 | Color filter badges use `aria-pressed` on non-button elements | LOW | S04 |
| 16 | Search ignores `context`, `chapterHref`, and other metadata fields | LOW | S05 |
| 17 | Daily Review and Cross-Book Search have no sidebar navigation entries | LOW | S02, S05 |

**Total Findings: 17**  
**Critical (HIGH): 4**  
**Significant (MEDIUM): 10**  
**Minor (LOW): 3**
