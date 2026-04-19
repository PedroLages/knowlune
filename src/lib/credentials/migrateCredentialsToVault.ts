/**
 * Backwards-compat migration that uploads pre-vault credentials to Supabase
 * Vault and clears them from Dexie rows. Runs once per authenticated device.
 *
 * Trigger point: called from `useAuthLifecycle` after sign-in (see the
 * `SIGNED_IN` / `INITIAL_SESSION` branch) via `runCredentialsToVaultMigration()`.
 * Dexie 4 async upgrade callbacks cannot read `auth.uid()`, so the E95-S02
 * schema bump left legacy credential fields in place and deferred clearing to
 * a post-boot step — that post-boot step lives here.
 *
 * Bookkeeping: uses `db.syncMetadata` with the synthetic key
 * `migrations.credentialsToVault.v1` (Knowlune has no `kv` table; syncMetadata
 * is the existing key/value bag used by E94-S03 for similar one-shot flags).
 *
 * Failure strategy:
 *   - `Promise.allSettled` — slow/failing rows do not block each other.
 *   - Per-`serverId` failure counter kept in module scope. 3 failures in one
 *     session fires a single non-blocking toast.
 *   - The `done` flag is set only when EVERY row succeeded. Partial failure
 *     means the migration re-runs next boot; `storeCredential` is idempotent.
 *
 * @module credentials/migrateCredentialsToVault
 * @since E95-S05
 */

import { toast } from 'sonner'
import { db } from '@/db/schema'
import type { AudiobookshelfServer, LegacyAudiobookshelfServer, LegacyOpdsCatalog, OpdsCatalog } from '@/data/types'
import { storeCredential, checkCredential, type CredentialType } from '@/lib/vaultCredentials'
import { emitTelemetry } from './telemetry'

const MIGRATION_FLAG_KEY = 'migrations.credentialsToVault.v1'
const MIGRATION_DONE = 'done'

/** Per-serverId failure counts for the current session. Reset on reload. */
const failureCounts = new Map<string, number>()
/** Ensures the "credential migration failing" toast fires at most once per session. */
let toastFiredThisSession = false
/** In-flight guard so concurrent callers don't double-run the migration. */
let inFlight: Promise<MigrationSummary> | null = null

export interface MigrationSummary {
  attempted: number
  uploaded: number
  failed: number
  alreadyDone: boolean
}

async function isAlreadyDone(): Promise<boolean> {
  const meta = await db.syncMetadata.get(MIGRATION_FLAG_KEY)
  return meta?.value === MIGRATION_DONE
}

async function markDone(): Promise<void> {
  await db.syncMetadata.put({ table: MIGRATION_FLAG_KEY, value: MIGRATION_DONE })
}

interface LegacyRow {
  id: string
  kind: CredentialType
  secret: string
  table: 'audiobookshelfServers' | 'opdsCatalogs'
}

async function collectLegacyRows(): Promise<LegacyRow[]> {
  const rows: LegacyRow[] = []

  const absRows = (await db.audiobookshelfServers.toArray()) as unknown as LegacyAudiobookshelfServer[]
  for (const row of absRows) {
    if (typeof row.apiKey === 'string' && row.apiKey.length > 0) {
      rows.push({ id: row.id, kind: 'abs-server', secret: row.apiKey, table: 'audiobookshelfServers' })
    }
  }

  const opdsRows = (await db.opdsCatalogs.toArray()) as unknown as LegacyOpdsCatalog[]
  for (const row of opdsRows) {
    const password = row.auth?.password
    if (typeof password === 'string' && password.length > 0) {
      rows.push({ id: row.id, kind: 'opds-catalog', secret: password, table: 'opdsCatalogs' })
    }
  }

  return rows
}

async function clearLegacyField(row: LegacyRow): Promise<void> {
  // Intentional: use raw Dexie .put() rather than syncableWrite —
  // this is a local-only clear of a removed field. Pushing the row through
  // syncableWrite would stamp a fresh `updatedAt` and upload a metadata row
  // whose only change is "remove a field Supabase never had anyway",
  // polluting the sync queue with no-op entries.
  //
  // We use .put() instead of .update() because Dexie .update() with
  // `undefined` values is a no-op in real browsers (fake-indexeddb masks
  // this). .put() with the field omitted reliably removes it from the row.
  if (row.table === 'audiobookshelfServers') {
    const existing = (await db.audiobookshelfServers.get(row.id)) as unknown as LegacyAudiobookshelfServer | undefined
    if (!existing) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey: _drop, ...rest } = existing
    await db.audiobookshelfServers.put(rest as AudiobookshelfServer)
  } else {
    // For OPDS, clear the nested password only — keep the username and authType.
    const existing = (await db.opdsCatalogs.get(row.id)) as unknown as LegacyOpdsCatalog | undefined
    if (!existing) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { auth: legacyAuth, ...restCatalog } = existing
    const nextAuth = legacyAuth?.username ? { username: legacyAuth.username } : undefined
    const next: OpdsCatalog = nextAuth ? { ...restCatalog, auth: nextAuth } : { ...restCatalog }
    await db.opdsCatalogs.put(next)
  }
}

async function migrateRow(row: LegacyRow): Promise<'uploaded' | 'failed'> {
  try {
    // storeCredential is non-throwing but resolves void on vault-write
    // failure (it only console.warns). Verify the write landed before
    // clearing the legacy field — otherwise the credential is lost silently.
    await storeCredential(row.kind, row.id, row.secret)

    const confirmed = await checkCredential(row.kind, row.id)
    if (!confirmed) {
      throw new Error(
        `Vault write could not be confirmed for ${row.kind}:${row.id} — aborting clear to preserve legacy field`,
      )
    }

    await clearLegacyField(row)
    emitTelemetry('sync.migration.credential_uploaded', { kind: row.kind, id: row.id })
    failureCounts.delete(row.id)
    return 'uploaded'
  } catch (err) {
    const count = (failureCounts.get(row.id) ?? 0) + 1
    failureCounts.set(row.id, count)
    emitTelemetry('sync.migration.credential_upload_failed', {
      kind: row.kind,
      id: row.id,
      attempt: count,
      error: err instanceof Error ? err.message : String(err),
    })
    if (count >= 3 && !toastFiredThisSession) {
      toastFiredThisSession = true
      toast.warning(
        'Some connection credentials could not be synced to the cloud yet. We will retry next time you sign in.',
      )
    }
    return 'failed'
  }
}

/**
 * Run the one-shot migration. Idempotent: returns `alreadyDone: true` if the
 * flag is already set. Concurrent calls share the same in-flight promise.
 */
export async function runCredentialsToVaultMigration(): Promise<MigrationSummary> {
  if (inFlight) return inFlight

  const run = async (): Promise<MigrationSummary> => {
    if (await isAlreadyDone()) {
      return { attempted: 0, uploaded: 0, failed: 0, alreadyDone: true }
    }

    const rows = await collectLegacyRows()
    if (rows.length === 0) {
      // No legacy data — mark done so future boots skip the scan entirely.
      await markDone()
      return { attempted: 0, uploaded: 0, failed: 0, alreadyDone: false }
    }

    const results = await Promise.allSettled(rows.map(migrateRow))
    let uploaded = 0
    let failed = 0
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value === 'uploaded') {
        uploaded += 1
      } else {
        failed += 1
      }
    }

    if (failed === 0) {
      await markDone()
    }

    return { attempted: rows.length, uploaded, failed, alreadyDone: false }
  }

  inFlight = run()
  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

/** Test-only hook — resets the module-level session state between cases. */
export function _resetMigrationStateForTests(): void {
  failureCounts.clear()
  toastFiredThisSession = false
  inFlight = null
}
