---
title: E2E tests need guest-mode init script post-E92 auth gate
date: 2026-04-25
module: tests/e2e
component: auth-gate
tags:
  - e2e
  - playwright
  - auth
  - guest-mode
  - test-setup
problem_type: workflow_issue
category: best-practices
---

## Context

After E92 shipped the Supabase auth integration, route guards in `src/app/routes.tsx` redirect anonymous users to `<Landing />` for any non-public path. E2E specs that pre-date E92 (and freshly written ones modeled after them) navigate to `/courses` and assert on page content — but those assertions silently time out because the landing page renders instead. Symptom: tests fail with `TimeoutError: locator.click: Timeout 15000ms exceeded waiting for getByRole('radio', { name: 'List view' })`. The trace screenshot shows the public landing page, not the courses page.

## Guidance

In every E2E spec that needs to reach an authenticated route, enable guest mode via `addInitScript` **before** the first `page.goto`. The auth store derives guest mode from `sessionStorage.getItem('knowlune-guest') === 'true'` (see `src/stores/useAuthStore.ts:198`).

```ts
async function setupPage(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
  })
  await page.goto('/')
  // …seed IndexedDB, navigate to the protected route…
}
```

Use `addInitScript`, not `evaluate`, so the flag exists before the auth store initializes on first paint. Reading `sessionStorage` at `about:blank` throws `SecurityError`, so the seed must be deferred to the first real navigation — `addInitScript` queues the write into the page-init lifecycle.

## Why This Matters

Tests written before E92 that previously passed will silently break the moment any auth-gated route is added to the navigation. The failure mode is a generic timeout, not a clear "auth required" error — engineers waste 15-30 minutes per affected spec chasing the wrong root cause. The shared `goToCourses` / `goToOverview` navigation helpers don't currently set the guest flag, so each spec needs its own pre-navigation hook. A single shared `enableGuestMode(page)` helper in `tests/support/helpers/` would centralize this — until that exists, copy the snippet above into every new spec.

## When to Apply

- Any new E2E spec navigating to `/courses`, `/library`, `/overview`, `/notes`, `/reports`, `/settings`, course detail pages, or any other route that requires authentication
- Any pre-E92 spec that starts failing with a "stuck on landing page" symptom — add the init script rather than rewriting the assertions
- Skip this only for specs that explicitly test the landing/auth flow itself (`auth-flow.spec.ts`, `auth-landing-bugs.spec.ts`)

## Examples

**Before — silent timeout:**

```ts
test('renders list view rows', async ({ page }) => {
  await page.goto('/')
  await seedImportedCourses(page, createImportedCourses(3))
  await goToCourses(page)
  await page.getByRole('radio', { name: 'List view' }).click()  // times out
})
```

**After — passes:**

```ts
test('renders list view rows', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
  })
  await page.goto('/')
  await seedImportedCourses(page, createImportedCourses(3))
  await goToCourses(page)
  await page.getByRole('radio', { name: 'List view' }).click()  // works
})
```

## Related

- `src/stores/useAuthStore.ts` — `selectIsGuestMode` and `selectAuthState` define the gate
- `src/app/routes.tsx:50` — `if (authState === 'anonymous') return <Landing />`
- `tests/e2e/e99-s02-grid-columns.spec.ts` — currently failing for this same reason; should be retrofitted
- E99-S03 implementation PR #450 (the spec that surfaced this lesson)
