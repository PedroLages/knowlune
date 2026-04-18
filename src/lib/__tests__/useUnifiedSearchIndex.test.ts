import { describe, it, expect } from 'vitest'
import { diffSnapshot } from '../useUnifiedSearchIndex'

// The hook's novel complexity is the diff algorithm — test that directly.
// Hook-level integration (useLiveQuery + timers + Dexie writes) is covered
// end-to-end by the Playwright specs for Unit 2/4.

describe('useUnifiedSearchIndex — diffSnapshot', () => {
  it('detects additions when ids appear in the new snapshot but not the previous', () => {
    const prev = new Map<string, string | undefined>()
    const next = [
      { id: 'a', updatedAt: '1' },
      { id: 'b', updatedAt: '1' },
    ]
    const diff = diffSnapshot(next, prev)
    expect(diff.added.map(r => r.id).sort()).toEqual(['a', 'b'])
    expect(diff.updated).toHaveLength(0)
    expect(diff.removedIds).toHaveLength(0)
  })

  it('detects updates when updatedAt changes for an existing id', () => {
    const prev = new Map<string, string | undefined>([
      ['a', '1'],
      ['b', '1'],
    ])
    const next = [
      { id: 'a', updatedAt: '2' }, // changed
      { id: 'b', updatedAt: '1' }, // unchanged
    ]
    const diff = diffSnapshot(next, prev)
    expect(diff.added).toHaveLength(0)
    expect(diff.updated.map(r => r.id)).toEqual(['a'])
    expect(diff.removedIds).toHaveLength(0)
  })

  it('detects removals when ids disappear from the new snapshot', () => {
    const prev = new Map<string, string | undefined>([
      ['a', '1'],
      ['b', '1'],
    ])
    const next = [{ id: 'a', updatedAt: '1' }]
    const diff = diffSnapshot(next, prev)
    expect(diff.added).toHaveLength(0)
    expect(diff.updated).toHaveLength(0)
    expect(diff.removedIds).toEqual(['b'])
  })

  it('treats an id with no updatedAt in prev and a defined updatedAt in next as update', () => {
    // Row existed (prev.has is true), but had undefined updatedAt; next has one.
    const prev = new Map<string, string | undefined>([['a', undefined]])
    const next = [{ id: 'a', updatedAt: '2' }]
    const diff = diffSnapshot(next, prev)
    expect(diff.updated.map(r => r.id)).toEqual(['a'])
  })

  it('handles empty previous + empty next cleanly', () => {
    const diff = diffSnapshot<{ id: string; updatedAt?: string }>(
      [],
      new Map<string, string | undefined>()
    )
    expect(diff.added).toHaveLength(0)
    expect(diff.updated).toHaveLength(0)
    expect(diff.removedIds).toHaveLength(0)
  })

  it('is stable across a no-op snapshot (all rows unchanged)', () => {
    const prev = new Map<string, string | undefined>([
      ['a', '1'],
      ['b', '2'],
    ])
    const next = [
      { id: 'a', updatedAt: '1' },
      { id: 'b', updatedAt: '2' },
    ]
    const diff = diffSnapshot(next, prev)
    expect(diff.added).toHaveLength(0)
    expect(diff.updated).toHaveLength(0)
    expect(diff.removedIds).toHaveLength(0)
  })

  it('handles mixed add/update/remove in one pass', () => {
    const prev = new Map<string, string | undefined>([
      ['a', '1'],
      ['b', '1'],
      ['c', '1'],
    ])
    const next = [
      { id: 'a', updatedAt: '1' }, // unchanged
      { id: 'b', updatedAt: '2' }, // updated
      // c removed
      { id: 'd', updatedAt: '1' }, // added
    ]
    const diff = diffSnapshot(next, prev)
    expect(diff.added.map(r => r.id)).toEqual(['d'])
    expect(diff.updated.map(r => r.id)).toEqual(['b'])
    expect(diff.removedIds).toEqual(['c'])
  })
})
