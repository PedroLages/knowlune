# Test Coverage Review: E83-S08 PWA Offline Shell for Library

**Date:** 2026-04-05
**Reviewer:** Claude Opus 4.6 (1M context)
**Story:** E83-S08 PWA Offline Shell for Library

## Acceptance Criteria Coverage

| AC | Description | Test Coverage | Status |
|----|-------------|---------------|--------|
| AC-1 | vite-plugin-pwa configured with Workbox precaching | Pre-existing (not this story's change) | N/A |
| AC-2 | EPUB chunks in precache manifest | Pre-existing | N/A |
| AC-3 | Library loads offline from SW cache | Manual test only (Task 4) | GAP |
| AC-4 | Offline indicator in reader toolbar | Offline badge added to Library page header | PARTIAL — no automated test |
| AC-5 | Graceful failure for network actions offline | Guards added with toast/silent return | PARTIAL — no automated test |

## Findings

### MEDIUM

1. **No automated tests for any AC in this story** — The story adds a `data-testid="library-offline-badge"` but no spec file exercises it. The existing `offline-awareness.spec.ts` covers a different page. Recommend adding at minimum a unit test for `useOnlineStatus` and an E2E test for the Library offline badge.

### LOW

2. **AC-4 deferred reader toolbar indicator** — The story notes the EPUB reader toolbar offline indicator is deferred to E84. This is acceptable since the reader component doesn't exist yet, but should be tracked.

## Verdict

**ADVISORY** — Functional guards are in place and the try/catch in OpenLibraryService provides a safety net. The gap is test automation coverage, not functionality.
