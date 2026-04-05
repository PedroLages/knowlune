## External Code Review: E88-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-05
**Story**: E88-S01

### Findings

#### Blockers

- **[src/services/OpdsService.ts:52-53](confidence: 92)**: **Credentials are sent in plaintext over HTTP.** The `validateCatalog` and `fetchOpdsFeed` functions accept basic auth credentials and pass them via `Authorization: Basic` headers, but there is **no protocol check**. If a user enters `http://` instead of `https://`, credentials traverse the network in cleartext. Fix: Add a protocol guard — if `username`/`password` are provided and the URL uses `http:`, either reject with an actionable error (e.g., "Credentials require HTTPS") or warn the user before proceeding.

#### High Priority

- **[src/services/OpdsService.ts:38](confidence: 88)**: **DOMParser creates execution risk for `text/html` responses.** The service fetches remote XML feeds and parses them via `new DOMParser().parseFromString(text, 'text/html')`. If the remote server returns `text/html` instead of Atom/XML (e.g., a malicious or misconfigured OPDS endpoint serving an HTML page), the parser will build a live DOM in the `text/html` mode, potentially triggering script execution or unexpected resource loads via `<img>`, `<link>`, or `<script>` tags embedded in the response. Fix: (1) Check `response.headers.get('content-type')` and reject non-XML content types, or (2) always parse with `'application/xml'` and reject `parsererror` results — this avoids HTML-mode parsing entirely.

#### Medium

- **[src/app/components/library/OpdsCatalogSettings.tsx:232-246](confidence: 82)**: **Save is allowed without a successful test connection.** The `handleSave` function validates `name` and `url` are non-empty but does not require `testResult?.ok === true`. Users can save catalogs that are unreachable or return invalid XML, leading to confusing failures when browsing later. Fix: Either disable the Save button until `testResult?.ok === true`, or at minimum show a warning/confirmation if saving an untested catalog.

- **[src/app/components/library/OpdsCatalogSettings.tsx:249](confidence: 72)**: **`removeCatalog` errors are silently swallowed.** The `handleConfirmDelete` callback calls `await removeCatalog(deleteTarget.id)` with no try/catch. If the Dexie delete fails (e.g., IndexedDB quota error or corruption), the delete confirmation dialog closes (`setDeleteTarget(null)`) and the toast shows success, but the catalog persists. Fix: Wrap in try/catch; on failure, show an error toast and keep `deleteTarget` set so the dialog remains open.

- **[src/services/OpdsService.ts:20](confidence: 70)**: **`fetchOpdsFeed` is exported but has no CORS error recovery path.** While `validateCatalog` distinguishes `TypeError` (network/CORS) from other errors with actionable messages, `fetchOpdsFeed` wraps the entire fetch in a single try/catch and returns a generic error. Story E88-S02 will call `fetchOpdsFeed` from the browsing UI, where users will see unhelpful error messages for CORS failures. Fix: Apply the same `TypeError`-checking pattern from `validateCatalog` to `fetchOpdsFeed`.

#### Nits

- **[src/app/components/library/OpdsCatalogSettings.tsx:197](confidence: 60)**: **`handleTestConnection` and `handleSave` are not guarded against component unmount during async work.** If the dialog closes while `validateCatalog` is in-flight, `setTestResult`/`setIsTesting`/`setIsSaving` will fire on an unmounted component (React 19 still logs a warning for this in dev). A standard `ignore` flag pattern (used elsewhere in this codebase) would prevent it.

---
Issues found: 6 | Blockers: 1 | High: 1 | Medium: 3 | Nits: 1
