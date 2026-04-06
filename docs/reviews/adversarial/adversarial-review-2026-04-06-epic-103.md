# Adversarial Review — Epic 103: Whispersync — EPUB-Audiobook Format Switching

**Date:** 2026-04-06  
**Reviewer:** Adversarial Review Agent  
**Stories:** E103-S01 (Chapter Title Matching Engine), E103-S02 (Format Switching UI), E103-S03 (Dual Position Tracking)  
**Verdict:** 13 issues found. No blockers, but several HIGH-severity logic gaps that will silently misdirect users to wrong chapters.

---

## Findings

1. **[HIGH] `normalizeChapterTitle` does not strip the word "Chapter" — contradicts documented behavior.** The Dev Notes in E103-S01 assert that `normalizeChapterTitle("Chapter 1: The Journey Begins")` produces `"the journey begins"`. It does not. The regex `^[\d\s.:\-–]+` only strips *leading numeric/punctuation* characters. Because the string starts with "C" (a letter), nothing is stripped — the result is `"chapter 1: the journey begins"`. The unit test on line 19–21 of `chapterMatcher.test.ts` actually asserts this *wrong* output, making the test pass while the documentation is a lie. Two book editions where one EPUB uses "Chapter 3: Into the Dark" and the audio uses "Into the Dark" will fail to match because the normalized forms differ. The story accepted `DEFAULT_CONFIDENCE_THRESHOLD = 0.7` as solved, but this gap produces confidence near 0.6 for common "Chapter N: Title" vs "Title" patterns.

2. **[HIGH] `useFormatSwitch` accesses `mapping.mappings[currentChapterIndex]` to resolve EPUB→audio — this is wrong.** When the current book is an EPUB, the hook does `mapping.mappings[currentChapterIndex]` to find the audio chapter. The `mappings` array is indexed by *insertion order from the matching engine*, not by EPUB chapter TOC index. A book where chapters were matched out of order (e.g., partial matches, fallback passes interleaved with JW passes) will resolve to the wrong audio chapter. The `mappings` array must be searched by `epubChapterHref`, not accessed by position. This is a silent data corruption — the user lands on the wrong chapter with no error.

3. **[HIGH] `findCurrentEpubChapterHref` uses CFI prefix matching, but epub.js CFI values are not hierarchical path prefixes in the simple sense.** The code does `currentCfi.startsWith(ch.position.value)` on raw CFI strings. A CFI like `/6/4[ch02.xhtml]!/4/2/1:0` will not be a startsWith-prefix of `/6/4[ch02.xhtml]!/4` because the chapter bookmark CFI stored in `ch.position.value` is a structural entry point, not a literal path prefix of arbitrary reader-generated CFIs. This means `bestChapter` almost never advances past `sorted[0]`, and the user always switches to audio chapter 0 regardless of their actual EPUB position. The R1 review and 5 review rounds did not catch this.

4. **[MEDIUM] `findCurrentAudioChapterIndex` iterates in reverse and returns the first chapter whose `position.seconds <= currentSeconds` — but `Book.chapters` for an audiobook is not guaranteed to be sorted by time.** The code iterates `book.chapters` in reverse array order, not reverse-time order. If `chapters` are stored in Dexie insertion order (which may differ from time order for ABS-imported books where chapters arrive as API JSON), the function returns a wrong chapter index. A `sort` by `position.seconds` is required before the search loop.

5. **[MEDIUM] `ChapterMappingRecord` has no primary key field — the Dexie compound index `[epubBookId+audioBookId]` acts as the PK, but `db.chapterMappings.delete([epubBookId, audioBookId])` relies on this array-key syntax which is Dexie-specific and undocumented in the store.** If a developer unfamiliar with Dexie compound deletes calls `db.chapterMappings.delete(id)` with a string, it silently fails to delete. The type system offers no protection. E103-S03 recognized this but only mentioned it in the code review — no defensive guard was added. The `deleteMapping` store method should include a comment explaining the compound key array syntax.

6. **[MEDIUM] `useChapterMappingStore.getMapping` reads from in-memory Zustand state without guaranteeing `loadMappings()` was called first.** `getMapping` is a synchronous selector on `state.mappings`. If `loadMappings()` has not been called (e.g., the component calls `getMapping` before the store is hydrated from Dexie), it silently returns `undefined`, which causes `hasMapping = false` and hides the format switch buttons. The `isLoaded` guard on `loadMappings` prevents duplicate reads but does not help callers who call `getMapping` first. Either `getMapping` should call `loadMappings()` internally (async, breaking the synchronous contract), or `hasMapping` should use `useLiveQuery` directly (which `useFormatSwitch` already does independently — making the store's `getMapping` function redundant and confusing).

7. **[MEDIUM] The E103-S01 story's `ChapterMappingRecord` type has no `id` field, but E103-S02's data contract table shows `id: string` (UUID), and the E2E seeding example in E103-S02 uses `id: 'mapping-1'`.** The actual `ChapterMappingRecord` type in `src/data/types.ts` has no `id` field. The Dexie schema uses a compound primary key `[epubBookId+audioBookId]`, so no auto-generated `id` exists. The E103-S02 story document contains a fabricated data contract that does not match the implementation — any developer reading that contract to write integration code will add a field that is silently ignored by Dexie.

8. **[MEDIUM] The Levenshtein fallback in `computeChapterMapping` is applied to chapters that *already failed* Jaro-Winkler at threshold 0.7, but uses the same threshold for Levenshtein.** Levenshtein normalized similarity is consistently lower than Jaro-Winkler for partially similar strings (it penalizes transpositions and length differences more harshly). Applying the same `0.7` threshold to the Levenshtein pass means the fallback almost never fires — Levenshtein will reject the same pairs JW rejected. The fallback's purpose (handling "I" vs "1" differences) works for very short strings but fails for typical chapter titles of 10+ characters. The story's claim that this handles "Chapter One" vs "Chapter 1" is unverified — no test exercises a real JW-fail/Levenshtein-pass case with varied lengths.

9. **[MEDIUM] `useFormatSwitch` does not handle the race condition where `useLiveQuery` returns `undefined` (pending) vs `undefined` (no record found).** The hook derives `hasMapping = !!mapping`. During the initial Dexie query, `mapping` is `undefined` (loading). After the query, `mapping` is either a `ChapterMappingRecord` or `undefined` (not found). These two `undefined` states are indistinguishable — the UI flickers from "no button" (loading) to "no button" (not found) with no intermediate state. For fast databases this is invisible, but on cold IndexedDB opens or slow devices the format switch button appears missing for a moment, then stays missing if no mapping exists. A loading state (`isLoading: boolean`) should be returned from the hook so the parent can defer rendering rather than flashing absent buttons.

10. **[LOW] The `normalizeChapterTitle` regex uses a hyphen-minus `-` inside a character class without escaping, placed between `\-` (escaped) and `–` (em dash).** The regex `^[\d\s.:\-–]+` is technically correct since `\-` is escaped, but the pattern is confusing — it appears to define a range `–` to something. A cleaner regex is `^[\d\s.:\-\u2013]+` or `^[\d\s.:–-]+` with the hyphen at the end of the class. This is a maintainability hazard; a future developer modifying the regex could accidentally turn it into a character range.

11. **[LOW] The manual pairing UI (`ChapterMappingEditor.tsx`) specified in E103-S01 AC3 is not wired to any route or trigger point — AC1 explicitly deferred it to E103-S02, but E103-S02 does not implement the entry point either.** The story says "For this story: expose `computeChapterMapping()` and `ChapterMappingEditor` as standalone — no routing integration needed yet." E103-S02 adds the format switch buttons but only when a mapping already exists. The user has no path to *create* a mapping through the UI — they can never trigger `ChapterMappingEditor`. The matching engine runs but is never called from user-facing code. Chapter mappings can only exist if seeded in Dexie manually or via a future story. This is a functional dead end shipped across all three stories.

12. **[LOW] `burn_in_validated: false` on both E103-S02 and E103-S03.** Both stories involve navigation flows, Dexie live queries, and ref-based debounce — exactly the pattern that `burn-in.sh` exists to validate. The code review notes detected the `switchingRef` pattern and acknowledged it's sound, but burn-in was not run. The story workflow flags this as "auto-suggested if test anti-patterns detected." The `useRef` guard and `useLiveQuery` dependency on `bookId` are plausible sources of flakiness under rapid re-mounts.

13. **[LOW] The `chapterSwitchResolver.ts` fallback when no EPUB chapter CFI matches (line 34–35: return first mapped audio chapter) is inconsistent with the fallback in `resolveEpubPositionFromAudio` (line 68–69: return first mapped EPUB chapter).** Both functions fall back to "first mapped chapter" when the current position cannot be resolved. However, the first entry in `mapping.mappings` is the first EPUB chapter that was *successfully matched* — not necessarily chapter 1. For books with an unmatched prologue or introduction chapter (common in audiobooks), the fallback lands the user mid-book rather than at the start. Neither the story spec nor the unit tests cover this edge case explicitly.

---

## Summary Table

| # | Severity | Component | Description |
|---|----------|-----------|-------------|
| 1 | HIGH | `chapterMatcher.ts` | `normalizeChapterTitle` does not strip "Chapter N:" prefix — documentation wrong, test wrong |
| 2 | HIGH | `useFormatSwitch.ts` | Array index used instead of href lookup for EPUB→audio resolution |
| 3 | HIGH | `chapterSwitchResolver.ts` | CFI prefix matching (`startsWith`) does not work for epub.js CFI strings |
| 4 | MEDIUM | `chapterSwitchResolver.ts` | Audio chapter search assumes `chapters` sorted by time — not guaranteed |
| 5 | MEDIUM | `useChapterMappingStore.ts` | Dexie compound-key delete is fragile and undocumented |
| 6 | MEDIUM | `useChapterMappingStore.ts` | `getMapping` silently returns undefined when store not loaded |
| 7 | MEDIUM | E103-S02 story doc | Data contract `id` field is fabricated — does not match actual `ChapterMappingRecord` type |
| 8 | MEDIUM | `chapterMatcher.ts` | Levenshtein fallback uses same threshold as JW — fallback effectively never fires |
| 9 | MEDIUM | `useFormatSwitch.ts` | Loading vs not-found `undefined` states conflated — no loading indicator |
| 10 | LOW | `chapterMatcher.ts` | Regex character class has confusing hyphen placement |
| 11 | LOW | E103-S01, S02, S03 | No UI entry point to create a chapter mapping — feature is dead-end without manual Dexie seeding |
| 12 | LOW | E103-S02, S03 | `burn_in_validated: false` on both navigation-heavy stories |
| 13 | LOW | `chapterSwitchResolver.ts` | "First mapped" fallback may not be chapter 1 if prologue/intro is unmatched |
