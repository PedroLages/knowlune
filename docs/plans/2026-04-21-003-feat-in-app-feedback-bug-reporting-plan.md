---
title: "feat: Add In-App Feedback & Bug Reporting"
type: feat
status: active
date: 2026-04-21
origin: docs/brainstorms/2026-04-21-e118-in-app-feedback-bug-reporting-requirements.md
---

# feat: Add In-App Feedback & Bug Reporting

## Overview

Add a persistent "Send Feedback" trigger to every page (sidebar on desktop/tablet, More drawer on mobile) that opens a modal with two submission modes — Bug Report and Feedback/Suggestion. Submissions route to GitHub Issues on the `PedroLages/Knowlune` repo with auto-attached context (route, user id, version, UA, Sentry event id). A graceful fallback renders the report as copyable text when the GitHub API is unavailable.

## Problem Frame

Beta users have no way to report bugs or share feedback from inside the app, forcing them to email Pedro with no auto-context. This degrades triage quality during the highest-value feedback window. Sentry passively captures unhandled errors but cannot capture user-volunteered descriptions, confusion, or feature requests. (see origin: `docs/brainstorms/2026-04-21-e118-in-app-feedback-bug-reporting-requirements.md`)

## Requirements Trace

- R1. Persistent "Send Feedback" trigger visible on every page — sidebar (desktop/tablet), More drawer (mobile).
- R2. Trigger opens a modal with focus trap, Escape-to-close, and focus-return on close (WCAG 2.1 AA).
- R3. Two submission modes: Bug Report and Feedback/Suggestion.
- R4. Bug report fields: title (required, ≤120 chars), description (required, ≥10 chars), steps-to-reproduce (optional).
- R5. Feedback/suggestion fields: title (optional), message (required).
- R6. Submit disabled while required fields empty or during in-flight submission.
- R7. Spinner during submission; 10-second timeout treated as failure. Toast on success; modal closes.
- R8. Inline error on failure; form stays open for retry or copy.
- R9. Auto-attached context: URL, user id, email, app version, timestamp, UA. Null user is handled gracefully (id/email omitted).
- R10. Context in request payload only — not shown in form.
- R11. For bug reports, attach most recent Sentry event id via `Sentry.lastEventId()`.
- R12. Route reports to GitHub Issues via REST API using `VITE_GITHUB_FEEDBACK_TOKEN`.
- R13. Bug reports: labels `bug` + `beta-feedback`. Suggestions: labels `enhancement` + `beta-feedback`.
- R14. Issue body: user-supplied fields + `<details>` block for auto-attached context.
- R15. Fallback when token absent or API fails: copyable textarea + optional `mailto:` link.

## Scope Boundaries

- Screenshot attachment is out of scope.
- Upvoting, public issue tracker, or triage workflow inside the app is out of scope.
- Rate-limiting / spam protection is out of scope at beta scale.
- i18n is out of scope.

### Deferred to Separate Tasks

- Migration to server-side proxy (Cloudflare Worker or Supabase Edge Function): Required before public launch / repo going public. The `VITE_GITHUB_FEEDBACK_TOKEN` is bundled into client assets — this is acceptable while the repo is private at beta scale, but must be revisited before any public exposure.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/Layout.tsx` — `SidebarContent` bottom section (Settings item at `mt-4 pt-3 border-t`). Feedback trigger should be added as a button immediately above Settings in the same bottom section.
- `src/app/components/navigation/BottomNav.tsx` — More drawer renders `navigationGroups` + `settingsItem`. A non-route button (like Feedback) needs to be added as a separate item after Settings in the drawer.
- `src/app/config/navigation.ts` — `settingsItem` pattern shows how bottom items are defined. Feedback is not a route, so it should not be added to `navigationGroups` — it is a standalone action button.
- `src/app/components/figma/KeyboardShortcutsDialog.tsx` — reference pattern for a modal opened from a Layout-level state + Dialog component.
- `src/app/components/ui/dialog` — shadcn Dialog primitive with built-in focus trap, Escape handling, and `DialogContent`/`DialogHeader`/`DialogTitle`.
- `src/app/components/ui/drawer` — used by BottomNav for the More drawer; Feedback can be a `DrawerClose`-wrapped button in the drawer.
- `src/stores/useAuthStore.ts` — `useAuthStore(s => s.user)` exposes `user.id` and `user.email` (Supabase `User`).
- `src/main.tsx` — Sentry is initialized with `@sentry/react` v10.x when `VITE_SENTRY_DSN` is set.
- `src/lib/errorTracking.ts` — existing Sentry usage pattern (`Sentry.captureException`, `Sentry.captureMessage`).
- Existing toast usage in Layout.tsx: `import { toast } from 'sonner'`.

### Institutional Learnings

- Dialogs used in Knowlune follow the shadcn `Dialog` primitive which handles focus trapping and Escape natively — no manual focus management needed beyond returning focus to the trigger element on close (use `onOpenChange` + a `useRef` to the trigger).
- ESLint `error-handling/no-silent-catch` rule requires all catch blocks to surface user feedback (toast or inline error) — ensure the fetch wrapper has a visible error path.
- Design token system: use `bg-brand-soft text-brand-soft-foreground` for active/highlight states, `text-muted-foreground` for secondary text.

### External References

- GitHub Issues REST API: `POST /repos/{owner}/{repo}/issues` — payload: `title`, `body`, `labels`. Auth: `Authorization: Bearer <token>`.
- `@sentry/react` v10: `Sentry.lastEventId()` is a top-level export and returns the string event id of the most recently captured event in this browser session, or `undefined` if none.
- `VITE_*` env vars are replaced at build time via Vite. Version can be injected via `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` in `vite.config.ts`.

## Key Technical Decisions

- **`VITE_APP_VERSION` sourced from `package.json` via Vite `define`**: No `define` block currently exists in `vite.config.ts`. Add `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` (importing `pkg` from `../../package.json`). This injects the current `"0.0.1"` version at build time without requiring a separate env var.
- **Modal opened from Layout-level state**: The feedback button lives in the sidebar and mobile drawer — both rendered by `Layout.tsx`. Following the `KeyboardShortcutsDialog` pattern, a `feedbackOpen` boolean state in `Layout.tsx` drives the modal open/close. The `FeedbackModal` component is passed `open` and `onOpenChange` props.
- **FeedbackModal is self-contained**: All form state, submission logic, GitHub API call, and fallback rendering live inside `FeedbackModal` (or a `useFeedbackSubmit` hook it calls). Layout.tsx only owns the `feedbackOpen` boolean.
- **Sentry event id accessed via `Sentry.lastEventId()`**: Available in `@sentry/react` v10. Captured inside the submit handler when mode === 'bug' and only when `typeof Sentry !== 'undefined'` (graceful no-op when Sentry is not initialised).
- **Fallback copyable textarea + mailto**: Shown when `VITE_GITHUB_FEEDBACK_TOKEN` is absent (empty string) or when the GitHub API call fails. The `mailto:` link uses `mindsetspheremail@gmail.com` as a named constant (`FEEDBACK_FALLBACK_EMAIL`) defined in the service module — not an env var.
- **Sidebar trigger placement**: Below the main nav scroll area, in the existing bottom border section, above the Settings `NavLink`. Matches the visual weight of Settings without adding a new group.
- **Mobile trigger placement**: A standalone button inside the More drawer in `BottomNav`, rendered after the Settings link. Not added to `navigationGroups` (it is not a route).

## Open Questions

### Resolved During Planning

- **`Sentry.lastEventId()` API**: Confirmed available as a top-level export in `@sentry/react` v10 (the installed version). Returns `string | undefined`.
- **`VITE_APP_VERSION` source**: Add to `vite.config.ts` `define` block using `package.json` version. No separate env var needed.
- **`mailto:` fallback recipient**: `mindsetspheremail@gmail.com`, defined as `FEEDBACK_FALLBACK_EMAIL` constant in the service module.
- **Sidebar placement**: Between the scrollable nav and the Settings border section — the button is added inside the same `div` that wraps Settings, above the `<ul>` containing the Settings `NavLink`.

### Deferred to Implementation

- Exact `AbortController` timeout wiring for the 10-second API timeout — implementation detail.
- Whether to `useRef` the trigger button in `SidebarContent` or pass a callback for focus restoration — depends on how the iconOnly collapsed mode renders the button.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Layout.tsx
  state: feedbackOpen (bool)
  ├── SidebarContent (desktop/tablet)
  │     └── [bottom section] FeedbackTriggerButton → sets feedbackOpen=true
  ├── BottomNav (mobile)
  │     └── [More drawer] FeedbackTriggerButton → sets feedbackOpen=true
  └── FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        ├── mode toggle: "Bug Report" | "Feedback"
        ├── form fields (conditional on mode)
        ├── useFeedbackSubmit hook
        │     ├── buildContext(): { url, userId, email, version, ua, sentryEventId }
        │     ├── buildIssueBody(fields, context): string (markdown + <details>)
        │     ├── submitToGitHub(payload): fetch with 10s AbortController timeout
        │     └── fallback: show copyable textarea + mailto link
        └── renders: loading spinner | inline error | fallback textarea
```

Submission flow:
1. User fills form → clicks Submit
2. `useFeedbackSubmit` assembles context + body
3. Calls GitHub Issues API with token from `import.meta.env.VITE_GITHUB_FEEDBACK_TOKEN`
4. Success → `toast.success("Thanks — your feedback was sent.")` → modal closes
5. Failure / timeout / missing token → inline error + fallback copyable textarea

## Implementation Units

- [ ] **Unit 1: Inject app version via Vite define**

**Goal:** Make `__APP_VERSION__` available as a build-time constant so the feedback service can attach it to submissions without a separate env var.

**Requirements:** R9

**Dependencies:** None

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/vite-env.d.ts` (or create `src/env.d.ts` if absent — add `declare const __APP_VERSION__: string`)

**Approach:**
- Import `pkg` from `package.json` at the top of `vite.config.ts` (using `assert { type: 'json' }` or `createRequire`)
- Add `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` inside `defineConfig`
- Add the ambient declaration so TypeScript recognises the constant

**Test scenarios:**
- Test expectation: none — this is a build-config change. Verified by the feedback service reading `__APP_VERSION__` without a TypeScript error during `npm run build`.

**Verification:**
- `npm run build` completes without TypeScript errors referencing `__APP_VERSION__`
- The value `"0.0.1"` (current package.json version) appears in the built bundle when grepping

---

- [ ] **Unit 2: `useFeedbackSubmit` hook and GitHub Issues service**

**Goal:** Encapsulate all submission logic — context assembly, GitHub Issues API call, timeout, fallback detection — in a reusable hook so `FeedbackModal` stays a presentational component.

**Requirements:** R6, R7, R8, R9, R10, R11, R12, R13, R14, R15

**Dependencies:** Unit 1 (for `__APP_VERSION__`)

**Files:**
- Create: `src/app/hooks/useFeedbackSubmit.ts`
- Create: `src/lib/feedbackService.ts`
- Test: `src/app/hooks/__tests__/useFeedbackSubmit.test.ts`

**Approach:**
- `feedbackService.ts` exports:
  - `FEEDBACK_FALLBACK_EMAIL = 'mindsetspheremail@gmail.com'`
  - `buildFeedbackContext(user)` — assembles `{ url, userId, email, version, ua, sentryEventId }`. Calls `Sentry.lastEventId()` guarded by `typeof Sentry !== 'undefined' && mode === 'bug'`.
  - `buildIssueBody(fields, context, mode)` — constructs markdown: user fields first, then `<details><summary>Auto-attached context</summary>...</details>`.
  - `submitToGitHub(payload)` — `fetch` to `https://api.github.com/repos/PedroLages/Knowlune/issues` with `Authorization: Bearer ${token}`, 10-second `AbortController` timeout. Returns `{ ok: true }` or `{ ok: false, error: string }`.
  - `buildFallbackText(fields, context, mode)` — plain-text representation for the copyable textarea.
  - `buildMailtoHref(subject, body)` — returns a `mailto:mindsetspheremail@gmail.com?subject=...&body=...` string.
- `useFeedbackSubmit` hook exposes `{ submit, status, fallbackText, mailtoHref, error }`. `status` is `'idle' | 'submitting' | 'success' | 'error' | 'fallback'`.
- Token absence (`!import.meta.env.VITE_GITHUB_FEEDBACK_TOKEN`) jumps directly to `'fallback'` status without making a network call.

**Patterns to follow:**
- `src/lib/errorTracking.ts` — Sentry guard pattern
- Existing `useAuthStore(s => s.user)` usage in `Layout.tsx` for accessing user

**Test scenarios:**
- Happy path: valid token + all fields filled → `submitToGitHub` resolves 201 → status becomes `'success'`
- Bug mode: `buildIssueBody` includes `labels: ['bug', 'beta-feedback']`; suggestion mode uses `['enhancement', 'beta-feedback']`
- Bug mode with Sentry event id: `buildIssueBody` body includes the event id in the `<details>` block
- Bug mode with no Sentry event: context block omits the Sentry row gracefully
- Missing token: `submit()` immediately transitions to `'fallback'` without calling `fetch`
- API timeout (10s exceeded): status becomes `'error'` with a retry-friendly message
- API 4xx/5xx: status becomes `'error'`; `fallbackText` and `mailtoHref` are populated
- Unauthenticated user (`user === null`): `buildFeedbackContext` omits `userId` and `email` keys; submission is not blocked
- `buildIssueBody` produces valid markdown with `<details>` block containing all context keys
- `buildFallbackText` is non-empty and includes title, description, and context fields

**Verification:**
- All unit tests pass
- TypeScript: no `__APP_VERSION__` type errors

---

- [ ] **Unit 3: `FeedbackModal` component**

**Goal:** Implement the two-mode form (Bug Report / Feedback) as a Dialog-based modal with full WCAG 2.1 AA compliance — focus trap, Escape, focus return, spinner, inline error, and fallback textarea.

**Requirements:** R2, R3, R4, R5, R6, R7, R8, R15

**Dependencies:** Unit 2

**Files:**
- Create: `src/app/components/figma/FeedbackModal.tsx`
- Test: `src/app/components/figma/__tests__/FeedbackModal.test.tsx`

**Approach:**
- Use the shadcn `Dialog` primitive (`DialogContent`, `DialogHeader`, `DialogTitle`) — focus trap and Escape handling are provided automatically.
- Focus return: call `triggerRef.current?.focus()` inside the `onOpenChange(false)` handler. The parent passes a `triggerRef` prop (or the modal stores a ref to `document.activeElement` on open).
- Mode toggle: two buttons styled as a segmented control (`bg-muted` / `bg-background` pattern matching existing tab patterns).
- Conditional fields: Bug mode shows title + description + steps-to-reproduce; Feedback mode shows title (optional) + message.
- Submit button: `disabled` when required fields empty or `status === 'submitting'`. Shows spinner icon when submitting.
- Inline error: rendered below the form fields when `status === 'error'` — not a toast.
- Fallback state: when `status === 'fallback'`, replace the form fields with a `<textarea readOnly>` containing `fallbackText` + a copy button + (if UA likely supports mailto) an `<a href={mailtoHref}>Open in Mail</a>` link.
- On success: parent's `onOpenChange(false)` fires, then `toast.success('Thanks — your feedback was sent.')` fires from the parent (or via callback) after the modal closes.

**Patterns to follow:**
- `src/app/components/figma/KeyboardShortcutsDialog.tsx` — Dialog open/close pattern from Layout state
- `src/app/components/ui/dialog` — shadcn Dialog primitive

**Test scenarios:**
- Happy path — Bug mode: fill title + description → Submit enables → click Submit → spinner visible → on resolve success callback fires
- Happy path — Feedback mode: fill message only → Submit enables (title is optional)
- Submit stays disabled when required fields empty (bug mode: title or description empty)
- Submit disabled during `status === 'submitting'` to prevent double-submit
- Escape key closes modal (handled natively by DialogContent)
- Fallback state: when `status === 'fallback'`, form fields are replaced with copyable textarea; copy button copies `fallbackText` to clipboard
- Inline error shown when `status === 'error'`; submit button re-enables for retry
- Mode switch from Bug to Feedback: steps-to-reproduce field disappears; title becomes optional
- Accessibility: DialogTitle is present and associated; all form inputs have labels

**Verification:**
- All tests pass
- Dialog traps focus: Tab cycles only within modal while open
- Escape closes modal
- Screen reader: modal role, title, and input labels announced

---

- [ ] **Unit 4: Feedback trigger in sidebar and mobile More drawer**

**Goal:** Place the "Send Feedback" trigger in the sidebar bottom section (desktop/tablet) and the More drawer (mobile), wired to `feedbackOpen` state in `Layout.tsx`.

**Requirements:** R1

**Dependencies:** Unit 3

**Files:**
- Modify: `src/app/components/Layout.tsx`
- Modify: `src/app/components/navigation/BottomNav.tsx`
- Test: `tests/e2e/e118-feedback-trigger.spec.ts`

**Approach:**
- **`Layout.tsx`**: Add `feedbackOpen` state (`useState(false)`). Import `FeedbackModal` and render it at the bottom of the JSX (alongside `KeyboardShortcutsDialog`). Pass `feedbackOpen` and `setFeedbackOpen` as props.
- **`SidebarContent`**: Add a feedback button in the `mt-4 pt-3 border-t` bottom `div`, above the Settings `<ul>`. When `iconOnly === true`, wrap in a Tooltip (same pattern as `NavLink`). Use a `MessageSquarePlus` or `MessageSquare` Lucide icon. Button calls `onFeedbackClick` prop passed from `Layout`.
- **`BottomNav.tsx`**: Add a standalone feedback button after the Settings link in the More drawer. It is not a `<Link>` — it is a `<button>` that calls `setMoreOpen(false)` then triggers the feedback modal. Because `BottomNav` does not own `feedbackOpen`, use a custom event (`window.dispatchEvent(new CustomEvent('open-feedback'))`) or lift state — the simplest approach is lifting: pass `onFeedbackClick` prop from `Layout.tsx` to `BottomNav`.
- **Icon**: Use `MessageSquarePlus` from `lucide-react` for the trigger (distinct from the AI Tutor `MessageSquare` in nav).

**Patterns to follow:**
- `src/app/components/Layout.tsx` — `shortcutsOpen` / `setShortcutsOpen` pattern
- `src/app/components/navigation/BottomNav.tsx` — existing drawer button pattern

**Test scenarios:**
- Happy path desktop: trigger button visible in sidebar on all 6 main pages; click opens FeedbackModal
- Happy path mobile: "Send Feedback" item visible in More drawer; tap opens FeedbackModal
- Collapsed sidebar (icon-only): trigger button shows tooltip with "Send Feedback" label
- Trigger returns focus to trigger button after modal closes (keyboard navigation)
- Integration: full submit flow — open modal, fill bug report, submit — GitHub API mock returns 201 — toast appears

**Verification:**
- Trigger visible at 375px (mobile, in More drawer), 768px (tablet, in sidebar), 1440px (desktop, in sidebar)
- Trigger passes axe accessibility scan (label, role)
- Focus returns to trigger button after modal closes via Escape or Submit

---

## System-Wide Impact

- **Interaction graph:** `Layout.tsx` gains a new `feedbackOpen` state and two new props on `SidebarContent` and `BottomNav`. No existing components are modified beyond these two entry points plus `SidebarContent`.
- **Error propagation:** Submission errors are surfaced inline in `FeedbackModal` (not swallowed). The `useFeedbackSubmit` hook returns structured `{ ok, error }` results — no silent catches.
- **State lifecycle risks:** The form state (mode, fields) lives only in `FeedbackModal` and resets when the modal unmounts (controlled by `feedbackOpen`). No global state is introduced. Duplicate submission is prevented by `disabled` during `submitting` state.
- **API surface parity:** No existing API surface is changed. `VITE_GITHUB_FEEDBACK_TOKEN` is a new env var that must be added to `.env.local` and production environment config.
- **Integration coverage:** The E2E spec tests the full trigger → open → fill → submit flow with a GitHub API mock to avoid real issue creation during CI.
- **Unchanged invariants:** Navigation config (`navigationGroups`, `settingsItem`) is not modified. Routing is not modified. The feedback trigger does not appear in the navigation config — it is a Layout-level UI element.
- **Security note (carry-forward):** `VITE_GITHUB_FEEDBACK_TOKEN` is bundled into client assets. This is acceptable while `PedroLages/Knowlune` is private. A fine-grained PAT with `Issues: write` scope only limits blast radius. A comment in the service file should document the public-launch migration requirement.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `VITE_GITHUB_FEEDBACK_TOKEN` exposed in client bundle | Acceptable at beta scale with private repo + narrow PAT scope. Document migration path. Must be revisited before public launch. |
| `Sentry.lastEventId()` returns `undefined` in most sessions | Handled gracefully — omit from context block when undefined |
| GitHub API rate limit (5000 req/hr for authenticated user) | Not a concern at ~10 beta users |
| Users may close the fallback modal without copying report | Fallback textarea is read-only and selectable; user can also use the mailto link |
| `vite.config.ts` `define` block may conflict with existing config | No existing `define` block — safe to add |

## Documentation / Operational Notes

- Add `VITE_GITHUB_FEEDBACK_TOKEN=<fine-grained-PAT>` to `.env.local` (development) and production env config on Cloudflare Pages / hosting.
- The PAT needs `Issues: write` scope on `PedroLages/Knowlune` only — not classic `repo` scope.
- Before making the repo public, migrate to a server-side proxy (Cloudflare Worker or Supabase Edge Function) that holds the token server-side.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-21-e118-in-app-feedback-bug-reporting-requirements.md](docs/brainstorms/2026-04-21-e118-in-app-feedback-bug-reporting-requirements.md)
- Related code: `src/app/components/Layout.tsx`, `src/app/components/navigation/BottomNav.tsx`, `src/app/config/navigation.ts`
- Related stores: `src/stores/useAuthStore.ts`
- External: [GitHub Issues REST API](https://docs.github.com/en/rest/issues/issues#create-an-issue), [@sentry/react v10 docs](https://docs.sentry.io/platforms/javascript/guides/react/)
