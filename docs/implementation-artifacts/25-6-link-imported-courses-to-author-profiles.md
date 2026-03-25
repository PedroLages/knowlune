# E25-S06: Link Imported Courses to Author Profiles

## Status: Complete

## Summary

Links imported courses to author profiles bidirectionally. Author info appears on course cards, course detail pages show an author section, author profile pages display linked imported courses, and the EditCourseDialog includes an author picker.

## Acceptance Criteria

- [x] ImportedCourseCard shows author name + avatar (or "Unknown Author")
- [x] AuthorProfile page shows linked imported courses alongside pre-seeded courses
- [x] ImportedCourseDetail page shows author section with link to profile
- [x] EditCourseDialog has author picker to set/change/remove author
- [x] Author ↔ course bidirectional link maintained (authorId on course, courseIds on author)
- [x] All existing unit tests updated and passing

## Files Changed

| File | Change |
|------|--------|
| `src/lib/authors.ts` | Added `getAuthorForImportedCourse()` helper |
| `src/stores/useCourseImportStore.ts` | Extended `CourseDetailsUpdate` with `authorId` field |
| `src/app/components/figma/ImportedCourseCard.tsx` | Added author display (avatar + name link) |
| `src/app/components/figma/EditCourseDialog.tsx` | Added author picker Select dropdown |
| `src/app/pages/ImportedCourseDetail.tsx` | Added author section with avatar/name/title |
| `src/app/pages/AuthorProfile.tsx` | Added imported courses grid alongside pre-seeded courses |
| `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` | Added useAuthorStore mock |
| `src/app/components/figma/__tests__/EditCourseDialog.test.tsx` | Added useAuthorStore mock, updated save expectation |
| `src/app/pages/__tests__/Courses.test.tsx` | Fixed pre-existing mock gaps (autoAnalysisStatus, author mocks) |

## Lessons Learned

- When adding a new store dependency to a component, every unit test that renders that component (directly or transitively) needs the mock updated. The Courses.test.tsx had a pre-existing failure from missing `autoAnalysisStatus` in the mock, which was masked until the test was re-examined.
- For bidirectional links (course.authorId + author.courseIds), the save handler should update both sides atomically to avoid data inconsistency. The current implementation does this sequentially which is acceptable for a client-side IndexedDB app but would need a transaction in a server-side context.
