---
date: 2026-04-21
topic: e118-in-app-feedback-bug-reporting
---

# E118 — In-App Feedback & Bug Reporting

## Problem Frame

Beta users have no way to report bugs or share feedback from inside the app. When issues occur they must email Pedro from outside Knowlune, losing all auto-context (current URL, user id, app state). Sentry already captures unhandled errors passively, but cannot capture user-volunteered context, confusion, or feature requests. With ~10 beta users and an imminent launch, this gap means low-quality bug reports and missed signal during the highest-value feedback window.

## Requirements

**Trigger — feedback entry point**
- R1. A persistent "Send Feedback" trigger is visible on every page. It lives in the sidebar (desktop) and in the bottom nav overflow (mobile, "More" / overflow item) — the overflow placement is more discoverable than a Settings item because it surfaces at the navigation layer rather than requiring a second page visit.
- R2. The trigger opens a modal feedback form without navigating away from the current page. The modal traps focus while open, closes on Escape key, and returns focus to the trigger element on close (WCAG 2.1 AA).

**Form — content capture**
- R3. The form offers two submission modes selectable by the user: **Bug report** and **General feedback / suggestion**.
- R4. Bug report mode presents: a short title field (required, max 120 chars), a description field (required, min 10 chars), and an optional steps-to-reproduce field.
- R5. Feedback/suggestion mode presents: a short title field (optional) and a freeform message field (required).
- R6. The form has a Submit and a Cancel action. Submit is disabled while required fields are unfilled and during in-flight submission (to prevent duplicate issue creation).
- R7. The form shows a loading/spinner state while the submission is in-flight. The API call has a 10-second timeout — if exceeded, treat as failure per R8. On successful submission the modal closes and a brief toast confirmation appears ("Thanks — your feedback was sent.").
- R8. On submission failure the form stays open and shows an inline error so the user can retry or copy their text.

**Auto-attached context**
- R9. Every submission automatically attaches: current page URL/route, authenticated user id (from `useAuthStore`), user email (if available), app version (`import.meta.env.VITE_APP_VERSION` or equivalent), timestamp, and browser/OS string (from `navigator.userAgent`). When `user` is null (unauthenticated or session-expired), user id and email are omitted from the context — submission is not blocked.
- R10. Context is attached in the request payload — never shown to the user in the form. The form stays clean.
- R11. For bug reports, if Sentry is initialised, the submission also captures and attaches the most recent Sentry event id for the current session (allows cross-referencing with Sentry breadcrumbs).

**Routing — where reports go**
- R12. Reports are routed to GitHub Issues on the `PedroLages/Knowlune` repository via the GitHub REST API (using a `VITE_GITHUB_FEEDBACK_TOKEN` env var — a fine-grained PAT with `Issues: write` scope only, not classic `repo` scope).
- R13. Bug reports are created as GitHub Issues with label `bug` and `beta-feedback`. Feedback/suggestions use label `enhancement` and `beta-feedback`.
- R14. The issue body is formatted with the user-supplied fields followed by a collapsible `<details>` block containing the auto-attached context (route, user id, version, UA, Sentry event id).
- R15. If the GitHub token is absent or the API call fails, the form displays the full report text (title, description, steps-to-reproduce if present, plus auto-attached context) in a read-only copyable textarea so the user can manually send or save it. On devices where `mailto:` reliably opens a mail client, a secondary "Open in Mail" link is offered alongside the textarea. This fallback must not silently drop the report.

**Scope boundaries**
- Screenshot attachment is out of scope for this epic.
- Upvoting, public issue tracker, or triage workflow inside the app is out of scope.
- Rate-limiting / spam protection is out of scope at beta scale (~10 users).
- Localisation / i18n is out of scope.

## Success Criteria

- A beta user who encounters a bug can submit a report in under 60 seconds without leaving the app.
- Every submitted report arrives as a GitHub Issue with enough context (route, user id, version) that Pedro can reproduce or triage without follow-up.
- Zero reports are silently lost — failure surfaces a visible error or falls back to `mailto:`.
- The feedback trigger is visible on all six main pages at both mobile and desktop breakpoints.

## Key Decisions

- **GitHub Issues over email-only**: GitHub provides a structured, searchable, labelled record and fits the existing solo-dev workflow. Email is kept as a fallback only.
- **Modal over full page**: Avoids navigation and preserves in-progress user state on the page where the bug was encountered.
- **Sidebar trigger over floating FAB**: Floating buttons create z-index complexity and obscure content. The sidebar already carries navigation-level items and is present on every page.
- **Two modes (bug vs feedback) in one form**: Minimises entry points while allowing different required fields and GitHub labels per type.
- **Context in `<details>` block**: Keeps issue body readable at a glance while preserving full context for triage.

## Dependencies / Assumptions

- Sentry is confirmed initialised in `src/main.tsx` via `VITE_SENTRY_DSN`. The Sentry event id is accessible via `Sentry.lastEventId()` (unverified — confirm during planning).
- Auth store shape confirmed: `useAuthStore` exposes `user.id` and `user.email` (Supabase `User`).
- A `VITE_APP_VERSION` env var or equivalent version signal must exist or be added. If absent, planning should decide the source (e.g., `package.json` version via Vite define).
- The GitHub token (`VITE_GITHUB_FEEDBACK_TOKEN`) will be a fine-grained PAT with Issues write scope on the repo. It is a frontend-exposed credential — the risk is acceptable at beta scale (private repo, low-value token). This decision should be revisited before public launch.
- **Security constraint — repo must stay private:** `VITE_GITHUB_FEEDBACK_TOKEN` is bundled into the client bundle and is visible to anyone with access to the built assets. The `PedroLages/Knowlune` repository must remain private for as long as this token is in use. Public launch requires migrating to a server-side proxy (e.g., a Cloudflare Worker or Supabase Edge Function) that holds the token server-side, or replacing the GitHub Issues sink entirely with a backend endpoint.

## Outstanding Questions

### Resolve Before Planning
*(none — all product decisions are resolved above)*

### Deferred to Planning
- [Affects R11][Needs research] Confirm `Sentry.lastEventId()` is available in `@sentry/react` and returns the most recent captured event id for the session, or find the correct API.
- [Affects R9][Needs research] Determine the source for `VITE_APP_VERSION` — check if `package.json` version is already injected via `vite.config.ts` define, or add it.
- [Affects R15][Technical] Decide `mailto:` fallback recipient address (Pedro's email) and whether it should be an env var or hardcoded constant.
- [Affects R1][Technical] Decide exact placement in sidebar (bottom of nav list, above Settings, or inside user-profile section) based on visual review of `src/app/components/Layout.tsx`.

## Next Steps

-> `/ce:plan` for structured implementation planning
