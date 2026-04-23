# E119-S04 — Deletion Verification + Confirmation Email

## Problem Statement

Users who request account deletion receive no email acknowledgement today. There is also no automated check to detect when a schema change leaves a table unregistered for erasure — creating silent GDPR compliance gaps. This story delivers two independent capabilities:

1. **Email notifications** at both soft-delete (request acknowledged, cancel within 7 days) and hard-delete (data erased receipt), ensuring the address captured pre-scrub is used for the final receipt.
2. **CI deletion probe** — a TypeScript script that queries every registry-listed table and all 4 Storage buckets for a test user ID, reporting any tables that still contain data after deletion. The probe runs automatically on PRs that touch the erasure surface.

## Acceptance Criteria

- **AC-1**: Email sent within 30 s of deletion request: subject "Deletion scheduled — cancel within 7 days" containing cancel link routed to `cancel-account-deletion` Edge Function.
- **AC-2**: Email sent when hard-delete completes: subject "Your data has been deleted" receipt.
- **AC-3**: The hard-delete receipt uses the address recorded at deletion-request time (stored in `pending_deletions` row to handle pre-scrub timing, when the user row may already be anonymised).
- **AC-4**: Email delivery failure does NOT block deletion. Failures are logged to `console.error` (ops alert channel).
- **AC-5**: `scripts/ci/deletion-probe.ts` queries every table in `TABLE_NAMES` (from `hardDeleteUser.ts`) and all 4 buckets in `STORAGE_BUCKETS` for a given `USER_ID` env var; exits 0 on zero rows, exits 1 and prints offending table names.
- **AC-6**: `.github/workflows/test.yml` is extended to run `deletion-probe.ts` on PRs whose diff touches `tableRegistry.ts`, `delete-account/`, or `retention-tick/`.
- **AC-7**: Email templates live in `src/lib/compliance/emailTemplates.ts` with plain-text + HTML variants exported as pure functions (no side effects).

## Out of Scope

- Full E2E coverage of actual email delivery (staging-only test).
- Implementing the retention enforcement job (S11).
- Building a new SMTP provider integration — use Supabase's built-in `supabase.functions.invoke` or a simple `fetch` call to Resend/Mailgun via env var `EMAIL_PROVIDER_URL` + `EMAIL_API_KEY`.

## Technical Context

- Existing Edge Functions: `delete-account/index.ts` (soft-delete), `cancel-account-deletion/index.ts` (cancel), `retention-tick/index.ts` (hard-delete loop via `hardDeleteUser()`).
- `hardDeleteUser.ts` exports `TABLE_NAMES` (38 tables) and `STORAGE_BUCKETS` (4 buckets).
- `src/lib/sync/tableRegistry.ts` exports `ERASURE_TABLE_NAMES` (mirrors `TABLE_NAMES`).
- The cancel link must point to `cancel-account-deletion` Edge Function URL (pattern from S03).
- `pending_deletions` table: must store `(user_id, email, requested_at)`. Created via a new Supabase migration.
- Email provider: use env vars `EMAIL_PROVIDER_URL` + `EMAIL_API_KEY` + `EMAIL_FROM`. If absent, log a warning and skip silently — never throw.
- CI probe: runs as a Node.js/tsx script against the real Supabase project (uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars from GitHub Actions secrets).

## Open Questions

1. Should `pending_deletions` rows be hard-deleted after the receipt email is sent (GC), or retained for audit? Recommendation: retain for 90 days as a deletion audit trail, then purge via S11.
2. What email provider is available in the production environment? Recommendation: default to Resend (`https://api.resend.com/emails`) with env-var override.
