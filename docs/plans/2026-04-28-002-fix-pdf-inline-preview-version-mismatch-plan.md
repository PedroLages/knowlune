---
title: "fix: Restore PDF inline preview broken by pdfjs-dist version mismatch"
type: fix
status: done
date: 2026-04-28
---

# fix: Restore PDF inline preview broken by pdfjs-dist version mismatch

## Overview

PDF inline preview under the Materials tab (and in the full-page PDF viewer) shows only the "Unable to preview this document inline" fallback with an "Open in New Tab" button. The inline renderer (`react-pdf`'s `<Document>` component) fails because the PDF.js worker and main library versions are mismatched.

## Problem Frame

`react-pdf@10.4.1` bundles its own `pdfjs-dist@5.4.296`. The project's top-level `pdfjs-dist` was installed at `5.6.205` (via caret range `^5.4.296` in `package.json`). The worker source in `src/lib/pdfWorker.ts` imports from the top-level `pdfjs-dist`, loading a v5.6.205 worker. `react-pdf`'s `<Document>` uses the bundled v5.4.296 library API. PDF.js requires exact version parity between worker and main library — the mismatch causes `onDocumentLoadError` to fire, which sets `loadError = true` in `usePdfViewerState`, triggering the error fallback UI.

Because `react-pdf` pins its `pdfjs-dist` dependency to exactly `5.4.296`, pinning the top-level `pdfjs-dist` to the same version will cause npm to deduplicate: both resolve to a single `pdfjs-dist@5.4.296` instance, and the existing import `pdfjs-dist/build/pdf.worker.min.mjs?url` will produce a worker that matches the library version. No import path change is needed.

**Why "Open in New Tab" still works:** `openBlobPdfInNewTab` (`PdfToolbar.tsx:69-84`) fetches the blob and opens it via `window.open()` — the browser's native PDF viewer, which does not use pdfjs at all.

## Requirements Trace

- **R1.** PDF documents render inline in the PdfViewer component (both Materials tab and full-page PdfContent) without falling back to the error state
- **R2.** The PDF.js worker version matches the library version used by react-pdf and cannot silently drift out of sync
- **R3.** A regression test catches version mismatches before they reach users

## Scope Boundaries

- Fix applies to all PdfViewer instances: Materials tab collapsible sections, full-page PdfContent, and any other embedded PDF viewer
- Does NOT change PDF rendering behavior, toolbar features, or UI layout
- Does NOT change how blob URLs are created or resolved

## Context & Research

### Relevant Code and Patterns

- `src/lib/pdfWorker.ts` — Worker config; imports `pdfjs` from `react-pdf`, worker source from `pdfjs-dist`
- `src/app/components/figma/PdfViewer/PdfViewer.tsx:61-73` — Error fallback UI rendered when `state.loadError` is true
- `src/app/components/figma/PdfViewer/usePdfViewerState.ts:104-108` — `handleDocumentLoadError` sets `loadError = true`
- `src/app/components/figma/PdfViewer/PdfToolbar.tsx:69-84` — `openBlobPdfInNewTab` bypasses pdfjs entirely
- `package.json:125` — `"pdfjs-dist": "^5.4.296"` (caret range allows silent bumps)
- `package.json:135` — `"react-pdf": "^10.4.0"` (resolved to 10.4.1; bundles `pdfjs-dist@5.4.296`)
- `src/lib/fileSystem.ts` — Also imports `pdfjs-dist` directly (dynamic import + worker URL via `new URL()`), would also break if top-level version drifts from react-pdf's bundled version

### Institutional Learnings

- `docs/solutions/e120-pwa-polish-lessons.md` — Documents the pdfjs-dist/react-pdf type entanglement and that react-pdf bundles extra pdfjs-dist properties (`pagesMapper`, `extractPages`, `getRawData`)
- Commit `6585c501` — Prior fix for the same symptom (inline preview broken), but that fix addressed a CSP/worker URL resolution issue, not version mismatch
- Commit `277e4d8c` — Fixed type-level version mismatch (compile-time only, not runtime worker resolution)
- Commit `477e8535` — `package-lock.json` regeneration that silently bumped pdfjs-dist from 5.4.296 to 5.6.205

### External References

- PDF.js versioning policy: worker and main library must be exact version matches
- react-pdf v10.x uses pdfjs-dist 5.x internally

## Key Technical Decisions

- **Pin, don't repath**: Pin top-level `pdfjs-dist` to exactly `5.4.296` to match react-pdf's bundled version. No import path change is needed — npm deduplication ensures the existing `pdfjs-dist/build/pdf.worker.min.mjs?url` import resolves to the same version. This is simpler and more robust than importing from react-pdf's nested `node_modules`, which would break if npm hoists the dependency.
- **Exact pin (no caret)**: Remove the `^` prefix to prevent future `npm install` or lock-file regenerations from silently bumping to an incompatible version. This protects both `pdfWorker.ts` and `fileSystem.ts`, which both import from the top-level `pdfjs-dist`.

## Open Questions

### Deferred to Implementation

- Whether the Vitest/jsdom environment can load `react-pdf`'s `<Document>` component for the smoke test, since PDF.js requires a real Worker thread. If jsdom cannot support it, the smoke test should be scoped to verifying the worker URL resolves correctly, or use a mock.

## Implementation Units

- [x] **Unit 1: Pin pdfjs-dist to exact 5.4.296 and reinstall**

**Goal:** Align the top-level pdfjs-dist version with react-pdf's bundled version (5.4.296) so the PDF.js worker and library match. The existing import in `pdfWorker.ts` will automatically resolve to the correct version after npm deduplication.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `package.json`

**Approach:**
- Change `"pdfjs-dist": "^5.4.296"` to `"pdfjs-dist": "5.4.296"` (remove caret prefix)
- Run `npm install` to deduplicate — npm will hoist 5.4.296 to the top level and remove the nested `node_modules/react-pdf/node_modules/pdfjs-dist/` since both packages now agree on the version
- Verify the installed version: `node_modules/pdfjs-dist/package.json` should show `5.4.296`
- No changes to `src/lib/pdfWorker.ts` — the existing import `pdfjs-dist/build/pdf.worker.min.mjs?url` is correct and will resolve to 5.4.296

**Patterns to follow:**
- Exact version pinning without prefix is the standard npm convention for preventing unwanted upgrades
- Other dependencies in this project already use exact pinning where version stability matters

**Test scenarios:**
- Test expectation: none — pure config change with mechanical verification

**Verification:**
- `npm install` completes without errors
- `node_modules/pdfjs-dist/package.json` version field is `5.4.296`
- `npm run dev` — open any lesson with companion PDFs, expand a PDF section under Materials tab — the PDF renders inline (not the error fallback)
- Navigate to a PDF-type lesson in the full-page viewer — pages render inline
- `npm run build` succeeds

---

- [x] **Unit 2: Verify fix in production build**

**Goal:** Confirm the fix works after Vite bundling, not just in dev mode.

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- No code changes (verification only)

**Approach:**
- Run `npm run build` and inspect the output to confirm the worker file is included in the bundle
- Serve the production build locally (`npx vite preview`) and verify PDF inline rendering works
- This ensures Vite's `?url` asset import for the worker resolves correctly in production mode

**Test scenarios:**
- Verify the production bundle includes `pdf.worker.min.mjs` as a separate asset (not inlined)
- Verify PDF inline preview works when served from the production build

**Verification:**
- `npm run build` succeeds
- Production preview shows inline PDF rendering, not the error fallback

---

- [x] **Unit 3: Add PdfViewer smoke test for inline rendering**

**Goal:** Catch PDF version mismatch regressions (and other PdfViewer breakages) in the test suite before they reach users.

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/components/figma/PdfViewer/__tests__/PdfViewer.smoke.test.tsx`

**Approach:**
- Create a minimal valid PDF as a blob (generated programmatically — a one-page PDF is ~200 bytes of base64)
- Render `<PdfViewer src={blobUrl} title="Test" />` in a test
- Assert that the error fallback UI (`"Unable to preview this document inline"`) is NOT rendered
- Assert that the PDF viewer container (`data-testid="pdf-viewer"`) IS rendered
- Use `waitFor` since PDF parsing is async
- If jsdom cannot support the full `react-pdf` `<Document>` component (due to Worker API limitations), scope the test to verify that `pdfjs.GlobalWorkerOptions.workerSrc` is set to a valid URL and that the import resolves without errors. The full rendering test can be deferred to an E2E test.

**Patterns to follow:**
- Existing component tests in the project use Vitest + React Testing Library
- PDF blob creation: use a minimal valid PDF base64 string (avoids dependency on external PDF files or file handles)

**Test scenarios:**
- Happy path: A valid PDF blob URL renders the PdfViewer container without the error fallback (or, if jsdom-limited: the worker URL is set and module imports without error)
- Edge case: An invalid/corrupt PDF blob URL shows the error fallback UI with "Open in New Tab" button

**Verification:**
- `npm run test:unit` passes with the new smoke test
- Reverting the version pin (changing back to `^5.4.296` and bumping) causes the smoke test to fail

## System-Wide Impact

- **Interaction graph:** `pdfWorker.ts` is imported by `PdfPageRenderer`, `PdfScrollView`, and `PdfThumbnailSidebar` — all three use `pdfjs` from `react-pdf` and rely on the global worker config. The fix is transparent to all consumers. `src/lib/fileSystem.ts` also imports `pdfjs-dist` directly and will benefit from the version alignment.
- **Unchanged invariants:** No import paths change. No behavior changes. All PdfViewer features (zoom, rotate, search, thumbnails, outline, dark mode, fullscreen) continue to work. The "Open in New Tab" fallback is preserved for actual load errors (corrupt PDFs, permission denials, etc.).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| npm may not deduplicate if another dependency constrains pdfjs-dist to a different version | Check `npm ls pdfjs-dist` after install to verify only one version exists; if not, use `overrides` in package.json to force 5.4.296 |
| react-pdf major version upgrade could change its bundled pdfjs-dist version | The pinned top-level version prevents accidental upgrades; intentional upgrades to react-pdf must also update the pdfjs-dist pin |
| PdfViewer smoke test may not work in jsdom due to Worker API limitations | Fall back to module-level verification of worker URL resolution; full rendering coverage deferred to E2E |

## Sources & References

- **Related commits:** `6585c501` (prior PDF preview fix), `277e4d8c` (type-level mismatch fix), `477e8535` (lock file regeneration)
- **Related solution:** `docs/solutions/e120-pwa-polish-lessons.md`
- Related code: `src/app/components/figma/PdfViewer/PdfViewer.tsx`, `src/app/components/figma/PdfViewer/usePdfViewerState.ts`, `src/lib/pdfWorker.ts`, `src/lib/fileSystem.ts`
