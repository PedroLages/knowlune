## Edge Case Review — E07-S06 (2026-03-19)

### Unhandled Edge Cases

**[tests/e2e/regression/story-e07-s03.spec.ts:65]** — `No dialog element exists when closeCompletionModal is called`
> Consequence: Generic timeout error instead of descriptive "dialog not found" failure
> Guard: `await dialog.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })`

**[tests/e2e/regression/story-e07-s03.spec.ts:489-496]** — `Synthetic lesson IDs don't match actual course lesson IDs`
> Consequence: Algorithm sees 0% progress, momentum calculation wrong, test passes falsely or fails
> Guard: `Import actual lesson IDs from course data files instead of generating synthetic ones`

**[tests/e2e/regression/story-e07-s03.spec.ts:471-480]** — `New course added to app not in excludedCourseIds list`
> Consequence: Unexcluded course becomes candidate, may outscore confidence-reboot, test fails
> Guard: `Derive excludedCourseIds from ALL_COURSES.filter(c => !['authority','confidence-reboot','behavior-skills'].includes(c.id))`

**[tests/e2e/regression/story-e07-s03.spec.ts:473-478]** — `Excluded courses seeded with 1000 fake lesson IDs not matching real data`
> Consequence: Completion check rejects fake IDs, courses remain candidates, test breaks
> Guard: `Seed completedLessons using actual lesson IDs from each course's data module`

**[tests/e2e/regression/story-e07-s03.spec.ts:553-554]** — `h2 element inside suggestion card has no text content`
> Consequence: Regex match on undefined throws TypeError instead of clear assertion failure
> Guard: `expect(suggestedTitle).not.toBeNull(); expect(suggestedTitle!.toLowerCase()).toMatch(...)`

**[tests/e2e/regression/story-e07-s03.spec.ts:65-66]** — `Multiple dialog elements open simultaneously`
> Consequence: Strict mode violation if Playwright resolves multiple dialog matches
> Guard: `const dialog = page.getByRole('dialog').first()`

---
**Total:** 6 unhandled edge cases found.
