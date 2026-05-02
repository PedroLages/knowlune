---
title: "feat: Notice Acknowledgement at Signup + Material-Change Re-ack"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s02-notice-acknowledgement-requirements.md
---

# feat: Notice Acknowledgement at Signup + Material-Change Re-ack

## Overview

Adds an explicit, server-persisted privacy-notice acknowledgement gate at signup and a re-acknowledgement flow when the notice changes materially. The signup form will block submission until the user checks a consent checkbox. A background hook continuously compares the user's last-acked version to `CURRENT_NOTICE_VERSION`; when stale, it surfaces a non-blocking banner for 30 days, then a soft-block (read-only mode) until the user re-acknowledges.

## Problem Frame

Knowlune currently has passive legal links in the auth form but no server-side record of user acknowledgement. This creates GDPR audit risk — there is no evidence that users have read or agreed to the privacy notice. When the notice changes materially, users are never notified or required to re-acknowledge. This story closes both gaps with a lightweight compliance record and a graceful degradation UX (banner → soft-block) that prioritises user experience over hard gates.

(see origin: docs/brainstorms/2026-04-23-e119-s02-notice-acknowledgement-requirements.md)

## Requirements Trace

- R1 (AC-1): `notice_acknowledgements` Supabase table with RLS owner-only
- R2 (AC-2): Signup checkbox "I have read the Privacy Notice (v{version})" — submit disabled until checked
- R3 (AC-3): Write ack row on successful signup
- R4 (AC-4): `useNoticeAcknowledgement` hook — returns `{ acknowledged, stale }`
- R5 (AC-5): `LegalUpdateBanner` extended — re-ack banner (non-blocking, 30 days)
- R6 (AC-6): `useSoftBlock()` — write-gate after 30 days stale
- R7 (AC-7): 30-day window from server-side notice release date (`parseNoticeVersion`)
- R8 (AC-8): E2E test covering signup ack, stale re-ack, soft-block transition

## Scope Boundaries

- Google OAuth / Magic Link signup ack out of scope (no form; follow-up story)
- Consent toggles out of scope (S08)
- Export/delete flows out of scope (S03-S06)
- `ip_hash` stored as NULL (GDPR gap documented; no edge function needed)
- `useSoftBlock()` gates at component level, not sync engine queue

### Deferred to Separate Tasks

- Google OAuth / Magic Link ack recording: separate story in E119
- `ip_hash` full implementation via Supabase edge function: separate chore

## Context & Research

### Relevant Code and Patterns

- **Migration pattern**: `supabase/migrations/20260427000002_p4_sync.sql` — idempotent `IF NOT EXISTS` / `DROP POLICY IF EXISTS`, RLS with `auth.uid()`, owner-only policies via `FOR SELECT`, `FOR INSERT`, `FOR UPDATE` (see p3_sync for additional examples of insert-only RLS)
- **Compliance constants**: `src/lib/compliance/noticeVersion.ts` — `CURRENT_NOTICE_VERSION`, `NOTICE_DOCUMENT_ID`, `parseNoticeVersion()`
- **Existing banner shell**: `src/app/pages/legal/LegalUpdateBanner.tsx` — localStorage-based, dismissible; extend with server-backed mode and soft-block variant
- **Auth form**: `src/app/components/auth/EmailPasswordForm.tsx` — sign-up mode with `isSignUp` branch; `onSuccess` callback after `signUp` store action
- **Supabase client**: `src/lib/auth/supabase.ts` — nullable client (`supabase: SupabaseClient | null`)
- **Auth store**: `src/stores/useAuthStore.ts` — `useAuthStore(s => s.user)` for user identity
- **E2E patterns**: `tests/e2e/auth-flow.spec.ts` — `page.route()` mocking of Supabase endpoints; `tests/utils/test-time.ts` — `FIXED_DATE`, `getRelativeDate()`
- **Existing hook pattern**: `src/hooks/useReadingMode.ts` (or similar) — simple Zustand/hook pattern for feature flags
- **Supabase direct query pattern**: `src/lib/streak.ts` or `src/lib/settings.ts` — `supabase.from('table').select().eq().single()` pattern

### Institutional Learnings

- Soft-block should never block read actions — `useSoftBlock()` must only intercept write paths (per AC-6 and context notes)
- Error path at signup: ack write failure must NOT block the user from completing signup — show retry CTA, log the error, but call `onSuccess()` anyway
- RLS: use `FOR SELECT` + `FOR INSERT` separate policies (not `FOR ALL`) for fine-grained insert-only control where appropriate
- `supabase` client is nullable — all Supabase calls must guard with `if (!supabase)` before use
- E2E tests must use `FIXED_DATE` from `tests/utils/test-time.ts` — never `Date.now()` or `new Date()`

### External References

- GDPR Article 7 — conditions for valid consent (documented acknowledgement per-version required)
- Supabase RLS docs: row-level security with `auth.uid()` equality

## Key Technical Decisions

- **`ip_hash` = NULL**: No Supabase edge function is in scope. Store NULL and document the gap. The ack row still provides version + timestamp evidence. (see origin: open question 2)
- **Server-backed ack check via Supabase query (not localStorage)**: The hook queries `notice_acknowledgements` filtered by `user_id = auth.uid()` and `document_id = NOTICE_DOCUMENT_ID`, ordered by `acknowledged_at DESC`, taking 1 row. This is authoritative across devices.
- **30-day window from `parseNoticeVersion(CURRENT_NOTICE_VERSION).isoDate`**: This is the notice release date, parsed deterministically on the client — not the client clock. The comparison is `daysSince(noticeReleaseDate) > 30 && !acked`. This avoids a server roundtrip for the window calculation while keeping the reference date server-authored.
- **`LegalUpdateBanner` accepts a `mode` prop**: `'info'` (existing dismissible banner) vs `'reack'` (re-ack CTA + optional soft-block visual). This keeps backward compatibility and avoids breaking the existing PrivacyPolicy page usage.
- **`useSoftBlock()` is a thin wrapper around `useNoticeAcknowledgement`**: It returns `true` only when `stale === true && daysSincePolicyRelease > 30`. Component-level, not sync engine.
- **Checkbox state lives in `EmailPasswordForm`** — the `isSignUp` branch already has conditional UI; adding `privacyAcknowledged` state is minimal and co-located.
- **Write ack after `signUp` resolves successfully** — the hook inside `handleSubmit` writes the row only if `!result.error`. On write failure, `toast.error()` with a retry CTA, but `onSuccess()` still fires.

## Open Questions

### Resolved During Planning

- **Should `useSoftBlock` touch the sync engine queue?** No — component-level gate only (see origin: open question 3)
- **`ip_hash` required?** NULL for now with documented gap (see origin: open question 2)
- **Where should the soft-block gate render?** In `Layout.tsx` or as a wrapper around write-action components. Plan: add a `SoftBlockGate` component that wraps the main content area in `Layout.tsx` and renders a modal/overlay when `useSoftBlock()` is true, but keeps the read-only content visible beneath it.

### Deferred to Implementation

- Exact SQL column types for `version` and `document_id` (TEXT is implied, verify nullability with NOT NULL constraints)
- Whether `LegalUpdateBanner`'s existing localStorage path should be removed or kept as fallback
- Exact Playwright `page.route()` mock URLs needed for `notice_acknowledgements` REST endpoint

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
[Signup flow]
EmailPasswordForm (sign-up mode)
  └─ privacyAcknowledged: boolean (state)
  └─ checkbox: "I have read the Privacy Notice (v2026-04-23.1)"
       └─ link → /legal/privacy
  └─ submit button: disabled unless privacyAcknowledged
  └─ handleSubmit()
       ├─ signUp() → success
       │    └─ writeAck(CURRENT_NOTICE_VERSION) → supabase.from('notice_acknowledgements').insert()
       │         ├─ success → onSuccess()
       │         └─ failure → toast.error() + onSuccess() [non-blocking]
       └─ signUp() → error → show error (existing path, unchanged)

[Re-ack flow]
Layout.tsx
  └─ useNoticeAcknowledgement() → { acknowledged, stale, staleDays }
       └─ queries notice_acknowledgements WHERE user_id + document_id ORDER BY acknowledged_at DESC LIMIT 1
       └─ compares latestVersion vs CURRENT_NOTICE_VERSION
       └─ calculates staleDays = daysSince(parseNoticeVersion(CURRENT_NOTICE_VERSION).isoDate)
  └─ stale && staleDays <= 30 → <LegalUpdateBanner mode="reack" />
  └─ stale && staleDays > 30  → useSoftBlock() = true → <SoftBlockGate />

[SoftBlockGate]
  └─ Renders overlay: "Acknowledge our updated Privacy Notice to continue writing"
  └─ CTA: "Acknowledge" → writeAck() → clears soft-block
  └─ Read content visible beneath overlay (pointer-events: none on overlay)
```

## Implementation Units

- [ ] **Unit 1: Supabase Migration — `notice_acknowledgements` table**

**Goal:** Create the `notice_acknowledgements` table with RLS allowing owner-only read and insert.

**Requirements:** R1 (AC-1)

**Dependencies:** None — standalone migration

**Files:**
- Create: `supabase/migrations/20260428000001_notice_acknowledgements.sql`

**Approach:**
- Table columns: `id` (UUID PK default gen_random_uuid()), `user_id` (UUID NOT NULL FK → auth.users ON DELETE CASCADE), `document_id` (TEXT NOT NULL), `version` (TEXT NOT NULL), `acknowledged_at` (TIMESTAMPTZ NOT NULL DEFAULT now()), `ip_hash` (TEXT NULL)
- Indexes: `(user_id, document_id, acknowledged_at DESC)` for efficient "latest ack" queries
- RLS: `ALTER TABLE notice_acknowledgements ENABLE ROW LEVEL SECURITY`
- Policy `FOR SELECT`: `USING (auth.uid() = user_id)`
- Policy `FOR INSERT`: `WITH CHECK (auth.uid() = user_id)`
- No UPDATE/DELETE policies — ack records are immutable
- Use `IF NOT EXISTS` and `DROP POLICY IF EXISTS` for idempotency

**Patterns to follow:**
- `supabase/migrations/20260427000002_p4_sync.sql` — idempotency guards, RLS pattern, FK with ON DELETE CASCADE

**Test scenarios:**
- Test expectation: none — migration DDL; verified by RLS unit tests in Unit 4

**Verification:**
- Migration file is idempotent (safe to re-run)
- Table and policies exist after migration
- RLS: `SELECT` and `INSERT` succeed for the owning user, fail for a different `auth.uid()`

---

- [ ] **Unit 2: Signup Checkbox in `EmailPasswordForm`**

**Goal:** Add a "I have read the Privacy Notice" checkbox to the sign-up mode that disables the submit button until checked.

**Requirements:** R2 (AC-2), R3 (AC-3)

**Dependencies:** Unit 1 (table must exist for ack write; can develop in parallel since write is guarded by `!result.error`)

**Files:**
- Modify: `src/app/components/auth/EmailPasswordForm.tsx`

**Approach:**
- Add `privacyAcknowledged: boolean` state (false by default), scoped to `isSignUp` branch
- Render checkbox in sign-up mode only, above the submit button
- Label text: `I have read the` + link to `/legal/privacy` (opens in new tab) + `(v{CURRENT_NOTICE_VERSION})`
- Submit button: add `disabled={loading || (isSignUp && !privacyAcknowledged)}` — combine with existing `disabled={loading}`
- After `signUp()` resolves without error and `privacyAcknowledged` is true, call `writeNoticeAck(CURRENT_NOTICE_VERSION)` (helper from Unit 3)
- On ack write failure: `toast.error('Could not record your consent. You can acknowledge from Settings.')` — then still call `onSuccess()`

**Patterns to follow:**
- Existing `isSignUp` conditional rendering in `EmailPasswordForm.tsx`
- `min-h-[44px]` touch target on checkbox + label
- `text-brand-soft-foreground` for the link

**Test scenarios:**
- Happy path: checkbox unchecked → submit button is `disabled`
- Happy path: checkbox checked → submit button is enabled
- Happy path: after successful signup with checkbox, ack write is called (unit test mock)
- Error path: ack write fails → `toast.error()` fires, `onSuccess()` still called (signup not blocked)
- Edge case: sign-in mode → no checkbox rendered

**Verification:**
- Submit button cannot be activated in sign-up mode without the checkbox
- Checkbox is not rendered in sign-in mode

---

- [ ] **Unit 3: `writeNoticeAck` helper and `useNoticeAcknowledgement` hook**

**Goal:** Encapsulate ack write logic and the stale-version query in reusable, typed units.

**Requirements:** R3 (AC-3), R4 (AC-4)

**Dependencies:** Unit 1 (table), Unit 2 (caller of `writeNoticeAck`)

**Files:**
- Create: `src/lib/compliance/noticeAck.ts` — `writeNoticeAck(version: string): Promise<void>`
- Create: `src/hooks/useNoticeAcknowledgement.ts` — exports `useNoticeAcknowledgement(): { acknowledged: boolean, stale: boolean, staleDays: number, refetch: () => void }`
- Test: `src/hooks/__tests__/useNoticeAcknowledgement.test.ts`

**Approach:**

`noticeAck.ts`:
- `writeNoticeAck(version)` inserts `{ document_id: NOTICE_DOCUMENT_ID, version, acknowledged_at: new Date().toISOString(), ip_hash: null }` into `notice_acknowledgements` via `supabase.from('notice_acknowledgements').insert()`
- Guards: `if (!supabase) throw new Error('Supabase not configured')`
- Throws on error — callers handle it

`useNoticeAcknowledgement`:
- Queries `notice_acknowledgements` filtered by `document_id = NOTICE_DOCUMENT_ID`, ordered by `acknowledged_at DESC`, `.limit(1)` via `supabase.from(...)` in a `useEffect` on mount and when `user` changes
- If no user → returns `{ acknowledged: true, stale: false, staleDays: 0 }` (no gate for guests)
- If supabase null → returns `{ acknowledged: true, stale: false, staleDays: 0 }` (graceful fallback)
- `acknowledged` = `latestRow?.version === CURRENT_NOTICE_VERSION`
- `stale` = user has a row but `latestRow.version !== CURRENT_NOTICE_VERSION`
- `staleDays` = days since `parseNoticeVersion(CURRENT_NOTICE_VERSION).isoDate` — computed from `CURRENT_NOTICE_VERSION`, not client `Date.now()` (use `Math.floor((Date.now() - Date.parse(isoDate)) / 86_400_000)`)
- `refetch()` — re-runs the query (used after banner ack button click)

**Patterns to follow:**
- `src/lib/compliance/noticeVersion.ts` — imports and re-exports `NOTICE_DOCUMENT_ID`, `CURRENT_NOTICE_VERSION`, `parseNoticeVersion`
- `src/lib/streak.ts` or `src/lib/settings.ts` — Supabase `.from().select().eq().order().limit(1).single()` pattern

**Test scenarios:**
- Happy path: no rows → `{ acknowledged: false, stale: false }`
- Happy path: row with `CURRENT_NOTICE_VERSION` → `{ acknowledged: true, stale: false }`
- Happy path: row with older version → `{ acknowledged: false, stale: true, staleDays: N }`
- Edge case: unauthenticated user → `{ acknowledged: true, stale: false }` (no query fired)
- Edge case: supabase null → `{ acknowledged: true, stale: false }` (graceful fallback)
- Error path: Supabase query error → logs warning, returns `{ acknowledged: true, stale: false }` (fail-open for reads)
- `writeNoticeAck`: happy path inserts correct payload
- `writeNoticeAck`: throws when supabase is null

**Verification:**
- All unit test scenarios pass
- Hook returns correct shape in every state

---

- [ ] **Unit 4: Extend `LegalUpdateBanner` with re-ack mode + `SoftBlockGate`**

**Goal:** Surface re-ack banner for stale users (non-blocking, 30 days) and a soft-block overlay after 30 days, plus integrate into `Layout.tsx`.

**Requirements:** R5 (AC-5), R6 (AC-6), R7 (AC-7)

**Dependencies:** Unit 3 (`useNoticeAcknowledgement`, `writeNoticeAck`)

**Files:**
- Modify: `src/app/pages/legal/LegalUpdateBanner.tsx` — add `mode` prop (`'info' | 'reack'`), ack button in `reack` mode
- Create: `src/app/components/SoftBlockGate.tsx` — overlay gate component
- Modify: `src/app/components/Layout.tsx` — integrate `useNoticeAcknowledgement` + conditionally render banner or gate
- Test: `src/app/pages/legal/__tests__/LegalUpdateBanner.reack.test.tsx`

**Approach:**

`LegalUpdateBanner` changes:
- Add `mode?: 'info' | 'reack'` prop (default `'info'` for backward compatibility)
- In `reack` mode: show "Our Privacy Notice has been updated. Please review and acknowledge to continue using all features." + "Review & Acknowledge" button
- Acknowledge button calls `writeNoticeAck(CURRENT_NOTICE_VERSION)` then calls an `onAcknowledged?: () => void` prop (triggers `refetch()` in Layout)
- Loading state on button during write; toast on error

`SoftBlockGate`:
- Renders a full-screen semi-transparent overlay (z-50) with centered card
- Message: "Please acknowledge our updated Privacy Notice to continue creating and saving content."
- CTA: "Acknowledge Privacy Notice" button → `writeNoticeAck()` → `refetch()`
- Link: "View Privacy Notice" → `/legal/privacy`
- Does NOT block pointer events on the underlying content (read-only browsing still works)
- Uses `pointer-events-none` on main content wrapper only for write elements — OR simply renders the overlay without `pointer-events: all` on body (soft visual gate, not a technical permission block). Decision: soft visual gate — the overlay has its own CTA, and write paths at component level show "Acknowledge to continue" inline. Actual write-action blocking is not enforced at the DOM level in this story; `useSoftBlock()` flag is available for future per-component gating.

`Layout.tsx` integration:
- Import `useNoticeAcknowledgement`
- `stale && staleDays <= 30` → render `<LegalUpdateBanner mode="reack" onAcknowledged={refetch} />`
- `stale && staleDays > 30` → render `<SoftBlockGate onAcknowledged={refetch} />` (no banner)
- Guest / acknowledged: neither renders

**Patterns to follow:**
- Existing `LegalUpdateBanner` props and conditional render patterns
- `bg-brand-soft`, `text-brand-soft-foreground`, `rounded-2xl`, `min-h-[44px]` accessibility tokens

**Test scenarios:**
- Happy path: `mode="info"` renders dismiss-only banner (existing behavior, regression)
- Happy path: `mode="reack"` renders "Acknowledge" button
- Happy path: clicking Acknowledge button calls `writeNoticeAck` and `onAcknowledged`
- Error path: `writeNoticeAck` throws → `toast.error()`, button returns to non-loading state
- Edge case: unauthenticated (stale=false) → no banner rendered in Layout

**Verification:**
- `LegalUpdateBanner` renders correctly in both modes
- `SoftBlockGate` renders with correct message and CTA
- `Layout.tsx` shows banner only when `stale && staleDays <= 30`, gate only when `staleDays > 30`

---

- [ ] **Unit 5: `useSoftBlock` hook**

**Goal:** Expose a single `useSoftBlock(): boolean` hook that write-action components can consume.

**Requirements:** R6 (AC-6)

**Dependencies:** Unit 3 (`useNoticeAcknowledgement`)

**Files:**
- Create: `src/hooks/useSoftBlock.ts`
- Test: integrated into `src/hooks/__tests__/useNoticeAcknowledgement.test.ts` (same test file)

**Approach:**
- `useSoftBlock()` calls `useNoticeAcknowledgement()` and returns `stale && staleDays > 30`
- Returns `false` for unauthenticated users (inherited from hook)
- Simple one-liner wrapper

**Test scenarios:**
- Happy path: `stale=false` → returns `false`
- Happy path: `stale=true, staleDays=15` → returns `false`
- Happy path: `stale=true, staleDays=31` → returns `true`
- Edge case: unauthenticated → returns `false`

**Verification:**
- Returns boolean in all states

---

- [ ] **Unit 6: E2E tests — notice acknowledgement flows**

**Goal:** Cover the three AC-8 scenarios end-to-end: signup ack, stale re-ack banner, soft-block transition.

**Requirements:** R8 (AC-8)

**Dependencies:** Units 1–5

**Files:**
- Create: `tests/e2e/compliance/notice-acknowledgement.spec.ts`

**Approach:**

The E2E tests mock Supabase REST endpoints via `page.route()` (same pattern as `auth-flow.spec.ts`). No live Supabase connection required.

Three test scenarios:

1. **Signup with required checkbox**
   - Navigate to `/login`, toggle to sign-up
   - Fill email + password + confirm password
   - Assert submit button is disabled (checkbox unchecked)
   - Check the privacy checkbox
   - Assert submit button is now enabled
   - Mock `**/auth/v1/signup*` → success + mock `**/rest/v1/notice_acknowledgements*` → 200
   - Submit → assert `onSuccess` redirects (navigate to `/`)

2. **Stale version → re-ack banner**
   - Inject auth session (mock user in localStorage/page.evaluate)
   - Mock `**/rest/v1/notice_acknowledgements*` SELECT → returns row with older version `'2026-01-01.1'`
   - Navigate to `/`
   - Assert `LegalUpdateBanner` with "Acknowledge" button is visible
   - Mock INSERT → 200
   - Click "Acknowledge"
   - Assert banner disappears

3. **Soft-block after 30 days**
   - Use `page.clock.install({ time: getRelativeDate(31) })` relative to `parseNoticeVersion(CURRENT_NOTICE_VERSION).isoDate` to simulate 31 days past the notice release date — OR set `FIXED_DATE` + freeze clock using Playwright's `page.clock`
   - Inject auth session with stale ack row
   - Mock SELECT → older version row
   - Navigate to `/`
   - Assert `SoftBlockGate` overlay is visible (not banner)
   - Assert "Acknowledge Privacy Notice" CTA is visible

**Patterns to follow:**
- `tests/e2e/auth-flow.spec.ts` — `page.route()`, `MOCK_SIGNUP_RESPONSE`, `MOCK_SESSION_RESPONSE`
- `tests/utils/test-time.ts` — `FIXED_DATE`, `getRelativeDate()`
- `tests/e2e/support/fixtures.ts` — import `test, expect`

**Test scenarios:**
- (see Approach above — three scenarios map directly to AC-8)

**Verification:**
- All three E2E scenarios pass reliably
- No `Date.now()` or `new Date()` in test file (ESLint `test-patterns/deterministic-time` rule)

## System-Wide Impact

- **Interaction graph:** `Layout.tsx` gains a `useNoticeAcknowledgement` subscription — triggers on mount and on user change. The hook fires a Supabase query; ensure query is debounced on rapid session changes (standard React `useEffect` cleanup with `mounted` guard).
- **Error propagation:** Ack write failures in signup are non-fatal (toast + continue). Ack write failures in the banner are non-fatal (toast + button reset). Hook query errors fail-open (return `acknowledged: true`) to avoid locking out users on transient Supabase errors.
- **State lifecycle risks:** `useNoticeAcknowledgement` caches result in local state; `refetch()` is the invalidation path. After `writeNoticeAck`, callers must call `refetch()` to clear the stale/block state. No stale state risk between tabs (each tab runs the hook independently).
- **API surface parity:** `LegalUpdateBanner`'s `mode` prop defaults to `'info'` — all existing usages (PrivacyPolicy page) are backward-compatible.
- **Unchanged invariants:** `EmailPasswordForm` sign-in mode is unchanged. Magic Link and Google OAuth flows are unchanged. `CURRENT_NOTICE_VERSION` constant is unchanged and remains the single source of truth.
- **Integration coverage:** The signup flow requires an integration test that mocks both the auth signup endpoint AND the ack insert endpoint to verify both fire in sequence.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `supabase` nullable in all new paths | Guard every `supabase.from()` call with `if (!supabase)` — fail-open for reads, throw for writes |
| Ack write blocking signup | Contract is explicit: write failure calls `onSuccess()` anyway; only shows toast |
| `staleDays` computed client-side from `CURRENT_NOTICE_VERSION.isoDate` | The date is embedded in the constant by the developer, not the client clock — safe and consistent |
| Soft-block overlay not actually preventing writes | Accepted: this is a soft UX gate, not a security control. Write permissions remain on the server (future story can add server-side enforcement) |
| `useNoticeAcknowledgement` firing on every render in Layout | Use `useEffect` with `[user?.id]` dependency — only re-queries when user identity changes |
| E2E tests depending on Playwright clock manipulation for 30-day scenario | Use `page.clock.install()` (Playwright 1.45+) or mock the `Date` constructor via `page.evaluate()` |

## Documentation / Operational Notes

- After deploy, bump `CURRENT_NOTICE_VERSION` in `src/lib/compliance/noticeVersion.ts` whenever the privacy notice changes materially — this is the single trigger for re-ack flows
- `ip_hash` is NULL in all rows until an edge function is added; document this gap in a `docs/known-issues.yaml` entry
- No migration rollback script needed for this table (ack records are auditable and should not be deleted on rollback)

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s02-notice-acknowledgement-requirements.md](../brainstorms/2026-04-23-e119-s02-notice-acknowledgement-requirements.md)
- Story file: `docs/implementation-artifacts/stories/E119-S02.md`
- Related plan (S01): `docs/plans/2026-04-23-002-feat-e119-s01-privacy-notice-versioning-plan.md`
- Full GDPR compliance plan: `docs/plans/2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md`
- Auth flow patterns: `src/app/components/auth/EmailPasswordForm.tsx`
- Migration patterns: `supabase/migrations/20260427000002_p4_sync.sql`
- E2E patterns: `tests/e2e/auth-flow.spec.ts`
