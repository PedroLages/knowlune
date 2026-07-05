## Security Review: E64-S09 — Service Worker Precache Optimization

**Date:** 2026-07-05
**Type:** Pre-implementation spec review (no code written)
**Phases executed:** 6/8 (Phase 4, 5, 6 skipped — no code diff, no package.json/auth/routes changes to analyze)
**Diff scope:** 0 files changed (pre-implementation review of specification document only)

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 4 vectors identified (all low severity) |
| 2 | Secrets Scan | Always | Clean — no code diff to scan |
| 3 | OWASP Top 10 | Always | 4 client-side categories checked, 0 findings |
| 7 | Configuration | CSP/config files exist | 1 advisory (CSP compatibility) |
| 8 | Config Security | Always-on checks | 1 non-story finding (pre-existing .mcp.json API key) |
| 4 | Dependencies | Skipped (no package.json change) | N/A |
| 5 | Auth & Access | Skipped (no auth files changed) | N/A |
| 6 | STRIDE | Skipped (pre-implementation, no new routes added yet) | N/A |

### Attack Surface Changes

This story adds four new attack vectors via the spec. All are low severity:

1. **Route-chunk runtime cache (`/assets/*.js`)** — New ServiceWorker `registerRoute` intercepting same-origin JS chunks. Scope is tightly bounded to `/assets/*.js` path pattern and 1-day TTL mitigates stale cache impact. No user data or API responses intercepted.

2. **Font runtime cache (`/assets/*.woff2`)** — New ServiceWorker `registerRoute` for woff2 font files. Static assets only. 30-day TTL but content-hashed URLs invalidate on redeployment.

3. **ChunkErrorBoundary component** — New error boundary that catches dynamic import() failures. Checks `error.message` against known browser strings (not user input). Re-throws non-chunk errors. Properly designed to never silently suppress errors.

4. **OfflineRouteFallback component** — New static UI component. Renders "not available offline" message. No user input, no URL parameters, no dynamic content. No XSS vector.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

**None.** No critical vulnerabilities identified in the proposed design.

#### High Priority (should fix)

**None.** No high-severity issues identified.

#### Medium (fix when possible)

**None.** No medium-severity issues identified.

#### Informational (awareness only)

- **I-01: CacheableResponsePlugin status 0 for same-origin assets** (confidence: 65)
  **File:** `src/sw.ts` (Task 4 — proposed route-chunks rule)
  **Category:** CS5 (Flawed Client-Side Integrity)
  **Autofix Class:** advisory
  **Description:** The spec proposes `CacheableResponsePlugin({ statuses: [0, 200] })` for the route-chunks runtime cache. Status `0` allows opaque responses to be cached. For same-origin `/assets/*.js` requests, opaque responses (status 0) should never occur in normal operation — they indicate a CORS failure or a network-level error. If a misconfigured proxy, CDN edge function, or middleware returned an opaque response for a same-origin JS request, the `StaleWhileRevalidate` strategy could cache that opaque response as valid JS content.
  **Exploit scenario:** An attacker with MITM position or control over an intermediary (CDN edge worker, reverse proxy) could cause a same-origin JS chunk request to return an opaque error response. The `CacheableResponsePlugin` with `status: [0, 200]` would accept it, and `StaleWhileRevalidate` would cache it. On next visit, the opaque/empty response would be served as JS, causing the route to fail silently. The existing `ChunkErrorBoundary` would catch this, but the user would see the offline fallback despite being online.
  **Mitigating factors:**
  - Content-hashed URLs mean a new deployment invalidates the cache immediately
  - 1-day `maxAgeSeconds` limits the blast radius
  - Same-origin requests are extremely unlikely to produce opaque responses in production
  - The existing `Unsplash images` and `HF models` rules (cross-origin) also use `status: [0, 200]`, which is correct for their use case
  - `StaleWhileRevalidate` serves from cache first, so the corrupted entry would only appear after a revalidation cycle
  **Recommendation:** Consider removing `0` from the statuses array for the route-chunks rule since these are strictly same-origin assets, or add an inline comment explaining why `0` is included and confirming it's intentional. Example:
  ```ts
  // Status 0 allows opaque responses for cross-origin assets. Route chunks are
  // same-origin, so status 0 is included only for consistency with other rules
  // and as a safety net for proxy misconfigurations. Content-hashed URLs and
  // 1-day TTL mitigate any impact.
  new CacheableResponsePlugin({ statuses: [0, 200] }),
  ```

- **I-02: Spec inconsistency — registerType value** (confidence: 70)
  **File:** `docs/implementation-artifacts/stories/E64-S09-service-worker-precache.md` (line ~147)
  **Category:** A05 (Security Misconfiguration)
  **Autofix Class:** manual
  **Description:** The spec's Implementation Notes show `registerType: 'prompt'` in the PWA config (line 147), but the current codebase (`vite.config.ts` line 505) uses `registerType: 'autoUpdate'`. The spec comment says "manifest unchanged from E61-S01," but `registerType` is not part of the manifest — it's a `VitePWA()` option. If `prompt` is implemented unintentionally, the SW update flow changes: users would need to manually accept updates via `PWAUpdatePrompt` instead of getting them automatically on next visit. This could lead to users running outdated SW versions for longer, which is technically a regression in security posture (stale SW means stale precache content).
  **Note:** This may be an illustrative oversight in the spec rather than an intended change, since the story's scope is limited to `globPatterns`/`globIgnores` and runtime caching rules. The spec does not list `registerType` as a change target in Tasks or Files Modified/Created. **Verify that the implementation preserves `registerType: 'autoUpdate'` (the current value).**

- **I-03: Stale cache accumulation across SW versions** (confidence: 60)
  **File:** `src/sw.ts` (Task 4 — proposed rules)
  **Category:** CS5 (Flawed Client-Side Integrity)
  **Autofix Class:** advisory
  **Description:** The `fonts` cache uses `CacheFirst` with `maxAgeSeconds: 30 * 24 * 60 * 60` (30 days) and `route-chunks` uses `StaleWhileRevalidate` with `maxAgeSeconds: 1 * 24 * 60 * 60` (1 day). The SW's `activate` event handler currently only calls `clients.claim()` without cleaning up old caches. Over multiple SW updates, old cache entries from previous SW versions could accumulate. While `maxEntries: 100` on route-chunks and `maxEntries: 50` on fonts prevents unbounded growth across versions, old caches share the same `cacheName` so entries are naturally pruned by `maxEntries` regardless of which SW version created them. No action needed — this is an advisory for awareness that the current `activate` handler does not perform cache cleanup.

### Secrets Scan

**Clean** — No code diff exists to scan (pre-implementation review). The spec does not propose any hardcoded secrets, API keys, or tokens.

### Non-Story Security Findings (Pre-existing, Not in Diff Scope)

- **`.mcp.json` contains plaintext API key** (pre-existing, not introduced by this story)
  **File:** `.mcp.json`
  **Severity:** Not formally flagged (not in diff scope), but documented for awareness
  **Description:** The `stitch` MCP server configuration includes `"X-Goog-Api-Key": "<REDACTED>"` in plaintext headers. This file is tracked by git (`git ls-files` confirms it is committed). API keys in MCP config headers are a security concern because:
  - Any contributor with repo access can read the key
  - If this key is pushed to a public remote, it is compromised
  - The file is NOT in `.gitignore`
  **Recommendation (outside this story's scope):** Move secrets to environment variables referenced as `${ENV_VAR_NAME}` in `.mcp.json`, or add `.mcp.json` to `.gitignore` and distribute a `.mcp.json.example` template instead.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No access control changes in this story |
| CS2: Client-Side Injection (XSS) | Yes | No | OfflineRouteFallback is static. ChunkErrorBoundary checks error.message against known browser strings (not user input). No dangerouslySetInnerHTML, no user-controlled href, no ref manipulation. |
| CS3: Sensitive Data in Client Storage | Yes | No | New caches (fonts, route-chunks) store only static app assets. No API keys, user data, or tokens cached. Existing BYOK key storage unchanged. |
| CS5: Client-Side Integrity | Yes | 1 advisory (I-01) | Content-hashed URLs and CacheableResponsePlugin provide integrity. Status 0 in route-chunks rule is advisory only. |
| CS7: Client-Side Security Logging | Yes | No | No new console.log of sensitive data. Proper error reporting via reportError(). |
| CS9: Client-Side Communication | No | No | No postMessage, no cross-window, no cross-origin communication introduced. |
| A05: Security Misconfiguration | Yes | 1 info (I-02) | Spec registerType inconsistency with current autoUpdate config. |

### CSP Compatibility Analysis

The existing CSP in `index.html` (lines 21-37) is fully compatible with the proposed changes:

- `worker-src 'self' blob:;` — The service worker is served from the same origin, so this directive allows registration. No change needed.
- `script-src 'self' ...` — Route chunks loaded via dynamic `import()` are same-origin scripts, allowed by `'self'`.
- `font-src 'self'` — Fonts served from same-origin are allowed.
- `connect-src 'self' ...` — The service worker's fetch handlers only intercept same-origin requests, which are covered by `'self'`.

**No CSP changes are required for this story.**

### What's Done Well

1. **Safe error boundary design** — The `ChunkErrorBoundary` spec explicitly requires re-throwing non-chunk errors to `RouteErrorBoundary`, ensuring errors are never silently suppressed. The fallback checks `navigator.onLine` and discriminates error types before deciding what to render.

2. **Content-hashed URL integrity** — By excluding large chunks from precache and relying on Vite's content-hashed URLs for runtime caching, the design naturally prevents stale/malicious content from persisting across deployments. The 1-day TTL on route chunks is well-chosen.

3. **Proper runtime rule ordering** — The spec explicitly places font and route-chunk rules AFTER the specific API rules (AI API, ABS proxy) to ensure non-cacheable API routes aren't accidentally intercepted. The navigation fallback denylist for `/api/` is preserved.

### Files Modified (Speculative — Implementation)

| File | Action | Security Relevance |
|------|--------|-------------------|
| `vite.config.ts` | Modify | Low — globPatterns/globIgnores update |
| `src/sw.ts` | Modify | Low — 2 new registerRoute rules (advisory I-01) |
| `src/app/components/ChunkErrorBoundary.tsx` | Create | Low — error boundary, no data handling |
| `src/app/components/OfflineRouteFallback.tsx` | Create | None — static UI |
| `src/app/routes.tsx` | Modify | Low — structural SuspensePage wrapper change |

---
Phases: 6/8 | Findings: 3 (all informational) | Blockers: 0 | Non-story observations: 1
