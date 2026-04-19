/**
 * Tests for runCredentialsToVaultMigration — the post-boot one-shot that
 * moves pre-vault ABS apiKeys and OPDS passwords into Supabase Vault.
 *
 * @since E95-S05
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Dexie from 'dexie'

const { storeMock, checkMock, toastWarn } = vi.hoisted(() => ({
  storeMock: vi.fn(),
  checkMock: vi.fn(),
  toastWarn: vi.fn(),
}))

vi.mock('@/lib/vaultCredentials', () => ({
  storeCredential: storeMock,
  checkCredential: checkMock,
  deleteCredential: vi.fn(),
  readCredential: vi.fn(),
  readCredentialWithStatus: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { warning: toastWarn, error: vi.fn(), success: vi.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
let runCredentialsToVaultMigration: typeof import(
  '@/lib/credentials/migrateCredentialsToVault'
)['runCredentialsToVaultMigration']
let _resetMigrationStateForTests: typeof import(
  '@/lib/credentials/migrateCredentialsToVault'
)['_resetMigrationStateForTests']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  storeMock.mockReset()
  checkMock.mockReset()
  // By default, checkCredential confirms the vault write succeeded.
  checkMock.mockResolvedValue(true)
  toastWarn.mockReset()
  const schema = await import('@/db/schema')
  db = schema.db
  const mod = await import('@/lib/credentials/migrateCredentialsToVault')
  runCredentialsToVaultMigration = mod.runCredentialsToVaultMigration
  _resetMigrationStateForTests = mod._resetMigrationStateForTests
  _resetMigrationStateForTests()
})

afterEach(() => {
  _resetMigrationStateForTests()
})

async function seedLegacyAbs(id: string, apiKey: string) {
  await db.audiobookshelfServers.add({
    id,
    name: `srv-${id}`,
    url: 'http://abs.test',
    libraryIds: [],
    status: 'offline',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    apiKey,
  })
}

async function seedLegacyOpds(id: string, password: string) {
  await db.opdsCatalogs.add({
    id,
    name: `cat-${id}`,
    url: 'http://opds.test',
    auth: { username: 'u', password },
    createdAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('runCredentialsToVaultMigration', () => {
  it('is a no-op and marks done when no legacy rows exist', async () => {
    storeMock.mockResolvedValue(undefined)
    const summary = await runCredentialsToVaultMigration()
    expect(summary).toEqual({ attempted: 0, uploaded: 0, failed: 0, alreadyDone: false })
    expect(storeMock).not.toHaveBeenCalled()
    const flag = await db.syncMetadata.get('migrations.credentialsToVault.v1')
    expect(flag?.value).toBe('done')
  })

  it('returns alreadyDone:true on subsequent runs', async () => {
    storeMock.mockResolvedValue(undefined)
    await runCredentialsToVaultMigration()
    _resetMigrationStateForTests() // drop in-flight guard so this is a fresh call
    const summary = await runCredentialsToVaultMigration()
    expect(summary.alreadyDone).toBe(true)
    expect(storeMock).not.toHaveBeenCalled()
  })

  it('uploads a legacy ABS apiKey and clears the field', async () => {
    storeMock.mockResolvedValue(undefined)
    await seedLegacyAbs('abs-1', 'KEY-1')
    const summary = await runCredentialsToVaultMigration()
    expect(summary).toMatchObject({ attempted: 1, uploaded: 1, failed: 0 })
    expect(storeMock).toHaveBeenCalledWith('abs-server', 'abs-1', 'KEY-1')
    const stored = (await db.audiobookshelfServers.get('abs-1')) as Record<string, unknown>
    expect(stored.apiKey).toBeUndefined()
    const flag = await db.syncMetadata.get('migrations.credentialsToVault.v1')
    expect(flag?.value).toBe('done')
  })

  it('uploads an OPDS password and clears it from the nested auth object', async () => {
    storeMock.mockResolvedValue(undefined)
    await seedLegacyOpds('opds-1', 'PW-1')
    const summary = await runCredentialsToVaultMigration()
    expect(summary).toMatchObject({ attempted: 1, uploaded: 1, failed: 0 })
    expect(storeMock).toHaveBeenCalledWith('opds-catalog', 'opds-1', 'PW-1')
    const stored = (await db.opdsCatalogs.get('opds-1')) as Record<string, unknown>
    const auth = stored.auth as Record<string, unknown>
    expect(auth).toEqual({ username: 'u' })
  })

  it('handles a mix of ABS + OPDS legacy rows in one run', async () => {
    storeMock.mockResolvedValue(undefined)
    await seedLegacyAbs('abs-1', 'K1')
    await seedLegacyOpds('opds-1', 'P1')
    const summary = await runCredentialsToVaultMigration()
    expect(summary).toMatchObject({ attempted: 2, uploaded: 2, failed: 0 })
    expect(storeMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT mark done when any row fails; successful rows are still cleared', async () => {
    await seedLegacyAbs('abs-ok', 'K-OK')
    await seedLegacyAbs('abs-bad', 'K-BAD')
    storeMock.mockImplementation(async (_kind: string, id: string) => {
      if (id === 'abs-bad') throw new Error('broker down')
    })
    const summary = await runCredentialsToVaultMigration()
    expect(summary).toMatchObject({ attempted: 2, uploaded: 1, failed: 1 })
    const flag = await db.syncMetadata.get('migrations.credentialsToVault.v1')
    expect(flag?.value).toBeUndefined()
    const ok = (await db.audiobookshelfServers.get('abs-ok')) as Record<string, unknown>
    const bad = (await db.audiobookshelfServers.get('abs-bad')) as Record<string, unknown>
    expect(ok.apiKey).toBeUndefined()
    expect(bad.apiKey).toBe('K-BAD')
  })

  it('fires a single toast after three consecutive failures for the same row', async () => {
    storeMock.mockRejectedValue(new Error('still down'))
    await seedLegacyAbs('abs-flaky', 'K')
    // Three sequential "runs" — simulates three consecutive sign-in attempts
    // with the same legacy row still present. The in-flight guard is cleared
    // between calls by _resetMigrationStateForTests so each run actually
    // executes, but failureCounts / toastFiredThisSession intentionally
    // persist via the shared module instance.
    const prevReset = _resetMigrationStateForTests
    const clearInFlightOnly = async () => {
      // Call the reset then re-seed counts/toast-flag via a partial hack:
      // simpler path — just call runCredentialsToVaultMigration three times
      // without resetting and rely on it not being alreadyDone (flag never set
      // because every row fails).
    }
    void prevReset
    void clearInFlightOnly
    await runCredentialsToVaultMigration()
    await runCredentialsToVaultMigration()
    await runCredentialsToVaultMigration()
    expect(toastWarn).toHaveBeenCalledTimes(1)
  })

  it('preserves legacy apiKey and does not set done flag when checkCredential returns false', async () => {
    storeMock.mockResolvedValue(undefined)
    checkMock.mockResolvedValue(false)
    await seedLegacyAbs('abs-unverified', 'KEY-UNVERIFIED')
    const summary = await runCredentialsToVaultMigration()
    // Vault write appeared to succeed but confirmation failed → counts as failed
    expect(summary.failed).toBeGreaterThanOrEqual(1)
    // Legacy field must NOT be cleared — data would be lost otherwise
    const stored = (await db.audiobookshelfServers.get('abs-unverified')) as Record<string, unknown>
    expect(stored.apiKey).toBe('KEY-UNVERIFIED')
    // Migration must NOT be marked done so it retries on next boot
    const flag = await db.syncMetadata.get('migrations.credentialsToVault.v1')
    expect(flag?.value).toBeUndefined()
  })

  it('in-flight guard prevents concurrent duplicate runs', async () => {
    storeMock.mockResolvedValue(undefined)
    await seedLegacyAbs('abs-1', 'K1')
    // Fire two calls synchronously — the in-flight promise is shared, so the
    // second caller must resolve with the same summary and storeCredential
    // must only be invoked once.
    const a = runCredentialsToVaultMigration()
    const b = runCredentialsToVaultMigration()
    const [summaryA, summaryB] = await Promise.all([a, b])
    expect(storeMock).toHaveBeenCalledTimes(1)
    expect(summaryA).toEqual(summaryB)
  })
})
