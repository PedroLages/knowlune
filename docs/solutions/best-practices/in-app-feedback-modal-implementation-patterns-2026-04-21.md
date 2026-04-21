---
title: "In-App Feedback Modal: Implementation Patterns and Non-Obvious Decisions"
date: 2026-04-21
category: docs/solutions/best-practices
module: FeedbackModal
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - Building a modal-based feedback or bug-reporting form
  - Implementing a radiogroup segmented control inside a Radix Dialog
  - Wiring a GitHub Issues API integration from client-side code
  - Deciding how to handle PII (email, user id) in auto-attached context
tags:
  - feedback-modal, radix-dialog, roving-tabindex, radiogroup, github-api, pat-scope, pii, focus-management, arrow-key-nav
---

# In-App Feedback Modal: Implementation Patterns and Non-Obvious Decisions

## Context

E118 shipped a persistent "Send Feedback" trigger (sidebar + mobile More drawer) that opens a two-mode modal (Bug Report / Feedback). The modal submits to GitHub Issues via REST API, with a copyable-text fallback when the token is absent or the API fails. Three rounds of code review surfaced several non-obvious implementation requirements that are worth capturing before they are forgotten.

## Guidance

### 1. Roving tabIndex in a radiogroup requires both state AND `.focus()` via ref

A segmented control rendered as `role="radiogroup"` with two `role="radio"` buttons must implement roving tabIndex: only the active button has `tabIndex={0}`; the inactive button has `tabIndex={-1}`. This is WCAG 2.1 requirement for composite widgets.

The non-obvious part: **setting state alone is not enough**. When the user presses ArrowLeft/ArrowRight, you must both update the mode state (which re-renders `tabIndex`) and imperatively call `.focus()` on the destination button via a `useRef`. The re-render from state change moves focus *eligibility* but does not move *actual keyboard focus*.

```tsx
// Refs for roving tabIndex
const bugBtnRef = useRef<HTMLButtonElement>(null)
const feedbackBtnRef = useRef<HTMLButtonElement>(null)

<div
  role="radiogroup"
  aria-label="Feedback type"
  onKeyDown={(e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (e.key === 'ArrowRight') {
        setMode('feedback')
        feedbackBtnRef.current?.focus()  // imperative focus required
      } else {
        setMode('bug')
        bugBtnRef.current?.focus()       // imperative focus required
      }
    }
  }}
>
  <button
    ref={bugBtnRef}
    role="radio"
    aria-checked={mode === 'bug'}
    tabIndex={mode === 'bug' ? 0 : -1}   // roving tabIndex
    ...
  />
  <button
    ref={feedbackBtnRef}
    role="radio"
    aria-checked={mode === 'feedback'}
    tabIndex={mode === 'feedback' ? 0 : -1}
    ...
  />
</div>
```

This pattern took two review iterations to get right: R1 introduced the roving tabIndex without `.focus()`, R2 added `.focus()` but had a conflation issue, R3 confirmed the final pattern was correct.

### 2. Radix Dialog handles focus return natively — do not add a manual `priorFocusRef`

Radix UI's `<Dialog>` component automatically returns focus to the element that triggered the dialog when the dialog closes (via its built-in `returnFocus` behaviour). Adding a manual `priorFocusRef` to capture the trigger element and call `.focus()` on close is redundant and races with Radix's internal logic, producing double-focus-return or flicker.

**Do not** add this pattern to a Radix Dialog:

```tsx
// ❌ Do not do this inside a Radix Dialog consumer
const priorFocusRef = useRef<HTMLElement | null>(null)
useEffect(() => {
  if (open) {
    priorFocusRef.current = document.activeElement as HTMLElement
  } else {
    priorFocusRef.current?.focus()
  }
}, [open])
```

Radix handles it. The only manual focus management needed is the roving tabIndex within the dialog's composite widget (the radiogroup above).

### 3. GitHub PAT scope: `Issues: write` only — no `contents`, no repo-level access

The fine-grained PAT stored in `VITE_GITHUB_FEEDBACK_TOKEN` must be scoped to **`Issues: write`** on the target repository only. Wider scopes (`contents`, repo-level access, classic tokens) are disproportionate for a feedback pipeline that only creates issues. This is the minimum viable scope and the correct choice even while the repo is private.

When creating the PAT:
- Token type: Fine-grained personal access token
- Repository access: Only repositories → `PedroLages/Knowlune`
- Permissions: Issues → Read and write (all others: No access)

### 4. PII handling: email in fallback text only, not in GitHub issue body

User email is captured in `FeedbackContext` but handled asymmetrically:

- **GitHub issue body (`<details>` block)**: email is **omitted**. User ID is included (opaque identifier, sufficient for triage). GitHub token attribution already identifies who filed the issue when the PAT is tied to a specific user account.
- **Fallback copyable text**: email is **included**. This text never leaves the user's browser unless they manually send it — it's a local copy to assist with manual email submission.

```ts
// buildIssueBody — email intentionally excluded
if (ctx.userId) ctxLines.push(`| User ID | \`${ctx.userId}\` |`)
// Email omitted from issue body to avoid persisting PII; GitHub token attribution is sufficient
if (ctx.sentryEventId) ctxLines.push(`| Sentry event | \`${ctx.sentryEventId}\` |`)

// buildFallbackText — email included (stays local)
if (ctx.userId) lines.push(`User ID: ${ctx.userId}`)
// Email included in local copy only — never sent to GitHub.
if (ctx.email) lines.push(`Email: ${ctx.email}`)
```

This asymmetry is intentional and should be preserved. Before public launch (when the repo is public), revisit whether even the local fallback should omit email.

### 5. `VITE_GITHUB_FEEDBACK_TOKEN` is acceptable in client bundle while repo is private

Client-bundled Vite env vars are visible in built assets. For a private beta with a private repo, this is an acceptable tradeoff: the PAT only has `Issues: write` on a single private repo, and the attack surface is low. The token can be rotated without a code deploy.

Before the repo goes public or traffic scales beyond trusted beta users, migrate to a server-side proxy (Cloudflare Worker or Supabase Edge Function) that holds the token server-side and validates submissions. This is explicitly deferred in the plan — do not do it at beta scale.

### 6. `fallbackText` and `mailtoHref` must be built before the `setStatus('submitting')` call

The fallback text and mailto href are derived from the form fields + context. They must be built at the start of the submit handler (before `setStatus('submitting')`) so they are available immediately if the API call fails. If you build them inside the catch block, you have lost access to the ephemeral state (Sentry event id, current URL) that was captured at submit time.

```ts
// Build context + fallback BEFORE the network call
const ctx = buildFeedbackContext(user, fields.mode)
const fallback = buildFallbackText(fields, ctx)
const mailto = buildMailtoHref(subject, fallback)

setStatus('submitting')
// ... then await submitToGitHub(...)
// On failure: setFallbackText(fallback) — already computed above
```

### 7. `getIssueTitle` as a shared utility prevents subject/title drift

Both the GitHub issue `title` field and the `mailto:` subject line need the same derived title. Extracting `getIssueTitle(fields)` as a named export from the service module ensures they stay in sync and prevents the mailto subject drifting from the issue title when one is changed.

## Why This Matters

- Missing the `.focus()` call in the roving tabIndex pattern produces a component that looks correct in mouse interaction tests but breaks keyboard navigation — screen readers will announce the new `aria-checked` state but the focused element will not have moved.
- Adding a manual `priorFocusRef` to a Radix Dialog consumer causes a race condition on close that is hard to reproduce in tests but visible to keyboard/screen reader users.
- Overly broad PAT scope is a security finding that blocks review. `Issues: write` is the correct minimum.
- Including email in the GitHub issue body is a GDPR-relevant decision — it persists PII in a third-party system without explicit consent. Omitting it is the safer default.

## When to Apply

- Any modal form that contains a segmented control (radiogroup) — apply the roving tabIndex + `.focus()` ref pattern.
- Any modal built on Radix Dialog — trust Radix's focus return; remove manual `priorFocusRef` if one was added.
- Any GitHub API integration from client code — use fine-grained PAT with minimum scope.
- Any feature that collects user identity alongside user-supplied content — audit which identity fields go to third parties vs stay local.

## Examples

### Arrow-key navigation — two-step pattern (state + focus)

```tsx
onKeyDown={(e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    // Step 1: update state (re-renders tabIndex)
    const nextMode = e.key === 'ArrowRight' ? 'feedback' : 'bug'
    setMode(nextMode)
    // Step 2: move actual keyboard focus (not covered by state re-render)
    const ref = nextMode === 'feedback' ? feedbackBtnRef : bugBtnRef
    ref.current?.focus()
  }
}}
```

### PII asymmetry in issue body vs fallback text

```ts
// GitHub issue body — omit email
export function buildIssueBody(fields, ctx) {
  // ...
  if (ctx.userId) ctxLines.push(`| User ID | \`${ctx.userId}\` |`)
  // email intentionally omitted here
}

// Fallback plain text — include email (stays in user's browser)
export function buildFallbackText(fields, ctx) {
  // ...
  if (ctx.userId) lines.push(`User ID: ${ctx.userId}`)
  if (ctx.email) lines.push(`Email: ${ctx.email}`)
}
```

### Fine-grained PAT setup checklist

```
Token type: Fine-grained personal access token
Repository access: Only repositories → PedroLages/Knowlune
Permissions:
  Issues: Read and write
  (all others: No access)
```

## Related

- PR #400 — E118 In-App Feedback & Bug Reporting
- `src/app/components/figma/FeedbackModal.tsx` — roving tabIndex + Radix Dialog usage
- `src/lib/feedbackService.ts` — PII handling + PAT security note
- `src/app/hooks/useFeedbackSubmit.ts` — pre-submission context build + double-submit guard
- Plan: `docs/plans/2026-04-21-003-feat-in-app-feedback-bug-reporting-plan.md`
