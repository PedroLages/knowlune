---
story_id: E19-S03
story_name: "Entitlement System & Offline Caching"
status: done
started: 2026-03-26
completed: 2026-03-26
reviewed: true
review_started: 2026-03-26
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 19.3: Entitlement System & Offline Caching

## Story

As a premium user,
I want my subscription status validated against the server and cached locally,
so that I can access premium features offline within a grace period.

## Acceptance Criteria

- AC1: Online launch validates entitlement against Supabase server and caches result in IndexedDB
- AC2: Offline with fresh cache (<7 days) honors cached entitlement
- AC3: Offline with stale cache (>7 days) disables premium and shows message
- AC4: Auto-revalidates when coming back online
- AC5: Cancelled subscription shows resubscribe option
- AC6: isPremium() guard — non-premium users see an upgrade CTA
- AC7: Network error with fresh cache honors cached tier silently
- AC8: Explicit denial from server clears cache immediately
- AC9: Loading state shows skeleton for premium content while resolving

## Tasks / Subtasks

- [x] Task 1: Create useIsPremium() hook with server validation (AC: 1, 2, 3, 4, 7, 8)
- [x] Task 2: Implement isCacheFresh() with 7-day TTL (AC: 2, 3)
- [x] Task 3: Implement validateEntitlementOnServer() (AC: 1)
- [x] Task 4: Implement clearCachedEntitlement() for explicit denial (AC: 8)
- [x] Task 5: Add online event listener for auto-revalidation (AC: 4)
- [x] Task 6: Create PremiumGate component with upgrade CTA (AC: 5, 6, 9)
- [x] Task 7: Add unit tests for all hook behaviors (AC: 1-9)
- [x] Task 8: Add unit tests for PremiumGate component

## Implementation Notes

- useIsPremium() hook follows cache-first strategy: check IndexedDB, then validate against server
- Race condition prevention via validationInProgress ref with pending revalidation queue
- PremiumGate uses Stripe checkout integration for upgrade flow with URL validation
- Stale cache treated as explicit downgrade to free tier (AC3)
- Trial tier treated as premium equivalent (isPremium = tier === 'premium' || tier === 'trial')

## Testing Notes

- 22 unit tests for isPremium.ts covering all ACs + edge cases
- 11 unit tests for PremiumGate component covering rendering states, accessibility, and checkout flow
- All tests use vitest mocks for Supabase, IndexedDB (Dexie), and auth store
- Fake timers used for TTL boundary tests (isCacheFresh)
- No E2E tests — requires Supabase + Stripe infrastructure

## Challenges and Lessons Learned

- Race condition between mount validation and online event revalidation required ref-based guard pattern (validationInProgress + pendingRevalidation)
- Stale cache handling needed careful state management: show free tier immediately but still attempt server revalidation
- Stripe checkout URL validation prevents open redirect attacks via startsWith check
- silent-catch-ok pattern used for startCheckout rejection since checkout handles errors internally
