# Test Coverage Review: E27-S03 — Update Sidebar Links to Reports Tabs

**Date:** 2026-03-22
**Story:** E27-S03
**Reviewer:** code-review-testing agent
**Branch:** feature/e27-s03-update-sidebar-links-to-reports-tabs

---

## AC Coverage: 7/8 (87.5%) — GATE: PASS

| AC# | Description | Unit | E2E | Verdict |
|-----|-------------|------|-----|---------|
| 1 | Sidebar shows Study Analytics link | — | `story-e27-s03.spec.ts:22` | ✅ Covered |
| 2 | Sidebar shows Quiz Analytics link | — | `story-e27-s03.spec.ts:28` | ✅ Covered |
| 3 | Sidebar shows AI Analytics link | — | `story-e27-s03.spec.ts:34` | ✅ Covered |
| 4 | Each link navigates to the correct URL | — | `story-e27-s03.spec.ts:40–58` | ✅ Covered |
| 5 | Active state highlights correct link; others inactive | `NavLink.test.tsx:5–18` | `story-e27-s03.spec.ts:61–93` | ✅ Covered |
| 6 | Bare `/reports` defaults Study Analytics to active | `NavLink.test.tsx:13` | `story-e27-s03.spec.ts:83` | ✅ Covered |
| 7 | Old single Reports item no longer present | — | `story-e27-s03.spec.ts:96` | ✅ Covered |
| 8 | SearchCommandPalette has tab-specific entries | — | — | ❌ **GAP** |

---

## Findings

### High Priority

**[High] AC5 inactive-state assertions missing in per-tab active tests (confidence: 80)**

The three active-state tests (`?tab=study`, `?tab=quizzes`, `?tab=ai`) each verify only that the matching link becomes active — they do not assert the other two are inactive. A buggy `getIsActive` that activates all three simultaneously would pass these tests.

**Fix:** In each of the three active-state tests, add negative assertions (e.g., `await expect(quizLink).not.toHaveAttribute('aria-current', 'page')`) mirroring the pattern already used at lines 89–93.

**[High] AC8 (SearchCommandPalette) has zero test coverage (confidence: 78)**

`SearchCommandPalette.tsx:81–103` adds three tab-specific entries. No unit test verifies the `navigationPages` array, and no E2E test opens the palette and confirms navigation.

**Fix:** Add E2E test: open command palette, search "Analytics", assert all three entries visible, select one, verify navigation to correct URL.

**[High] React key collision in sidebar — `Layout.tsx:122` (confidence: 85)**

All three Reports tab items share `key={item.path}` which equals `'/reports'`. Playwright doesn't surface React key warnings, so tests pass but the bug exists.

**Fix:** Add a unit test asserting all `navigationItems` have unique `path+tab` composite identifiers. Fix code with composite key.

### Medium

**[Medium] `NavLink.test.tsx` tests `getIsActive` not the `NavLink` component (confidence: 72)**

The file is named `NavLink.test.tsx` but never renders the component. The wiring inside `NavLink` (aria-current, href generation) is exercised only by E2E tests.

**Fix:** Consider renaming to `getIsActive.test.ts` and adding a render test with `MemoryRouter` verifying the `<a>` element gets correct `href` and `aria-current`.

**[Medium] Missing tablet viewport localStorage seed (confidence: 68)**

`beforeEach` seeds `knowlune-sidebar-collapsed-v1` but not `knowlune-sidebar-v1`. Safe at 1280px but fragile if viewport changes to tablet range.

### Nits

- **Nit** `story-e27-s03.spec.ts:99`: `not.toBeVisible()` vs `not.toBeAttached()` — latter is more precise for verifying element absence. (confidence: 55)
- **Nit** `NavLink.test.tsx`: Missing symmetry tests for all three tab pairs (quiz-vs-ai, ai-vs-study). (confidence: 50)

---

## Edge Cases to Consider

- **Unknown `?tab=` value**: `/reports?tab=unknown` correctly leaves all three inactive — but no unit test guards against a future fallback-to-default change in `getIsActive`.
- **Collapsed sidebar tooltip**: Story AC specifies tooltip shows correct tab name in icon-only mode. No E2E test verifies this.
- **Href attribute assertion**: AC1–3 check visibility by label but not `href`. Explicit `toHaveAttribute('href', '/reports?tab=study')` would be more direct.
