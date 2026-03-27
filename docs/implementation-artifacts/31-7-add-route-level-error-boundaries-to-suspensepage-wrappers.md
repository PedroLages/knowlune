---
story_id: E31-S07
story_name: "Add Route-Level Error Boundaries to SuspensePage Wrappers"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, type-check, unit-tests-skipped, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
review_scope: lightweight
burn_in_validated: false
---

# Story 31.7: Add Route-Level Error Boundaries to SuspensePage Wrappers

## Story

As a user,
I want page crashes to be contained to the affected section,
so that I can still navigate to other pages when one section fails.

## Acceptance Criteria

**Given** a page component throws a render error
**When** the error is caught by the route-level ErrorBoundary
**Then** only the page content area shows the error fallback
**And** the sidebar and header remain functional

**Given** the route error fallback is displayed
**When** the user clicks "Try again"
**Then** the page component is remounted (error state reset)

**Given** the route error fallback is displayed
**When** the user clicks "Go to Overview"
**Then** they navigate to the Overview page as an escape hatch

**Given** the root ErrorBoundary in App.tsx
**When** a route-level boundary catches an error
**Then** the root boundary is NOT triggered (route-level catches first)

## Tasks / Subtasks

- [x] Task 1: Create RouteErrorBoundary component
  - [x] 1.1 Create `RouteErrorFallback` with "Try again" and "Go to Overview" actions
  - [x] 1.2 Create `RouteErrorBoundary` class component wrapping the fallback
  - [x] 1.3 Integrate error reporting via `reportError()`
- [x] Task 2: Wrap SuspensePage with RouteErrorBoundary
  - [x] 2.1 Import RouteErrorBoundary in routes.tsx
  - [x] 2.2 Wrap `<Suspense>` inside `SuspensePage` with `<RouteErrorBoundary>`
  - [x] 2.3 Verify root ErrorBoundary in App.tsx remains unchanged
- [x] Task 3: Verify build passes

## Challenges and Lessons Learned

- **Composition over modification**: Rather than modifying the existing `ErrorBoundary` to accept a fallback prop, creating a separate `RouteErrorBoundary` component kept concerns cleanly separated. The root boundary handles catastrophic app-level failures; the route boundary handles page-level crashes.
- **SuspensePage as the injection point**: Wrapping `RouteErrorBoundary` around `Suspense` inside the existing `SuspensePage` helper meant zero changes to any route definitions — all 30+ routes get error isolation automatically.
- **Design token discipline**: The fallback UI uses `bg-card`, `text-card-foreground`, `border-border`, `text-muted-foreground`, `bg-muted`, and `variant="brand"` button — no hardcoded colors, works in both light and dark mode.
