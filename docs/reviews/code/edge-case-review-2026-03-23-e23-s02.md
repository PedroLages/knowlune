## Edge Case Review — E23-S02 (2026-03-23)

### Unhandled Edge Cases

**[tests/analysis/error-path-invalid-study-goals.spec.ts:362-364]** — `Sidebar label renamed but selector still matches old "My Class" text`
> Consequence: E2E test fails — link selector `/my class/i` no longer matches any navigation element after rename to "My Courses"
> Guard: `await page.getByRole('link', { name: /my courses/i }).click(); await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()`

---

**[tests/analysis/error-path-malformed-study-log.spec.ts:403-405]** — `Sidebar label renamed but selector still matches old "My Class" text`
> Consequence: E2E test fails — link selector `/my class/i` no longer matches any navigation element after rename to "My Courses"
> Guard: `await page.getByRole('link', { name: /my courses/i }).click(); await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()`

---

**[tests/analysis/error-path-corrupted-sessions.spec.ts:355-357]** — `Sidebar label renamed but selector still matches old "My Class" text`
> Consequence: E2E test fails — link selector `/my class/i` no longer matches any navigation element after rename to "My Courses"
> Guard: `await page.getByRole('link', { name: /my courses/i }).click(); await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()`

---

**[tests/analysis/error-path-corrupted-courses.spec.ts:402-404]** — `Sidebar label renamed but selector still matches old "My Class" text`
> Consequence: E2E test fails — link selector `/my class/i` no longer matches any navigation element after rename to "My Courses"
> Guard: `await page.getByRole('link', { name: /my courses/i }).click(); await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()`

---

**[tests/analysis/error-path-zustand-persist.spec.ts:194-196]** — `Sidebar label renamed but selector still matches old "My Class" text`
> Consequence: E2E test fails — link selector `/my class/i` no longer matches any navigation element after rename to "My Courses"
> Guard: `await page.getByRole('link', { name: /my courses/i }).click(); await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()`

---

**[tests/e2e/story-e23-s02.spec.ts:22-23]** — `Sidebar locator uses data-testid="sidebar" which does not exist in Layout.tsx`
> Consequence: Test relies on fallback `aside` selector which matches but is fragile — if Layout adds another `aside` element, test becomes ambiguous
> Guard: `const sidebar = page.locator('nav[aria-label="Main navigation"]')` (matches the actual sidebar nav element)

---

**[tests/e2e/navigation.spec.ts:58]** — `Active indicator test changed from /courses/i regex to exact: true but "Courses" also appears in sidebar as "My Courses"`
> Consequence: If sidebar renders "My Courses" link before "Courses" link and both are visible, `exact: true` correctly disambiguates — no bug here, but the test comment still says "sidebar link for Courses" without noting the disambiguation rationale
> Guard: No code change needed — `exact: true` is the correct fix. Comment could clarify.

---
**Total:** 6 unhandled edge cases found (5 stale test selectors in `tests/analysis/`, 1 fragile test locator in `story-e23-s02.spec.ts`).
