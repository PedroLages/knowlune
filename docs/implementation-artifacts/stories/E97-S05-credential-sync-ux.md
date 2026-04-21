---
story_id: E97-S05
story_name: "Credential Sync UX for External Services"
status: ready-for-dev
started: 2026-04-19
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 97.05: Credential Sync UX for External Services

## Story

As a Knowlune user who signs in on a new device (or who has configured
external services like AI providers, OPDS catalogs, or Audiobookshelf
servers),
I want the app to clearly explain which credentials need to be re-entered,
which are synced via Vault vs stored locally, and walk me through restoring
them in one place,
so that I understand why my API keys and server passwords do not sync like
my notes and books, and I can get my integrations working again without
hunting through settings pages.

## Context

This is the **final** story of Epic 97 (Sync UX Polish). Prior stories:

- **E97-S01** — Header sync status indicator (always-on subtle readout).
- **E97-S02** — Sync Settings Panel (`SyncSection.tsx`).
- **E97-S03** — Initial Upload Wizard (upload local data to Supabase).
- **E97-S04** — New Device Download Experience (auto-download on sign-in).

E97-S05 closes the "what happened to my credentials?" gap that S04 exposes.
In **E95-S02** Knowlune moved API credentials (OpenAI / Anthropic / Groq /
GLM / Gemini / OpenRouter / Ollama URL isn't a credential / OPDS passwords /
Audiobookshelf API keys) into Supabase Vault via the `vault-credentials`
Edge Function, fronted by the resolver/cache pattern in
`src/lib/credentials/` (E95-S05). Credentials **never** travel in the
`syncQueue`, `syncMetadata`, or any public Supabase table — they are
brokered per-request through `readCredential('abs-server' | 'opds-catalog'
| 'ai-provider', id)`.

What S04 does not address: after download completes, the user's OPDS /
Audiobookshelf / AI configs are all present in Dexie, but the credential
reads from Vault may return `null` (first access on new device, no cache)
or `authFailed` (session refresh failed). The UI today silently renders
"Not connected" and offers no guided path to re-enter keys.

## Acceptance Criteria

### AC1 — "Credentials need setup" banner on new device

**Given** the user has just signed in and S04's download overlay has
dismissed,
**And** one or more of the following is true for the current user:

- an AI provider is selected or listed in `providerKeys` but
  `getConfiguredProviderIds()` returns no entry for it (no Vault
  credential; no device-local fallback either), OR
- an OPDS catalog row exists in Dexie but `checkCredential('opds-catalog',
  id)` returns `false` (and the catalog is not anonymous — `auth.username`
  is set), OR
- an Audiobookshelf server row exists in Dexie but
  `checkCredential('abs-server', id)` returns `false`,

**Then** a dismissible banner / callout is rendered (top of Overview or
pinned in Settings — picked during plan phase) listing each missing
credential with service name, connection name, and "Re-enter" action.

### AC2 — Click-through opens the relevant settings page with input focused

**Given** AC1 banner is visible,
**When** the user clicks a missing-credential entry,
**Then** the app navigates to the correct settings surface (AI
Configuration, OPDS Catalog Settings dialog, Audiobookshelf Settings
dialog) **and** the relevant credential input (`<input type="password">`
or the "Enter new API key" field) is focused and the form is in edit
mode for that specific entry.

### AC3 — Per-AI-provider sync status indicator

**Given** the user is viewing `AIConfigurationSettings.tsx` or
`ProviderKeyAccordion`,
**When** each configured provider is rendered,
**Then** an inline status indicator shows either:

- **"Synced via Vault"** (cloud icon) — `checkCredential('ai-provider',
  providerId)` returned `true`, OR
- **"Local only"** (phone/device icon) — only present in
  `config.providerKeys[provider]` (localStorage encrypted fallback), OR
- **"Not configured"** (outline icon) — no credential known anywhere.

Each indicator has a `<Tooltip>` explaining the state.

### AC4 — Per-server sync status indicator (OPDS + ABS)

**Given** the user opens `OpdsCatalogSettings` or `AudiobookshelfSettings`,
**When** the server/catalog list is rendered,
**Then** each row shows the same three-state status (Synced via Vault /
Local only / Not configured) based on `checkCredential('opds-catalog' |
'abs-server', id)`. For OPDS catalogs with no `auth.username`, the
indicator shows "No credential needed" (anonymous feed) instead.

### AC5 — "Why don't credentials sync?" explanation

**Given** the user hovers or taps the status indicator **or** opens the
banner's "Why?" link,
**Then** an informational tooltip / popover displays copy explaining:

1. Credentials are stored in **Supabase Vault**, not the regular sync
   stream, for security.
2. Vault brokers the secret per-request per-device; it is not pushed into
   Dexie or the shared sync table on another device.
3. On a new device, the credential is read from Vault on first use (e.g.
   when loading an OPDS catalog or making an AI request).
4. If the user sees "Local only," it means the key lives only in this
   browser's localStorage and will not appear on other devices — they
   should re-save it in settings to promote it into Vault.

Copy-tone: reassuring, short, no jargon. Links to a Help article
placeholder (deferred).

### AC6 — Banner auto-dismiss + per-session persistence

**Given** the banner from AC1 is visible,
**When** the user resolves the last missing credential (re-enters an AI
API key / OPDS password / ABS API key and the save handler's subsequent
`checkCredential` returns `true`),
**Then** the banner disappears automatically without a reload.

**And** when the user clicks the "Dismiss" (X) action on the banner
explicitly, the banner is suppressed for the remainder of the current
session (persist to `sessionStorage` keyed per user id —
`knowlune:credential-banner-dismissed:{userId}`). Fresh tabs / new
sessions re-evaluate.

## Tasks / Subtasks

- [ ] Task 1: Credential status aggregator (AC1, AC3, AC4) — new
  `src/lib/credentials/credentialStatus.ts` with
  `getMissingCredentials(userId): Promise<MissingCredential[]>` and
  `getCredentialStatus(kind, id): Promise<'vault' | 'local' | 'missing'
  | 'anonymous'>`. Reuses `checkCredential`, `getConfiguredProviderIds`,
  Dexie reads on `opdsCatalogs` + `audiobookshelfServers`.
- [ ] Task 2: `useMissingCredentials` React hook (AC1, AC6) — subscribes
  to `ai-configuration-updated`, `opds-catalogs` store, `abs-servers`
  store + a 30s refresh timer; re-evaluates via Task 1 aggregator.
- [ ] Task 3: `CredentialSetupBanner.tsx` (AC1, AC2, AC5, AC6) — rendered
  in `App.tsx` or on the Overview page (confirm in plan phase). Uses
  Task 2 hook. Provides click handlers that route to:
  - AI provider: `/settings?section=integrations` with a focus hint for
    `ProviderKeyAccordion` to expand that provider and focus its input.
  - OPDS: open `OpdsCatalogSettings` dialog in edit mode for catalog id.
  - ABS: open `AudiobookshelfSettings` dialog in edit mode for server id.
- [ ] Task 4: `CredentialSyncStatusBadge.tsx` (AC3, AC4) — shared inline
  indicator with Cloud / Smartphone / Circle icons + tooltip. Accepts
  `status` prop returned from Task 1.
- [ ] Task 5: Wire badge into `AIConfigurationSettings` +
  `ProviderKeyAccordion` (AC3).
- [ ] Task 6: Wire badge into `OpdsCatalogSettings` list rows +
  `AudiobookshelfServerListView`/`AudiobookshelfServerCard` (AC4).
- [ ] Task 7: Focus + deep-link plumbing for banner click-through (AC2) —
  URL hash or query param (`?focus=opds:<id>` style) consumed by the
  relevant settings component's `useEffect` to open the right form and
  `inputRef.current?.focus()` after mount.
- [ ] Task 8: `sessionStorage` dismissal + AC6 auto-clear logic.
- [ ] Task 9: Unit tests — aggregator truth table, hook transitions,
  badge rendering, banner visibility.
- [ ] Task 10: E2E — simulate new device with Vault-configured credentials
  (seed + wipe Dexie), assert banner appears, click-through focuses
  input, re-entering a key clears the corresponding entry, banner
  auto-dismisses when empty.

## Design Guidance

- Banner placement: top-of-viewport `Alert` card (shadcn `Alert` +
  custom header), non-modal. Mobile (375px) = full-width beneath header;
  desktop ≥1024px = inline within the page max-width container.
- Badge copy: "Synced via Vault" / "Local only" / "Not configured" /
  "No credential needed". Icons: `Cloud`, `Smartphone`, `CircleDashed`,
  `CheckCircle2` (anonymous OPDS).
- Tooltip content ≤ 3 sentences. Respect `prefers-reduced-motion`
  (no banner slide-in animation when reduced).
- Empty / loading state for the banner during the aggregator's initial
  async resolve: render nothing (do not flash a skeleton).
- Use design tokens from `theme.css` — `bg-brand-soft`,
  `text-brand-soft-foreground`, `bg-warning/10`, `text-warning`,
  `bg-muted`, etc. No hardcoded color classes.
- All interactive targets ≥ 44×44px.

## Implementation Notes

- **Do not cache** missing-credential evaluation results in the resolver
  cache — that cache lives in `src/lib/credentials/cache.ts` and is
  scoped to positive reads. Missing-credential aggregation is a UI
  concern; use a 30s polling refresh plus event listeners on
  `ai-configuration-updated` and on store subscriptions.
- **Do not read** credential values — only use `checkCredential` and
  the `providerKeys` / server-row presence. The banner must never
  surface secret material.
- **New-device race:** the banner's first evaluation must run AFTER
  `hydrateP3P4FromSupabase` + the initial sync-engine download cursor
  have populated `opdsCatalogs` and `audiobookshelfServers` — otherwise
  the banner will show an empty "nothing missing" state for a window.
  Gate the first evaluation on `useSyncStatusStore.lastSyncAt !==
  null` OR subscribe to the same signal the S04 overlay uses to dismiss.
- **AC2 deep-link:** prefer `useSearchParams` over a custom event bus
  so reloads preserve intent. The target settings component owns a
  `useEffect([searchParams])` that reads its sub-key, opens the correct
  form, focuses the input, then clears the param via `setSearchParams(
  { focus: undefined })`.
- **AC3/AC4 status resolution:** run `checkCredential` calls in parallel
  via `Promise.allSettled` (ES2020, per `reference_es2020_constraints`).
  Result shape: `Record<id, 'vault' | 'local' | 'missing' |
  'anonymous'>`.

## Testing Notes

- Unit: `credentialStatus.ts` aggregator — mock `checkCredential` +
  `getConfiguredProviderIds`; assert correct bucketing for:
  vault-only provider, local-only (legacy `apiKeyEncrypted`),
  unconfigured provider, anonymous OPDS, authenticated OPDS without
  Vault entry, ABS server without Vault entry.
- Unit: `useMissingCredentials` hook — simulate `ai-configuration-
  updated` event, store subscription update, and polling tick.
- Unit: AC6 dismissal persistence — sessionStorage read/write, auto-clear
  when missing list goes empty, per-userId keying.
- E2E: new-device flow — seed Supabase with AI config + OPDS catalog +
  ABS server, seed Vault (via Edge Function test fixture), wipe Dexie,
  sign in, wait for S04 overlay → assert S05 banner appears with 3
  entries.
- E2E: click-through — click "Re-enter" on OPDS entry → assert
  `OpdsCatalogSettings` dialog opens, form is in edit mode for the
  expected catalog, password input is focused.
- E2E: save-and-clear — type a password, save, assert banner entry
  count decreases by one. Save all three → assert banner unmounts.
- E2E: dismiss persistence — click X, reload tab, assert banner re-
  evaluates fresh (new session). Click X, navigate within SPA, assert
  banner stays dismissed.

## Pre-Review Checklist

(standard — see story-template.md)

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — aggregator and hook surface failures via
  console.warn + safe fallbacks
- [ ] useEffect hooks have cleanup functions (ignore flag for async,
  event listener removal, setInterval clearInterval)
- [ ] No optimistic UI updates before persistence — banner entry removal
  waits for `checkCredential` to flip to true post-save
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] At every non-obvious site, add `// Intentional: <reason>` comment
- [ ] `tsc --noEmit` clean before submission
- [ ] Touch targets ≥ 44×44 px
- [ ] ARIA: banner has `role="status"` + `aria-live="polite"`; badges
  have accessible name via tooltip `aria-label`
- [ ] Design tokens only — no hardcoded colors

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Populated during implementation]
