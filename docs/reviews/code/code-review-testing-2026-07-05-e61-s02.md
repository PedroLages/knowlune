## Test Coverage Review: E61-S02 — Service Worker Push and Click Handlers

### AC Coverage Summary

**Acceptance Criteria Coverage:** 3.5/7 ACs tested (**50%**)

**🚨 COVERAGE GATE:** 🔴 BLOCKER (<60%)

> **Note:** This story's tests are scoped as **ATDD build verification** — they validate the compiled `dist/sw.js` contains expected handler code. Full behavioral testing (push event dispatch, notification click flows, tag deduplication) requires Chrome DevTools Protocol (CDP) and is explicitly deferred to manual DevTools verification per the test file header. The coverage calculation below treats ACs that are structurally verifiable at build time. Three ACs (AC 2 tag dedup, AC 3 fallback, AC 5 navigate behavior) cannot be verified without CDP and are counted as gaps. Three additional ACs (AC 1, 5, 6) have partial build-verification coverage — their core handler structure is verified but specific code paths within the handlers are not checked.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Push handler shows notification with full payload fields (title, body, icon, badge, tag, url) | None | `story-e61-s02.spec.ts:41` (build: addEventListener, waitUntil, showNotification, icon regex, badge regex) | **Partial** — handler structure verified; tag field pass-through not checked |
| 2 | Tag field enables notification deduplication | None | None | **Gap** — requires CDP; deferred to manual DevTools testing |
| 3 | Invalid/missing payload falls back to defaults (generic notification) | None | None | **Gap** — catch-block behavior requires CDP; deferred to manual testing |
| 4 | Notification click handler closes notification and focuses/opens tabs | None | `story-e61-s02.spec.ts:41` (build: notificationclick, close, matchAll) | **Covered** — handler structure verified |
| 5 | Notification click navigates to payload URL (navigate or postMessage fallback) | None | `story-e61-s02.spec.ts:41` (build: matchAll only) | **Partial** — matchAll verified but openWindow, navigate, postMessage not checked |
| 6 | Pushsubscriptionchange handler re-subscribes and POSTs to backend | None | `story-e61-s02.spec.ts:41` (build: pushsubscriptionchange, subscribe) | **Partial** — handler + subscribe verified; fetch POST not checked |
| 7 | Build produces dist/sw.js with all handlers and icon assets exist | None | `story-e61-s02.spec.ts:41` (sw.js existence + content), `:76` (icon files) | **Covered** — fully verified |

**Coverage**: 2/7 ACs fully covered | 3 gaps | 2 partial

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC 2: "Tag field enables notification deduplication" has no test. The `tag` field passes through `...payload` into `showNotification()` options — the compiled SW will contain the tag logic but there's no string check for it. While behavioral dedup testing requires CDP (deferred to manual), the build test should at least verify that the compiled SW handles the `tag` option. Suggested test: add `expect(swContent).toContain('tag')` or verify the options spread pattern in `story-e61-s02.spec.ts:41`.

- **(confidence: 95)** AC 3: "Invalid/missing payload falls back to defaults" has no test. The catch block is intentionally empty (defaults pre-assigned), making this impossible to verify at build time — there's no unique code path to grep for. This is a **legitimate deferral** to manual CDP testing. No build-verification test can cover this. Document as known limitation.

#### High Priority

- **(confidence: 85)** `story-e61-s02.spec.ts:41`: AC 5 — notificationclick handler test checks for `matchAll` but does not verify `openWindow`, `navigate`, or `postMessage` exist in the compiled SW. These are critical code paths: `openWindow` is the fallback when no tab exists, `navigate`/`postMessage` handle URL changes. Suggested fix: add assertions:
  ```ts
  expect(swContent, 'notificationclick must call openWindow for new tabs').toContain('openWindow')
  expect(swContent, 'notificationclick must support navigate or postMessage').toMatch(/navigate|postMessage/)
  ```

- **(confidence: 85)** `story-e61-s02.spec.ts:41`: AC 6 — pushsubscriptionchange test checks for `subscribe` but does not verify the `fetch` POST call exists. The backend notification is a critical requirement for S03 compatibility. Suggested fix: add:
  ```ts
  expect(swContent, 'pushsubscriptionchange must POST to backend').toContain('fetch')
  ```

- **(confidence: 80)** `story-e61-s02.spec.ts:41`: AC 1 — push handler test does not verify that `tag` is handled. While tag dedup behavior requires CDP, the build test should confirm the compiled SW includes tag support. The `tag` field is passed via `...payload` spread — in the compiled output this may or may not be visible. Suggested fix: add assertion verifying the options spread or tag reference exists:
  ```ts
  expect(swContent, 'push handler must support tag for deduplication').toMatch(/tag/)
  ```
  Note: this may be fragile if the minifier renames the property. If `tag` cannot be reliably detected in compiled output, document as a known build-verification limitation.

#### Medium

- **(confidence: 70)** `story-e61-s02.spec.ts:80-104`: The "service worker registers successfully" and "push manager is available" tests are valuable integration checks, but they don't directly map to any AC. They verify prerequisites (SW registration, PushManager) rather than story behavior. These are good to keep as smoke tests but shouldn't count toward AC coverage. Consider adding a comment linking them to the story as "infrastructure verification."

- **(confidence: 65)** `story-e61-s02.spec.ts:41`: The build verification test is a single large test covering ACs 1, 4, 6, 7 in one block. If any assertion fails, the entire test fails — making it harder to pinpoint which handler is broken. Suggested: split into 3 focused tests: "push handler structure", "notificationclick handler structure", "pushsubscriptionchange handler structure", each with their own assertions. This improves debuggability and makes the AC mapping clearer.

#### Nits

- **Nit** `story-e61-s02.spec.ts:41` (confidence: 60): The `toContain('addEventListener')` assertion is overly broad — it would pass if ANY event listener exists (e.g., the `activate` or `message` listener). Consider using a more specific pattern: `toMatch(/addEventListener\s*\(\s*['"]push['"]/)` to verify the push-specific listener.

- **Nit** `story-e61-s02.spec.ts:41` (confidence: 55): The `showNotification` string check doesn't verify that both `title` and `notificationOptions` arguments are passed. The compiled output should contain `showNotification(title,` or similar. Consider tightening this assertion.

### Edge Cases to Consider

These scenarios are not covered by any test and are not explicitly deferred to manual testing:

1. **`event.oldSubscription` is null** (pushsubscriptionchange): The source code guards against this (`if (\!event.oldSubscription) return`), but the build test doesn't verify this guard exists. If the guard is accidentally removed, the SW would throw on `event.oldSubscription.options`. Add a string check for `oldSubscription` in the build test.

2. **`event.data` is null** (push handler): The source checks `if (event.data)` before calling `.json()`. This is a different path from the catch block (which handles invalid JSON). The build test doesn't verify this null-check exists. If removed, empty pushes would throw instead of using defaults.

3. **No existing tabs + `openWindow` unavailable**: The source guards `if (self.clients.openWindow)`. The build test doesn't verify this guard exists. Very old browsers or restricted contexts may not support `openWindow`.

4. **`client.focus()` failing silently**: The source calls `await client.focus()` without a try/catch. If focus fails (e.g., the tab was closed between `matchAll` and `focus`), the notificationclick handler would reject. This is a race condition that would need CDP testing.

5. **Preview server not running**: Tests 3 and 4 use `test.skip()` for dev server (port 5173), but don't verify that the preview server (port 4173) is actually running. If the preview server isn't started, these tests will fail with a connection error rather than a clear skip message. Consider adding a pre-condition check or documenting the requirement.

---
ACs: 2 covered (AC 4, 7) / 7 total | Findings: 8 | Blockers: 2 | High: 3 | Medium: 2 | Nits: 2
