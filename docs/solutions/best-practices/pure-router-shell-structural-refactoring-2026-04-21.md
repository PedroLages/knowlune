---
title: "Pure router-shell refactoring — verbatim effect-block moves, provider preservation via children, and line-count as a health metric"
date: 2026-04-21
category: docs/solutions/best-practices/
module: knowlune-web
problem_type: best_practice
component: frontend_stimulus
related_components:
  - tooling
severity: medium
applies_when:
  - A root component (App.tsx, Layout.tsx, providers.tsx) has absorbed cross-cutting UX concerns across multiple epics and reviewers now re-reason about unrelated lifecycle code on every story
  - You're extracting coordination state (mutually-exclusive floaters, modal queues, banner gating) into a dedicated container component
  - Multiple useEffects have implicit render-cycle ordering that a mechanical extraction must preserve
  - A provider (e.g., context provider) wraps routed content and you want to relocate it without changing its scope
  - You want a measurable "this file has drifted back toward mixed-concern" signal for future sprints
tags:
  - react
  - refactoring
  - component-extraction
  - structural-refactoring
  - provider-trees
  - effect-ordering
  - app-shell
  - children-prop
---

# Pure router-shell refactoring — verbatim effect-block moves, provider preservation via children, and line-count as a health metric

## Context

`src/app/App.tsx` grew from a thin provider + router shell into a 310-line sync orchestrator over epics E92–E97. Every sync-UI story (link dialog, upload wizard, download overlay, credential banner) added imports, state, refs, callbacks, and effects to the same file. Reviewers re-read the link → upload → overlay → banner gating sequence on every unrelated PR, mixed in with global concerns (vector store init, YouTube metadata refresh, notification service, reduce-motion class, font scaling).

[PR #397](https://github.com/PedroLages/knowlune/pull/397) extracted all sync-UX concerns into `src/app/components/sync/SyncUXShell.tsx` — a dedicated container that now owns all 4 floaters, their gating state, and the two sync lifecycle hooks. `App.tsx` dropped from 310 → 113 lines and returned to being a pure provider + router shell. No behavior change, no test changes, no new abstractions for "future" work.

This doc captures the four techniques that made the refactor low-risk and reviewable:

1. Mechanical verbatim moves for effect blocks with implicit ordering
2. Provider tree preservation via the `children` prop (moving providers without changing scope)
3. "Pure router shell" target line count as a sprint-over-sprint health metric
4. Deliberate placement of `Toaster` inside the extracted shell rather than beside it

## Guidance

### 1. Move effect blocks verbatim when ordering is implicit

When a component has multiple `useEffect`s whose correctness depends on render-cycle ordering (one effect's state update feeds another effect's guard), extract them as a contiguous block — not one at a time, not reordered, not "simplified" during the move.

SyncUXShell's 4 gating effects had this property:

```
1. Link dialog fast-path trigger on authUser change
2. Upload wizard evaluation gate (depends on link dialog state)
3. Download overlay evaluation + 2s defer timer (depends on wizard state)
4. Sign-out reset (depends on all three above being at known initial states)
```

Splitting them across commits or reordering during the move would break the implicit link → upload → overlay → sign-out cascade. The overlay could flash before the wizard predicate runs. The sign-out reset could race the defer timer.

The refactor kept them as a single copy-paste block, preserved comment blocks explaining non-obvious guards (`evaluationInFlightRef`, `downloadEvaluationInFlightRef`, the 2s defer), and added a file-header invariant comment:

```typescript
/**
 * Invariants (do not rearrange the effects below):
 *   - The 4 gating effects execute in a specific render-cycle order
 *     (link → upload → overlay → sign-out reset). Splitting or reordering
 *     can cause the overlay to flash before the wizard gate evaluates, or
 *     vice versa.
 */
```

**The rule:** If an extraction touches effects whose ordering matters, the minimum unit of change is the whole block. Characterization tests are often impractical at this layer — rely on the existing E2E set as the behavioral safety net and ship the move as one reviewable diff.

### 2. Preserve provider scope via the `children` prop

When a provider (React context) wraps routed content and you want to relocate it without changing what it scopes, have the extracted component wrap `children` in that provider:

```tsx
// BEFORE — App.tsx
<MotionConfig>
  <MissingCredentialsProvider>
    <RouterProvider router={router} />
    <Toaster />
    <LinkDataDialog ... />
    <InitialUploadWizard ... />
    <NewDeviceDownloadOverlay ... />
    <CredentialSetupBanner />
  </MissingCredentialsProvider>
</MotionConfig>

// AFTER — App.tsx
<MotionConfig>
  <SyncUXShell>
    <RouterProvider router={router} />
    <Toaster />
  </SyncUXShell>
</MotionConfig>

// AFTER — SyncUXShell.tsx
export function SyncUXShell({ children }: { children: ReactNode }) {
  // ...state, refs, callbacks, effects, hooks
  return (
    <MissingCredentialsProvider>
      {children}
      {linkDialogUserId && <LinkDataDialog ... />}
      <InitialUploadWizard ... />
      {downloadOverlayUserId && deferredOverlayReady && <NewDeviceDownloadOverlay ... />}
      <CredentialSetupBanner />
    </MissingCredentialsProvider>
  )
}
```

Provider ancestry for every consumer stays identical:
- `RouterProvider` / routed pages still see `MissingCredentialsProvider` ✓
- `Toaster` still sees `MissingCredentialsProvider` ✓
- The 4 floaters still see `MissingCredentialsProvider` ✓
- Outer providers (`ErrorBoundary`, `ThemeProvider`, `MotionConfig`) stay above the shell ✓

The only structural change: `MissingCredentialsProvider` now lives inside `SyncUXShell` instead of directly in `App`. Its render-tree position is unchanged, which means hooks like `useMissingCredentials()` resolve the same provider they did before.

**The rule:** When moving a provider during a refactor, use `children` to keep its scope identical. Verify by asking: "For every `useContext` / hook consumer in the codebase, does the provider chain it resolves look the same?" If yes, the move is scope-preserving. If no, some consumer just silently lost its context.

### 3. Use "pure router shell" line count as a health metric

The plan set R3: `App.tsx` ≤ 170 lines. After the refactor it landed at 113. This is not arbitrary — it's the rough line count of a component that only owns:

- Global hooks that must run at app mount (color scheme, reduce-motion, font scale, welcome wizard init, notification service, vector store, YouTube metadata refresh)
- Provider JSX chain (`ErrorBoundary → ThemeProvider → MotionConfig`)
- Single router + Toaster + PWA banner mount
- A portal for dev-only instrumentation

Future sync-UI stories now edit `SyncUXShell.tsx`, not `App.tsx`. The next time `App.tsx` starts creeping back up (say, past 180 lines), that's a signal: something domain-specific leaked into the root, and it needs its own extracted shell.

Capture the target in the plan's requirements so it becomes a review gate, not just an aspiration:

```markdown
- **R3.** `App.tsx` drops to ≤170 lines (AC3).
```

**The rule:** A root component should be boring to read. Set a specific line-count budget in the refactor plan so "App.tsx has grown again" becomes a measurable signal instead of a vague feeling. The specific number matters less than the commitment to treat growth as evidence of drift.

### 4. Place Toaster inside the extracted shell, not beside it

The origin brainstorm initially recommended keeping `Toaster` at the App level as a sibling of `SyncUXShell`. The plan overrode that recommendation. Reason:

Toasts fired from hook effects inside the shell (credential errors, sync status) must resolve the same provider context as the rest of the shell. Rendering `Toaster` as a **child** of the shell (via the `children` prop) keeps it inside `MissingCredentialsProvider` at runtime, which guarantees sync-originated toasts see the same credential context that triggered them.

Functional equivalence was verified by reading toast call sites — `toast()` from sonner is context-free for generic toasts, so generic consumers don't care. But the moment any toast call site needs a credential-aware context, the sibling placement would silently break it.

**The rule:** When extracting a shell that emits toasts from inside a context provider, render `Toaster` inside the shell (as a child) rather than beside it. Loss of context ancestry is a class of bug that passes all unit tests and only fails in the specific provider-consuming toast path. Preventing it at the architectural level is cheaper than debugging it later.

## Why This Matters

**Reviewer cost compounds with file size.** Every cross-cutting UX concern added to a root file taxes every future unrelated PR. A 310-line `App.tsx` mixing providers + router + sync gating + lifecycle hooks forces reviewers to re-build a mental model of the link → upload → overlay cascade even when reviewing a reduce-motion class change. Extracting once amortizes that cost across all future stories in the same area.

**Behavior-preserving refactors are the cheapest time to fix structure.** The refactor shipped with zero test changes, zero new tests, and zero behavioral risk because it was pure relocation. Attempting the same cleanup during a feature story (when new behavior is landing) would mix structural + behavioral diffs and make review much harder. The pattern to emulate: notice the drift, plan a dedicated pure-refactor PR, ship it between feature work.

**Provider ancestry bugs are silent.** Moving a context provider without preserving its consumer set can pass every unit test, build cleanly, and fail only when a specific hook in a specific subtree tries to read the missing context at a specific time. The `children`-prop pattern is a structural guarantee that provider scope is preserved — it's worth using deliberately rather than relying on manual verification.

**The pattern extends.** This refactor is specifically about sync-UX, but the same four techniques apply to any cross-cutting UI shell: onboarding coordinators, collaboration presence indicators, notification centers, feature-flag gates. Every future sync-UI story gets a clear home in `SyncUXShell.tsx`; a future non-sync coordinator will follow the same extraction pattern against `App.tsx`.

## When to Apply

- A root component (App, Layout, providers wrapper) has grown past ~200 lines by accretion across epics
- Multiple useEffects in one file have implicit render-cycle ordering that extraction must preserve
- A context provider wraps a mix of routed pages + top-level UI (modals, toasters, banners) and you want to relocate it
- You want a measurable "root file has drifted back" signal for future sprint reviews
- You're about to add a 4th or 5th cross-cutting concern to a root file and reviewers have started complaining about unrelated diffs colliding

## Examples

**Line-count before/after (from PR #397 diff stats):**

```
src/app/App.tsx                          | 219 ++------------------
src/app/components/sync/SyncUXShell.tsx  | 239 ++++++++++++++++++++++
```

App.tsx went 310 → 113 lines. SyncUXShell.tsx added 239 lines. Net codebase growth: ~140 lines of code moved, not duplicated. The extraction cost is low because the shell absorbs state + effects + callbacks + JSX that already existed together logically, just colocated in the wrong file.

**Plan requirements that enforced the pattern:**

```markdown
- **R2.** `App.tsx` no longer imports `LinkDataDialog`, `InitialUploadWizard`,
         `NewDeviceDownloadOverlay`, `CredentialSetupBanner`,
         `MissingCredentialsProvider`, `useAuthLifecycle`, `useSyncLifecycle`,
         `shouldShowInitialUploadWizard`, `shouldShowDownloadOverlay`,
         `useDownloadStatusStore`, or `useAuthStore` (AC2).
- **R3.** `App.tsx` drops to ≤170 lines (AC3).
- **R6.** `useAuthLifecycle`'s `onUnlinkedDetected` contract is unchanged — still
         fires and still defers `syncEngine.start()` until `LinkDataDialog` resolves.
- **R7.** Provider/consumer tree preserved: `MissingCredentialsProvider` remains
         an ancestor of `RouterProvider` and `Toaster`.
```

R2 lists specific forbidden imports (prevents sneaking concerns back). R3 sets a line-count ceiling (prevents drift). R6 pins the exact behavior contract (prevents accidental behavior change). R7 pins the provider tree shape (prevents scope changes).

**Shell-file header as institutional memory:**

```typescript
/**
 * SyncUXShell — E98 (refactor extracted from App.tsx, 2026-04-21)
 *
 * Responsibilities:
 *   1. Owns the 4 floaters: LinkDataDialog, InitialUploadWizard,
 *      NewDeviceDownloadOverlay, CredentialSetupBanner.
 *   2. Hosts the gating state machine that enforces mutual exclusion:
 *      link → upload → overlay → banner.
 *   3. Wires the two sync lifecycle hooks (useAuthLifecycle, useSyncLifecycle).
 *   4. Wraps `children` in MissingCredentialsProvider so routed pages and the
 *      Toaster remain context consumers (unchanged from pre-refactor scope).
 *   5. Exposes dev/test shim `window.__forceDownloadOverlay` for E2E tests.
 *
 * Invariants (do not rearrange the effects below):
 *   - The 4 gating effects execute in a specific render-cycle order
 *     (link → upload → overlay → sign-out reset).
 *   - evaluationInFlightRef / downloadEvaluationInFlightRef guard against
 *     same-tick double-evaluation.
 *   - Overlay mount is deferred 2s so fast restores never flash (E97-S04).
 */
```

The file header is the most durable place to record non-obvious invariants. Future maintainers reading `SyncUXShell.tsx` see the ordering rule before they touch an effect.

## Related

- [Extract shared primitive when a second consumer appears](./extract-shared-primitive-on-second-consumer-2026-04-18.md) — the micro-level sibling rule (two consumers → extract). This doc is the macro-level version (one root component absorbing cross-cutting concerns → extract a shell).
- [Unified course-card shared-shell pattern](./unified-course-card-shared-shell-pattern-2026-04-20.md) — another shared-shell pattern for card components; structurally similar reasoning applied at the component level rather than the app level.
- [Post-E97 cleanup lessons](./post-e97-cleanup-lessons-2026-04-21.md) — the broader cleanup sweep this refactor was part of.
- Plan: [docs/plans/2026-04-21-002-refactor-extract-sync-ux-shell-plan.md](../../plans/2026-04-21-002-refactor-extract-sync-ux-shell-plan.md)
- PR: [PedroLages/knowlune#397](https://github.com/PedroLages/knowlune/pull/397)
- Source concern: [docs/reviews/code/E97-deep-report-2026-04-21.md](../../reviews/code/E97-deep-report-2026-04-21.md) Architectural Concern #4
