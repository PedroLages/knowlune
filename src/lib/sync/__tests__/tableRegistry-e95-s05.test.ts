/**
 * Defense-in-depth tests for the E95-S05 credential-off-the-row invariant.
 *
 * The TypeScript types for `AudiobookshelfServer` and `OpdsCatalog` drop the
 * credential fields, so well-typed callers cannot introduce a regression. A
 * cast-around or untyped boundary could still slip credentials into the
 * sync queue — these tests assert that `toSnakeCase` drops them anyway
 * because both tables declare `vaultFields` in the registry.
 *
 * @since E95-S05
 */
import { describe, it, expect } from 'vitest'
import { tableRegistry } from '@/lib/sync/tableRegistry'
import { toSnakeCase } from '@/lib/sync/fieldMapper'

function entryOf(dexieTable: string) {
  const entry = tableRegistry.find(e => e.dexieTable === dexieTable)
  if (!entry) throw new Error(`tableRegistry missing entry for ${dexieTable}`)
  return entry
}

describe('audiobookshelfServers — vault field stripping', () => {
  const entry = entryOf('audiobookshelfServers')

  it('drops apiKey from the upload payload even when a caller slips it in', () => {
    const leaky = {
      id: 'srv-1',
      name: 'Home',
      url: 'http://abs.test',
      libraryIds: ['lib-1'],
      status: 'connected',
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      apiKey: 'LEAK-SHOULD-NOT-APPEAR',
    }
    const payload = toSnakeCase(entry, leaky)
    // Neither camelCase nor snake_case key is allowed to survive.
    expect(Object.keys(payload).some(k => /api[_-]?key/i.test(k))).toBe(false)
    expect(JSON.stringify(payload)).not.toMatch(/LEAK-SHOULD-NOT-APPEAR/)
  })

  it('passes through non-credential fields with correct casing', () => {
    const clean = {
      id: 'srv-2',
      name: 'Home',
      url: 'http://abs.test',
      libraryIds: ['a', 'b'],
      status: 'connected',
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const payload = toSnakeCase(entry, clean)
    expect(payload['library_ids']).toEqual(['a', 'b'])
    expect(payload['last_synced_at']).toBe('2026-01-01T00:00:00.000Z')
    expect(payload['created_at']).toBe('2026-01-01T00:00:00.000Z')
    expect(payload['updated_at']).toBe('2026-01-01T00:00:00.000Z')
  })

  it('declares apiKey as a vault field in the registry', () => {
    expect(entry.vaultFields).toContain('apiKey')
  })

  it('uses an empty fieldMap (default camelCase conversion is correct)', () => {
    expect(entry.fieldMap).toEqual({})
  })
})

describe('opdsCatalogs — vault field stripping', () => {
  const entry = entryOf('opdsCatalogs')

  it('drops password from the upload payload even when a caller slips it in', () => {
    // Intentional cast-around: a caller with an untyped boundary could
    // introduce `password` directly on the payload object.
    const leaky = {
      id: 'cat-1',
      name: 'Library',
      url: 'https://calibre.local/opds',
      createdAt: '2026-01-01T00:00:00.000Z',
      authUsername: 'u',
      password: 'LEAK-SHOULD-NOT-APPEAR',
    } as unknown as Record<string, unknown>
    const payload = toSnakeCase(entry, leaky)
    expect(payload).not.toHaveProperty('password')
    expect(JSON.stringify(payload)).not.toMatch(/LEAK-SHOULD-NOT-APPEAR/)
  })

  it('emits auth_username from a top-level authUsername field', () => {
    const projected = {
      id: 'cat-2',
      name: 'Library',
      url: 'https://calibre.local/opds',
      createdAt: '2026-01-01T00:00:00.000Z',
      authUsername: 'u',
    }
    const payload = toSnakeCase(entry, projected)
    expect(payload['auth_username']).toBe('u')
  })

  it('declares password as a vault field in the registry', () => {
    expect(entry.vaultFields).toContain('password')
  })

  it('uses an empty fieldMap (default camelCase conversion is correct)', () => {
    expect(entry.fieldMap).toEqual({})
  })
})
