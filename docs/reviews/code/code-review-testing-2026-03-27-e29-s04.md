# Test Coverage Review: E29-S04 — Remove focus-visible:outline-none from Legal Pages

**Date:** 2026-03-27
**Reviewer:** Claude Opus 4.6 (Test Coverage Agent)
**Story:** E29-S04 — Remove focus-visible:outline-none from Legal Pages

## Summary

ADVISORY — No automated tests exist for this story. This is a CSS-class-only change on static legal pages with no logic, so the risk is low. Manual verification via Playwright MCP confirmed correct behavior.

## Acceptance Criteria Coverage

| AC | Description | Automated Test | Manual Verification |
|----|-------------|---------------|-------------------|
| AC1 | Privacy Policy TOC links show focus ring, `focus-visible:outline-none` removed | No E2E test | PASS (Playwright MCP) |
| AC2 | Terms of Service TOC + cross-page links show focus ring, WCAG 2.4.7 satisfied | No E2E test | PASS (Playwright MCP) |

## Test Gap Analysis

### Missing Tests (Advisory — low risk for CSS-only change)

1. **No E2E test for focus ring visibility on legal pages** — Could add a simple Tab-through test that asserts `outline` or `box-shadow` computed styles are non-`none` when focused. Risk: LOW (CSS-only, no logic).

2. **No regression guard against re-introduction of `focus-visible:outline-none`** — An ESLint rule could prevent `focus-visible:outline-none` globally. This would be a codebase-wide improvement beyond this story's scope.

## Pre-Existing Test Issues (not blocking)

- Unit test coverage is at 69.73%, slightly below the 70% threshold — not caused by this story.
- No existing E2E tests cover legal pages at all.

## Recommendation

PASS with advisory. The change is low-risk (CSS class swap on 3 elements) and was verified manually via browser automation. Adding automated tests would be over-engineering for this story's scope.
