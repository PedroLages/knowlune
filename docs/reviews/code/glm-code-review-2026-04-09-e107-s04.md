## External Code Review: E107-S04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-09
**Story**: E107-S04

### Findings

#### Blockers

#### High Priority

#### Medium

- **[tests/e2e/story-e107-s04.spec.ts:26] (confidence: 90)**: E2E test imports `libraryPage` fixture from `'../support/fixtures'` but the checkpoint notes this fixture doesn't exist yet (`libraryPage.goto()`, `libraryPage.openBookCardContextMenu()`, `libraryPage.openAboutBookDialog()`, `libraryPage.switchToListView()`, `libraryPage.openBookListItemContextMenu()` are all unimplemented). Every test will fail at runtime with a fixture resolution error. This isn't caught by the build since E2E tests aren't compiled in the build step. Fix: Either implement the `libraryPage` fixture or mark the entire test suite with `test.skip` until the fixture exists, so CI doesn't silently show green on unrunnable tests.

- **[tests/e2e/story-e107-s04.spec.ts:149] (confidence: 80)**: The "Dialog closes on click outside" test uses a fragile selector (`[data-state="open"]` then `.locator('..').first()`) to find the overlay, which may not match the actual Dialog overlay DOM structure. If the overlay element isn't the parent of the `[data-state="open"]` element, the click could hit the dialog content itself or miss entirely, causing a flaky false positive. Fix: Use a more robust overlay selector such as the radix dialog overlay pattern (`[data-radix-overlay]` or the direct DialogOverlay element), or use `page.locator('.fixed.inset-0').first()` / similar structural selector.

- **[tests/e2e/story-e107-s04.spec.ts:162] (confidence: 75)**: The "Dialog returns focus to triggering element on close" test asserts `bookCard.toBeFocused()` after Escape closes the dialog. However, the context menu was opened first, then the menu item was clicked. After the dialog closes, focus typically returns to the menu trigger (not the card), and the context menu itself may have already closed. This assertion is likely to fail intermittently since Radix focus restoration targets the trigger element, not the parent card. Fix: Check that focus returns to a sensible element within the book card area or adjust the assertion to verify focus is somewhere within the card using `expect(bookCard).toContainFocus()` or similar, rather than requiring the card itself to be focused.

#### Nits

- **[src/app/components/library/AboutBookDialog.tsx:42] (confidence: 60)**: Minor redundancy — the `formatFileSize` function is recreated on every render. It has no dependencies on component state or props. Fix: Move it outside the component as a module-level utility, or wrap with `useCallback` if preferred. This is a performance nit, not a correctness issue.

- **[src/app/components/library/AboutBookDialog.tsx:48] (confidence: 55)**: Extra blank line between `formatFileSize` and the return statement adds no semantic value.

---
Issues found: 5 | Blockers: 0 | High: 0 | Medium: 3 | Nits: 2
