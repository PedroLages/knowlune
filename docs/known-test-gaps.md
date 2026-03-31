# Known Test Gaps

Documented limitations in the E2E and integration test suite. These are accepted gaps due to browser/tooling constraints, not oversights.

## fileHandle limitation

Local video E2E tests cannot access the filesystem via the File System Access API. `window.showOpenFilePicker()` is not available in headless Chromium and cannot be stubbed reliably. Video playback tests that depend on local file selection must use pre-seeded blob URLs or test fixtures instead.

## Transcript seeding

No IndexedDB infrastructure exists for seeding transcript cues in E2E tests. Transcript features that parse WebVTT cues at runtime cannot be pre-populated through the standard IDB seeding helpers. Tests must either inject cues via `addInitScript` or rely on the parser running against a fixture file served by the dev server.

## Onboarding dismissal

The onboarding flow reads a `localStorage` flag to determine first-visit status. Every E2E test that needs to bypass onboarding must seed `localStorage` before navigation. This is a per-test boilerplate cost that cannot be centralized into a global fixture without side effects on tests that explicitly test onboarding behavior.

## `::cue` pseudo-element

CSS custom properties applied via the `::cue` pseudo-element (used for caption/subtitle styling) cannot be asserted in headless browsers. `window.getComputedStyle()` does not resolve styles on `::cue`, and Playwright has no API for inspecting video text track rendering. Caption customization must be validated manually or via visual regression screenshots.

## PDF viewer controls

The File System Access API (`showSaveFilePicker`) used for PDF export is not available in Playwright's Chromium. Tests for PDF download/export functionality cannot verify the actual file write. Instead, tests assert that the export function is called with the correct arguments and that the UI reflects the expected state transitions.
