# Notice Acknowledgement at Signup + Material-Change Re-ack — Requirements

## Problem Statement

Knowlune needs explicit evidence that users have acknowledged the privacy notice at signup and re-acknowledged after material changes. Currently the auth flow only has passive legal links with no recorded consent. This leaves Knowlune without audit evidence for GDPR/compliance obligations, and users are never prompted to re-read the notice when it changes materially.

## Acceptance Criteria

- **AC-1**: Supabase migration creates `notice_acknowledgements(user_id, document_id, version, acknowledged_at, ip_hash)` with RLS owner-only (users can only read/write their own rows).
- **AC-2**: Signup flow (`EmailPasswordForm` in sign-up mode) includes a checkbox "I have read the Privacy Notice (v{version})" linking to `/legal/privacy`; the submit button is disabled until the checkbox is checked.
- **AC-3**: On successful signup + checkbox checked, a `notice_acknowledgements` row is written with `CURRENT_NOTICE_VERSION`, `NOTICE_DOCUMENT_ID`, `acknowledged_at` = now(), and `ip_hash` = SHA-256 hash of the request IP (handled server-side via Supabase edge function or trigger).
- **AC-4**: `useNoticeAcknowledgement` hook (`src/hooks/useNoticeAcknowledgement.ts`) queries the user's latest ack version for `NOTICE_DOCUMENT_ID`, compares against `CURRENT_NOTICE_VERSION`; returns `{ acknowledged: boolean, stale: boolean }`. When user is unauthenticated, returns `{ acknowledged: true, stale: false }` (no gate for guests).
- **AC-5**: When `stale === true`, `LegalUpdateBanner` (extended) displays a re-ack banner (non-blocking for 30 days). Banner includes link to `/legal/privacy` and an "Acknowledge" button that writes a new row.
- **AC-6**: After 30 days without ack (`staleSince > 30 days`), `useSoftBlock()` flag becomes `true`; write actions in the app surface a gate ("Acknowledge to continue" CTA). Read actions still work.
- **AC-7**: The 30-day window is calculated from the server-side notice release date (`parseNoticeVersion(CURRENT_NOTICE_VERSION).isoDate`) — not client clock.
- **AC-8**: E2E test `tests/e2e/compliance/notice-acknowledgement.spec.ts` covers: new user signup ack (checkbox required), stale-version re-ack banner, and soft-block transition after 30+ days.

## Out of Scope

- Consent toggles (S08)
- Export/delete flows (S03-S06)
- Google OAuth / Magic Link acknowledgement (those paths do not have a signup form; can be addressed in a follow-up)

## Technical Context

- `CURRENT_NOTICE_VERSION = '2026-04-23.1'` and `NOTICE_DOCUMENT_ID = 'privacy'` defined in `src/lib/compliance/noticeVersion.ts`
- `LegalUpdateBanner.tsx` shell exists in `src/app/pages/legal/LegalUpdateBanner.tsx` — currently localStorage-based dismissal only; extend for server-backed ack + soft-block mode
- Auth flow: `src/app/pages/Login.tsx` → `src/app/components/auth/EmailPasswordForm.tsx` (sign-up mode)
- Supabase client at `src/lib/auth/supabase.ts`; auth store at `src/stores/useAuthStore.ts`
- `ip_hash`: since we can't get client IP reliably, use Supabase `pg_net` or a DB trigger to compute SHA-256(auth.uid()::text || current_timestamp) as a deterministic placeholder — or store NULL if not available without an edge function
- Last migration: `20260427000002_p4_sync.sql` — next migration should be `20260428000001_notice_acknowledgements.sql`
- Error path: if ack write fails at signup, user sees retry CTA and is NOT silently blocked from completing signup
- Soft-block gates write actions only; read-only browsing must always remain available
- Use `FIXED_DATE` deterministic time helper in E2E tests (per `.claude/rules/testing/test-patterns.md`)

## Open Questions

1. Should Google OAuth / Magic Link signup paths also record an acknowledgement? (deferred to follow-up)
2. Is `ip_hash` required for GDPR compliance in this jurisdiction, or can it be NULL? (store NULL for now, document the gap)
3. Should `useSoftBlock()` integrate with the Supabase sync engine write queue, or block at the component level? (component-level for now)
