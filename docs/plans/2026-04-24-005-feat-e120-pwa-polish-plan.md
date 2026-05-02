---
title: "feat: E120 PWA Polish — iOS splash, MediaSession, update prompt, offline UX"
type: feat
status: active
date: 2026-04-24
epic: E120
---

# feat: E120 PWA Polish — iOS splash, MediaSession, update prompt, offline UX

## Overview

Knowlune's PWA foundation is ~90% shipped: `vite-plugin-pwa` v1.2.0 generates a Workbox service worker, manifest, and precache manifest; icons (192/512/maskable, apple-touch) exist; `PWAInstallBanner` handles `beforeinstallprompt`; safe-area insets are respected in `BottomNav`; offline sync (E92) is production. Users who install the app on iOS still see a white flash on launch (no splash), never receive a prompt when a new SW is available, can't control audiobook playback from the lock screen, and — on iOS Safari — have no signal that "Add to Home Screen" exists because Safari doesn't fire `beforeinstallprompt`.

This epic ships five narrow slices of polish that close those gaps without any new architecture: iOS splash screens + `viewport-fit=cover`, a user-facing SW update prompt, MediaSession API wiring for lock-screen audio controls, an iOS install-instruction card + manifest shortcuts, and a branded offline fallback with runtime-caching audit to target Lighthouse PWA 100. The single highest-leverage change is MediaSession — ~50 lines in `AudiobookshelfService.ts` unlocks lock-screen media controls on Android Chrome and iOS Safari 16.4+, delivering the #1 feature users assume requires a native app.

Companion analysis explaining why we are polishing the PWA instead of wrapping with Capacitor or rewriting in React Native: [docs/analysis/mobile-strategy-comparison-2026-04-24.md](../analysis/mobile-strategy-comparison-2026-04-24.md).

## Problem Frame

**Symptom 1 (iOS install UX):** A user installs the PWA on iOS via Share → Add to Home Screen. On cold launch, they see a blank white screen for 1-3 seconds before the React root mounts. This looks broken. Root cause: `index.html` has no `<link rel="apple-touch-startup-image">` entries for iOS splash, and the viewport meta lacks `viewport-fit=cover` so iOS's default splash fallback is misaligned on devices with a notch.

**Symptom 2 (silent updates):** After we ship a new build, users on the installed PWA continue using the stale version until they happen to fully close the app and reopen. Root cause: [vite.config.ts:503](vite.config.ts#L503) has `registerType: 'prompt'`, which means the SW *detects* updates but does not auto-apply them. The app is supposed to surface a "New version available — Reload" UI, but no component consumes `useRegisterSW`'s `needRefresh` state.

**Symptom 3 (no lock-screen audio controls):** A user starts an audiobook on their phone, locks the screen to put the phone in their pocket. On the lock screen they see the OS's generic media card ("Web page audio") with no cover, no title, and no skip buttons. Root cause: [src/services/AudiobookshelfService.ts](src/services/AudiobookshelfService.ts) uses a module-level `<audio>` singleton and never calls `navigator.mediaSession.metadata = ...` or `navigator.mediaSession.setActionHandler(...)`. The browser has no way to populate the OS media card.

**Symptom 4 (iOS install invisibility):** A first-time visitor on iOS Safari sees no install UI at all. Android users see `PWAInstallBanner` because Chrome fires `beforeinstallprompt`; iOS Safari never does. Root cause: [src/app/components/PWAInstallBanner.tsx:45-50](src/app/components/PWAInstallBanner.tsx#L45-L50) only listens for `beforeinstallprompt`, with no iOS-specific branch showing "Tap Share → Add to Home Screen."

**Symptom 5 (offline page is unbranded):** When the app is opened while fully offline and the user navigates to a route not in SW precache or Workbox `navigateFallback`, they see [public/offline.html](public/offline.html), which is basic. Also, Lighthouse PWA audit has never been run — unknown missing fields in manifest (`shortcuts`, `categories`), no `maskable` shortcut icons, etc.

**Intended outcome:** Installed PWA users get a branded launch experience, see update prompts, control audio from the lock screen, and are gently guided to install on iOS. Lighthouse PWA score reaches 100. No architectural changes; all additive.

## Requirements Trace

- **R1.** Installed iOS PWA shows a branded splash screen on cold launch; no white flash. Splash assets are generated for all current iPhone/iPad screen sizes.
- **R2.** When a new service worker is installed, the running PWA shows a non-blocking banner with "Reload" and "Later" actions. Reloading applies the new SW; "Later" dismisses the banner for that session.
- **R3.** Audiobook playback populates the lock screen with cover, title, author. Play/pause, skip-forward, skip-backward, and seek actions from lock screen or Bluetooth headphones route to existing `AudiobookshelfService` methods.
- **R4.** First-time visitors on iOS Safari who have not installed the PWA see a one-time instruction card ("Tap Share → Add to Home Screen") after a brief delay. Dismissal persists in localStorage. Does not show in standalone mode.
- **R5.** Installed PWA on Android has at least three home-screen shortcuts: Continue Learning → library, New Note → notes capture, Sync Now → settings sync focus.
- **R6.** Offline fallback page is branded with Knowlune theme and displays a list of routes the user has recently visited (read from SW Cache Storage or Dexie recent-routes).
- **R7.** Lighthouse PWA audit scores 100 on the `/` route. Manifest includes `categories`, all icons including shortcuts are `maskable` where appropriate.
- **R8.** No regression in existing behavior: Android install banner still works, current offline indicators still function, audiobook playback controls in-app continue to work, sync engine (E92) is untouched.

## Scope Boundaries

- Not adding Capacitor or any native wrapper — the analysis doc explains why.
- Not changing the Workbox `navigateFallback` strategy or SW caching logic beyond small additive runtime-caching rules; sync engine (E92) is untouched.
- Not migrating to a different PWA framework (no switching from `vite-plugin-pwa` to anything else).
- Not implementing Web Push notifications — iOS push requires install, and push infrastructure is a separate future epic.
- Not changing CSP; current [index.html:17-36](index.html#L17-L36) policy already permits manifest, workers, and our icon sources.
- Not adding background-fetch or periodic-sync — browser support is thin and our sync engine already covers resume-on-reconnect.
- Not touching [src/app/components/BottomNav.tsx](src/app/components/BottomNav.tsx) beyond verifying safe-area tokens still resolve with `viewport-fit=cover` active.

### Deferred to Separate Tasks

- Native push notifications via Web Push or FCM — requires backend infrastructure and user consent flows; separate epic when/if we decide to ship.
- App Store / Play Store distribution via Capacitor — gated on measured user demand after E120 ships. See the comparison analysis.
- Periodic background sync — awaits broader browser support.
- Offline-capable AI features — already in progress elsewhere, not in scope here.

## Context & Research

### Relevant Code and Patterns

- [vite.config.ts:502-561](vite.config.ts#L502-L561) — `VitePWA` configuration, runtime caching rules, manifest shape. All changes to manifest (`shortcuts`, `categories`) and runtime caching land here.
- [index.html](index.html) — viewport meta (line 6), apple-touch-icon (line 10), apple-mobile-web-app-capable (line 11), theme-color (line 14), CSP (17-36). Splash `<link>` tags and `viewport-fit=cover` go here.
- [src/app/components/PWAInstallBanner.tsx](src/app/components/PWAInstallBanner.tsx) — existing `beforeinstallprompt` handler (line 45). iOS branch extends this file.
- [src/app/components/Layout.tsx](src/app/components/Layout.tsx) — where new `PWAUpdatePrompt` component mounts alongside `PWAInstallBanner`; also where "You are offline" toast lives today.
- [src/services/AudiobookshelfService.ts](src/services/AudiobookshelfService.ts) — module-level `<audio>` singleton, the exact integration point for `navigator.mediaSession`.
- [public/offline.html](public/offline.html) — current unbranded fallback; rewritten with Knowlune theme + visited-routes IIFE.
- [src/db/schema.ts](src/db/schema.ts) — if we read recent routes from Dexie for offline page, the store exists here (look for a `recentRoutes` or `navigationHistory` table; if absent, we read from Cache Storage instead).
- [src/app/hooks/useMediaQuery.ts](src/app/hooks/useMediaQuery.ts) — `useIsMobile` used in iOS detection branch.

### Institutional Learnings

- From [PWAInstallBanner.tsx](src/app/components/PWAInstallBanner.tsx): the existing pattern persists dismissal with a `localStorage` key (`pwa-install-dismissed`). The iOS-instruction branch should use a separate key (`pwa-ios-install-instructions-dismissed`) so dismissing one does not suppress the other, matching the "don't over-dismiss" principle.
- Git log: commit `517e78db` migrated to Supabase Cloud; commit `fe718e1f` deep-links the sign-up tab. Both touch auth flow but don't interact with SW lifecycle — our update prompt is safe to ship on top of these.
- The `navigator.locks` API is already used in [src/lib/sync/syncEngine.ts:7](src/lib/sync/syncEngine.ts#L7) with a Safari ≤15.3 fallback. MediaSession API has a similar support matrix (iOS 16.4+); we feature-detect and no-op on unsupported browsers.
- Memory note (`project_tauri_rejected.md`, 2026-03-28): desktop wrapper rejected on the same logic — PWA sufficient, invest in UX. Extends to mobile here.
- Memory note (`feedback_epic_orchestrator_autopilot.md`): autopilot runs with R3 review-loop cap. Structure this plan so critic scores ≥85 on first pass.

### External References

- [vite-plugin-pwa — Prompt registration mode](https://vite-pwa-org.netlify.app/guide/prompt-for-update) — exact shape of `useRegisterSW` hook and `needRefresh` signal used in E120-S02.
- [MDN — MediaSession API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) — supported action handlers (`play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward`, `seekforward`, `seekto`).
- [Web.dev — Add a manifest shortcut](https://web.dev/add-manifest-shortcut/) — `shortcuts` array format, icon sizing, URL resolution.
- [Apple — Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) — apple-touch-startup-image media queries per device.
- [Workbox — Runtime caching strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies) — `StaleWhileRevalidate` vs. `NetworkFirst` for Supabase endpoints.

## Key Technical Decisions

- **Generate iOS splash screens with `pwa-asset-generator`.** It's the de-facto tool, produces 12 device-specific PNGs + matching `<link>` media queries. Alternative (hand-crafted SVG + single image) has worse cross-device coverage. Trade-off: adds a dev dependency; output is committed static files, so runtime has zero cost.
- **Use `virtual:pwa-register/react`'s `useRegisterSW` for the update prompt, not a manual SW lifecycle listener.** The hook is provided by `vite-plugin-pwa` and handles `onNeedRefresh`/`onOfflineReady` correctly across browsers. Rolling our own would re-implement race-condition handling.
- **Wire MediaSession directly inside `AudiobookshelfService` rather than via a React hook.** The metadata and action handlers are tightly coupled to the `<audio>` element's state (play/pause/currentTime). A hook adds an indirection with no benefit and creates a bug class where the hook re-registers handlers on every render.
- **iOS install-instruction card is a *branch* inside `PWAInstallBanner`, not a new component.** Both solve the same UX problem (nudge user to install) and share dismissal logic. One component with two branches is simpler than two components racing for the same screen region.
- **Offline page reads visited routes from SW Cache Storage, not Dexie.** Cache Storage is directly accessible from `offline.html` as a plain HTML page; reading Dexie would require bundling Dexie into the static page or opening IndexedDB manually. SW cache keys already represent visited navigations.
- **Feature-detect MediaSession and splash-screen support; no-op on unsupported.** Do not polyfill. Unsupported browsers fall back to current behavior (which is fine — we're adding, not replacing).
- **Bump the SW cache version for Workbox precache.** Any change to runtime-caching rules forces a SW update on next visit. Users already installed will see the update prompt from E120-S02 — the two features complement each other.

## Open Questions

### Resolved During Planning

- "Should we add Web Push?" → No, deferred (see Scope Boundaries). Requires infrastructure and consent flows; out of scope for polish.
- "Should MediaSession live in a new `useMediaSession` hook?" → No. Decided in Key Technical Decisions above — direct wiring in `AudiobookshelfService` avoids re-registration bugs.
- "Does `viewport-fit=cover` break existing layouts?" → Investigate in E120-S01 verification. `BottomNav` already uses `env(safe-area-inset-bottom)`; `Layout.tsx` header does not currently use top safe-area. Fix by adding `pt-[env(safe-area-inset-top)]` to `Layout.tsx` header if the header gets clipped.
- "Split into four PRs or one?" → One epic with four stories, merged together. Reviews share context; PRs would churn over shared files (Layout.tsx appears in S02 and S04).
- "Do we need to version-bump the SW to force cache invalidation?" → Yes — any change to `runtimeCaching` in vite.config.ts auto-triggers a new SW install. Explicit version bump not required; Workbox handles it via precache manifest hashing.

### Deferred to Implementation

- Exact copy for the iOS instruction card, update prompt, and offline page — will finalize with a design pass during implementation; placeholder copy in the plan is illustrative.
- Which runtime-caching strategy for Audiobookshelf `/api/abs/proxy/*` — `NetworkOnly` is safest (audio is range-requested), but there may be metadata endpoints that benefit from `StaleWhileRevalidate`. Decide during E120-S04 audit.
- Whether to include "Sync Now" as a manifest shortcut or just "Continue Learning" and "New Note" — depends on whether the sync-focus deep link already works; verify in E120-S03.

## Implementation Units

- [ ] **E120-S01: iOS splash screens and viewport-fit**

**Goal:** Eliminate the white-flash on iOS PWA cold launch. Make `env(safe-area-inset-*)` resolve to non-zero on all edges.

**Requirements:** R1, R8

**Dependencies:** None

**Files:**
- Modify: [index.html](index.html) — viewport meta, new `<link rel="apple-touch-startup-image">` entries
- Create: `public/splash/*.png` — 12 device-specific splash images (generated)
- Modify: [src/app/components/Layout.tsx](src/app/components/Layout.tsx) — if top safe-area clipping detected, add `pt-[env(safe-area-inset-top)]` to header
- Modify: `package.json` — add `pwa-asset-generator` as devDependency
- Modify: `.gitignore` — ensure `public/splash/*.png` is NOT ignored

**Approach:**
- `npm i -D pwa-asset-generator`, then run `npx pwa-asset-generator public/pwa-512x512.png public/splash -i index.html --splash-only --background "#FAF5EE" --padding "calc(50vh - 25%) calc(50vw - 25%)"`. The tool emits PNGs and updates `index.html` in place with `<link>` tags.
- Update viewport meta at [index.html:6](index.html#L6) from `<meta name="viewport" content="width=device-width, initial-scale=1.0">` to `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`.
- Launch the installed PWA on an iOS simulator or real device. If `Layout.tsx` header clips into the notch, add `pt-[env(safe-area-inset-top)]` to the header element.
- Commit the generated `public/splash/*.png` images to the repo — they are static assets.

**Patterns to follow:**
- Existing manifest icons in [vite.config.ts:514-518](vite.config.ts#L514-L518) use the same directory pattern (`public/*.png`).
- Safe-area usage in [src/app/components/BottomNav.tsx:25](src/app/components/BottomNav.tsx#L25): `pb-[env(safe-area-inset-bottom)]`.

**Acceptance Criteria (Given/When/Then):**
- **AC1 — Splash renders on iOS:** *Given* the PWA is installed on iOS (any supported device), *when* the user cold-launches it from the home screen, *then* a branded splash (Knowlune logo on `#FAF5EE` background) is visible from the moment the app opens until the React root mounts, with no white flash.
- **AC2 — Viewport-fit active:** *Given* the PWA is running on an iOS device with a notch, *when* the layout renders, *then* `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` resolve to non-zero CSS values (verifiable via DevTools on a real device or simulator).
- **AC3 — No header clipping:** *Given* viewport-fit is cover, *when* the app renders on a device with a notch, *then* no [Layout.tsx](src/app/components/Layout.tsx) header content is obscured by the notch or status bar.
- **AC4 — Android unaffected:** *Given* a user on Android Chrome, *when* they launch the installed PWA, *then* the existing behavior (instant render, no white flash) is preserved.

**Test scenarios:**
- Unit: N/A (pure asset + markup change).
- Integration: N/A.
- Manual on iOS real device or Simulator: cold launch → branded splash visible → no flash. Verified per AC1/AC2.
- Manual on Android: cold launch → behavior unchanged. Verified per AC4.

**Verification:**
1. `npm run build` completes without warnings; `dist/splash/*.png` present in output.
2. DevTools → Application → Manifest shows splash screens listed under the icon section (Chrome shows all `<link rel="apple-touch-startup-image">` references).
3. iOS Simulator (latest) or real device: Add to Home Screen → cold launch from home → splash visible, no flash.
4. On device, open DevTools (Safari Web Inspector): `getComputedStyle(document.querySelector('.bottom-nav')).paddingBottom` > 0 on a device with home indicator.

---

- [ ] **E120-S02: Service worker update prompt and MediaSession API**

**Goal:** (a) Surface a non-blocking "New version available" banner when the SW detects an update. (b) Populate the OS lock-screen media card with audiobook metadata and wire its action handlers to `AudiobookshelfService`.

**Requirements:** R2, R3, R8

**Dependencies:** None (independent of S01)

**Files:**
- Create: `src/app/components/PWAUpdatePrompt.tsx` — new component, consumes `useRegisterSW` from `virtual:pwa-register/react`
- Modify: [src/app/components/Layout.tsx](src/app/components/Layout.tsx) — mount `<PWAUpdatePrompt />` next to `<PWAInstallBanner />`
- Modify: [src/services/AudiobookshelfService.ts](src/services/AudiobookshelfService.ts) — add MediaSession metadata updates on track change; add action handlers for play/pause/seek/skip
- Create: `src/services/__tests__/AudiobookshelfService.mediasession.test.ts` — unit tests with mocked `navigator.mediaSession`
- Modify: `src/vite-env.d.ts` — add the `virtual:pwa-register/react` module declaration if not already present (check)

**Approach:**

*Part A — Update prompt:*
- Import `{ useRegisterSW }` from `virtual:pwa-register/react` in `PWAUpdatePrompt.tsx`.
- Destructure `{ needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker }`.
- Render a banner in the same position as `PWAInstallBanner` (bottom, centered, z-50) with "Reload" and "Later" buttons.
- "Reload" calls `updateServiceWorker(true)`; "Later" sets `needRefresh` to false. No localStorage dismissal — the prompt should reappear if the user ignores it and a newer version arrives.
- Mount in `Layout.tsx` adjacent to `<PWAInstallBanner />` (both render at most one at a time; they don't stack).

*Part B — MediaSession:*
- Feature-detect: `if (!('mediaSession' in navigator)) return;` early.
- In `AudiobookshelfService`, where the `<audio>` singleton starts playing a track, call:
  ```
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.author,
    album: track.bookTitle,
    artwork: [{ src: track.coverUrl, sizes: '512x512', type: 'image/png' }]
  });
  ```
- Register action handlers for `play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward`, `seekforward`, `seekto`. Each routes to the existing playback method in `AudiobookshelfService` (which already knows how to play/pause/seek the `<audio>` element).
- On track change, update `metadata`. On player destroy, set all handlers to `null`.

**Patterns to follow:**
- [src/app/components/PWAInstallBanner.tsx](src/app/components/PWAInstallBanner.tsx) — component structure, position classes (`fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg`), button variants.
- Feature-detection pattern in [src/lib/sync/syncEngine.ts:7](src/lib/sync/syncEngine.ts#L7) (`navigator.locks` with fallback).

**Acceptance Criteria (Given/When/Then):**
- **AC1 — Update banner appears:** *Given* a user is on a running instance of the PWA, *when* a new build is deployed and the new service worker installs in the background, *then* a banner appears at the bottom of the screen reading "New version available" with Reload and Later buttons.
- **AC2 — Reload applies update:** *Given* the update banner is visible, *when* the user clicks Reload, *then* the page reloads and the new SW takes over (verifiable by the new build's hash appearing in DevTools → Application → Service Workers).
- **AC3 — Later dismisses for session:** *Given* the update banner is visible, *when* the user clicks Later, *then* the banner disappears for the current session but will re-appear if a further update arrives.
- **AC4 — Lock screen shows metadata:** *Given* the user is playing an audiobook in the PWA on Android Chrome or iOS Safari 16.4+, *when* they lock their phone screen, *then* the lock-screen media card shows the book cover, track title, and author name.
- **AC5 — Lock-screen controls work:** *Given* the lock-screen media card is visible, *when* the user taps play/pause or next/previous on the lock screen or presses the corresponding Bluetooth headphone button, *then* the audio responds immediately — the same effect as tapping the in-app controls.
- **AC6 — Unsupported browsers silent:** *Given* a user on a browser without MediaSession support (e.g., older iOS Safari), *when* they play an audiobook, *then* no errors are thrown; in-app playback works normally.
- **AC7 — Unsupported browsers update-prompt silent:** *Given* a user on a browser without SW support at all, *when* the app loads, *then* the update prompt never fires and no errors are thrown (`useRegisterSW` no-ops).

**Test scenarios:**
- Unit: `PWAUpdatePrompt.test.tsx` mocks `virtual:pwa-register/react` and asserts banner renders when `needRefresh === true`, buttons call the expected handlers.
- Unit: `AudiobookshelfService.mediasession.test.ts` mocks `navigator.mediaSession` and asserts `setActionHandler` is called for each of the 6 actions on track start, `metadata` is updated on track change, and handlers are unregistered on destroy.
- E2E: Existing Audiobookshelf E2E specs continue to pass — no behavioral regression in in-app controls.
- Manual: Deploy two consecutive builds. On the second visit, verify the update banner appears; click Reload, verify new SW in DevTools.
- Manual: Play audiobook on Android Chrome → lock phone → verify lock-screen card. Press play/pause on Bluetooth headphones → audio responds.

**Verification:**
1. `npm run test:unit` passes new unit tests.
2. `npm run build` completes; `PWAUpdatePrompt` is tree-shaken into the entry chunk.
3. Deploy cycle: Build A deployed → user loads app → Build B deployed → user reloads page → update prompt appears. Reload button applies update.
4. Android Chrome physical device: audiobook plays → lock screen shows cover + title → play/pause works from lock screen.
5. Chrome DevTools (desktop): Media Session panel shows metadata and registered actions while playing an audiobook.

---

- [ ] **E120-S03: iOS install instructions and manifest shortcuts**

**Goal:** Close the iOS install-discoverability gap and add home-screen long-press shortcuts on Android.

**Requirements:** R4, R5, R8

**Dependencies:** None (independent of S01, S02)

**Files:**
- Modify: [src/app/components/PWAInstallBanner.tsx](src/app/components/PWAInstallBanner.tsx) — add iOS detection branch with "Add to Home Screen" instruction card
- Modify: [vite.config.ts](vite.config.ts) — add `shortcuts` array to PWA manifest config
- Create: `public/shortcuts/continue.png`, `public/shortcuts/new-note.png`, `public/shortcuts/sync.png` — 96×96 shortcut icons
- Modify: [src/app/components/__tests__/PWAInstallBanner.test.tsx](src/app/components/__tests__/PWAInstallBanner.test.tsx) (create if absent) — test iOS branch

**Approach:**

*Part A — iOS instruction card:*
- Detect iOS Safari: `const isIosSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);`
- Detect not-installed: `!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone;`
- Store dismissal under a separate key: `pwa-ios-install-instructions-dismissed`.
- Card copy: "Install Knowlune — tap [Share icon] then 'Add to Home Screen'". Use the Lucide `Share` icon or an SVG that matches iOS's native share icon.
- Delay show by 10 seconds after first page load to avoid nagging immediately.

*Part B — Manifest shortcuts:*
- Add to the `manifest` object in [vite.config.ts](vite.config.ts):
  ```
  shortcuts: [
    { name: 'Continue Learning', short_name: 'Continue', url: '/library', icons: [{ src: 'shortcuts/continue.png', sizes: '96x96' }] },
    { name: 'New Note', short_name: 'New Note', url: '/notes?new=1', icons: [{ src: 'shortcuts/new-note.png', sizes: '96x96' }] },
    { name: 'Sync Now', short_name: 'Sync', url: '/settings?focus=sync', icons: [{ src: 'shortcuts/sync.png', sizes: '96x96' }] }
  ]
  ```
- Generate 96×96 PNG icons matching the visual style of existing PWA icons. Use brand color `#5e6ad2` on `#FAF5EE`.
- Verify the target URLs exist: `/library` (yes), `/notes?new=1` (verify), `/settings?focus=sync` (verify). If any routes don't handle the query params, add lightweight handlers in those pages.

**Patterns to follow:**
- Existing iOS meta tags at [index.html:11-13](index.html#L11-L13).
- Existing dismissal logic in [PWAInstallBanner.tsx:61-64](src/app/components/PWAInstallBanner.tsx#L61-L64) — reuse structure, separate key.

**Acceptance Criteria (Given/When/Then):**
- **AC1 — iOS card shows to new iOS users:** *Given* a first-time visitor on iOS Safari (non-standalone, not previously dismissed), *when* 10 seconds pass after page load, *then* the "Add to Home Screen" instruction card is visible with a Share icon illustration and dismiss button.
- **AC2 — iOS card never shows on Android:** *Given* a user on Android Chrome, *when* they visit the app, *then* the iOS instruction card does not appear; only the existing `beforeinstallprompt` banner appears (if applicable).
- **AC3 — iOS card never shows in standalone:** *Given* a user has already installed the PWA on iOS and launches it from the home screen (standalone mode), *when* the app loads, *then* the iOS card does not appear.
- **AC4 — iOS card dismissal persists:** *Given* a user on iOS Safari dismisses the iOS card, *when* they reload the page, *then* the card does not reappear on subsequent visits in the same browser (localStorage persisted).
- **AC5 — Shortcut appears on Android:** *Given* a user installs the PWA on Android Chrome, *when* they long-press the home-screen icon, *then* they see three shortcuts: Continue Learning, New Note, Sync Now.
- **AC6 — Shortcut navigates correctly:** *Given* the shortcuts are visible, *when* the user taps "Continue Learning", *then* the PWA opens directly to `/library`.

**Test scenarios:**
- Unit: `PWAInstallBanner.test.tsx` — mock user agent to `iPhone`+`Safari`, `display-mode: standalone: false` → assert iOS card renders after 10s; mock `Android` UA → assert iOS card does not render.
- Unit: Dismissal writes `pwa-ios-install-instructions-dismissed` to localStorage without affecting `pwa-install-dismissed`.
- Manual on iOS Safari: visit site as new user → wait 10s → card appears. Dismiss. Reload. Card does not reappear.
- Manual on Android Chrome: install PWA → long-press home icon → 3 shortcuts listed. Tap each → correct navigation.

**Verification:**
1. `npm run test:unit` passes.
2. `npm run build`: manifest at `dist/manifest.webmanifest` includes the `shortcuts` array with three entries.
3. Chrome DevTools → Application → Manifest panel shows 3 shortcuts rendered.
4. Android Chrome real device: PWA installs with shortcut support.

---

- [ ] **E120-S04: Branded offline page, runtime caching audit, Lighthouse 100**

**Goal:** Replace the basic `offline.html` with a branded fallback that shows recently visited routes. Audit Workbox runtime caching for correctness. Achieve Lighthouse PWA score 100.

**Requirements:** R6, R7, R8

**Dependencies:** None (independent of S01-S03, but best shipped last so Lighthouse catches issues introduced by the earlier stories)

**Files:**
- Modify: [public/offline.html](public/offline.html) — rebrand with Knowlune theme, add visited-routes list
- Modify: [vite.config.ts](vite.config.ts) — audit runtime caching rules, add `categories`, adjust `maxAgeSeconds`
- Create: `docs/reviews/performance/lighthouse-pwa-2026-04-24.md` — audit report

**Approach:**

*Part A — Branded offline.html:*
- Rewrite `public/offline.html` with:
  - Background `#FAF5EE`, text using brand colors
  - Knowlune logo (embed SVG inline to avoid requiring a cached asset)
  - System font stack fallback (no remote fonts available offline)
  - Heading "You're offline" + subtext "But your library is available"
  - A JavaScript block that reads `caches.keys()` and `cache.match()` to find recently visited routes, renders up to 5 as clickable links
  - Fallback: if no visited routes found, show a generic "Back to Library" button linking to `/library`

*Part B — Runtime caching audit:*
- Review each rule in [vite.config.ts:525-556](vite.config.ts#L525-L556):
  - `/images/*` CacheFirst — OK, already has `maxAgeSeconds: 30 days`
  - `images.unsplash.com` StaleWhileRevalidate — OK
  - `huggingface.co` CacheFirst — OK
  - `/api/ai/*` NetworkOnly — OK
- Add new rules where gaps exist:
  - `https://*.supabase.co/rest/v1/profiles` → `StaleWhileRevalidate` with short TTL (1 hour) for user profile metadata
  - `/api/abs/proxy/*` audio streams → explicitly `NetworkOnly` (audio is range-requested; caching breaks seeking)
  - Icon/shortcut images from S03 → already covered by the glob pattern `**/*.{js,css,html,svg,png,webp,woff2}`

*Part C — Manifest polish:*
- Add to manifest config:
  - `categories: ['education', 'productivity']`
  - `description` (already present — verify it's still appropriate)
  - `dir: 'ltr'`, `lang: 'en'`

*Part D — Lighthouse run:*
- Run `npx lighthouse http://localhost:4173/ --only-categories=pwa --output html --output-path lighthouse-pwa-report.html` after `npm run build && npm run preview`.
- Target: 100. Triage any remaining flags.
- Save report to `docs/reviews/performance/lighthouse-pwa-2026-04-24.md` with score + notes.

**Patterns to follow:**
- Existing runtime caching in [vite.config.ts:525-556](vite.config.ts#L525-L556).
- Offline-page structure in current [public/offline.html](public/offline.html).

**Acceptance Criteria (Given/When/Then):**
- **AC1 — Offline page is branded:** *Given* the user is offline and navigates to a route not in the SW cache, *when* the offline fallback is served, *then* the page displays Knowlune branding (logo, colors, fonts) consistent with the rest of the app.
- **AC2 — Recently visited routes shown:** *Given* the offline page is visible and the user has visited pages previously in the same browser, *when* the page loads, *then* up to 5 clickable links to those cached routes are rendered.
- **AC3 — Offline page fallback:** *Given* the user is offline and has never visited any non-cached pages, *when* the offline page loads, *then* a "Back to Library" button links to `/library`.
- **AC4 — Lighthouse 100:** *Given* the production build, *when* Lighthouse PWA audit is run against the preview server, *then* the PWA score is 100.
- **AC5 — Audio streams still work:** *Given* a user is playing an Audiobookshelf audiobook, *when* they seek forward or backward in the audio, *then* seeking completes without error (verifies `NetworkOnly` strategy for `/api/abs/proxy/*`).
- **AC6 — Regression check for other caching rules:** *Given* a user has previously loaded the app online, *when* they go offline and navigate to a previously visited page, *then* the page loads from SW cache as before.

**Test scenarios:**
- Manual: DevTools → Network → Offline → visit `/nonexistent` → branded offline page renders.
- Manual: Visit 3 pages online → go offline → open offline page → see 3 clickable links.
- Automated: Lighthouse CI `npx lighthouse --only-categories=pwa` against `npm run preview` → score 100.
- Manual: Play audiobook → seek forward 30 seconds → audio resumes correctly (no cache corruption).
- Existing E2E: `npm run test:e2e` smoke specs pass — sync, library, notes all still function offline.

**Verification:**
1. `npm run build && npm run preview` then Lighthouse PWA = 100 on `http://localhost:4173/`.
2. DevTools → Application → Service Workers: SW updates to new version with new runtime-caching rules (from S04 changes) after rebuild.
3. DevTools → Application → Cache Storage: offline.html present; new cache entries for Supabase profile endpoint visible after profile load.
4. Manual offline test: clickable recent-routes list works.
5. Manual seek test: audio playback seeking unbroken.

## System-Wide Impact

- **Interaction graph:** Changes touch 4 surfaces independently — `index.html` (S01), `Layout.tsx` + `AudiobookshelfService` (S02), `PWAInstallBanner` + manifest (S03), `offline.html` + runtime caching (S04). No shared state mutation; no new subsystems introduced.
- **Error propagation:** MediaSession API failures fall back to current behavior (no lock-screen controls, in-app playback unchanged). Update-prompt failures (if `useRegisterSW` errors on an unsupported browser) fall back to the existing silent-update model. Runtime caching additions cannot break existing caches because they scope to new URL patterns.
- **State lifecycle risks:** The SW version bump forces one-time re-precache on existing users — expected and handled by Workbox. Users see the update prompt from S02 exactly once. No migration needed on Dexie, localStorage, or the sync engine.
- **API surface parity:** `PWAUpdatePrompt` is a new component with no external callers. `AudiobookshelfService` gains MediaSession wiring as internal detail — no public method signatures change.
- **Integration coverage:** Existing Playwright E2E suite stays green — none of the changes touch business-logic flows. New unit tests cover the MediaSession + iOS-detection branches.
- **Unchanged invariants:** CSP policy unchanged. Sync engine (E92) unchanged. Dexie schema unchanged. React Router routes unchanged. All existing offline indicators (`useSyncStatusStore`, "You are offline" toast) continue to work.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `viewport-fit=cover` causes unexpected layout clipping on existing pages with fixed top elements | S01's AC3 explicitly verifies header rendering. Rollback is a one-line revert of the viewport meta. |
| `useRegisterSW` from `virtual:pwa-register/react` is incompatible with our current `vite-plugin-pwa` version | Already on v1.2.0 which supports the hook per the plugin's docs. Feature-detect + no-op as belt-and-braces. |
| MediaSession metadata references a cover URL that 404s offline | Cover URLs are already cached by Workbox image rules; MediaSession handles 404s silently (lock screen just shows no art). |
| iOS Safari 15.x user sees MediaSession no-op and complains about "missing" feature | Graceful degradation by design — no user-facing error, in-app controls unchanged. Note in release notes. |
| pwa-asset-generator produces images that exceed repo-size budget | Splash PNGs are ~100KB each × 12 = ~1.2MB total. Acceptable. If over budget, use `--quality 80` flag or defer iOS-specific sizes. |
| Update prompt fires during the middle of a user flow (e.g., while recording a note) | Prompt is non-blocking and dismissable; "Later" keeps the session alive. User controls the reload moment. |
| Lighthouse 100 requires service-worker registration during dev which we've disabled (`devOptions.enabled: false` in vite.config.ts:558-560) | Run Lighthouse against `npm run preview` (production build), not dev server. Already the convention. |
| Manifest shortcut URLs for `/notes?new=1` and `/settings?focus=sync` do not handle the query params | E120-S03 Approach notes explicitly verify + add lightweight handlers if missing. |

## Documentation / Operational Notes

- **No feature flag** — all changes are additive and strictly safer than current behavior for all users.
- **No migration** — optional PWA metadata additions, no data model changes.
- **Rollback plan per story:** each story is a separate commit (or small cluster) within a single branch. Revert the commit to roll back; no database or user-state side effects.
- **SW cache invalidation:** the SW precache manifest is content-hashed by Workbox. Any `vite.config.ts` or `index.html` change forces a new precache on next user visit — this is desired and handled by E120-S02's update prompt.
- **Sprint-status:** add `epic-120: active` + 4 story entries (`120-1` through `120-4`) to [docs/implementation-artifacts/sprint-status.yaml](docs/implementation-artifacts/sprint-status.yaml) before work starts.
- **Update known-issues.yaml** if any open entry references "missing install prompt on iOS" or "no update banner" — mark as fixed by this epic.

## Branching Strategy

- **Work in a git worktree off `main`** to keep the current `feat/app-auth-surface-guest-gate` branch (with 20 modified files and unrelated WIP for guest-gate/audiobook-m4b/youtube-embed-fallback) untouched. Use the `superpowers:using-git-worktrees` skill.
- **Branch name:** `feature/e120-pwa-polish` (per the `feature/e##-...` convention in [story-workflow.md](.claude/rules/workflows/story-workflow.md)).
- **One PR** for the full epic, since the four stories share files (`Layout.tsx`, `vite.config.ts`) and review context. If PR grows beyond ~600 lines added, split at story boundaries.

## Performance Baseline

Routes to baseline before work starts (consumed by `performance-benchmark` agent):

- `/` — landing / root (mandatory, always baselined)
- `/library` — shortcut target, typical first post-install route
- `/audiobook/:id` — audiobook playback screen, affected by MediaSession changes
- `/settings` — shortcut target (`?focus=sync`)
- `/notes` — shortcut target (`?new=1`)

Metrics captured: TTFB, FCP, LCP, DOM Complete, bundle size (Chromium desktop + mobile emulation).

Regression thresholds per [`.claude/agents/performance-benchmark.md`](.claude/agents/performance-benchmark.md): >50% timing increase OR >500ms absolute = HIGH; >25% = MEDIUM.

## Rollback

- **S01 (splash / viewport):** revert the commit touching `index.html` and delete `public/splash/`. No user-visible residual.
- **S02 (update prompt / MediaSession):** revert the commit; remove `PWAUpdatePrompt` import from `Layout.tsx`; delete the MediaSession block in `AudiobookshelfService`. Users who had already received the update will keep the SW version they have; new visitors will not see the prompt.
- **S03 (iOS card / shortcuts):** revert the PWAInstallBanner iOS branch and remove `shortcuts` from manifest. Existing installed shortcuts on users' devices remain until the user uninstalls and reinstalls the PWA; benign.
- **S04 (offline page / runtime cache / Lighthouse):** revert offline.html and the added caching rules. The next SW update will propagate the revert to users.

All rollbacks are additive-reversals — no destructive data migration to undo.

## Sources & References

- Related analysis: [docs/analysis/mobile-strategy-comparison-2026-04-24.md](../analysis/mobile-strategy-comparison-2026-04-24.md) — why PWA over Capacitor or RN
- Related files: [vite.config.ts](../../vite.config.ts), [index.html](../../index.html), [src/app/components/PWAInstallBanner.tsx](../../src/app/components/PWAInstallBanner.tsx), [src/app/components/Layout.tsx](../../src/app/components/Layout.tsx), [src/services/AudiobookshelfService.ts](../../src/services/AudiobookshelfService.ts), [public/offline.html](../../public/offline.html)
- Related memory: `project_tauri_rejected.md` (2026-03-28), `feedback_epic_orchestrator_autopilot.md`, `reference_sync_engine_api.md`
- External docs: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/), [MDN MediaSession API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API), [Web.dev Manifest Shortcuts](https://web.dev/add-manifest-shortcut/), [Apple Web Apps Reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
