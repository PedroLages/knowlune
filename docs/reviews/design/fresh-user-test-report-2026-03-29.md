# Fresh-User Test Report — Post Sample Course & Career Paths Removal

**Date:** 2026-03-29
**Context:** After removing 8 sample courses and Career Paths feature (~2,500 lines, commit `73bed4a8`), a fresh-user walkthrough was performed to validate the app experience.
**Testing method:** Manual testing (Pedro) + superpowers-chrome CDP browser automation (22 steps, 103 tool uses) + codebase analysis (3 parallel Explore agents)
**Browser test screenshots:** `/Volumes/SSD/Dev/cache/.cache/superpowers/browser/2026-03-29/session-1774752596244/`

---

## Executive Summary

The removal of sample courses and Career Paths was successful — no broken routes, no stale data, and navigation is clean. However, the removal exposed a **critical architecture gap**: imported courses are now the ONLY course type, but they have ~30% of the features that regular courses had. Three UX bugs were found and fixed in this session. Several medium/large improvements are recommended as future stories.

---

## Findings (Severity-Triaged)

### BLOCKER — None

### HIGH

#### H1: Cover Image Selection Not Persisting to Course Card
- **Severity:** HIGH
- **Status:** FIXED in this session
- **Symptom:** User selects cover image in Import Wizard Step 2, but the course card shows a generic green folder icon
- **Root cause:** `persistScannedCourse()` saved `coverImageHandle` to `ImportedCourse` record but never extracted the blob and saved it to `courseThumbnails` table. The card reads from `courseThumbnails` → finds nothing → shows fallback.
- **Fix:** Added code in `src/lib/courseImport.ts:503-515` to read the file from handle, resize via `loadThumbnailFromFile()`, save to `courseThumbnails`, and update Zustand store.
- **Files modified:** `src/lib/courseImport.ts`

#### H2: Drag & Drop Fails for Course Folders + No Visual Feedback
- **Severity:** HIGH
- **Status:** FIXED in this session
- **Symptom:** Dropping a course folder shows "No supported files found" error toast. Even after fix, no visual feedback during async folder extraction.
- **Root cause:** `handleDrop` used `e.dataTransfer.files` which for a dropped directory contains the folder entry itself (not its contents). Additionally, the async `extractFilesFromDrop()` had no loading state.
- **Fix:** Added recursive directory reading via `webkitGetAsEntry()`. Added `isExtracting` state with spinner + "Reading folder contents..." text + pulse animation during extraction. Improved error message with file count and suggestion to use "Select Folder".
- **Files modified:** `src/app/components/figma/ImportDropZone.tsx`, `src/lib/courseImport.ts`

#### H3: Regular Course Infrastructure Is Dead Code
- **Severity:** HIGH (tech debt)
- **Status:** NOT FIXED — requires dedicated epic
- **Symptom:** No user can create a `Course` — `useCourseStore` has no `add` method, `main.tsx` clears the table on every startup. Quiz routes (`/courses/:id/quiz/*`) are orphaned.
- **Impact:** ~3,000 lines of dead code across 40+ files. Features wired to regular courses (quizzes, structured navigation) are inaccessible.
- **Recommendation:** Phase 2 of progressive unification (see Strategy section below)

### MEDIUM

#### M1: Import Progress Overlay Not Prominent Enough
- **Severity:** MEDIUM
- **Status:** FIXED in this session
- **Symptom:** Small overlay (320px) in bottom-right corner, auto-dismisses in 3 seconds
- **Fix:** Increased auto-dismiss to 8 seconds. Widened to 384px/448px. Added brand-colored border glow for visibility.
- **Files modified:** `src/app/components/figma/ImportProgressOverlay.tsx`

#### M2: Imported Courses Lack Notes Panel in Video Player
- **Severity:** MEDIUM
- **Status:** NOT FIXED — requires story
- **Symptom:** When watching an imported course video at `/imported-courses/:id/lessons/:lessonId`, there is no notes panel, no quiz access, no flashcard creation.
- **Key files:** `src/app/pages/ImportedLessonPlayer.tsx`
- **Recommendation:** Add notes sidebar to `ImportedLessonPlayer` (pattern exists in `LessonPlayer.tsx`)

#### M3: No Prev/Next Video Navigation in Imported Player
- **Severity:** MEDIUM
- **Status:** NOT FIXED — requires story
- **Symptom:** User must go back to course detail, then click next video. No inline prev/next buttons.
- **Key file:** `src/app/pages/ImportedLessonPlayer.tsx`

#### M4: No Breadcrumbs in Imported Course Experience
- **Severity:** MEDIUM
- **Status:** NOT FIXED — requires story
- **Symptom:** User navigating imported courses has no breadcrumb trail (e.g., `Courses > Course Name > Video`)
- **Key files:** `src/app/pages/ImportedCourseDetail.tsx`, `src/app/pages/ImportedLessonPlayer.tsx`

### LOW

#### L1: PDF Viewer Shows "Coming Soon"
- **Severity:** LOW
- **Status:** NOT FIXED — requires story
- **Symptom:** Imported PDFs listed in course detail but clicking shows "coming soon" badge
- **Key file:** `src/app/pages/ImportedCourseDetail.tsx`

#### L2: Authors Page Shows Hardcoded "Chase Hughes" After Data Clear
- **Severity:** LOW
- **Status:** FIXED in this session
- **Symptom:** After clearing all IndexedDB data, `/authors` page still shows "Chase Hughes" (Behavioral Intelligence Expert & Author) with full bio and social links.
- **Root cause:** `getMergedAuthors()` in `src/lib/authors.ts` had a fallback that always injected static authors from `src/data/authors/` when they weren't found in IndexedDB. Designed as a "migration failure safeguard" but confused fresh users.
- **Fix:** Removed the pre-seeded author fallback. `getMergedAuthors()` now only returns user-imported authors from IndexedDB.
- **Files modified:** `src/lib/authors.ts`
- **Found by:** Browser test agent (superpowers-chrome)

#### L3: Onboarding Wizard Two-Step Dismissal
- **Severity:** LOW
- **Status:** NOT FIXED — UX polish
- **Symptom:** "Skip for now" doesn't immediately dismiss — leads to secondary state with "Skip onboarding" and "Close" buttons. Users must click twice to skip.
- **Found by:** Browser test agent (superpowers-chrome)

#### L4: My Class Page Has Empty Regular Course Sections
- **Severity:** LOW
- **Status:** NOT FIXED — deferred to unification epic
- **Symptom:** `MyClass.tsx` renders sections for regular courses (In Progress, Completed, Not Started) that are always empty since regular courses can't be created
- **Key file:** `src/app/pages/MyClass.tsx`

### INFO

#### I1: Career Paths Route Returns 404 ✅
- **Status:** PASS — Route correctly removed, 404 page shown

#### I2: Sidebar Navigation Clean ✅
- **Status:** PASS — No "Career Paths" link, 4 Library items (Overview, Courses, Learning Paths, Authors)

#### I3: Empty States Working Correctly ✅
- **Status:** PASS — Courses, Reports, Session History, My Class all show proper empty states with CTAs

#### I4: Onboarding Wizard Works for Fresh Users ✅
- **Status:** PASS — Welcome wizard appears, can be completed/skipped

#### I5: Dark/Light Mode Consistent ✅
- **Status:** PASS — Theme toggle works, no broken colors

#### I6: Search Shows No Sample Courses ✅
- **Status:** PASS — Cmd+K search palette has no stale sample course results

#### I7: Overview Empty State Clean ✅
- **Status:** PASS — Shows "Start Your Learning Journey" with zeroed-out stats (0 courses, 0 lessons, 0 study time)
- **Found by:** Browser test agent (superpowers-chrome)

#### I8: Progressive Disclosure Working ✅
- **Status:** PASS — Sidebar shows core items + "+11 more features available" link to Settings
- **Found by:** Browser test agent (superpowers-chrome)

---

## Architecture Analysis: Two Course Systems

| Aspect | Regular `Course` | `ImportedCourse` |
|--------|-----------------|------------------|
| **Creation** | ❌ No UI, no `add` method, cleared on startup | ✅ Folder import, YouTube import |
| **Store** | `useCourseStore` (read-only, 26 lines) | `useCourseImportStore` (full CRUD, 417 lines) |
| **Routes** | 6 routes including quiz/* | 2 routes (detail + player) |
| **Notes** | ✅ | ✅ (via courseId) |
| **Quizzes** | ✅ (orphaned) | ❌ No routes |
| **Prev/Next Nav** | ✅ sidebar | ❌ None |
| **Breadcrumbs** | ✅ | ❌ Minimal |
| **PDF viewer** | N/A | ❌ "Coming soon" |

**Conclusion:** Regular courses are functionally dead. Imported courses are the only user-facing course type but have ~30% of features.

---

## Recommended Strategy: Progressive Unification

### Phase 1 — Fix UX Bugs ✅ (Done This Session)
- ✅ Cover image persistence
- ✅ Progress overlay visibility
- ✅ Drag & drop folder support

### Phase 2 — Unify Course Experience (1 Epic, ~5-6 Stories)
1. Remove dead `Course` type, `useCourseStore`, and 6 orphaned regular course routes (~3,000 lines)
2. Rename `ImportedCourse` → `Course` (becomes THE course type)
3. Unify routes: `/courses/:id` instead of `/imported-courses/:id`
4. Add notes panel to video player
5. Add prev/next video navigation
6. Add breadcrumbs

### Phase 3 — Enhanced Learning Features (Future Epic)
- Wire quiz system to work with unified course IDs
- PDF inline viewer
- AI-powered study tools (auto-generate notes/flashcards from video transcripts — industry trend from StudyFetch, Mindgrasp, Quizgecko)

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `src/lib/courseImport.ts` | Added `loadThumbnailFromFile`/`saveCourseThumbnail` import; added cover image persistence after line 502; improved drag-drop error message |
| `src/app/components/figma/ImportDropZone.tsx` | Added recursive folder reading via `webkitGetAsEntry()`; added `isExtracting` state with spinner + pulse animation |
| `src/app/components/figma/ImportProgressOverlay.tsx` | AUTO_DISMISS_MS 3000→8000; wider overlay (448px); brand border glow |
| `src/lib/authors.ts` | Removed pre-seeded author fallback in `getMergedAuthors()`; removed unused `preseededToView`, `allAuthors` import |

---

## Industry Research References

- [10 Good UX Practices for Online Courses (2026)](https://learnstream.io/blog/good-ux-practices/) — drag-and-drop content upload, clear learner pathways
- [StudyFetch](https://www.studyfetch.com/) — auto-generates flashcards, quizzes, notes from uploaded materials
- [Mindgrasp](https://www.mindgrasp.ai/) — transforms uploads into AI study sessions
- [9 Must-Have Features for eLearning](https://www.magicedtech.com/blogs/9-must-have-features-for-your-elearning-platform/) — interactive elements, notes, bookmarks
- [Offline Learning in LMS](https://www.eleapsoftware.com/glossary/offline-learning-in-lms-practical-strategies-to-teach-train-and-track-without-the-internet/) — offline-first sync patterns
