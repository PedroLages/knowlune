# Mobile Strategy Comparison: PWA vs. Capacitor vs. React Native

**Date:** 2026-04-24
**Author:** Pedro (with Claude)
**Context:** Decision support for E120 (PWA Polish) and beyond. Answers "should we build a native React Native app?"

## TL;DR

**Recommendation:** No native rewrite. Polish the existing PWA (E120, 2-4 days). Revisit Capacitor only if the PWA hits a real wall (App Store distribution, true background audio with lock-screen controls, native push). Do **not** consider React Native — the cost is 4-8 months against this codebase and the payoff is marginal.

Prior precedent: Tauri/desktop wrapper was rejected on 2026-03-28 on the same logic — PWA is sufficient, invest in UX instead. This analysis extends that posture to mobile.

## Codebase Snapshot (grounding the estimates)

Measured 2026-04-24:

- **~288k LoC** across **1,386 files** in `src/`
- **73 route-level pages** in `src/app/pages/`
- **56 shadcn/ui components** in `src/app/components/ui/`
- **84 Zustand stores** in `src/stores/`
- **50+ Dexie tables** in `src/db/schema.ts` (plus E92 sync engine)
- **2,199 DOM refs** (`window`, `document`, `localStorage`, `iframe`, `<audio>`, `<video>`) across the codebase
- **Tailwind v4** (not v3) — NativeWind compatibility is ~90% with edges on v4-specific features
- **epub.js iframe reader** with CSS injection for theming and `getBoundingClientRect()` for highlight offsets
- **Audiobookshelf integration** via HTML5 `<audio>` singleton + OPFS offline storage + REST proxy (520+ refs)
- **Supabase PKCE auth** via `exchangeCodeForSession()` using `window.location` manipulation
- **vite-plugin-pwa v1.2.0** already configured with Workbox, maskable icons, runtime caching, offline fallback

The foundation for PWA is ~90% present. The foundation for Capacitor is the same as PWA (wraps the same web build). The foundation for React Native is **zero** — nothing ports mechanically.

## Decision Matrix

All estimates are calibrated against the codebase snapshot above.

| Dimension | PWA Polish | Capacitor Wrapper | React Native Rewrite |
|---|---|---|---|
| **Effort** | **2-4 days** | **2-3 weeks** | **4-8 months** |
| **Codebase reuse** | 100% | ~98% (thin native shell) | ~5-10% (business logic only) |
| **App Store presence** | ❌ No | ✅ Yes (both stores) | ✅ Yes (both stores) |
| **True background audio** | ⚠️ Partial (MediaSession unlocks lock-screen, but browsers throttle) | ✅ Yes (plugin-based) | ✅ Best (native track player) |
| **Push notifications (iOS)** | ⚠️ Web Push 16.4+ only, requires PWA install | ✅ Full APNs via plugin | ✅ Full APNs |
| **Lock-screen controls** | ✅ Via MediaSession API (free with E120-S02) | ✅ Via plugin | ✅ Native |
| **Offline-first** | ✅ Already works (Dexie + SW + E92 sync) | ✅ Same as PWA | ⚠️ Rewrite to SQLite/MMKV |
| **epub.js reader** | ✅ Works | ⚠️ WebView — iframe quirks on mid-range Android | ❌ **Blocker** — no RN-native equivalent |
| **Audiobookshelf integration** | ✅ Works | ✅ Works | ⚠️ Client rewrite required |
| **Supabase auth** | ✅ Works | ⚠️ Deep-link config (~5-10 hrs) | ⚠️ Deep-link + secure token storage |
| **Tailwind v4 styling** | ✅ Native | ✅ Native | ⚠️ NativeWind ~90% compat, theme edges |
| **shadcn/ui (56 components)** | ✅ Native | ✅ Native | ❌ Full rewrite to RN Paper/NativeBase |
| **React Router v7 (73 pages)** | ✅ Native | ✅ Native | ❌ Rewrite to React Navigation |
| **Distribution cost** | ✅ Free | 💰 $99/yr Apple + $25 Google one-time | 💰 Same as Capacitor |
| **Review cycle risk** | N/A | ⚠️ App Store reject risk for "just a wrapper" | ✅ Lower (full native) |
| **Maintenance burden** | 1 codebase | 1 codebase + thin native shell | 2 codebases forever (or RN-only, losing web) |

## Effort Breakdown

### (A) PWA Polish — 2-4 days

**Why this small:** The foundation is already shipped. Only additive work.

Scope:
- iOS splash screens + `viewport-fit=cover`
- SW update-prompt UI component
- MediaSession API wiring in `AudiobookshelfService`
- iOS install-instruction card (Safari lacks `beforeinstallprompt`)
- Manifest shortcuts (long-press home icon)
- Branded offline fallback page
- Runtime-caching audit + Lighthouse 100

Risk: Near-zero. All changes are additive config + small UI components. See [docs/plans/2026-04-24-005-feat-e120-pwa-polish-plan.md](../plans/2026-04-24-005-feat-e120-pwa-polish-plan.md).

**When to pick:** Always — this is table-stakes regardless of longer-term strategy. Do this first no matter what.

### (B) Capacitor Wrapper — 2-3 weeks

**Why this cost:** Wraps the existing web app in a native shell. All UI survives. Core risk is WebView performance tuning and App Store review.

Breakdown:
- **Day 1-3:** `npx cap init`, wire iOS + Android projects, set `webDir` to `dist`, configure deep links for Supabase OAuth callback
- **Week 1-2:** Install plugins (`@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/preferences`, `@capacitor/share`, audio background plugin). Wire native session controls to `AudiobookshelfService`.
- **Week 2:** WebView performance tuning. epub.js iframe + highlight selection may have jank on mid-range Android — budget 3-5 days. Ensure Supabase PKCE deep-link flow works end-to-end.
- **Week 3:** App Store + Play Store submission. Splash assets, icon sets, Apple privacy manifest (required since 2024), Play Store data-safety form.

Risk surface:
- epub.js iframe behavior in WKWebView — tolerable but needs testing
- Supabase PKCE deep-link edge cases (returning to already-running app vs. cold start)
- App Store reviewer flagging "just a web wrapper" (mitigate by exposing genuine native plugins — audio, share, notifications — so reviewers see platform integration)

**When to pick:** App Store listings become strategic, true background audio is requested by users, or native push is required — and you want to keep shipping web features in lockstep (one codebase).

### (C) React Native Rewrite — 4-8 months

**Why this cost:** The codebase is not architected to port. Every layer changes.

Hard blockers ordered by pain:

1. **epub.js reader → 3-6 weeks.** No RN-native EPUB library matches capability (iframe CSS injection, highlight offsets via `getBoundingClientRect`, annotation layer with paragraph offsets). Options: `react-native-webview` wrapper (defeats the purpose — you're back to Capacitor), or integrate Readium toolkit (Swift + Kotlin bindings, large native lift).
2. **56 shadcn/Radix components → 2-3 weeks.** Every Dialog, Sheet, Popover, Tooltip, Hover Card, Command needs a new implementation in RN Paper or NativeBase.
3. **73 route pages → 1-2 weeks.** Full navigation rewrite to React Navigation with deep linking for Supabase callback.
4. **Tailwind v4 → NativeWind — 1-2 weeks.** ~90% compatible; theme tokens in OKLCH may need transformation. Reader theming (`theme.css`) uses CSS variable cascades NativeWind doesn't express cleanly.
5. **2,199 DOM refs → platform APIs — 3-4 weeks systematic.** Every `localStorage` → `AsyncStorage`, every `window.matchMedia` → `Dimensions`/`Appearance`, every `iframe` → `react-native-webview` or custom native component.
6. **Dexie (50+ tables) → SQLite/WatermelonDB — 2-3 weeks.** Plus the E92 sync engine rewrite to speak to the new store. The LWW conflict logic, dead-letter queue, and monotonic counters all need reimplementation.
7. **Audiobookshelf client — 1-2 weeks.** HTML5 `<audio>` singleton, OPFS offline storage, range-request handling — all need native equivalents (`react-native-track-player`, file-system module).
8. **Test suite rewrite — 2-4 weeks.** Playwright E2E tests (the bulk of coverage) don't run on RN. Detox or Maestro required. Every test gets rewritten.

Plus: you'd either **lose the web app** (regression for desktop users who access via knowlune.pedrolages.net) or **maintain two codebases forever**, doubling every feature's cost.

**When to pick:** You have a dedicated mobile team AND App Store distribution is core to the business model AND you've validated that Capacitor's WebView performance is the actual bottleneck. For Knowlune today: **no**.

## Recommended Sequence

1. **Now → 1 week:** Ship E120 (PWA Polish). 2-4 days focused work, zero architectural risk. Unlocks lock-screen audio controls via MediaSession, which is the #1 thing users assume requires a native app but doesn't.
2. **Measure (1 month):** Add analytics on mobile visits, install rate, session length, offline usage. Watch for user complaints about: lock-screen controls, true background audio (MediaSession throttling), iOS push notifications, App Store discoverability.
3. **Decision gate:** If the measured data shows real pain Capacitor would solve — allocate E## for Capacitor (2-3 weeks). Otherwise, stop here. The PWA is the product.
4. **RN is not on the roadmap.** Reconsider only if (a) a native-only feature becomes strategic (e.g., on-device ML with Core ML / ONNX), or (b) App Store reviewer rejects a Capacitor build for "just a wrapper" and can't be mitigated with added native plugins.

## Related Documents

- [E120 PWA Polish Plan](../plans/2026-04-24-005-feat-e120-pwa-polish-plan.md)
- [Tauri Rejection Memory](/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/project_tauri_rejected.md) — prior parallel decision
- [Sync Engine Architecture](../plans/sync-architecture.md) — E92 foundation that makes PWA offline-first viable
