# E95-S05 — OPDS and Audiobookshelf Server Connection Sync

**Status:** Requirements (brainstorm output)
**Date:** 2026-04-19
**Epic:** E95 — Online beta: auth + entitlements + server state
**Depends on:** E95-S01 (user_settings), E95-S02 (vault-credentials broker), E92 sync engine
**Related known issue:** KI-E95-S02-L01 (ABS apiKey read-path not migrated, 20+ call sites)

---

## Problem

Users who configure an OPDS feed or an Audiobookshelf (ABS) server on one device have to reconfigure on every new device. Their server URLs, library selections, and credentials live only in Dexie / localStorage. Beta-launch goal is "sign in and have your stuff show up" — that promise fails if the user's library sources don't hydrate.

E95-S02 shipped the Supabase Vault broker (`vault-credentials` Edge Function) and the server-side tables `opds_catalogs` and `audiobookshelf_servers` (migration `supabase/migrations/20260423000001_server_tables_no_credentials.sql`). It also registered both tables in `src/lib/sync/tableRegistry.ts` (lines 517, 530). But the ABS apiKey **read path** was never migrated — 20+ call sites still read `server.apiKey` directly from the local Dexie row, which was left in place as a compatibility shim. That is known issue **KI-E95-S02-L01**, and this story exists to close it alongside wiring up the actual row-sync for both tables.

## Goals

1. On a fresh device, after sign-in, the user's OPDS catalogs and ABS servers hydrate from Supabase and become immediately usable (catalog browsable, ABS library syncable).
2. ABS apiKey and OPDS password never round-trip through Postgres rows or the Dexie `syncQueue` — they only travel via the vault-credentials Edge Function (E95-S02 contract).
3. KI-E95-S02-L01 is **closed in this story**: every read site of `audiobookshelfServer.apiKey` goes through a single async resolver that reads from the vault (with a local cache), not from the Dexie row.
4. Existing users (installed app pre-vault, apiKey stored locally) are migrated safely on first run after shipping — no silent loss of configured servers.

## Non-goals

- Credential rotation UX (E95-S02 broker supports it; UI is a later story).
- Multi-tenant / shared server connections — each server row is still single-user (`user_id` = `auth.uid()`).
- Syncing ABS playback progress or library state — that is already wired through `absProgress` / library sync. This story only syncs the **connection configuration**.
- Changing the Vault broker API surface — reuse store/retrieve/delete/rotate as-is.

## Users and scenarios

1. **New-device sign-in.** User signs into Knowlune on a second device. Within one sync tick, Settings > Library shows their OPDS catalogs and ABS servers from device 1, and the ABS library sync begins pulling books without asking for credentials.
2. **Existing install upgrade.** User already has `audiobookshelf_servers` rows in Dexie with `apiKey` populated (pre-vault era). On first run after upgrade, the app migrates each local apiKey into the vault, strips `apiKey` from the Dexie row, and enqueues a sync of the metadata row to Supabase. No user-visible interruption.
3. **Offline edit.** User edits an ABS server name while offline. Name change rides the sync queue. Credentials stay untouched (credentials are never in the queue).
4. **Credential update.** User pastes a new ABS apiKey. Store writes the new secret through the vault broker; the Dexie row metadata (`updatedAt`) is updated via `syncableWrite`; the apiKey column on the row is never populated (post-migration).

---

## Hard constraints (from user — non-negotiable)

These three items are **requirements**, not nice-to-haves. Planning must resolve all three in this story.

### HC-1: ABS apiKey read-path migration (resolves KI-E95-S02-L01)

All call sites that currently read `server.apiKey` directly off the Dexie row must be migrated to read through a single async resolver backed by the vault broker plus an in-memory cache. The compatibility shim that leaves `apiKey` on the Dexie row as a mirror copy is removed in this story — not deferred again.

**Confirmed call sites** (grep `server.apiKey` / `server?.apiKey` / `config.apiKey` across `src/`, excluding tests and unrelated `apiKeyEncrypted` AI-config fields):

- `src/stores/useAudiobookshelfStore.ts` (lines ~82, 101, 188, 196, 220, 234, 257, 290, 298) — store methods: addServer, updateServer, testConnection, fetchLibraries, fetchCollections
- `src/app/hooks/useAudiobookshelfSync.ts` (lines 90, 110, 141, 159) — library sync, cover URL, bearer auth
- `src/app/hooks/useAudiobookshelfProgressSync.ts` (lines 73, 77, 94, 140, 159, 172) — progress sync read + write
- `src/app/hooks/useAudiobookshelfSocket.ts` (lines 113, 115, 141) — socket bearer + reconnect dep array
- `src/app/hooks/useAudioPlayer.ts` (line 313) — stream-URL apiKey resolution
- `src/app/pages/CollectionDetail.tsx` (line 70)
- `src/app/components/library/CollectionCard.tsx` (lines 56, 168)
- `src/app/components/library/SeriesCard.tsx` (lines 103, 162)
- `src/app/components/library/AudiobookshelfSettings.tsx` (lines 105, 191)

Count: 9 files, ~25 read/write sites. Planning must list each one and confirm it calls the async resolver (or uses a hook like `useAbsApiKey(serverId)` for React components that need reactive access).

**Requirement:** After this story ships, a grep for `\.apiKey` within `src/` under files that touch `audiobookshelfServer` must return zero hits that read the field as a stored property. The Dexie type `AudiobookshelfServer` must no longer declare an `apiKey` field (or must declare it as `never` / removed) so TypeScript enforces the migration.

**Resolver contract (to be specified in plan):** one exported function + one React hook.

```
getAbsApiKey(serverId: string): Promise<string | null>
useAbsApiKey(serverId: string | undefined): { apiKey: string | null; loading: boolean; error: Error | null }
```

Both read through vault (cached in memory keyed by `serverId`), retry once on 401, return `null` if vault entry is absent. The hook is needed because cover-URL / socket / stream-URL consumers are render-time.

### HC-2: Backwards-compatibility migration for pre-vault installs

Existing users have `apiKey` (ABS) and `password` (OPDS) in their local Dexie rows. The story must migrate these into the vault on first run after upgrade without user interaction and without dropping the connection.

**Requirement:** A one-shot migration routine runs after app boot when `auth.uid()` is available, once per device, tracked via a Dexie `kv` entry (e.g. `migrations.absApiKeyToVault.v1 = 'done'`). For each local server row that has a local `apiKey` / `password`:

1. Call `storeCredential(kind, serverId, secret)` against the vault broker.
2. On success: clear the local field in Dexie (via a raw migration write, not `syncableWrite` — we don't want to push a stale metadata row for a field we're removing from the schema).
3. On failure: leave the local field in place, log `sync.migration.credential_upload_failed` telemetry with `{ kind, serverId }`, retry on next boot. Do **not** surface a user-visible error on the first attempt — it's silent recovery.
4. After three consecutive failed boots for the same `serverId`, surface a non-blocking toast: "Can't secure your ABS credentials — check your connection."

**Schema requirement:** The Dexie schema bump for E95-S05 must add a new version where `audiobookshelfServers` and `opdsCatalogs` drop `apiKey` / `password` from the stored shape, with the upgrade function running the migration described above for rows that still carry the field. See `src/db/schema.ts` for the pattern (Dexie 4 async upgrades cannot read auth; the migration must run *after* the upgrade, from a post-boot hook that does have auth — not inside the Dexie upgrade function).

**Safety rails:**

- If the user is not signed in on first boot after upgrade, the migration defers until sign-in. Local apiKey remains readable by the legacy shim until the migration completes.
- If vault write succeeds but the local clear fails (write-partial), the next boot retries vault write, which is idempotent (vault overwrites on `storeCredential` with the same key).
- The one-shot is keyed per-device, not per-account — a user switching between two accounts on the same device re-runs migration for the new account's rows.

### HC-3: Full Supabase sync wiring for both tables

Both `opdsCatalogs` and `audiobookshelfServers` must be end-to-end synced. E95-S02 created the server-side schema and RLS and registered the Dexie tables in `tableRegistry`, but did not wire the write path or the hydration path.

**Requirement checklist** — planning must confirm each, for both tables:

- [ ] Supabase table exists with RLS policies (already true — migration `20260423000001`)
- [ ] `tableRegistry` entry with `fieldMap` (camelCase Dexie ↔ snake_case Postgres) and `stripFields` (credentials — `apiKey`, `password`) — already registered, but `fieldMap` / `stripFields` must be audited against the post-migration Dexie shape (after HC-2 removes the credential fields, `stripFields` for credentials becomes a no-op defense-in-depth only)
- [ ] All store write methods route through `syncableWrite` (not raw `db.table.put`). Call sites: `useAudiobookshelfStore.addServer/updateServer/removeServer`, `useOpdsCatalogStore.addCatalog/updateCatalog/removeCatalog`
- [ ] Hydration on sign-in: `syncEngine.download` pulls server rows into Dexie. Needs verification that the tables are in the download manifest for E95-S05.
- [ ] Credential writes use `vaultCredentials.storeCredential` (in-flight alongside the `syncableWrite`; atomicity: see ADR below)
- [ ] Credential reads go through resolver from HC-1 (ABS) and equivalent resolver for OPDS password

**Atomicity (ADR-style decision, belongs in plan):** writing a new server is a two-step operation (vault write + metadata write). The plan must specify the order and failure handling. Recommended: **vault-first, metadata-second**. If metadata write fails, the vault entry is orphaned but harmless — it has no lookup path without a row. A background reconciler (later story) can sweep orphans. If vault write fails, surface error and don't persist the row at all.

---

## Acceptance criteria

Copy-ready for the story file.

1. **Sign-in hydration.** Signing into Knowlune on a device with an empty Dexie causes both `opdsCatalogs` and `audiobookshelfServers` rows to appear within one sync cycle. E2E: seed Supabase with a row for user U; launch a fresh browser context; sign in as U; assert Settings > Library shows the server.
2. **ABS connection works post-hydration.** After hydration, clicking "Sync now" on a hydrated ABS server fetches libraries successfully without the user re-entering an apiKey (because the apiKey was stored by the originating device into the vault, and this device reads it back through the resolver).
3. **KI-E95-S02-L01 is closed.** Unit + type test: `AudiobookshelfServer` Dexie type does not declare `apiKey`. Grep assertion in CI (or in the story-file verification section): `git grep -nP 'server\??\.apiKey' src/ -- ':!*.test.ts' ':!*.spec.ts'` returns zero lines.
4. **Pre-vault users migrate cleanly.** Playwright test seeds Dexie with a legacy row (has `apiKey` field set), launches the app signed-in, asserts: (a) vault has an entry for that serverId, (b) Dexie row no longer has `apiKey`, (c) ABS sync still works, (d) no error toast fired.
5. **Credentials never hit Postgres or syncQueue.** Unit test on `tableRegistry.stripFields` for both tables asserts `apiKey` / `password` are stripped. Integration test on `syncableWrite({ ...server, apiKey: 'SHOULD-NOT-LEAK' })` asserts the enqueued payload has no `apiKey`.
6. **Offline edit replays.** E2E: go offline, rename an ABS server, go online, assert the rename appears on Supabase and that credentials were not touched (vault has no new calls, checked by mock).
7. **Telemetry.** Events fire for `sync.server_config.hydrated` (count per table), `sync.migration.credential_uploaded` (HC-2 success), `sync.migration.credential_upload_failed` (HC-2 retry), with `{ table, serverId, success }` shape.

## Success metrics

- 0 user-reported "had to re-enter my ABS apiKey on new device" complaints in the beta channel.
- ≥99% success rate on HC-2 migration in the first 7 days after rollout (Supabase function logs vs unique user count).
- Grep gate in CI catches any future regression that reads `server.apiKey` directly.

---

## Open questions for planning

1. Should the resolver cache be bounded (LRU) or unbounded (a user has at most ~3 servers, so unbounded is fine)? Planning should note the choice.
2. Does OPDS feed browsing need a hook (`useOpdsPassword`) or is an imperative async resolver sufficient? Scan usages in `src/stores/useOpdsCatalogStore.ts` and `src/app/components/library/OpdsBrowser.tsx` during planning.
3. Reconciler for orphaned vault entries — defer to a later story or include a minimal sweep here? Recommended: defer; log but don't sweep.
4. Do we need a "re-auth required" UX if the vault retrieve returns 401 (token expired, credential revoked server-side)? Recommended: surface an error state on the server row and prompt re-entry; specify wording in plan.

## References

- Broker implementation: `supabase/functions/vault-credentials/index.ts`, client `src/lib/vaultCredentials.ts`
- Server-side schema: `supabase/migrations/20260423000001_server_tables_no_credentials.sql`
- Sync engine public API: `src/lib/sync/tableRegistry.ts`, `src/lib/sync/syncableWrite.ts`, `src/db/schema.ts`
- Known issue: `docs/known-issues.yaml` → `KI-E95-S02-L01`
- Prior-art brainstorm: `docs/brainstorms/2026-04-19-e95-s02-api-keys-and-all-credentials-via-supabase-vault-requirements.md`
