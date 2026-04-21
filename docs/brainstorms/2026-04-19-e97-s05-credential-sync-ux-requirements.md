# E97-S05 — Credential Sync UX for External Services (Requirements)

**Date:** 2026-04-19
**Epic:** E97 Sync UX Polish (final story)
**Story:** E97-S05
**Status:** Requirements / pre-plan

## Problem

Epic 97 has delivered everything a user needs to see that their **data**
(notes, books, flashcards, bookmarks, etc.) is syncing: header indicator
(S01), settings panel (S02), first-time upload wizard (S03), new-device
download overlay (S04). What is still invisible is the **credentials
layer**.

Knowlune stores three kinds of credentials for external services:

1. **AI provider keys** — OpenAI, Anthropic, Groq, GLM, Gemini,
   OpenRouter. (Ollama uses a server URL, not a secret, so it is exempt
   from Vault.)
2. **OPDS catalog passwords** — per-catalog basic-auth secrets.
3. **Audiobookshelf server API keys** — per-server long-lived tokens.

Since **E95-S02** these credentials live in **Supabase Vault** and are
brokered per-request through the `vault-credentials` Edge Function,
fronted by a resolver/cache layer introduced in **E95-S05**
(`src/lib/credentials/resolverFactory.ts`, plus `opdsPasswordResolver`,
`absApiKeyResolver`, and the `getConfiguredProviderIds()` helper for AI
providers in `src/lib/aiConfiguration.ts`). Secrets **never** travel
through the regular sync pipeline — not in `syncQueue`, not in any
publicly synced table, not in Dexie's metadata rows.

The practical consequence for users: after S04's download overlay
finishes on a new device, their OPDS catalogs, ABS servers, and AI
configs are all present as metadata — but credential reads may still
return `null` (first access, no cache) or `authFailed` (session refresh
failed). Today the UI renders "Not connected" with no explanation and
no guided recovery path. Users think the sync is broken.

E97-S05 fixes this with three UX affordances:

- A **"Credentials need setup" banner** listing every external service
  whose credential is missing on this device (AC1, AC6).
- **Inline status badges** in AI Config, OPDS Settings, and ABS Settings
  showing whether each credential is Vault-synced, local-only, or
  missing (AC3, AC4).
- A **"Why don't credentials sync like everything else?"** tooltip /
  popover explaining the Vault broker model (AC5).

## Existing Systems (Research Summary)

### Credential storage & broker — `src/lib/vaultCredentials.ts`

- Type: `CredentialType = 'ai-provider' | 'opds-catalog' | 'abs-server'`.
- API: `storeCredential`, `checkCredential`, `readCredential`,
  `readCredentialWithStatus`, `deleteCredential`.
- Auth-gated: all functions no-op if no Supabase user.
- Non-throwing; failures surfaced via `console.warn` + safe returns
  (`null` / `false`).
- `readCredentialWithStatus` returns a discriminated result so consumers
  can tell "not configured" from "auth-failed" — used by the resolver
  retry ladder.

### Resolver factory — `src/lib/credentials/resolverFactory.ts`

- `createCredentialResolver(kind)` returns `{ get, useValue,
  invalidate }`.
- Cache: in-memory, per-kind, scoped to session (`cache.ts`).
- Retry ladder on 401/403: invalidate → `supabase.auth.refreshSession()`
  → retry once → surface `authFailed: true` via hook.
- `useValue(id)` hook returns `{ value, loading, authFailed }`.
  **The `authFailed` flag is explicitly called out in the source as the
  driver for a "Re-enter credentials" banner (S05 = the deferred "AC-4
  polish" mentioned there).**

### Existing per-kind resolvers

- `src/lib/credentials/opdsPasswordResolver.ts` —
  `getOpdsPassword(catalogId)`, `useOpdsPassword(catalogId)`,
  `invalidateOpdsPassword(catalogId)`.
- `src/lib/credentials/absApiKeyResolver.ts` — analogous `getAbsApiKey`,
  `useAbsApiKey`, `invalidateAbsApiKey` (referenced by
  `useAudiobookshelfStore`).
- AI providers do NOT have a hook-style resolver today — instead,
  `aiConfiguration.ts` exposes `getDecryptedApiKeyForProvider(provider)`
  (checks Vault via `storeCredential` writes but reads from
  localStorage's `providerKeys` map) and `getConfiguredProviderIds()`
  (the async "which providers have Vault credentials?" aggregator we
  will piggy-back on for AC1 / AC3).

### AI configuration — `src/lib/aiConfiguration.ts`

Key functions for S05:

- `getConfiguredProviderIds(): Promise<AIProviderId[]>` — returns every
  provider the Vault knows about for this user, falling back to
  localStorage `providerKeys` if Vault is unavailable or empty. Ollama
  is included if a `serverUrl` is set (it has no Vault credential).
- `saveProviderApiKey(provider, key)` — writes to Vault
  fire-and-forget, writes an encrypted copy to
  `localStorage.providerKeys[provider]`.
- `saveAIConfiguration({...}, apiKey?)` — legacy single-key path
  (still used for `connectionStatus` updates); encrypts into
  `apiKeyEncrypted`.

S05 implication: the `config.providerKeys` map is **always** the
device-local fallback (localStorage-encrypted via Web Crypto). If
Vault returns `false` for `checkCredential('ai-provider', provider)`
but `providerKeys[provider]` is present → status = "Local only". If
both return empty → status = "Not configured". If Vault returns true
→ status = "Synced via Vault" regardless of localStorage.

### AI settings UI — `src/app/components/figma/AIConfigurationSettings.tsx`

- Already uses `getConfiguredProviderIds()` via a `useEffect` at line
  158 (sets `hasAnyProviderKey` boolean) to gate whether to show
  "Feature Permissions." We can extend this pattern to produce per-
  provider status in `ProviderKeyAccordion`.
- `ProviderKeyAccordion` receives `onConfigChanged` — the hook S05
  needs to invalidate its aggregator cache on.
- Cross-tab sync via `window.dispatchEvent(new
  CustomEvent('ai-configuration-updated'))` — S05's hook subscribes
  to this.

### OPDS UI — `src/app/components/library/OpdsCatalogSettings.tsx`

- Uses `checkCredential` to gate "has existing password" messaging.
- `useOpdsCatalogStore.addCatalog(catalog, password?)` already does
  Vault-first write.
- Catalog list view (`CatalogListView`) is a separate subcomponent we
  can extend with a status badge per row.

### ABS UI — `src/app/components/library/AudiobookshelfSettings.tsx` + `AudiobookshelfServerListView.tsx`

- Uses `checkCredential('abs-server', serverId)` to set
  `hasExistingApiKey` (line 80). Already the data shape S05 needs.
- `useAudiobookshelfStore.addServer(server, apiKey)` — same Vault-first
  pattern.
- Server list view is where AC4's badges go.

### Auth — `src/stores/useAuthStore.ts`

- `user: User | null` (Supabase user).
- All S05 evaluation is gated on `user !== null`. Unauthenticated
  users never see the banner or badges.

### Sync status — `src/app/stores/useSyncStatusStore.ts` (referenced by S02)

- `lastSyncAt` is the most reliable "first-sync-complete" signal
  S05 can use to gate its first evaluation run (avoid firing before
  `opdsCatalogs` / `audiobookshelfServers` have hydrated from
  Supabase).

### Settings nav — `src/app/components/settings/sections/`

- Existing sections: Profile, Appearance, Learning, Notifications,
  Account, IntegrationsData, Sync.
- AI config lives under Integrations & Data (confirm with a grep
  during plan phase); OPDS / ABS dialogs are triggered from
  `Library.tsx`.

## Requirements (from story ACs)

**R1 (AC1)** Banner appears when any of the following are true for the
signed-in user (order-agnostic):

- `getConfiguredProviderIds()` returns an empty set AND the user's
  `config.providerKeys` is non-empty (i.e. they have keys locally but
  nothing in Vault).
- Any row in Dexie `opdsCatalogs` with `auth?.username` set has
  `checkCredential('opds-catalog', id)` === `false`.
- Any row in Dexie `audiobookshelfServers` has
  `checkCredential('abs-server', id)` === `false`.

Banner is dismissible. On dismissal, persist in `sessionStorage` keyed
by userId (R6).

**R2 (AC2)** Each banner entry is a button that deep-links to the
correct settings surface and focuses the credential input:

- AI provider → `?section=integrations&focus=ai-provider:<providerId>`
  → `AIConfigurationSettings` reads query, expands that provider's
  `ProviderKeyAccordion` item, focuses its `<Input>`.
- OPDS catalog → open `OpdsCatalogSettings` dialog with
  `?focus=opds:<catalogId>` → `OpdsCatalogSettings` starts in edit
  mode for that catalog id, focuses password input.
- ABS server → open `AudiobookshelfSettings` dialog with
  `?focus=abs:<serverId>` → `AudiobookshelfSettings` starts in edit
  mode for that server id, focuses API key input.

**R3 (AC3)** Each provider row inside `AIConfigurationSettings` +
`ProviderKeyAccordion` shows a three-state badge computed from
`getConfiguredProviderIds()` ∪ `config.providerKeys` ∪
`config.apiKeyEncrypted`.

**R4 (AC4)** Each OPDS catalog + each ABS server shows the same badge
in its list view, computed from `checkCredential(kind, id)` +
(for OPDS) the presence of `auth?.username`.

**R5 (AC5)** A `<Tooltip>` (and an optional `<Popover>` anchored to
the banner's "Why?" link) explains the Vault broker model in plain
language with an optional Help link.

**R6 (AC6)** Banner auto-dismisses when the missing-list becomes empty.
Explicit X-click suppresses for the session via
`sessionStorage['knowlune:credential-banner-dismissed:<userId>'] =
'true'`. New session / new tab / sign-out + sign-in clears it.

## Open Questions (for plan phase)

1. **Banner placement** — top of Overview? Pinned alert component in
   `AppShell`? Proposal: **pinned above the Overview main content
   area**, rendered inside `App.tsx` near the other floating UI
   (`InitialUploadWizard`, `NewDeviceDownloadOverlay`). This keeps
   discovery high but does not block the entire viewport.

2. **AI provider deep-link mechanism** — the Settings page doesn't
   currently parse `?focus=...`. Options: (a) `useSearchParams` +
   `useEffect` in `AIConfigurationSettings`, (b) a new
   `useDeepLinkFocus` hook shared across the three settings surfaces.
   Proposal: (b) — DRY + testable.

3. **Help link target** — no Help docs surface exists yet. Proposal:
   render the "Learn more" link as a `<Button variant="link">` with
   an empty `href` and a `// TODO: Help article (E99)` comment; do
   not block S05 on docs work.

4. **"Local only" remediation** — should clicking "Local only"
   trigger a one-click "Upload to Vault" action? Proposal: **no** for
   S05 scope — users get the explanation and can re-save their key
   to promote it. An auto-promote flow is a future chore.

5. **Ollama treatment** — Ollama's server URL is not a Vault
   credential, but new-device users still need to re-enter it
   (it's stored in `config.ollamaSettings.serverUrl`, which does sync
   via the normal settings sync path — verify). Proposal: **exclude
   Ollama from S05's banner** (not a Vault credential; a different
   UX concern) and document the exclusion in the story.

6. **Aggregator freshness strategy** — polling interval vs event-
   driven? Proposal: event-driven (ai-configuration-updated, OPDS
   store subscribe, ABS store subscribe) + 30s fallback poll +
   refresh on tab `visibilitychange`. Mirrors S02 SyncSection.

7. **Race with S04 overlay** — banner must not render under the
   full-screen overlay. Proposal: gate banner render on `document
   .getElementById('new-device-download-overlay') === null` OR
   subscribe to the same "downloading complete" signal S04 uses.

## Patterns to Reuse

- Async "is credential configured" helper pattern:
  `getConfiguredProviderIds()` and `checkCredential()`.
- `useEffect`-based cross-tab event listener
  (`ai-configuration-updated`) from `AIConfigurationSettings.tsx`.
- `Promise.allSettled` parallel checks (ES2020-compatible).
- `sessionStorage` per-user keys — pattern already used in S03 for
  wizard dismissal.
- shadcn `Alert` + `Badge` + `Tooltip` primitives (already in
  `components/ui/`).
- Store-subscription hooks (`useAudiobookshelfStore`,
  `useOpdsCatalogStore`) — we subscribe to the `servers` / `catalogs`
  arrays and re-run the aggregator on change.

## Risk & Mitigation

- **R: Banner flashes before Dexie hydration finishes on new device
  sign-in.** → Gate first evaluation on `useSyncStatusStore.lastSyncAt
  !== null`.
- **R: `checkCredential` is an Edge Function call per row — N×2 rows
  could be expensive.** → Run via `Promise.allSettled`, parallel.
  Most users have ≤ 3 ABS servers + ≤ 2 OPDS catalogs + ≤ 3 AI
  providers. Cap total calls at ~8. Consider batch endpoint as
  follow-up if scale becomes an issue.
- **R: Stale banner after user saves credential in a different tab.**
  → Subscribe to `ai-configuration-updated` (cross-tab via storage
  event). OPDS/ABS writes go through Zustand stores — those rebroadcast
  locally; for cross-tab we accept the 30s fallback poll.
- **R: Session-dismissed banner never re-appears if user adds a new
  server that needs a credential.** → AC6 auto-clears the
  sessionStorage flag when transition happens (missing count rising
  from 0 → N); plan phase to confirm exact semantics.
- **R: Deep-link focus races the dialog mount animation.** → Use
  `requestAnimationFrame` inside the focus effect, or listen to the
  Dialog's `onOpenAutoFocus` to override.

## Success Metrics

- New-device users land on Overview and within one screenful see a
  clear, actionable banner listing their missing credentials
  (> 95% of new-device sessions with pre-existing external service
  configs).
- Click-through from banner to the focused input takes ≤ 1 click.
- Banner auto-dismisses within 2 seconds of saving the last
  missing credential (no reload, no navigation).
- "Why don't credentials sync?" tooltip viewed by > 30% of banner
  viewers (qualitative — nice-to-have instrumentation via telemetry
  event `ux.credential.explanation_viewed`, deferred).

## Out of Scope

- **Help articles** — placeholder link; not part of S05.
- **Auto-promote "Local only" → Vault** — deferred.
- **Ollama** — not Vault-brokered; different UX path if at all.
- **Server-side Vault lifecycle** — batch endpoints, reconciliation
  of orphaned vault entries, etc. (E95 follow-ups).
- **Telemetry dashboard** — emit events is a nice-to-have; UI is the
  deliverable.

## Definition of Done

- AC1–AC6 verified via Playwright + unit tests.
- Design review passes at 375 / 768 / 1440 px.
- Code review passes (silent-failure scan, architecture, accessibility).
- `tsc --noEmit` clean; design-token lint clean.
- Does not regress the S03 wizard, S04 overlay, or any existing AI /
  OPDS / ABS flow.
- Epic 97 retrospective can be scheduled after merge (final story).
