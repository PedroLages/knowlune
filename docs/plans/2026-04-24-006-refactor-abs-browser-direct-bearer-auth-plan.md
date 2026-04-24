---
title: Browser-direct ABS calls with Bearer auth (remove Express proxy)
type: refactor
status: active
date: 2026-04-24
---

# Browser-direct ABS calls with Bearer auth (remove Express proxy)

## Overview

Knowlune's Audiobookshelf (ABS) integration currently routes every ABS request through an Express proxy (`/api/abs/proxy/*`) that was deployed alongside the app on Unraid. After the cutover to Cloudflare Pages (static hosting), the proxy no longer exists at the app's origin — ABS features are broken in production (observed 405 errors when testing connection).

This plan removes the proxy dependency entirely. ABS calls go **browser-direct** to the user's ABS server using `Authorization: Bearer <token>` for REST calls and `?token=<token>` query params for `<img>`/`<audio>` tags. This is the same pattern Jellyfin Vue and the official ABS mobile app use.

**Constraint we accept:** Users must expose their ABS over HTTPS (Tailscale Funnel, Cloudflare Tunnel, or reverse proxy). Browsers block HTTPS→HTTP mixed content. Research shows this aligns with how ABS users already consume the service — ~80% already have remote access set up because audiobook listening is a mobile/commute activity, not an at-desk one.

## Problem Frame

**Why now:** The cloud cutover broke ABS integration. The Express proxy (`server/index.ts` lines 160–426) does not run on Cloudflare Pages. Users added a server in settings and saw `Server error (405). Try again later.` because the proxy path resolves to Knowlune's own static host, which has no `/api/abs/*` route.

**Why browser-direct (not a new cloud proxy):**
- A cloud-hosted proxy can't reach LAN ABS servers (most users' setup) — the proxy would run in Cloudflare's cloud, blind to `192.168.x.x`.
- User API tokens would transit your infrastructure — avoidable security/privacy concern.
- Open-proxy risk: arbitrary user-provided target URLs in a cloud Worker violate Cloudflare ToS.
- ABS natively supports Bearer token auth and CORS allowlisting — it's designed for browser-direct calls.

**Why accept the HTTPS filter:**
- Research (see user-research-2026-04-24): ABS users overwhelmingly listen on mobile during commute/walking. Browser-LAN-only serves ~15% of the audience, and the least-engaged slice (at-desk listeners).
- Users who want Knowlune to work from their phone outside home already need HTTPS for their ABS.
- Tailscale Funnel gives free HTTPS in 3 minutes without a domain — documented path for non-technical users.

## Requirements Trace

- **R1.** ABS features work from `https://knowlune.pedrolages.net` (production) without an Express proxy.
- **R2.** All existing ABS functionality preserved: connection test, library browse, item details, playback sessions, audio streaming, cover images, progress sync (REST + WebSocket), bookmarks.
- **R3.** Settings UI rejects plain `http://` URLs with a user-facing message pointing to the "How do I expose my ABS over HTTPS?" help content.
- **R4.** Bearer token auth is used for headered fetches; `?token=<apiKey>` query param is used only where headers are impossible (`<img>`, `<audio>`).
- **R5.** User-facing CORS failure surfaces a specific error telling users to add `https://knowlune.pedrolages.net` to their ABS server's **Settings → Security → Allowed Origins**.
- **R6.** Local dev continues to work unchanged (Express proxy can remain for `npm run dev` targeting a LAN ABS, or be removed — see Deferred decision).
- **R7.** Existing unit/E2E tests pass (URL assertions updated to match direct calls).

## Scope Boundaries

- **Not in scope:** Knowlune Cloud tunnel service (Nabu Casa-style paid subscription). Tracked as future product direction.
- **Not in scope:** Docker self-hosted distribution of Knowlune. Future option for LAN-only users.
- **Not in scope:** Native mobile apps. Future.
- **Not in scope:** Chrome Local Network Access (LNA) support with `targetAddressSpace: "private"` + nginx sidecar. Interesting, but Chrome-only and requires ABS-side header injection. Revisit after Firefox/Safari add LNA support.
- **Not in scope:** Migrating existing users' stored ABS server URLs from `http://` to `https://`. Users will see the validation error on their existing server and fix it themselves.
- **Not in scope:** Full deletion of the Express server (`server/index.ts`). Every other Express route has already been migrated to a Supabase Edge Function and is unused by the frontend; removing the whole server is a follow-up cleanup, not this plan's concern.

### Deferred to Separate Tasks

- **ABS `allowedOrigins` onboarding UX polish:** A richer in-app guide (screenshots, "copy origin" button) for users to configure their ABS server. First pass here is plain text + a docs link.
- **Tailscale Funnel setup guide:** Dedicated docs page at `docs/user-guides/abs-https-setup.md`. Minimal stub created in this plan; full guide deferred.
- **Full Express server retirement:** A separate cleanup PR to delete `server/index.ts` and its unused dependencies (express, rate-limit) after the ABS removal is stable. All other routes (AI, Ollama, models, calendar, cover-proxy, Audible) are already unused in production — frontend calls Supabase Edge Functions via `apiUrl()`.

## Context & Research

### Relevant Code and Patterns

- `src/services/AudiobookshelfService.ts` — Single service file, ~654 lines. 4 proxy call sites (lines 68, 261, 283, 295) and direct WebSocket code (lines 405–640, already bypasses proxy). Pattern to follow: existing `connectSocket()` builds direct `ws://` or `wss://` URLs from the user's ABS URL — generalise that approach to REST.
- `src/lib/credentials/absApiKeyResolver.ts` — Credential resolution hook (`getAbsApiKey`, `useAbsApiKey`, `invalidateAbsApiKey`). No changes needed; call sites already use this.
- `src/stores/useAudiobookshelfStore.ts` — Server metadata store. No changes needed.
- `src/app/components/library/AudiobookshelfSettings.tsx` (362 lines) — Settings form. One meaningful change: add HTTPS validation before calling `testConnection()`.
- `src/services/__tests__/AudiobookshelfService.test.ts` — 9 assertions check proxy URL construction; all will flip to assert direct ABS URLs.
- `tests/e2e/audiobookshelf/*.spec.ts` — 10 E2E specs; `connection.spec.ts` explicitly tests CORS error flow — update to new error messaging.

### Institutional Learnings

- `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/project_abs_cors_proxy.md` — Existing memory note claims "ABS API calls need Express backend proxy (Cloudflare strips CORS headers)." This is **outdated after this refactor** — update the memory after merge. The claim is historically accurate (Cloudflare Pages can't run the proxy) but the conclusion (we need the proxy) was wrong — the right answer is to remove the proxy and call ABS directly.
- No solutions doc currently explains why the proxy existed. Create `docs/solutions/integration-issues/2026-04-24-abs-browser-direct-bearer-auth.md` to document the new architecture.

### External References

- ABS API Bearer token support: [api.audiobookshelf.org](https://api.audiobookshelf.org/) — confirms `Authorization: Bearer <token>` is first-class for all REST endpoints, and `?token=` query param works for GET endpoints that return binary.
- ABS `allowedOrigins` setting: [advplyr/audiobookshelf PR #4557](https://github.com/advplyr/audiobookshelf/pull/4557) — server-side allowlist for cross-origin requests, added ~v2.26.
- Jellyfin Vue pattern (analogous): [jellyfin.org/docs/general/clients/jellyfin-vue](https://jellyfin.org/docs/general/clients/jellyfin-vue/) — static SPA connects to user-entered server URL, browser-direct.
- Tailscale Funnel (free HTTPS without domain): [tailscale.com/docs/features/tailscale-funnel](https://tailscale.com/docs/features/tailscale-funnel).

## Key Technical Decisions

- **Bearer token in `Authorization` header for all REST calls.** Rationale: ABS supports it natively; avoids token in URL (logs, referrer leaks).
- **`?token=<apiKey>` query param only for `<img>` and `<audio>` tags.** Rationale: HTML elements can't set headers; ABS supports this for GET endpoints. Accept the trade-off (token appears in browser network panel URLs) — it's the same as what the proxy already did.
- **Keep WebSocket/Socket.IO code as-is.** `connectSocket()` already speaks Engine.IO directly to ABS and doesn't use the proxy. No change needed.
- **Reject `http://` URLs in settings UI.** Rationale: A plain HTTP URL is guaranteed to fail from an HTTPS origin (mixed content), better to fail fast with a clear message than confuse users with a CORS/network error 2 seconds later.
- **Distinguish CORS failure from network failure in error messages.** When `fetch()` fails with `TypeError: Failed to fetch` and the URL is well-formed HTTPS, the most likely cause is CORS (not network). Surface: *"Your ABS server didn't accept requests from this app. Add `https://knowlune.pedrolages.net` to your ABS server's Allowed Origins setting."*
- **Express proxy routes kept behind a dev flag.** Rationale: `npm run dev` against a LAN ABS may still benefit from the proxy in some dev scenarios. Flag off by default; delete entirely in a follow-up task after production stability is proven.
- **URL normalization unchanged.** Existing `baseUrl.replace(/\/+$/, '')` trailing-slash strip remains — just applied to direct URLs instead of proxy URLs.
- **No service worker interception.** Tempted to use a service worker as an "in-browser proxy" to inject headers, but this doesn't work cross-origin and adds complexity. Skip.

## Open Questions

### Resolved During Planning

- **Do we keep the Express ABS routes for dev?** Yes, behind a flag for now, delete in follow-up. Minimizes blast radius of this change.
- **Do we migrate stored server URLs?** No. User-facing validation on next use is sufficient — the dataset is small and personal (each user has 1–2 servers max).
- **What error message for CORS failure?** See above — specific guidance that names the ABS setting to change.
- **Can covers/audio use POST+header?** No — HTML `<img>` and `<audio>` tags only issue GETs and can't set custom headers. Query param token is the only option.

### Deferred to Implementation

- **Exact CORS error detection heuristic:** The implementer will need to probe `fetch()` error shape (message + status) to distinguish CORS from DNS/refused/timeout. Concrete detection depends on browser behavior — finalize during implementation.
- **Does the Socket.IO code need CORS configuration?** `connectSocket()` uses `new WebSocket()` which is not bound by CORS the same way `fetch()` is. May still need origin-allowlist on ABS side. Verify during testing.
- **Should `getCoverUrl()` URL-encode the API key?** Existing code uses `encodeURIComponent()` on `itemId` but not on `apiKey`. Token strings are typically URL-safe, but confirm before shipping.

## Implementation Units

- [ ] **Unit 1: Add HTTPS validation to ABS settings form**

**Goal:** Block users from saving `http://` ABS URLs from a cloud HTTPS origin. Show actionable error text.

**Requirements:** R3.

**Dependencies:** None.

**Files:**
- Modify: `src/app/components/library/AudiobookshelfSettings.tsx`
- Modify: `src/app/components/library/__tests__/AudiobookshelfSettings.e97-s05.test.tsx` (add test)

**Approach:**
- In the `AudiobookshelfServerForm` component's submit/test-connection handler, validate that `url` starts with `https://` when the app itself is served from `https://` (use `window.location.protocol === 'https:'` as the gate).
- When blocking, surface error: *"Knowlune needs your Audiobookshelf server to be HTTPS. See [How to expose ABS over HTTPS](link) — Tailscale Funnel is the easiest option."*
- In dev (`http://localhost:5173`), allow `http://` URLs — validation only triggers from an HTTPS origin.
- Normalize trailing slash in submit handler before saving, as a hygiene measure.

**Patterns to follow:**
- Existing error-display pattern in this form (red alert at bottom, before Save button).
- Existing `isInsecureUrl()` helper at `src/services/AudiobookshelfService.ts:646` — extend or wrap.

**Test scenarios:**
- Happy path: User enters `https://abs.example.com:13378` → passes validation.
- Error path: User on production enters `http://192.168.2.200:13378` → blocked, error shown, Save disabled.
- Edge case: Dev context (`http://localhost:5173`) with `http://192.168.x.x` URL → allowed (no block).
- Edge case: User enters URL with trailing slash `https://abs.example.com:13378/` → saved normalized (no trailing slash).
- Edge case: User enters invalid URL `not a url` → existing error flow handles this (no regression).

**Verification:**
- Settings form rejects http:// URLs from an HTTPS origin with a clear error.
- Validation test case passes.
- Existing tests still pass.

- [ ] **Unit 2: Rewrite `absApiFetch()` to call ABS directly with Bearer auth**

**Goal:** All REST API calls (libraries, items, progress, sessions, search, collections, series) go directly to the user's ABS server with `Authorization: Bearer <apiKey>`.

**Requirements:** R1, R2, R4.

**Dependencies:** None (can ship before settings validation).

**Files:**
- Modify: `src/services/AudiobookshelfService.ts` (lines 60–110 approx, the `absApiFetch` helper)
- Modify: `src/services/__tests__/AudiobookshelfService.test.ts` (flip URL assertions)

**Approach:**
- `absApiFetch(baseUrl, apiKey, path, options?)` currently calls `fetch('/api/abs/proxy' + path, { headers: { 'X-ABS-URL': baseUrl, 'X-ABS-Token': apiKey } })`.
- Change to: `fetch(normalizedBaseUrl + path, { headers: { Authorization: \`Bearer ${apiKey}\`, 'Content-Type': 'application/json' } })`.
- Drop `X-ABS-URL` and `X-ABS-Token` headers — they're no longer needed (no proxy to read them).
- Preserve `AbortController` with 10s timeout.
- Preserve `AbsResult<T>` discriminated union return shape — unchanged.
- Map `TypeError: Failed to fetch` errors to a new error code `'cors-or-network'` with user-friendly message about allowedOrigins.

**Patterns to follow:**
- Existing `testConnection()` at `src/services/AudiobookshelfService.ts:119` — already uses direct-ish pattern (POST to `/api/authorize`), mirror its error handling.
- Existing `connectSocket()` at line 405 — constructs direct URLs to the ABS server. Same approach for REST.

**Test scenarios:**
- Happy path: `fetchLibraries('https://abs.example.com', 'token123')` → fetches `https://abs.example.com/api/libraries` with `Authorization: Bearer token123` header.
- Happy path: URL normalization — `fetchLibraries('https://abs.example.com/', ...)` strips trailing slash.
- Error path: 401 response → returns `{ok: false, error: 'Authentication failed. Check your API key.', status: 401}`.
- Error path: 403 response → returns `{ok: false, error: 'Access denied. Your API key may lack permissions.', status: 403}`.
- Error path: `fetch()` rejects with `TypeError: Failed to fetch` → returns `{ok: false, error: <CORS guidance message>, status: undefined}`.
- Error path: Timeout (AbortError) → returns timeout error.
- Integration: Bearer header is sent on every request; no `X-ABS-URL` or `X-ABS-Token` headers present.

**Verification:**
- Unit tests pass with new URL shapes.
- A manual fetch against a real ABS in dev returns data (libraries list visible).

- [ ] **Unit 3: Update `getCoverUrl()` and `getStreamUrlFromSession()` to return direct URLs with `?token=` query param**

**Goal:** `<img>` and `<audio>` tags load covers and audio directly from the user's ABS server, no proxy.

**Requirements:** R1, R2, R4.

**Dependencies:** Unit 2 (shares URL normalization helper; ordering convenience, not strict).

**Files:**
- Modify: `src/services/AudiobookshelfService.ts` (lines 250–296 — three URL builder functions)
- Modify: `src/services/__tests__/AudiobookshelfService.test.ts` (URL assertions)

**Approach:**
- `getCoverUrl(baseUrl, itemId, apiKey?)` currently returns `/api/abs/proxy/api/items/<id>/cover?_absUrl=...&_absToken=...`. Change to `<baseUrl>/api/items/<id>/cover?token=<apiKey>` (URL-encode `apiKey`).
- `getStreamUrlFromSession(baseUrl, apiKey, contentUrl)` currently returns `/api/abs/proxy<contentUrl>?token=...&_absUrl=...&_absToken=...`. Change to `<baseUrl><contentUrl>?token=<apiKey>`. Preserve existing `?token=` contract (ABS uses it for stream auth).
- `getStreamUrl(baseUrl, itemId, apiKey)` (deprecated legacy) — update for consistency, flag for removal in a follow-up.
- Handle `apiKey` URL-encoding via `encodeURIComponent()`.
- If `apiKey` is undefined (cover without auth — ABS can expose public covers), skip the token param.

**Patterns to follow:**
- `URLSearchParams` usage in existing `fetchLibraryItems` for pagination params.

**Test scenarios:**
- Happy path: `getCoverUrl('https://abs.example.com', 'item-abc', 'tok')` → `https://abs.example.com/api/items/item-abc/cover?token=tok`.
- Happy path: `getCoverUrl('https://abs.example.com/', 'item-abc', 'tok')` → trailing slash stripped.
- Happy path: `getStreamUrlFromSession('https://abs.example.com', 'tok', '/s/item/abc/book.m4b')` → `https://abs.example.com/s/item/abc/book.m4b?token=tok`.
- Edge case: `getCoverUrl(url, id)` without apiKey → URL without `token` param.
- Edge case: itemId with URL-unsafe chars is properly encoded.
- Edge case: apiKey with URL-unsafe chars is properly encoded.

**Verification:**
- Cover images load in `SeriesCard`, `CollectionCard`, `CollectionDetail` in manual dev testing against a real ABS.
- Audio playback works via `useAudioPlayer` against a real ABS.

- [ ] **Unit 4: Delete Express ABS proxy routes outright**

**Goal:** Remove dead `/api/abs/ping` and `/api/abs/proxy/*` routes from `server/index.ts` and drop the now-unused helpers (`absApiRateLimit`, `absCoverRateLimit`, `coverCache`, `ABS_TIMEOUT_MS`, `ABS_STREAM_TIMEOUT_MS`).

**Requirements:** R6.

**Dependencies:** Units 2 and 3 (frontend must not call these routes first).

**Rationale:** Audit confirmed the Express server is not deployed in production — Cloudflare Pages is static-only, no `npm run start`/`npm run server` script exists, and every other Express route (ai-generate, ai-stream, ai-ollama, models, calendar, cover-proxy) has already been migrated to Supabase Edge Functions that the frontend calls via `src/lib/apiBaseUrl.ts` → `apiUrl()`. The ABS routes were the last frontend-referenced routes; once Units 2–3 land, they are unreachable code.

**Files:**
- Modify: `server/index.ts` — delete lines ~160–247 (rate limiters, cover cache, `/api/abs/ping` handler) and lines ~249–426 (`/api/abs/proxy/*` handler).
- Modify: `server/__tests__/*.test.ts` — remove any tests that exercise the deleted routes.

**Approach:**
- Delete the two route registrations and all supporting code that becomes unused (cover cache, ABS-specific rate limiters, ABS timeout constants).
- Preserve `isAllowedOllamaUrl()` — still used by Ollama routes.
- Leave the rest of `server/index.ts` untouched; full server retirement is a separate cleanup task.

**Patterns to follow:**
- Keep deletions surgical — no refactoring of other routes in the same PR.

**Test scenarios:**
- Test expectation: none for new behavior (deletion). Existing ABS-route tests are deleted alongside the routes.

**Verification:**
- `grep "api/abs" server/` returns no matches.
- Frontend E2E tests pass (they already don't hit the proxy post-Unit 2).
- `npm run test:unit` passes (no tests reference deleted routes).

- [ ] **Unit 5: Update E2E tests for new error messaging and direct URLs**

**Goal:** Existing E2E tests that inspect proxy URLs or CORS error text are updated to match the new behavior.

**Requirements:** R7.

**Dependencies:** Units 1–3.

**Files:**
- Modify: `tests/e2e/audiobookshelf/connection.spec.ts` (CORS error test — update expected message)
- Modify: `tests/e2e/audiobookshelf/streaming.spec.ts` (stream URL assertions if present)
- Modify: any other spec that mocks `/api/abs/proxy/*` routes (replace with direct ABS URL mocks)

**Approach:**
- Grep the E2E suite for `/api/abs/proxy` and `X-ABS-URL` — update each mock/intercept to the direct ABS URL shape.
- Update CORS error test to expect the new user-facing message about allowedOrigins.
- Add one new test: HTTPS validation in the settings form (user enters `http://` → error shown, Save blocked).

**Patterns to follow:**
- Existing `page.route()` patterns in `tests/e2e/audiobookshelf/*.spec.ts`.

**Test scenarios:**
- E2E: Add server with `http://` URL (in a page mocked to be HTTPS) → validation error shown, Save disabled.
- E2E: Add server with valid HTTPS URL and valid API key → connection test succeeds.
- E2E: Mock 401 response → error toast with "Authentication failed..."
- E2E: Mock CORS failure (fetch TypeError) → error toast with allowedOrigins guidance.
- E2E: Stream playback works end-to-end with direct URLs.

**Verification:**
- `npm run test:e2e -- audiobookshelf/` passes.
- All 10 ABS E2E specs green.

- [ ] **Unit 6: Document the architecture change and update outdated memory**

**Goal:** Future developers (and future-you) understand why the proxy was removed. Memory note updated.

**Requirements:** R1 (non-code, part of the shipping surface).

**Dependencies:** Units 1–5 (document what shipped).

**Files:**
- Create: `docs/solutions/integration-issues/2026-04-24-abs-browser-direct-bearer-auth.md`
- Create: `docs/user-guides/abs-https-setup.md` (stub — full content deferred)
- Modify: `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/project_abs_cors_proxy.md` — update to reflect new reality

**Approach:**
- Solutions doc YAML frontmatter: `module: audiobookshelf`, `tags: [cors, bearer-auth, architecture]`, `problem_type: integration`. Body: why the proxy existed, why it was removed, how Bearer auth works, how covers/audio use query-param tokens, CORS requirements on the ABS side, how to configure `allowedOrigins`.
- User guide stub: title "Expose your ABS server over HTTPS", sections for Tailscale Funnel (recommended), Cloudflare Tunnel, reverse proxy. Rich content deferred to a follow-up; stub must name the three options so the settings-UI link target exists.
- Memory update: replace the old claim with the new architecture ("ABS calls go browser-direct with Bearer auth; user's ABS must be HTTPS and must allowlist the app origin").

**Patterns to follow:**
- Existing solutions docs in `docs/solutions/integration-issues/` — YAML frontmatter shape.
- Existing memory note format in `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/`.

**Test scenarios:**
- Test expectation: none — documentation unit, no behavioral change.

**Verification:**
- Solutions doc exists with frontmatter.
- User guide stub exists and is linked from `AudiobookshelfSettings.tsx` error message.
- Memory note reflects current architecture.

## System-Wide Impact

- **Interaction graph:** All ABS consumers (`useAudiobookshelfSync`, `useAudiobookshelfSocket`, `useAudioPlayer`, `SeriesCard`, `CollectionCard`, `CollectionDetail`) transparently get direct URLs via the same service API. No consumer-side changes needed.
- **Error propagation:** New CORS-specific error path surfaces through the existing `AbsResult<T>` channel. Error toast consumers already handle the `error` string — new message is just more specific.
- **State lifecycle risks:** None. Credentials vault flow unchanged. Server status transitions unchanged.
- **API surface parity:** Service function signatures unchanged (`fetchLibraries`, `getCoverUrl`, etc.). Callers don't need updates.
- **Integration coverage:** E2E tests already cover the full flow end-to-end; updates in Unit 5 verify the new URL shape works across playback, cover loading, progress sync.
- **Unchanged invariants:** Vault-based credential storage is unchanged. Sync engine's `syncableWrite` contract is unchanged. WebSocket/Socket.IO progress updates are unchanged (they already bypass the proxy). Dexie schema unchanged. Supabase Edge Functions unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| User's ABS server lacks `allowedOrigins` setting (older ABS versions) → CORS failure with no recovery path | Settings UI error message explicitly tells user to upgrade ABS to v2.26+ and add the app origin to Allowed Origins. Solutions doc documents required ABS version. |
| `?token=<apiKey>` in URL appears in browser devtools network panel → users may screenshot and leak | Existing proxy had the same issue (query param auth for covers/audio). No new exposure. Document in user guide. |
| Users on existing deployments have `http://` URLs stored → errors on next connection test | Acceptable. Error message guides them to fix. Small user base (personal app). |
| Express proxy flag-gated route still has a latent code path that could leak in prod | Flag defaults to off. Startup log makes state visible. Delete entirely in follow-up task once stable. |
| ABS server behind Cloudflare Tunnel may not pass through `Authorization` header correctly (known ABS mobile app issue) | If encountered, document workaround: use token query param for all GETs (already fallback behavior for images/audio). Low-probability on REST endpoints since Tunnel doesn't strip standard headers. |
| Breaking change for local dev: someone running dev against a LAN ABS without proxy will hit CORS | Mitigated by `DEV_ABS_PROXY=1` flag (Unit 4). Documented in `.env.example`. |

## Documentation / Operational Notes

- **Changelog / release note:** "ABS integration now connects directly from the browser. Your ABS server must be exposed over HTTPS and must list `https://knowlune.pedrolages.net` in Settings → Security → Allowed Origins. See [setup guide]."
- **Rollout:** Single deploy. No feature flag gating at the app level (settings validation is the gate).
- **Monitoring:** Watch for "CORS-or-network" error spikes in error telemetry (if wired). An expected baseline will appear from users with misconfigured ABS.
- **Rollback:** Revert the PR. Express proxy routes still exist in code (just flag-gated), so rolling back is a clean code revert + redeploy.

## Sources & References

- Research (this session): ABS user access pattern research, Jellyfin/Plex/Emby comparison, HTTPS/mixed-content browser rules.
- Related code: `src/services/AudiobookshelfService.ts`, `server/index.ts` lines 160–426, `src/app/components/library/AudiobookshelfSettings.tsx`.
- Related memory: `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/project_abs_cors_proxy.md` (outdated — Unit 6 updates).
- Existing solutions docs: `docs/solutions/integration-issues/` (pattern to follow).
- External: [Audiobookshelf API](https://api.audiobookshelf.org/), [ABS allowedOrigins PR #4557](https://github.com/advplyr/audiobookshelf/pull/4557), [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel).
