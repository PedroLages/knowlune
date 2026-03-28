## Test Coverage Review: E51-S01 — Settings Infrastructure & Display Section Shell

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%) — meets minimum threshold, but AC5 has a partial gap that reduces confidence.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Section appears with Eye icon, title "Display & Accessibility", description "Customize how content looks and moves" | None | `story-e51-s01-settings-infrastructure.spec.ts:36` | Covered |
| 2 | Reset button opens AlertDialog with specific title and description | None | `story-e51-s01-settings-infrastructure.spec.ts:57` | Partial |
| 3 | Confirming reset sets accessibilityFont=false, contentDensity='default', reduceMotion='system' + toast | None | `story-e51-s01-settings-infrastructure.spec.ts:76` | Covered |
| 4 | Fresh app getSettings() returns accessibilityFont=false, contentDensity='default', reduceMotion='system' | `settings.test.ts:16`, `settings.test.ts:29` | `story-e51-s01-settings-infrastructure.spec.ts:121` | Covered |
| 5 | Mobile (<640px): 44x44px touch targets, full-width reset button | None | `story-e51-s01-settings-infrastructure.spec.ts:152` | Partial |

**Coverage**: 4/5 ACs with meaningful coverage | 0 complete gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 5 ACs have at least one test.

---

#### High Priority

- **`story-e51-s01-settings-infrastructure.spec.ts:57-70` (confidence: 85)**: AC2 requires the AlertDialog to appear with *both* the title "Reset display settings?" *and* the description "This will reset accessibility font, spacious mode, and motion preference to their default values." The test at line 69 asserts the title text but never asserts the description. The description is a full sentence that could be silently truncated or changed during future refactors with no failing test. Fix: add `await expect(dialog.getByText(/This will reset accessibility font/)).toBeVisible()` after line 69.

- **`story-e51-s01-settings-infrastructure.spec.ts:152-165` (confidence: 82)**: AC5 states the reset button must be **full-width** on mobile. The test title is "mobile layout has proper touch targets and full-width reset" but only `box.height >= 44` is asserted — the width assertion is missing entirely. On a 375px viewport the button should occupy the full content width. Fix: add `expect(box!.width).toBeGreaterThan(300)` (or compare against the section's bounding box width) after line 164. Without this, `w-full sm:w-auto` could be removed from the component with no failing test.

- **`src/lib/__tests__/settings.test.ts` — no tests for corrupted enum values (confidence: 80)**: `settings.ts:69-77` contains explicit Zod-like sanitization for `reduceMotion`, `contentDensity`, and `accessibilityFont` — coercing invalid values back to defaults. This is a named implementation concern (story task 2.6 calls it "Edge case review HIGH #4") and is mentioned in the Challenges section. No unit test exercises these paths. For example, `getSettings()` called with `reduceMotion: 'invalid'` stored in localStorage should return `'system'`. Fix: add three tests in the `getSettings` describe block:
  - `localStorage.setItem('app-settings', JSON.stringify({ reduceMotion: 'invalid' }))` → `expect(getSettings().reduceMotion).toBe('system')`
  - `localStorage.setItem('app-settings', JSON.stringify({ contentDensity: 'compact' }))` → `expect(getSettings().contentDensity).toBe('default')`
  - `localStorage.setItem('app-settings', JSON.stringify({ accessibilityFont: 'yes' }))` → `expect(getSettings().accessibilityFont).toBe(false)`

  These paths are reachable from real users who manually edited localStorage and are the entire motivation for the validation code.

---

#### Medium

- **`story-e51-s01-settings-infrastructure.spec.ts:121-146` (confidence: 75)**: AC4 tests "fresh app getSettings() returns correct defaults" but the E2E test does not actually call `getSettings()` or read the new fields from `localStorage` after page load. The test removes `app-settings` from localStorage (line 123), then after navigation reads back `localStorage.getItem('app-settings')` (lines 137-139) — but the result is stored in `defaults` and then *not used in any assertion*. The only assertion is that the `display-accessibility-section` element is visible (line 144-145), which tests AC1 redundantly, not AC4. The AC4 behavior is already covered adequately by the unit tests (`settings.test.ts:16`). However, the E2E test body is misleading: it declares it covers AC4 but the meaningful assertion is absent. Fix: either remove the localStorage-reading block entirely (and rename the test to reinforce AC1 from a fresh state), or add `expect(defaults?.accessibilityFont).toBe(false)` etc. after verifying that `app-settings` was written to storage after the page initialised.

- **`story-e51-s01-settings-infrastructure.spec.ts:21-29` (confidence: 72)**: The local `goToSettings` helper duplicates setup that is already handled by `navigateAndWait` (sidebar seeding, onboarding dismissal). The helper only adds `knowlune-welcome-wizard-v1` before calling `navigateAndWait`, but the AC3 and AC4 tests inline all four localStorage keys redundantly (lines 85-93, 123-132). This is a maintenance hazard: if the welcome wizard key changes, multiple tests must be updated. Fix: either promote welcome wizard dismissal into `navigateAndWait` (which already handles sidebar and onboarding), or extract a shared `goToSettingsClean` helper in the support layer that sets all four keys. Using the existing `goToSettings(page)` helper from `tests/support/helpers/navigation.ts:77` (which already wraps `navigateAndWait`) would be cleaner than the file-local duplicate.

- **`src/lib/__tests__/settings.test.ts` — no explicit test for saveSettings persisting the three new fields (confidence: 68)**: The testing notes in the story explicitly call for "Unit test: saveSettings() persists new fields to localStorage." The existing `saveSettings` suite tests `displayName`, `bio`, `theme`, `colorScheme`, `fontSize`, and `profilePhotoDataUrl` in isolation, but no test calls `saveSettings({ accessibilityFont: true })` and verifies the value round-trips through localStorage. The `'can set all fields at once'` test (line 86) does include the three fields in its expected output (lines 98-100), which gives indirect coverage. However, a dedicated test for each new field would be more robust and fulfil the explicit testing note. Suggested location: `saveSettings localStorage persistence` describe block, new test `'persists accessibilityFont, contentDensity, and reduceMotion fields'`.

---

#### Nits

- **Nit `story-e51-s01-settings-infrastructure.spec.ts:49` (confidence: 60)**: The `data-testid="display-accessibility-section"` is placed on `<CardContent>`, not on the outermost `<Card>`. The AC says "section appears," and the test locates the section by that testid. This is functionally fine but semantically the testid represents the card body, not the card. If the heading and description move out of CardContent in a future story, the testid test (line 50) may still pass while the heading is gone. Minor: move the `data-testid` to `<Card>` or to the containing wrapper element.

- **Nit `story-e51-s01-settings-infrastructure.spec.ts:1` (confidence: 55)**: The file header comment says "RED phase — these tests should FAIL until the feature is implemented." This is an ATDD comment that was not removed after the GREEN phase was completed. The story's `review_gates_passed` frontmatter includes `e2e-tests`, confirming the feature is implemented and tests are green. Remove the stale comment to avoid confusing future contributors.

---

### Edge Cases to Consider

- **`settings.ts:93` — `saveSettings` fire-and-forget Supabase sync**: The `handleReset` path in `DisplayAccessibilitySection` calls `onSettingsChange` which in `Settings.tsx` calls `saveSettings()`. The `saveSettings` function unconditionally attempts a Supabase `auth.updateUser` call when profile fields are present. For the reset case the fields updated are `accessibilityFont`, `contentDensity`, and `reduceMotion` — none of which are in the `profileFields` block (lines 94-98 of settings.ts), so no Supabase call fires. This is correct behavior, but there is no test asserting that the reset does *not* trigger a Supabase call. Given the fire-and-forget pattern, a spurious sync would be silent — worth a unit test if Supabase mocking is available.

- **Cancel path on the AlertDialog**: No test verifies that clicking "Cancel" leaves the settings unchanged. AC3 only tests the confirm path. The cancel button dismisses the dialog without calling `handleReset`, which is correct component behavior, but the test suite does not guard against a regression where cancel inadvertently saves. Suggested test: open dialog, click Cancel, assert `app-settings` in localStorage still contains the pre-set non-default values.

- **`settings.ts:80` catch branch**: `getSettings()` returns `{ ...defaults }` if `JSON.parse` throws. The unit test `'returns defaults when localStorage has invalid JSON'` (line 29) covers this. However, the returned object is compared with `toEqual` including the full shape. If a future story adds more fields to `AppSettings`, this `toEqual` assertion will break and require updating — noted in the Challenges section of the story. The three new fields were already updated in the test (diff lines +3 each in two places), but the pattern is fragile. Consider switching these two full-shape assertions to property-level assertions with `expect(settings.accessibilityFont).toBe(false)` etc.

---

ACs: 4 covered / 5 total (80%) | Findings: 9 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 2 | Edge cases: 3
