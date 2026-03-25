# Test Coverage Review: E24-S03 — Import Wizard Tags, Cover Image, and Confirmation

**Date:** 2026-03-25
**Reviewer:** Claude Opus 4.6 (automated)

## Test Files

| File | Tests | Status |
|------|-------|--------|
| `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx` | 20 | PASS |
| `src/lib/__tests__/scanAndPersist.test.ts` | 18 | PASS |
| `src/lib/__tests__/courseImport.test.ts` | 9 (1 fail) | BROKEN by story |
| `src/lib/__tests__/courseImport.integration.test.ts` | 7 (all fail) | BROKEN by story |

## AC Coverage

### Tags
- Add tag via Enter: Covered (`adds a tag when Enter is pressed`)
- Duplicate prevention: Covered (`does not add duplicate tags`)
- Remove tag via X: Covered (`removes a tag when X is clicked`)
- Backspace to remove last tag: Covered (`removes last tag on Backspace when input is empty`)
- Tags passed to persist: Covered (`passes tags to persistScannedCourse`)
- Tag count in summary: Covered (`shows tag count in summary`)

### Cover Image
- No images placeholder: Covered (`shows no-images placeholder when no images found`)
- Image grid display: Covered (`shows image grid when images are found`)
- Image count in summary: Covered (`shows image count in summary when images exist`)
- Cover handle passed to persist: Covered (`passes coverImageHandle to persistScannedCourse`)
- Cover info in summary: Covered (`shows cover selected info in summary when image chosen`)
- Image discovery during scan: Covered in scanAndPersist (`should discover image files during scan`)

### Confirmation
- Import summary with counts: Covered via video-count/pdf-count/image-count tests
- Folder path display: Covered structurally (data-testid="wizard-folder-path")

## Gaps

1. **No test for deselecting a cover image** — the `handleSelectCoverImage(null)` path (clicking selected image again or clicking X on preview) is not tested.
2. **No test for tag lowercasing** — `handleAddTag` lowercases input, but no test verifies `"React"` becomes `"react"`.
3. **No test for `onBlur` tag addition** — the tag input has an `onBlur={handleAddTag}` handler; no test covers clicking away to add a pending tag.
4. **No E2E spec** for this story (expected: File System Access API is hard to test in Playwright).
5. **Broken existing tests** — `courseImport.test.ts` and `courseImport.integration.test.ts` need mock updates (see code review B1).

## Test Quality

- Factory patterns used correctly (`makeScannedCourse`, `makeMockFileHandle`)
- Good use of `data-testid` attributes for reliable selectors
- Tests properly clean up via `vi.clearAllMocks()` and `URL.createObjectURL` mocking
- `scanAndPersist.test.ts` correctly includes `isImageFile` in mocks (the pattern the other test files need to follow)
