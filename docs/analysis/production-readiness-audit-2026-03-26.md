# Production-Readiness Audit & Action Plan

**Date**: 2026-03-26
**Scope**: Full app audit — screens, flows, systems, infrastructure
**Status**: 27 epics complete, Epic 28 in progress (7/12 stories)

---

## Context

Knowlune has completed 27 epics (138+ stories) and is finishing Epic 28 (YouTube Course Builder, 7/12 stories done). The app is a personal learning platform with courses, notes, quizzes, AI features, analytics, premium subscriptions, and a sophisticated local-first architecture (Dexie IndexedDB + Zustand + React 19 + Tailwind v4).

This document identifies everything still needed before the app can be considered **production-ready** — based on a screen-by-screen, flow-by-flow, system-by-system audit.

---

## Part 1: What Has Been Built

**28 Epics covering:**
- Core learning (course import, lesson player, notes, progress tracking, streaks, gamification, momentum, analytics)
- AI infrastructure (embeddings, RAG, vector search, web workers, Ollama integration)
- Quiz system (6 epics: basic quizzes → diverse types → timed → analytics → accessibility)
- Platform (Supabase auth, Stripe subscriptions, entitlements, GDPR, legal pages)
- Advanced features (learning paths, flashcards, spaced repetition, career paths, Pomodoro)
- Polish (navigation cleanup, author management, import wizard, multi-path journeys, analytics consolidation)
- YouTube import (current: URL parser, API client, transcript pipeline, wizard, AI structuring)

**30+ pages, 50+ custom components, 22 Zustand stores, 27 Dexie tables, 100+ E2E tests, 90+ unit test files**

### Completed Epics Summary

| Phase | Epics | Key Deliverables |
|-------|-------|------------------|
| **Core Learning (E1-E8)** | 8 epics, 60 stories | Course import, lesson player, notes, progress, streaks, gamification, momentum, analytics |
| **AI Infrastructure (E9-E9B)** | 2 epics, 9 stories | AI provider config, web workers, embedding pipeline, video summaries, RAG Q&A, learning paths, knowledge gaps, auto-tagging |
| **Onboarding & Advanced (E10-E11)** | 2 epics, 8 stories | First-use onboarding, empty states, spaced review, retention dashboard, data export |
| **Quiz System (E12-E18)** | 7 epics, 43 stories | Quiz types, navigation, timer, feedback, scoring, analytics, accessibility, integration |
| **Platform (E19)** | 1 epic, 9 stories | Supabase auth, Stripe subscriptions, entitlements, premium gating, legal pages, GDPR |
| **Advanced Features (E20-E22)** | 3 epics, 16 stories | Career paths, flashcards, heatmap, radar chart, Pomodoro, Ollama integration, auto-categorization |
| **Polish (E23-E27)** | 5 epics, 29 stories | Navigation cleanup, import wizard, author management, multi-path learning, analytics consolidation |
| **YouTube (E28)** | 1 epic, 7/12 done | URL parser, API client, transcripts, wizard, rule-based grouping, AI structuring |

---

## Part 2: Critical Findings — What's Missing or Weak

### TIER 1: BLOCKERS (Must fix before any production launch)

#### 1.1 Authentication Placement & Flow
- **Problem**: Auth dialog is ONLY accessible via (a) premium feature upgrade CTAs and (b) Settings page. There is NO standalone login/signup page, no `/login` or `/signup` route, no prominent sign-in button on the main UI for unauthenticated users.
- **Impact**: New users have no obvious way to create an account. The header shows a user avatar dropdown but if not signed in, there's no clear "Sign In" CTA.
- **Fix**: Create a dedicated auth page (`/login`) OR add a prominent "Sign In" button to the header when unauthenticated. Consider whether the app should require auth for any features or remain fully usable without auth.

#### 1.2 No Password Change or Email Change UI
- **Problem**: Users cannot change their password or email from within the app. Magic link is available as a workaround for password-less login, but there's no "Change Password" or "Change Email" in Settings.
- **Impact**: Basic account management missing. Users locked out if they forget password and don't have magic link setup.
- **Fix**: Add password change and email change forms to Settings > Account section. Supabase supports `auth.updateUser()` for both.

#### 1.3 No Forgot Password Flow
- **Problem**: The EmailPasswordForm has sign-in and sign-up tabs but NO "Forgot Password?" link.
- **Impact**: Users who forget their password have no recovery path except magic link (which they may not know about).
- **Fix**: Add "Forgot Password?" link to sign-in form that triggers Supabase `auth.resetPasswordForEmail()`.

#### 1.4 Profile Data is Local-Only
- **Problem**: Display name, bio, and avatar are stored in localStorage only — not synced to Supabase. If user switches devices, all profile data is lost.
- **Impact**: Multi-device usage breaks profile continuity. Premium users paying for the service expect persistence.
- **Fix**: Sync profile data to Supabase user metadata (`auth.updateUser({ data: { ... } })`).

#### 1.5 No E2E Tests for Auth/Premium/Subscription
- **Problem**: ZERO E2E tests for authentication flow, premium feature gating, Stripe checkout, trial management, or entitlement validation.
- **Impact**: Core monetization and access control flows are untested — regressions won't be caught.
- **Fix**: Add `tests/e2e/auth-flow.spec.ts` and `tests/e2e/premium-gating.spec.ts` with MSW mocks for Supabase/Stripe.

#### 1.6 Pre-existing Test Failures Unregistered
- **Problem**: 4 test suites failing on main (Reports.test.tsx: 4 failures, navigation.spec.ts: 6 failures, Courses.test.tsx: 2 failures, story-e11-s01.spec.ts: non-deterministic). Not registered in known-issues.yaml.
- **Fix**: Register all in known-issues.yaml, fix or document waivers.

#### 1.7 KI-015: TypeScript Error in AIConfigurationSettings
- **Problem**: References undefined `isPrivateNetworkUrl` function — actual typecheck error in production code.
- **Fix**: Implement the function or remove the reference.

---

### TIER 2: HIGH PRIORITY (Should fix before launch)

#### 2.1 No Network Status Awareness in UI
- **Problem**: `useOnlineStatus()` hook exists but is NOT used in any page. When offline, API calls silently fail. No retry-on-reconnect. The offline indicator exists in Layout but many pages don't respond to offline state.
- **Fix**: Add network-aware error states to pages that fetch data. Show offline indicator prominently. Auto-retry failed operations when connection resumes.

#### 2.2 Missing Error States on Several Pages
- **Problem**: These pages have no visual error handling if data loading fails:
  - FlashcardReview — no error state (blank screen on failure)
  - ReviewQueue — console.error only, no UI error
  - CareerPaths — no error handling at all
  - Reports — toast only, charts may render empty/broken
- **Fix**: Add consistent error cards with retry buttons (like SessionHistory's pattern).

#### 2.3 Missing Empty States
- **Problem**: ReviewQueue has no empty state when queue is empty. Flashcards has no "no cards due today" state. CareerPaths has no empty state.
- **Fix**: Add empty states following the established EmptyState component pattern.

#### 2.4 No Course Completion Celebration
- **Problem**: When a user finishes the last lesson of a course, nothing happens — no modal, no confetti, no congratulations. The app has confetti for onboarding completion and challenge milestones but not course completion.
- **Fix**: Add completion celebration modal when final lesson is marked complete.

#### 2.5 CSS/UI Bugs (5 open known issues)
- **KI-011**: Topic filter tags render as unreadable single line
- **KI-012**: AI model selector dropdown broken CSS
- **KI-013**: Direct Connection tooltip dark mode styling
- **KI-014**: Settings page heading hierarchy inconsistent
- **KI-015**: AIConfigurationSettings references undefined function
- **Fix**: Resolve all 5 UI bugs.

#### 2.6 Image Alt Text Gaps
- **Problem**: Only ~38 `alt` attributes found across 1000+ image usages. Course thumbnails, author avatars, and decorative images likely missing alt text.
- **Fix**: Audit all `<img>` and background images. Add descriptive alt text or `alt=""` for decorative images.

#### 2.7 No Virtualization for Long Lists
- **Problem**: Course list, note list, session history, review queue — none use virtualization. With 100+ items, rendering could become janky.
- **Fix**: Add `react-window` or `@tanstack/virtual` for lists that can grow large.

#### 2.8 E28 YouTube Import — No E2E Tests
- **Problem**: Epic 28 (YouTube Course Builder) has zero E2E tests for 7 completed stories.
- **Fix**: Add E2E tests before epic completion.

#### 2.9 Accessibility Tests Skipped
- **Problem**: 3 accessibility E2E specs are skipped (keyboard nav, ARIA labels, ARIA live regions for video player).
- **Fix**: Unskip and fix, or replace with axe-core automated scanning.

---

### TIER 3: MEDIUM PRIORITY (Should fix for quality)

#### 3.1 Onboarding Gaps
- No re-triggerable tutorial for returning users
- Action-based onboarding (auto-advancing) may confuse users who don't follow the exact sequence
- Learning Paths requires prior AI usage to appear in sidebar — catch-22 for discoverability
- Flashcards always visible in nav but Notes hidden until created (inconsistent progressive disclosure)
- **Fix**: Add feature discovery tooltips, contextual hints, or a "Tour" button in Settings.

#### 3.2 Search & Discoverability
- Keyboard shortcuts (`?`) not mentioned anywhere until user discovers them
- No "What's New" or feature announcement system for premium features
- 404 page lacks helpful suggestions (only "Go to Overview")
- **Fix**: Add keyboard shortcut hint in header, feature announcement cards, improve 404.

#### 3.3 Form Validation Accessibility
- No ARIA live announcements for validation errors
- Missing `aria-describedby` on error messages
- **Fix**: Add aria-describedby to form fields with associated error messages.

#### 3.4 Responsive Images
- No `srcset`/`sizes` on images — full-resolution images loaded on mobile
- **Fix**: Add responsive image attributes for thumbnails and author photos.

#### 3.5 Performance: Missing useMemo/useCallback
- MyClass.tsx and Courses.tsx sort/filter on every render without memoization
- **Fix**: Add useMemo for computed lists, useCallback for event handlers.

#### 3.6 `@test/` Path Alias Technical Debt
- Carried across 5 epics without resolution (3-epic close-or-automate rule violated)
- **Fix**: Make a decision — implement or close as wont-fix.

#### 3.7 Large Component Files
- VideoPlayer.tsx (1334 lines), Settings.tsx (1168 lines), NoteEditor.tsx (1110 lines), LessonPlayer.tsx (1074 lines)
- Not blockers but increase maintenance burden
- **Fix**: Consider decomposition on next major touch.

---

### TIER 4: LOW PRIORITY (Nice to have for polish)

#### 4.1 No External Error Reporting
- Error tracking is local ring buffer only — no Sentry, LogRocket, or similar
- Performance monitoring logs to console in dev only
- **Fix**: Add Sentry (or similar) for production error tracking.

#### 4.2 No Analytics/Telemetry
- No product analytics (Posthog, Mixpanel, etc.) to understand user behavior
- **Fix**: Add anonymized usage analytics if desired.

#### 4.3 PWA Install Banner
- Relies on browser's native install prompt — no custom "Add to Home Screen" UX
- Update prompt is a toast (may be missed)
- **Fix**: Add custom install banner component.

#### 4.4 Video Accessibility
- Captions supported but optional — courses without captions have no accessibility fallback
- No adaptive bitrate streaming (single video source)
- **Fix**: Document as user responsibility; consider auto-captioning via Whisper.

#### 4.5 CSP Headers
- Content Security Policy not explicitly set (relies on server/nginx config)
- **Fix**: Add CSP meta tag or configure in Dockerfile nginx.

#### 4.6 No Contact/Support Channel
- Legal pages mention "Contact Us" in body but no actual support link/form
- **Fix**: Add support email or feedback form.

---

## Part 3: Page-by-Page State Audit

| Page | Loading | Empty | Error | Network | Issues |
|------|---------|-------|-------|---------|--------|
| **Overview** | Skeleton | When no imports | Global boundary | — | — |
| **Courses** | Instant | Multi-level | Metrics fail silently | — | — |
| **MyClass** | Skeleton | Per-tab | Global boundary | — | — |
| **Notes** | Skeleton | Multi-level | Graceful fallback | — | — |
| **Authors** | Skeleton | Multi-level | Global boundary | — | — |
| **Reports** | None | When no activity | Toast errors | — | Charts may render empty |
| **Sessions** | DelayedFallback | When none | Error card + retry | — | Best error handling |
| **Challenges** | DelayedFallback | When all empty | Error card + retry | — | — |
| **CareerPaths** | Skeleton rows | **MISSING** | **MISSING** | — | No error handling |
| **LearningPaths** | Unknown | Dialog only | Partial | — | — |
| **Flashcards** | Phase-based | Partial | **MISSING** | — | No "no due cards" state |
| **ReviewQueue** | Partial | **MISSING** | Partial | — | console.error only |
| **Settings** | Instant | N/A | Per-section | — | — |

---

## Part 4: Auth & Account Management Audit

| Feature | Status | Notes |
|---------|--------|-------|
| Sign-up (email/password) | Implemented | Via AuthDialog only |
| Sign-in (email/password) | Implemented | Via AuthDialog only |
| Magic link sign-in | Implemented | 60s resend cooldown |
| Google OAuth | Implemented | Redirect-based |
| Sign-out | Implemented | Header dropdown |
| Email verification | Supabase-handled | Automatic on sign-up |
| **Password reset** | **MISSING** | No "Forgot Password?" UI |
| **Password change** | **MISSING** | No UI in Settings |
| **Email change** | **MISSING** | No UI in Settings |
| Profile editing (name/bio/avatar) | Implemented | **localStorage only — not synced** |
| Account deletion (GDPR) | Implemented | 7-day soft-delete, multi-step |
| Data export (GDPR) | Implemented | JSON, CSV, Markdown, Open Badges |
| Subscription management | Implemented | Stripe portal integration |
| Premium gating | Implemented | Component-level, blurred preview |
| Trial management | Implemented | 14-day free trial, countdown badge |
| Offline entitlement cache | Implemented | 7-day TTL, auto-revalidation |
| **Route-level auth guards** | **MISSING** | All routes accessible, gating at component level |
| **Standalone login page** | **MISSING** | No `/login` or `/signup` route |
| **Prominent sign-in CTA** | **MISSING** | No header button for unauthenticated users |

---

## Part 5: Prioritized Action Plan

### Epic 29: Production Readiness — Auth & Account Management
| # | Story | Tier | Scope |
|---|-------|------|-------|
| S01 | Standalone auth page or prominent header sign-in CTA | T1 | New page or Layout change |
| S02 | Forgot password flow (reset via email) | T1 | AuthDialog enhancement |
| S03 | Change password + change email in Settings | T1 | Settings page enhancement |
| S04 | Sync profile data to Supabase (name, bio, avatar) | T1 | Store + API changes |

### Epic 30: Production Readiness — Error Handling & State Gaps
| # | Story | Tier | Scope |
|---|-------|------|-------|
| S01 | Network status awareness (offline indicator, retry-on-reconnect) | T2 | Layout + page changes |
| S02 | Error states for Flashcards, ReviewQueue, CareerPaths, Reports | T2 | 4 page fixes |
| S03 | Empty states for ReviewQueue, Flashcards "no due", CareerPaths | T2 | 3 page fixes |
| S04 | Course completion celebration (confetti + modal) | T2 | LessonPlayer enhancement |
| S05 | Fix 5 open CSS/UI bugs (KI-011 through KI-015) | T2 | Targeted fixes |

### Epic 31: Production Readiness — Testing & Quality
| # | Story | Tier | Scope |
|---|-------|------|-------|
| S01 | Auth flow E2E tests (sign-up, sign-in, sign-out, magic link) | T1 | New test file |
| S02 | Premium gating E2E tests (trial, subscription, entitlement) | T1 | New test file |
| S03 | Fix pre-existing test failures + register in known-issues.yaml | T1 | Test fixes |
| S04 | YouTube import E2E tests (E28 coverage) | T2 | New test file |
| S05 | Unskip accessibility E2E tests + axe-core scanning | T2 | Test fixes |
| S06 | Image alt text audit and remediation | T2 | Multi-file fixes |

### Epic 32: Production Readiness — UX Polish & Performance
| # | Story | Tier | Scope |
|---|-------|------|-------|
| S01 | Onboarding improvements (tooltips, re-triggerable tour, discovery) | T3 | New components |
| S02 | 404 page improvements + keyboard shortcut discoverability | T3 | Page enhancements |
| S03 | List virtualization for courses, notes, sessions | T2 | Component upgrades |
| S04 | useMemo/useCallback optimization pass | T3 | Multi-file refactor |
| S05 | Responsive images (srcset/sizes) | T3 | Multi-file update |

### Epic 33: Production Readiness — Infrastructure & Monitoring
| # | Story | Tier | Scope |
|---|-------|------|-------|
| S01 | Sentry integration for error reporting | T4 | New integration |
| S02 | CSP headers configuration | T4 | Nginx/meta tag |
| S03 | Product analytics (optional, anonymized) | T4 | New integration |
| S04 | Custom PWA install banner | T4 | New component |
| S05 | Support/feedback channel | T4 | New page/component |

---

## Part 6: Verification Strategy

After implementing the above, verify production-readiness with:

1. **Full test suite pass**: `npm run test:unit && npx playwright test`
2. **Build verification**: `npm run build` with zero warnings
3. **Lighthouse audit**: Performance >= 90, Accessibility >= 95, Best Practices >= 90, SEO >= 90
4. **Manual flow walkthrough**:
   - First-time user: land → sign up → import course → play lesson → take quiz → view analytics
   - Returning user: sign in → resume lesson → check progress → manage subscription
   - Offline user: go offline → verify cached content works → come back online → verify sync
   - Premium user: subscribe → access all features → manage subscription → cancel
5. **Cross-browser testing**: Chrome, Safari, Firefox, mobile Chrome, mobile Safari
6. **Security checklist**: OWASP top 10 review, CSP headers, API key exposure scan
7. **Performance profiling**: Bundle size check, Core Web Vitals in production mode

---

## Summary

| Tier | Items | Estimated Stories | Priority |
|------|-------|-------------------|----------|
| **T1 Blockers** | Auth placement, password/email management, profile sync, test failures | 8 stories | **Mandatory before launch** |
| **T2 High** | Network awareness, error/empty states, completion UX, UI bugs, testing | 10 stories | **Mandatory before launch** |
| **T3 Medium** | Onboarding, discoverability, performance, a11y forms, responsive images | 5 stories | Post-launch OK |
| **T4 Low** | Monitoring, analytics, PWA, CSP, support channel | 5 stories | Post-launch OK |
| **Total** | | **~28 stories across 5 epics** | |

**Recommended approach**: Epics 29-31 (T1+T2) are mandatory before any production launch. Epics 32-33 (T3+T4) improve quality but can ship incrementally post-launch.
