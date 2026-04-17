import { describe, expect, it } from 'vitest'

import { toCamelCase, toSnakeCase } from '../fieldMapper'
import { tableRegistry, type TableRegistryEntry } from '../tableRegistry'

/**
 * Tests for the pure camelCase↔snake_case field mapper (E92-S03, Unit 5).
 *
 * Each test uses a concrete registry entry so the assertions verify the real
 * contract the sync engine depends on — not a synthetic fixture.
 */

describe('fieldMapper.toSnakeCase', () => {
  it('renames fields using IDENTITY_FIELD_MAP + per-table fieldMap', () => {
    const entry = tableRegistry.contentProgress
    const input = {
      courseId: 'c-1',
      itemId: 'i-1',
      status: 'in_progress',
      userId: 'u-1',
      updatedAt: '2026-04-17T00:00:00.000Z',
    }

    const output = toSnakeCase(entry, input)

    expect(output).toEqual({
      course_id: 'c-1',
      item_id: 'i-1',
      status: 'in_progress',
      user_id: 'u-1',
      updated_at: '2026-04-17T00:00:00.000Z',
    })
  })

  it('passes through keys not present in either map', () => {
    const entry = tableRegistry.notes
    const input = {
      id: 'n-1',
      userId: 'u-1',
      tags: ['alpha', 'beta'],
      anythingElse: 42,
    }

    const output = toSnakeCase(entry, input)

    expect(output.id).toBe('n-1')
    expect(output.user_id).toBe('u-1')
    expect(output.tags).toEqual(['alpha', 'beta'])
    expect(output.anythingElse).toBe(42)
  })

  it('returns an empty object for an empty input (does not inject identity fields)', () => {
    const entry = tableRegistry.contentProgress
    expect(toSnakeCase(entry, {})).toEqual({})
  })

  it('preserves null values explicitly', () => {
    const entry = tableRegistry.flashcards
    const output = toSnakeCase(entry, { id: 'f-1', dueDate: null })
    expect(output).toEqual({ id: 'f-1', due_date: null })
  })

  it('preserves undefined values under the renamed key', () => {
    const entry = tableRegistry.flashcards
    const output = toSnakeCase(entry, { id: 'f-1', lastReview: undefined })
    expect(output).toHaveProperty('last_review', undefined)
    expect(Object.keys(output)).toContain('last_review')
  })

  it('strips all keys in entry.stripFields', () => {
    const entry = tableRegistry.importedCourses
    const input = {
      id: 'c-1',
      name: 'Course 1',
      userId: 'u-1',
      directoryHandle: { kind: 'directory' } as unknown,
    }

    const output = toSnakeCase(entry, input)

    expect(output).not.toHaveProperty('directoryHandle')
    expect(output).not.toHaveProperty('directory_handle')
    expect(output.name).toBe('Course 1')
    expect(output.user_id).toBe('u-1')
  })

  it('strips all keys in entry.vaultFields (they are written to Vault separately)', () => {
    const entry = tableRegistry.opdsCatalogs
    const input = {
      id: 'o-1',
      name: 'My Catalog',
      url: 'https://example.com/opds',
      password: 'supersecret',
      userId: 'u-1',
    }

    const output = toSnakeCase(entry, input)

    expect(output).not.toHaveProperty('password')
    expect(output.name).toBe('My Catalog')
    expect(output.url).toBe('https://example.com/opds')
  })

  it('passes nested objects through by reference (does not recurse)', () => {
    const entry = tableRegistry.learnerModels
    const nested = { pace: 'medium', depth: 3 }
    const input = {
      id: 'lm-1',
      courseId: 'c-1',
      strengths: nested,
    }

    const output = toSnakeCase(entry, input)

    expect(output.strengths).toBe(nested) // same reference
    expect(output.course_id).toBe('c-1')
  })

  it('passes arrays through unchanged', () => {
    const entry = tableRegistry.notes
    const tags = ['a', 'b', 'c']
    const output = toSnakeCase(entry, { id: 'n-1', tags })
    expect(output.tags).toBe(tags)
  })

  it('does not mutate the input record', () => {
    const entry = tableRegistry.contentProgress
    const input = { courseId: 'c-1', userId: 'u-1' }
    const snapshot = { ...input }

    toSnakeCase(entry, input)

    expect(input).toEqual(snapshot)
  })

  it('allows a per-table fieldMap entry to override IDENTITY_FIELD_MAP', () => {
    // Synthetic override — not expected in practice but the contract allows it.
    const entry: TableRegistryEntry = {
      dexieTable: '__test__',
      supabaseTable: 'test_table',
      conflictStrategy: 'lww',
      priority: 4,
      fieldMap: {
        userId: 'custom_user_id',
      },
    }

    const output = toSnakeCase(entry, { userId: 'u-1' })

    expect(output).toEqual({ custom_user_id: 'u-1' })
  })
})

describe('fieldMapper.toCamelCase', () => {
  it('inverts a toSnakeCase round-trip for contentProgress', () => {
    const entry = tableRegistry.contentProgress
    const original = {
      courseId: 'c-1',
      itemId: 'i-1',
      status: 'completed',
      userId: 'u-1',
      updatedAt: '2026-04-17T00:00:00.000Z',
    }

    const roundTripped = toCamelCase(entry, toSnakeCase(entry, original))

    expect(roundTripped).toEqual(original)
  })

  it('passes through keys not present in the inverse map', () => {
    const entry = tableRegistry.notes
    const output = toCamelCase(entry, { id: 'n-1', tags: ['x'], user_id: 'u-1' })
    expect(output).toEqual({ id: 'n-1', tags: ['x'], userId: 'u-1' })
  })

  it('does not restore stripped fields', () => {
    const entry = tableRegistry.importedCourses
    const serverRow = {
      id: 'c-1',
      name: 'Course 1',
      user_id: 'u-1',
      // Server never sees directoryHandle — so it is not in this input.
    }

    const output = toCamelCase(entry, serverRow)

    expect(output).not.toHaveProperty('directoryHandle')
    expect(output.userId).toBe('u-1')
  })

  it('does not mutate the input record', () => {
    const entry = tableRegistry.contentProgress
    const input = { course_id: 'c-1', user_id: 'u-1' }
    const snapshot = { ...input }

    toCamelCase(entry, input)

    expect(input).toEqual(snapshot)
  })

  it('returns an empty object for an empty input', () => {
    const entry = tableRegistry.contentProgress
    expect(toCamelCase(entry, {})).toEqual({})
  })
})

describe('fieldMapper round-trip across every registry entry', () => {
  // For each registry entry, build a fixture with one value per known field
  // (camelCase key → deterministic dummy value) and verify the round-trip.
  const entries = Object.entries(tableRegistry) as Array<[string, TableRegistryEntry]>

  it.each(entries)('round-trips every mapped field on %s', (_name, entry) => {
    // Compose a fixture: every key in entry.fieldMap + identity keys + id.
    const fixture: Record<string, unknown> = {
      id: 'id-1',
      userId: 'u-1',
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
    }
    for (const camelKey of Object.keys(entry.fieldMap)) {
      fixture[camelKey] = `value-${camelKey}`
    }

    const serverShape = toSnakeCase(entry, fixture)
    const back = toCamelCase(entry, serverShape)

    expect(back).toEqual(fixture)
  })
})

describe('registry invariants', () => {
  it('every entry key equals its dexieTable field', () => {
    for (const [key, entry] of Object.entries(tableRegistry)) {
      expect(entry.dexieTable).toBe(key)
    }
  })

  it('every conflictStrategy is one of the five literal values', () => {
    const allowed = new Set(['lww', 'monotonic', 'insert-only', 'conflict-copy', 'skip'])
    for (const entry of Object.values(tableRegistry)) {
      expect(allowed.has(entry.conflictStrategy)).toBe(true)
    }
  })

  it('every priority is in [0, 1, 2, 3, 4]', () => {
    for (const entry of Object.values(tableRegistry)) {
      expect([0, 1, 2, 3, 4]).toContain(entry.priority)
    }
  })

  it('every monotonicFields entry names a camelCase field (not a snake_case one)', () => {
    // Monotonic fields are consumed by the upload phase which reads from the
    // Dexie record before the mapper runs. They must be camelCase.
    for (const entry of Object.values(tableRegistry)) {
      for (const field of entry.monotonicFields ?? []) {
        expect(field).not.toContain('_')
      }
    }
  })

  it('no two entries share the same supabaseTable name (no silent collisions)', () => {
    const seen = new Map<string, string>()
    for (const entry of Object.values(tableRegistry)) {
      const prior = seen.get(entry.supabaseTable)
      expect(prior, `${entry.supabaseTable} collides (${prior} vs ${entry.dexieTable})`).toBeUndefined()
      seen.set(entry.supabaseTable, entry.dexieTable)
    }
  })

  it('every compoundPkFields entry names a camelCase field present in fieldMap OR a passthrough key', () => {
    // Compound PK fields are Dexie record keys; they may be renamed via
    // fieldMap (e.g., courseId → course_id) OR may be passthroughs (e.g., id).
    // Either way they must be camelCase (no underscores).
    for (const entry of Object.values(tableRegistry)) {
      for (const field of entry.compoundPkFields ?? []) {
        expect(field).not.toContain('_')
      }
    }
  })

  it('only reviewRecords is marked skipSync: true (local-only FSRS state)', () => {
    // E96-S04 will add more skipSync entries for transient-cache tables.
    // reviewRecords is the only skipSync entry in E92-S03 because it has a
    // (userId+updatedAt) index and therefore needs backfill coverage, but
    // must not be uploaded as-is (E92-S05 transforms it into flashcard_reviews).
    const skipped = Object.keys(tableRegistry).filter(
      (k) => tableRegistry[k].skipSync === true,
    )
    expect(skipped).toEqual(['reviewRecords'])
  })

  it('insertOnly flag is consistent with conflictStrategy', () => {
    for (const entry of Object.values(tableRegistry)) {
      if (entry.insertOnly === true) {
        expect(entry.conflictStrategy).toBe('insert-only')
      }
    }
  })
})
