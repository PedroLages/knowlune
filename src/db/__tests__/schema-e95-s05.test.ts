/**
 * schema-e95-s05.test.ts — Unit 1 verification.
 *
 * Asserts:
 *   - CHECKPOINT_VERSION is 57 (the E95-S05 credential-off-the-row marker)
 *   - Dexie opens cleanly at the new version on a fresh database
 *   - Legacy rows that still carry `apiKey` / `auth.password` remain readable
 *     (Dexie retains unknown fields on stored rows) so the post-boot
 *     migration in migrateCredentialsToVault() can read them out
 *
 * @since E95-S05
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { CHECKPOINT_VERSION } from '@/db/checkpoint'

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
})

describe('E95-S05 schema bump (v57)', () => {
  it('CHECKPOINT_VERSION is 57 or higher (now 58 after E119-S07)', () => {
    expect(CHECKPOINT_VERSION).toBeGreaterThanOrEqual(57)
  })

  it('opens cleanly on a fresh database', async () => {
    const { db } = await import('@/db/schema')
    // Awaiting toArray on a synced table forces Dexie to open the DB.
    const rows = await db.audiobookshelfServers.toArray()
    expect(rows).toEqual([])
    expect(db.verno).toBeGreaterThanOrEqual(57)
  })

  it('legacy apiKey field on audiobookshelfServers is still readable via raw Dexie', async () => {
    const { db } = await import('@/db/schema')
    // Cast through unknown: TypeScript now forbids apiKey on the row type.
    // We deliberately bypass the type to mimic a pre-E95-S05 stored row.
    await db.audiobookshelfServers.add({
      id: 'legacy-abs-1',
      name: 'Legacy ABS',
      url: 'http://legacy.test',
      libraryIds: [],
      status: 'offline',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      apiKey: 'legacy-key',
    } as unknown as Parameters<typeof db.audiobookshelfServers.add>[0])

    const rows = (await db.audiobookshelfServers.toArray()) as unknown as Array<
      Record<string, unknown>
    >
    expect(rows).toHaveLength(1)
    // The legacy value survives the open — the post-boot migration needs this.
    expect(rows[0]['apiKey']).toBe('legacy-key')
  })

  it('legacy auth.password field on opdsCatalogs is still readable via raw Dexie', async () => {
    const { db } = await import('@/db/schema')
    await db.opdsCatalogs.add({
      id: 'legacy-opds-1',
      name: 'Legacy OPDS',
      url: 'http://legacy.test/opds',
      auth: { username: 'u', password: 'legacy-pw' },
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Parameters<typeof db.opdsCatalogs.add>[0])

    const rows = (await db.opdsCatalogs.toArray()) as unknown as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    const auth = rows[0]['auth'] as Record<string, unknown>
    expect(auth['password']).toBe('legacy-pw')
  })
})
