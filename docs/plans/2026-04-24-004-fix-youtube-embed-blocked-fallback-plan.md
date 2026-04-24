---
title: "fix: Detect and surface non-embeddable YouTube videos"
type: fix
status: active
date: 2026-04-24
---

# fix: Detect and surface non-embeddable YouTube videos

## Overview

When a user imports a YouTube URL whose owner has disabled embedding on other sites, Knowlune currently renders YouTube's raw error page inside the iframe ("This content is blocked. Contact the site owner to fix the issue."). The fallback UI in [src/app/components/youtube/YouTubePlayer.tsx](src/app/components/youtube/YouTubePlayer.tsx#L93-L122) never fires because YouTube returns **HTTP 200 with an error page body** — `iframe.onLoad` succeeds, `onError` never runs, and the 10s timeout also does not fire because `setIsReady(true)` is called on load.

This plan adds (1) pre-flight embeddability detection at import time so non-embeddable videos are surfaced in the wizard before saving, (2) a runtime fallback that shows Knowlune's friendly "Watch on YouTube" CTA when a video is known non-embeddable, and (3) minor hardening of the iframe src to use `youtube-nocookie.com` where compatible.

## Problem Frame

**Symptom**: After importing a YouTube URL via the wizard, the course detail page renders a grey iframe with YouTube's "This content is blocked" error. The back arrow, title, and timer chrome come from our `CourseHeader`; the grey body is YouTube's own error page inside a successfully-loaded iframe.

**Root cause**: The iframe loads successfully (200 OK) even when the video is not embeddable. YouTube serves an HTML error page at `https://www.youtube.com/embed/<id>` when:
1. The video owner has disabled embedding (`status.embeddable: false` in the Data API)
2. The video is age-restricted or region-restricted in the viewer's region
3. The video is private/unlisted/deleted
4. The video owner or YouTube has blocked the specific referrer/origin

Our current detection only covers (a) network failure (`onError`) and (b) 10-second timeout (`setIsReady` fires on load). Neither catches the 200-OK error page.

**Contributing factors**:
- Our YouTube Data API fetch requests `part=snippet,contentDetails` but omits `status`, so we never see `embeddable`, `privacyStatus`, `uploadStatus`, or `regionRestriction`
- The oEmbed fallback path returns 401/404 for non-embeddable videos — we could leverage this as a pre-flight signal even without an API key
- We already have a fallback UI component (`data-testid="youtube-player-fallback"`); it simply never gets triggered

**Intended outcome**: Users see an informative message *before* completing import ("This video can't be embedded — you can still save it as a link"), and any video that slips through (region-restricted for some viewers, owner flips embedding off post-import) renders our friendly fallback instead of YouTube's grey error page.

## Requirements Trace

- R1. Non-embeddable videos are flagged during metadata fetch in the import wizard with a clear reason (embedding disabled / private / deleted / region-restricted)
- R2. Users can choose to skip non-embeddable videos or save them as external-link-only lessons (no in-app player)
- R3. At lesson playback, non-embeddable videos (flagged at import or detected at runtime) render Knowlune's existing fallback UI with a "Watch on YouTube" CTA — never YouTube's raw error page
- R4. Existing embeddable videos continue to play inline with no regression in load time or resume-from-position behavior
- R5. The fix works in both authenticated production (`knowlune.pedrolages.net`) and local dev (`http://localhost:5173`) without per-environment configuration

## Scope Boundaries

- Not changing the import wizard UX shell or adding new steps — only extending Step 2 (metadata preview) with an "unembeddable" status
- Not adding a YouTube IFrame API postMessage bridge (that is explicitly deferred per [src/app/components/youtube/YouTubePlayer.tsx:8-12](src/app/components/youtube/YouTubePlayer.tsx#L8-L12))
- Not changing CSP — current `frame-src` already covers both `www.youtube.com` and `www.youtube-nocookie.com` ([index.html:28](index.html#L28))
- Not addressing age-gated sign-in flows (users who'd need to sign in to YouTube to view) — those fall through to the generic fallback

### Deferred to Separate Tasks

- Proactive re-validation of previously-imported videos that become non-embeddable over time: background job that periodically re-checks `status.embeddable` via Data API and flips lessons to link-only — future hardening, not required for this fix.
- Full YouTube IFrame API postMessage bridge to detect player errors (codes 101, 150 = embedding disabled) at runtime — requires re-introducing `react-youtube` or a hand-rolled bridge, deferred with the rest of the IFrame API restoration.

## Context & Research

### Relevant Code and Patterns

- [src/app/components/youtube/YouTubePlayer.tsx](src/app/components/youtube/YouTubePlayer.tsx) — iframe embed, existing `loadFailed` fallback UI (line 93), iframe src construction (line 125)
- [src/app/components/course/YouTubeVideoContent.tsx](src/app/components/course/YouTubeVideoContent.tsx) — wraps `YouTubePlayer`, handles offline state and Dexie video lookup
- [src/lib/youtubeApi.ts:350,461](src/lib/youtubeApi.ts#L350) — Data API URL construction (currently `part=snippet,contentDetails`, needs `status`)
- [src/lib/youtubeApi.ts:37](src/lib/youtubeApi.ts#L37) — oEmbed endpoint, useful for key-less embeddability probe
- [src/stores/useYouTubeImportStore.ts:175-186](src/stores/useYouTubeImportStore.ts#L175) — `setVideosForFetch` orchestrates metadata fetch after URL parsing
- [src/stores/useYouTubeImportStore.ts:45-55](src/stores/useYouTubeImportStore.ts#L45) — `YouTubeImportVideo.status` already has a `'unavailable'` variant we can repurpose/extend
- [src/data/types.ts](src/data/types.ts) — `ImportedVideo` and `YouTubeVideoCache` types (needs `embeddable` flag and `unembeddableReason`)
- [index.html:28](index.html#L28) — CSP `frame-src` whitelist (no change needed)

### Institutional Learnings

- Git log commit `ed6377c7` (12 Apr 2026) reverted `youtube-nocookie.com` in script-src because it was breaking the player — `frame-src` whitelist still includes both domains, so `nocookie` iframe src is safe (the earlier break was script-src, not frame-src)
- Git log commit `1dd0d8b8` previously fixed an "infinite spinner" symptom by adding the 10s timeout fallback — that addressed network-level failures but not the 200-OK-with-error-page case this plan targets

### External References

- [YouTube Data API v3 — Videos.list `status` part](https://developers.google.com/youtube/v3/docs/videos#status) — `status.embeddable: boolean`, `status.privacyStatus`, `status.uploadStatus`
- [YouTube oEmbed endpoint](https://oembed.com/) — returns 401 when embedding is disabled, 404 when video doesn't exist, 200 otherwise; this is a zero-quota signal usable even when our Data API key isn't configured
- [YouTube IFrame API error codes](https://developers.google.com/youtube/iframe_api_reference#onError) — 101 and 150 both mean "embedding disabled by owner" (deferred to future IFrame API bridge)

## Key Technical Decisions

- **Use oEmbed HEAD probe as the primary embeddability signal at import time, not Data API `status.embeddable`.** oEmbed is key-less, zero-quota, and returns 401 precisely when embedding is disabled. Data API `status` requires quota + configured key and not all users have one. We still extend Data API calls to include `part=status` so when the key is present, we surface richer reasons (private vs deleted vs embedding-off).
- **Persist embeddability on `ImportedVideo`, not just in the wizard session.** Once known non-embeddable, the lesson player should skip the iframe attempt entirely and show the fallback directly. Add `ImportedVideo.embeddable?: boolean` and `ImportedVideo.unembeddableReason?: 'embedding-disabled' | 'private' | 'deleted' | 'region-restricted' | 'unknown'`.
- **Allow save-as-link for non-embeddable videos.** Blocking import entirely is too harsh — users may still want the metadata, notes, transcript, and a "Watch on YouTube" button. The lesson just won't play inline.
- **Switch iframe src to `youtube-nocookie.com`** as a minor privacy/cookie-banner improvement; CSP already permits it and it has slightly lower rates of spurious "site cannot be reached" rendering with certain ad-blocker configurations. This is a low-risk drive-by — not the primary fix.
- **Do not remove the 10s timeout.** Even with pre-flight checks, network-level flakes still happen. Keep the existing safety net.

## Open Questions

### Resolved During Planning

- "Is this a CSP problem?" → No. `frame-src https://www.youtube.com` is already in CSP (index.html:28); if CSP were the issue the browser console would show a CSP violation, not YouTube's error page.
- "Is this a local-only or production-only issue?" → Both, because the root cause is per-video (embedding disabled by the owner), not per-environment.
- "Should we block save for non-embeddable videos?" → No (decision above). Allow save-as-link with a user-visible badge.

### Deferred to Implementation

- Exact copy for the wizard warning and lesson fallback — will finalize during implementation with product/design review
- Whether to re-probe embeddability on a cache-miss after N days — can be decided once the field lands and we see real user patterns
- Region-restriction detection precision — `status.regionRestriction.blocked` is advisory; we'll surface a generic "may not be available in your region" message rather than attempting geolocation

## Implementation Units

- [ ] **Unit 1: Add oEmbed embeddability probe helper**

**Goal:** Provide a keyless, zero-quota function that returns `{ embeddable: boolean, reason?: ... }` for a given videoId by calling the YouTube oEmbed endpoint.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `src/lib/youtubeEmbeddability.ts`
- Test: `src/lib/__tests__/youtubeEmbeddability.test.ts`

**Approach:**
- Use `fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json')`
- Map response status: `200 → embeddable:true`; `401 → embedding-disabled`; `404 → deleted-or-private`; other `→ reason:'unknown'`
- Return a result type consistent with the existing `YouTubeApiResult` pattern in [src/lib/youtubeApi.ts:42](src/lib/youtubeApi.ts#L42)
- Add a small in-memory Map cache keyed by videoId to dedupe back-to-back calls inside a single import session

**Patterns to follow:**
- [src/lib/youtubeApi.ts](src/lib/youtubeApi.ts) — result type shape, toast policy (no toast from lib; return errors)

**Test scenarios:**
- Happy path: 200 response → `{ embeddable: true }`
- Error path: 401 response → `{ embeddable: false, reason: 'embedding-disabled' }`
- Error path: 404 response → `{ embeddable: false, reason: 'deleted-or-private' }`
- Edge case: network error (fetch rejects) → `{ embeddable: false, reason: 'unknown' }` (fail-safe: don't block import on probe failure — see Unit 3's policy)
- Edge case: called twice for same videoId within session → second call hits in-memory cache, fetch called once

**Verification:**
- Vitest suite passes
- Manual probe in browser console against known-unembeddable video ID (e.g., any major-label music video) returns `embedding-disabled`

---

- [ ] **Unit 2: Extend Data API fetch with `status` part and surface embeddability**

**Goal:** When a YouTube Data API key is configured, request `part=snippet,contentDetails,status` and parse `status.embeddable`, `status.privacyStatus`, `status.uploadStatus`, `status.regionRestriction` into the metadata cache.

**Requirements:** R1

**Dependencies:** Unit 1 (for type shape alignment)

**Files:**
- Modify: `src/lib/youtubeApi.ts`
- Modify: `src/data/types.ts` (extend `YouTubeVideoCache` with optional `embeddable`, `unembeddableReason`, `privacyStatus`)
- Test: `src/lib/__tests__/youtubeApi.test.ts` (extend existing)

**Approach:**
- Change URL construction at [src/lib/youtubeApi.ts:350](src/lib/youtubeApi.ts#L350) and [:461](src/lib/youtubeApi.ts#L461): `part=snippet,contentDetails,status`
- Extend `YouTubeApiVideoResource` interface with `status: { embeddable: boolean; privacyStatus: string; uploadStatus: string; regionRestriction?: { allowed?: string[]; blocked?: string[] } }`
- Extend the resource→`YouTubeVideoCache` mapping to populate `embeddable` and derive `unembeddableReason` from the status fields:
  - `status.privacyStatus === 'private'` → `'private'`
  - `status.uploadStatus === 'deleted'` → `'deleted'`
  - `status.embeddable === false` → `'embedding-disabled'`
  - `status.regionRestriction?.blocked?.length` → `'region-restricted'`
- Quota impact: zero — adding parts to an existing `videos.list` call is still 1 unit per batch

**Patterns to follow:**
- Existing `mapResourceToCache` function in `src/lib/youtubeApi.ts` (batch and single paths both call this)

**Test scenarios:**
- Happy path: API returns `status.embeddable: true` → cache record has `embeddable: true`, `unembeddableReason: undefined`
- Error path: `status.embeddable: false` → cache has `embeddable: false, unembeddableReason: 'embedding-disabled'`
- Edge case: `status.privacyStatus: 'private'` → `unembeddableReason: 'private'` (takes priority over embeddable flag)
- Edge case: `status.regionRestriction.blocked: ['US']` → `unembeddableReason: 'region-restricted'`
- Edge case: API omits `status` entirely (forward compat) → fields stay undefined, no crash

**Verification:**
- Vitest suite passes
- Manual: import a known-private video with API key configured; wizard shows the private reason

---

- [ ] **Unit 3: Wire embeddability into import wizard metadata fetch**

**Goal:** After metadata fetch in Step 2 of the import wizard, for each video without Data API `embeddable` info, run the oEmbed probe (Unit 1) in parallel. Set `YouTubeImportVideo.status` to a new `'unembeddable'` variant when probe returns false.

**Requirements:** R1, R2

**Dependencies:** Units 1 and 2

**Files:**
- Modify: `src/stores/useYouTubeImportStore.ts`
- Modify: `src/app/components/youtube/import/VideoList.tsx` (or wherever Step 2 preview rows live — locate during implementation)
- Test: `src/stores/__tests__/useYouTubeImportStore.test.ts`

**Approach:**
- Extend `YouTubeImportVideo` type with optional `unembeddableReason` and include `'unembeddable'` in the `status` union
- In `setVideosForFetch` (around [src/stores/useYouTubeImportStore.ts:175](src/stores/useYouTubeImportStore.ts#L175)), after Data API batch resolves: for videos where `metadata.embeddable === false`, mark `status: 'unembeddable'` with the reason from the cache; for videos where `embeddable` is undefined (no API key, or API didn't include status), run oEmbed probe in parallel via `Promise.allSettled` and set status accordingly
- Render a visible warning badge + reason in the Step 2 preview row with a "Save as link only" affordance and a "Remove" affordance
- Policy on oEmbed probe failure: do **not** block import — default to `embeddable: true` and let the runtime fallback (Unit 4) handle it. Rationale: oEmbed failure can also be network-level, and being too strict would block legitimate imports.

**Patterns to follow:**
- Existing status variants and row rendering for `'error'` and `'unavailable'`

**Test scenarios:**
- Happy path: all videos embeddable → no warnings, save proceeds normally
- Integration: one video returns `embeddable: false` from API → import list shows warning badge, checkbox to "save as link only" is present
- Integration: API returns no `status` field (no key configured) → oEmbed probe is dispatched, 401 result flips status to `'unembeddable'`
- Edge case: oEmbed probe rejects (network error) → status stays `'loaded'`, import can continue (runtime fallback is the safety net)
- Error path: all videos in a batch are unembeddable → user sees warning summary at top of list, can still proceed with "save all as link-only"

**Verification:**
- Vitest store suite passes
- Manual: import a known non-embeddable video (e.g., a music label video); Step 2 shows the warning badge with reason text

---

- [ ] **Unit 4: Persist embeddability and branch player rendering**

**Goal:** Save the `embeddable` flag and reason to `ImportedVideo` at save time; in `YouTubeVideoContent` and `YouTubePlayer`, skip the iframe attempt when `embeddable === false` and render the existing fallback UI with a reason-specific message.

**Requirements:** R3, R4

**Dependencies:** Unit 3

**Files:**
- Modify: `src/data/types.ts` (add `ImportedVideo.embeddable?: boolean`, `ImportedVideo.unembeddableReason?: UnembeddableReason`)
- Modify: `src/stores/useYouTubeImportStore.ts` (around save block near [src/stores/useYouTubeImportStore.ts:296](src/stores/useYouTubeImportStore.ts#L296) — include the flags in the record constructed for `db.importedVideos.put`)
- Modify: `src/app/components/course/YouTubeVideoContent.tsx` (branch on `video.embeddable === false` → render fallback directly)
- Modify: `src/app/components/youtube/YouTubePlayer.tsx` (accept optional `unembeddableReason` prop, surface reason-aware message; keep existing generic fallback for runtime timeouts)
- Test: add to `src/app/components/youtube/__tests__/YouTubePlayer.test.tsx` (create if absent)

**Approach:**
- Dexie schema: fields are additive + optional, so no migration version bump required. Confirm no index is needed (they're flag fields, not queried by themselves).
- In `YouTubeVideoContent`, add a branch after the `!youtubeVideoId` check: `if (video.embeddable === false) return <YouTubeUnembeddableFallback reason={video.unembeddableReason} videoId={video.youtubeVideoId} />` — reuse the existing fallback styling from `YouTubePlayer` by extracting it into a shared component, or extend `YouTubePlayer` with a `forceFallback` prop
- Reason-aware copy:
  - `embedding-disabled` → "The video owner has disabled embedding on other sites."
  - `private` → "This video is private."
  - `deleted` → "This video is no longer available on YouTube."
  - `region-restricted` → "This video may not be available in your region."
  - `unknown` / undefined → existing generic copy
- Also switch the iframe src at [src/app/components/youtube/YouTubePlayer.tsx:125](src/app/components/youtube/YouTubePlayer.tsx#L125) to `https://www.youtube-nocookie.com/embed/...` (CSP already permits it — see index.html:28)

**Patterns to follow:**
- Existing fallback markup in [src/app/components/youtube/YouTubePlayer.tsx:93-122](src/app/components/youtube/YouTubePlayer.tsx#L93-L122)

**Test scenarios:**
- Happy path: `video.embeddable === true` → iframe renders as before, no regression
- Happy path: `video.embeddable === undefined` (legacy imports, pre-fix) → iframe renders as before (undefined ≠ false)
- Error path: `video.embeddable === false, unembeddableReason: 'embedding-disabled'` → fallback renders with embedding-disabled copy, no iframe in DOM
- Error path: `video.embeddable === false, unembeddableReason: 'private'` → fallback renders with "video is private" copy
- Edge case: `video.embeddable === false` but `unembeddableReason` missing → fallback renders with generic copy
- Integration: fallback "Watch on YouTube" link uses `https://www.youtube.com/watch?v=<id>` and opens in new tab with `rel="noopener noreferrer"`

**Verification:**
- Vitest component test passes
- Manual: lesson detail for a flagged-unembeddable video renders our friendly fallback, not YouTube's grey error page
- Manual: legacy imported video (where `embeddable` is undefined) still plays inline

---

- [ ] **Unit 5: Backfill safety net — detect embed error at runtime for legacy imports**

**Goal:** For videos imported before this fix (where `embeddable` is undefined), detect YouTube's error page at runtime and flip to fallback. This catches the original reported symptom end-to-end even for previously-imported broken videos.

**Requirements:** R3

**Dependencies:** Unit 4

**Files:**
- Modify: `src/app/components/youtube/YouTubePlayer.tsx`

**Approach:**
- After iframe `onLoad` fires, schedule a delayed oEmbed probe (e.g., 500ms) — if probe returns non-embeddable, flip `loadFailed` to true and update the `ImportedVideo` record in Dexie with `embeddable: false` and the reason (so the next render skips the iframe entirely). Use `syncableWrite` per project sync convention ([src/lib/sync/syncableWrite.ts](src/lib/sync/syncableWrite.ts) — referenced by existing import store code at useYouTubeImportStore.ts:27).
- Skip the runtime probe when `video.embeddable === true` (API already confirmed it) or when the probe was already run in this session
- Do not block the initial iframe render on the probe — it runs in parallel; if the probe comes back `true`, nothing happens; if `false`, we flip to fallback (user sees a brief iframe flash, then our fallback — acceptable tradeoff vs showing YouTube's error page)

**Patterns to follow:**
- Existing `useEffect` with `ignore` flag pattern in `YouTubePlayer` ([src/app/components/youtube/YouTubePlayer.tsx:49-68](src/app/components/youtube/YouTubePlayer.tsx#L49-L68))
- `syncableWrite` write pattern from the import store

**Test scenarios:**
- Happy path: runtime probe returns embeddable → no-op, iframe stays mounted
- Error path: runtime probe returns non-embeddable for a legacy video → flips to fallback, writes `embeddable: false` to Dexie
- Edge case: user navigates away before probe resolves → cleanup prevents state update on unmounted component (the `ignore` pattern)
- Edge case: `video.embeddable === true` already set → probe is skipped entirely

**Verification:**
- Vitest component test with mocked fetch passes
- Manual: clear the `embeddable` flag on an existing Dexie record, reload the lesson, confirm fallback appears within ~1s and the Dexie record gets backfilled with `embeddable: false`

## System-Wide Impact

- **Interaction graph:** Import wizard Step 2 → metadata fetch → Dexie `importedVideos` + `youtubeVideoCache` writes → lesson player read path. All three touchpoints change; all are already in the import flow, no new subsystems added.
- **Error propagation:** Metadata probe failures degrade silently (we default to "embeddable: unknown/true" rather than blocking import). Runtime probe failures also degrade silently. This is deliberate: false negatives (flagging an embeddable video) would be worse than the status quo; false positives (missing a non-embeddable video) still land in our runtime fallback via Unit 5.
- **State lifecycle risks:** The new `embeddable` flag on `ImportedVideo` is optional and additive — existing records without it are treated as "unknown / assume embeddable", matching current behavior. No migration needed.
- **API surface parity:** `YouTubeVideoContent` and `YouTubePlayer` props change only additively (optional `unembeddableReason` prop). No caller changes required.
- **Integration coverage:** Unit tests cover the mapping logic; one integration scenario in Unit 4 verifies that legacy imports (undefined flag) still render the iframe.
- **Unchanged invariants:** CSP is not modified. The resume-from-position behavior in `YouTubePlayer` is untouched for embeddable videos. The 10s `loadFailed` timeout is preserved as the last-resort safety net.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| oEmbed endpoint changes or rate-limits our probe | Dedup cache per session; fallback to Data API `status` when key configured; probe failures default to allow-import + runtime safety net |
| Users with strict privacy extensions blocking `youtube-nocookie.com` | CSP already whitelists both domains; if a user reports regression, we can revert to `youtube.com` in a one-line change |
| Data API response adds `status.embeddable` but not in older API versions we've cached | Schema mapping treats the field as optional — missing `status` means we keep existing behavior (optimistic assume embeddable) |
| Runtime probe (Unit 5) causes a visible iframe-to-fallback flash for legacy unembeddable imports | Accepted tradeoff — better than YouTube's error page; Unit 4's pre-flight eliminates this for new imports, and the Dexie write from Unit 5 eliminates it on second load |

## Documentation / Operational Notes

- Add a known-issues entry if any is currently referenced in `docs/known-issues.yaml` for "YouTube import shows blocked page" — mark it as fixed by this plan
- No feature flag needed — this is strictly additive and safer than the current behavior for all users

## Sources & References

- Related files: [src/app/components/youtube/YouTubePlayer.tsx](src/app/components/youtube/YouTubePlayer.tsx), [src/lib/youtubeApi.ts](src/lib/youtubeApi.ts), [src/stores/useYouTubeImportStore.ts](src/stores/useYouTubeImportStore.ts), [src/data/types.ts](src/data/types.ts)
- Related commits: `ed6377c7` (CSP revert), `1dd0d8b8` (spinner timeout fallback), `d25df64a` (player error state)
- External docs: [YouTube Data API videos.list status part](https://developers.google.com/youtube/v3/docs/videos#status), [YouTube oEmbed](https://oembed.com/)
