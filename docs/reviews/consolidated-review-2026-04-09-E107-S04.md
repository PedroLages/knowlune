# Consolidated Review Report: E107-S04 — Wire About Book Dialog

**Date:** 2026-04-09
**Story:** E107-S04
**Verdict:** 🔴 BLOCKED
**Reviewer:** Automated review swarm (8 agents)

---

## Executive Summary

**Status:** BLOCKED - 3 critical test infrastructure blockers prevent AC verification

**Gate Results:**
- ✅ Pre-checks: PASSED
- ✅ Build: PASSED
- ✅ Lint: PASSED (E107-S04 files clean)
- ✅ Bundle Analysis: PASSED
- ✅ Performance: PASSED (no regressions, /library improved)
- ✅ Security: PASSED (no E107-S04 issues; 2 pre-existing secret leaks noted)
- 🔴 Testing Review: BLOCKED (missing libraryPage fixture)
- 🔴 Code Review: BLOCKED (3 testing blockers)
- ⏭️ Design Review: Not completed
- ⏭️ QA Review: Not completed

**E107-S04 Specific Findings:**
- 🔴 Blockers: 3
- 🟠 High: 1
- 🟡 Medium: 4
- ⚪ Nits: 2

**Pre-existing Issues (not E107-S04):**
- 🔴 Blockers: 2 (secrets in `.mcp.json` and `.claude/settings.json`)

---

## Critical Blockers (E107-S04 Specific)

### 🔴 Missing `libraryPage` Fixture

**Location:** `tests/e2e/story-e107-s04.spec.ts:15`
**Confidence:** 100%
**Reported By:** Testing Review, Code Review, GLM Review

**Issue:**
E2E tests import `libraryPage` fixture that doesn't exist. All 10 tests fail with "unknown parameter" error.

**Impact:**
- 0/5 Acceptance Criteria can be verified (0% coverage)
- Tests cannot execute at all

**Fix Required:**
Create `libraryPage` fixture in `tests/support/fixtures/` with:
- `goto()` - Navigate to library page
- `openBookCardContextMenu(index)` - Open context menu on book card
- `openBookListItemContextMenu(index)` - Open context menu on list item
- `openAboutBookDialog(index)` - Helper to open dialog
- `switchToListView()` - Toggle list view

---

### 🔴 Missing `data-testid` on Fallback Author

**Location:** `src/app/components/library/AboutBookDialog.tsx:90-97`
**Confidence:** 95%
**Reported By:** Code Review

**Issue:**
`data-testid="about-book-author"` only exists on truthy branch. When `book.author` is falsy, the "Unknown author" fallback (line 95-97) renders WITHOUT that testid. Test at `story-e107-s04.spec.ts:75-77` expects to find `[data-testid="about-book-author"]` with "Unknown author" but element won't exist.

**Fix:**
Add `data-testid="about-book-author"` to the fallback `<p>` element as well:
```tsx
<p className="text-base font-medium text-muted-foreground italic" data-testid="about-book-author">
  Unknown author
</p>
```

---

### 🔴 Missing `data-testid` on Fallback Description

**Location:** `src/app/components/library/AboutBookDialog.tsx:110-126`
**Confidence:** 95%
**Reported By:** Code Review

**Issue:**
`data-testid="about-book-description"` only exists on truthy branch. When `book.description` is falsy, the fallback renders without testid. Test at `story-e107-s04.spec.ts:81-83` expects to find it but element won't exist.

**Fix:**
Add `data-testid="about-book-description"` to fallback `<p>` at line 124.

---

## High Priority Issues

### 🟠 Book.author Type Inconsistency

**Location:** `src/app/components/library/AboutBookDialog.tsx:90`
**Confidence:** 75%
**Reported By:** Code Review

**Issue:**
`Book.author` is typed as `string` (required) in `src/data/types.ts:682`, but component checks `book.author ?` for empty string. The fallback only triggers on empty string `""`, not `undefined`. If test data never produces empty-string authors, the fallback is dead code.

**Fix:**
Either update Book type to `author?: string` or add `// Intentional: defensive check for empty string` comment.

---

## Medium Priority Issues

### 🟡 Fragile Overlay Selector

**Location:** `tests/e2e/story-e107-s04.spec.ts:149`
**Confidence:** 80%
**Reported By:** GLM Review

**Issue:**
"Dialog closes on click outside" test uses `.locator('[data-state="open"]').locator('..').first()` which may not match actual Dialog overlay DOM structure.

**Fix:**
Use robust selector: `page.locator('[data-radix-overlay]')` or `page.locator('.fixed.inset-0').first()`

---

### 🟡 Focus Restoration Assertion May Fail

**Location:** `tests/e2e/story-e107-s04.spec.ts:162`
**Confidence:** 75%
**Reported By:** GLM Review

**Issue:**
Test asserts `bookCard.toBeFocused()` but Radix focus restoration targets menu trigger, not parent card. Context menu may have closed.

**Fix:**
Use `await expect(bookCard).toContainFocus()` or verify focus is within card area.

---

### 🟡 Weak Content Assertions

**Location:** `tests/e2e/story-e107-s04.spec.ts:64-66`
**Confidence:** 85%
**Reported By:** Testing Review, GLM Review

**Issue:**
Tests verify fields are visible but don't assert actual values. Would pass even if metadata shows "—" or wrong values.

**Fix:**
```typescript
await expect(page.locator('[data-testid="about-book-format"]')).toContainText('EPUB')
await expect(page.locator('[data-testid="about-book-isbn"]')).toHaveText(/[\d-]+/)
```

---

### 🟡 formatFileSize Recreated on Every Render

**Location:** `src/app/components/library/AboutBookDialog.tsx:35-39`
**Confidence:** 70%
**Reported By:** Code Review, GLM Review

**Issue:**
`formatFileSize` is defined inside component body, creating new function on every render. Pure function with no dependencies.

**Fix:**
Move to module scope before component definition.

---

## Nits

### ⚪ Extra Blank Line

**Location:** `src/app/components/library/AboutBookDialog.tsx:48`
**Confidence:** 55%
**Reported By:** GLM Review

**Issue:**
Extra blank line adds no semantic value.

**Fix:** Remove blank line.

---

## Pre-existing Issues (Not E107-S04)

### 🔴 Plaintext API Key in `.mcp.json`

**Location:** `.mcp.json:15`
**Severity:** BLOCKER (pre-existing)
**Reported By:** Security Review

**Issue:**
Google/Stitch API key committed to git and pushed to origin/main.

**Fix:** Rotate API key, add `.mcp.json` to `.gitignore`, remove from git history.

---

### 🔴 Plaintext API Keys in `.claude/settings.json`

**Location:** `.claude/settings.json:17-18`
**Severity:** HIGH (pre-existing)
**Reported By:** Security Review

**Issue:**
OpenAI and ZAI API keys stored in local settings (no longer tracked in git, but still on disk).

**Fix:** Rotate keys, move to `.env.local`, add pre-commit hook for secret detection.

---

## Positive Findings

✅ **Performance:** No regressions detected. `/library` route improved (FCP -6ms, DOM Complete -16ms)
✅ **Security:** No E107-S04-specific security issues. All user-controlled data auto-escaped via React JSX.
✅ **Architecture:** Clean component following `LinkFormatsDialog` pattern. Proper fallback handling.
✅ **Design Tokens:** Correct usage throughout (no hardcoded colors).
✅ **TypeScript:** Compilation passes. Clean types.

---

## Recommendations (Priority Order)

1. **FIX CRITICAL BLOCKERS FIRST:**
   - Create `libraryPage` fixture in `tests/support/fixtures/`
   - Add `data-testid` to fallback author and description elements

2. **Fix medium-priority issues:**
   - Fix overlay selector in test
   - Fix focus restoration assertion
   - Add content value assertions
   - Move `formatFileSize` outside component

3. **Address pre-existing security issues:**
   - Rotate exposed API keys
   - Add `.mcp.json` to `.gitignore`

4. **Update documentation:**
   - Update AC-2 in story file to remove non-existent `publishDate` field

---

## Review Reports

- [Consolidated Review](docs/reviews/consolidated-review-2026-04-09-E107-S04.md)
- [Testing Review](docs/reviews/code/code-review-testing-2026-04-09-E107-S04.md)
- [Code Review](docs/reviews/code/code-review-2026-04-09-E107-S04.md)
- [Security Review](docs/reviews/security/security-review-2026-04-09-E107-S04.md)
- [Performance Review](docs/reviews/performance/performance-benchmark-2026-04-09-E107-S04.md)
- [GLM Adversarial Review](docs/reviews/code/glm-code-review-2026-04-09-e107-s04.md)
- [OpenAI Adversarial Review](docs/reviews/code/openai-review-2026-04-09-E107-S04.md)

---

**Generated:** 2026-04-09 14:50:00 UTC
**Review Bundle:** `.claude/state/review-story/review-bundle-E107-S04.json`
