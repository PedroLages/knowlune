# Test Coverage Review — E23-S04: Restructure Sidebar Navigation Groups

**Date**: 2026-03-23
**Story**: E23-S04 — Restructure Sidebar Navigation Groups
**Reviewer**: Claude Code (code-review-testing agent)

---

## AC Coverage Summary

**7/7 ACs covered — PASS**

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Sidebar shows exactly Learn, Review, Track group labels | `navigation.test.ts:5-8` | `story-e23-s04.spec.ts:23-39` | Covered |
| 2 | Learn group: Overview, My Courses, Courses, Authors, Notes | `navigation.test.ts:10-19` | `story-e23-s04.spec.ts:44-58` | Covered |
| 3 | Review group: Learning Path, Knowledge Gaps, Review, Retention | `navigation.test.ts:21-30` | `story-e23-s04.spec.ts:63-75` | Covered |
| 4 | Track group: Challenges, Session History, Study Analytics, Quiz Analytics, AI Analytics | `navigation.test.ts:32-41` | `story-e23-s04.spec.ts:80-93` | Covered |
| 5 | Mobile More drawer includes Authors and all Review/Track items | `navigation.test.ts:62-76` | `story-e23-s04.spec.ts:98-125` | Partial |
| 6 | Collapsed sidebar shows separators between groups | None | `story-e23-s04.spec.ts:130-145` | Partial |
| 7 | No horizontal overflow at mobile, tablet, desktop viewports | None | `story-e23-s04.spec.ts:150-167` | Covered |

---

## Test Quality Findings

### Blockers

None (all 7 ACs have coverage).

### High Priority

**H1**: `story-e23-s04.spec.ts:98-125` — AC5 drawer only checks Challenges from 5 Track items (confidence: 82)

Session History, Study Analytics, Quiz Analytics, AI Analytics are not asserted in the E2E drawer. The AC text says "all Review/Track items."

Fix: Add assertions for the 4 missing Track items inside the drawer test, or add an explicit comment explaining they are covered at unit level.

**H2**: `story-e23-s04.spec.ts:130-145` — AC6 separator selector uses Tailwind class `div[aria-hidden="true"].border-t` (confidence: 78)

Brittle — a style refactor would silently pass 0 matches.

Fix: Add `data-testid="group-separator"` to separator divs in Layout.tsx.

**H3**: `story-e23-s04.spec.ts:104-109` — AC5 uses `page.evaluate()` click bypassing Playwright actionability (confidence: 75)

Radix UI Drawer responds to pointer events; `page.evaluate()` skips pointer-event chain.

Fix: Use `moreButton.dispatchEvent('click')` or remove the dev-toolbar overlay in test context.

### Medium

**M1**: `navigation.test.ts:43-46` — Uniqueness test scope excludes `settingsItem` in the flat `navigationItems` export (confidence: 65)

**M2**: `story-e23-s04.spec.ts:150-167` — AC7 overflow check targets `document.documentElement` only, not the sidebar `<aside>` element itself (confidence: 65)

**M3**: `navigation.test.ts` — `getIsActive()` function has no unit tests (confidence: 60). Pre-dates this story; may be covered elsewhere. Check with `git grep -l "getIsActive"`.

### Nits

**N1**: AC1-AC4 E2E tests use `DESKTOP` only; sidebar items at tablet viewport (inside Sheet) are untested by the E2E spec.

**N2**: AC6 tests collapsed state at `DESKTOP` only — tablet uses Sheet not collapsible aside, so separator logic is not exercised at tablet.

**N3**: Item visual order within groups is only asserted at unit level (config), not in E2E rendering order.

**N4**: `page` fixture could use `test.use({ viewport: DESKTOP })` at describe-block level to reduce per-test boilerplate.

---

Coverage gate: PASS (7/7 ACs) | Findings: 9 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 4
