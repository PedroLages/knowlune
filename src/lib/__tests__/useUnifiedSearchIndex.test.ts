import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import Dexie from 'dexie'
import { diffSnapshot, useUnifiedSearchIndex } from '../useUnifiedSearchIndex'
import {
  initializeUnifiedSearch,
  __resetForTests as resetIndexForTests,
  toSearchableCourse,
} from '../unifiedSearch'
import type { ImportedCourse } from '@/data/types'
import { recordVisit } from '../searchFrecency'

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

// ───────────────────────────────────────────────────────────────────────────
// searchBestMatches — frecency-aware ranking (Unit 3)
// ───────────────────────────────────────────────────────────────────────────

function makeCourse(
  id: string,
  name: string,
  importedAt = '2026-01-01T00:00:00.000Z'
): ImportedCourse {
  return {
    id,
    name,
    importedAt,
    category: '',
    tags: [],
    status: 'active',
    videoCount: 0,
    pdfCount: 0,
    directoryHandle: {} as FileSystemDirectoryHandle,
  } as ImportedCourse
}

describe('useUnifiedSearchIndex — searchBestMatches', () => {
  beforeEach(async () => {
    localStorage.clear()
    resetIndexForTests()
    await Dexie.delete('ElearningDB')
    // Fresh db import so Unit 1's v53 migration runs
    await import('@/db/schema')
  })

  it('returns [] on empty query (no IO, no bulkGet)', async () => {
    initializeUnifiedSearch([toSearchableCourse(makeCourse('c1', 'TypeScript Fundamentals'))])
    const { result } = renderHook(() => useUnifiedSearchIndex())
    await waitFor(() => expect(result.current.ready).toBe(true))
    const out = await act(async () => result.current.searchBestMatches(''))
    expect(out).toEqual([])
  })

  it('returns [] synchronously when ready === false', async () => {
    resetIndexForTests()
    const { result } = renderHook(() => useUnifiedSearchIndex())
    // ready should start false; searchBestMatches should short-circuit
    expect(result.current.ready).toBe(false)
    const out = await result.current.searchBestMatches('anything')
    expect(out).toEqual([])
  })

  it('orders Best Matches by relevance × frecency multiplier (more opens = higher)', async () => {
    const courseA = makeCourse('course-a', 'TypeScript Fundamentals')
    const courseB = makeCourse('course-b', 'TypeScript Advanced')
    const courseC = makeCourse('course-c', 'TypeScript Patterns')
    initializeUnifiedSearch([
      toSearchableCourse(courseA),
      toSearchableCourse(courseB),
      toSearchableCourse(courseC),
    ])
    // Seed frecency: A opened 3× today, B 1× today, C never opened.
    await recordVisit('course', 'course-a')
    await recordVisit('course', 'course-a')
    await recordVisit('course', 'course-a')
    await recordVisit('course', 'course-b')

    const { result } = renderHook(() => useUnifiedSearchIndex())
    await waitFor(() => expect(result.current.ready).toBe(true))
    const out = await act(async () => result.current.searchBestMatches('TypeScript', { limit: 3 }))
    expect(out.map(r => r.id)).toEqual(['course-a', 'course-b', 'course-c'])
  })

  it('honors `limit` option (1 returns a single top item)', async () => {
    initializeUnifiedSearch([
      toSearchableCourse(makeCourse('c1', 'TypeScript one')),
      toSearchableCourse(makeCourse('c2', 'TypeScript two')),
    ])
    const { result } = renderHook(() => useUnifiedSearchIndex())
    await waitFor(() => expect(result.current.ready).toBe(true))
    const out = await act(async () => result.current.searchBestMatches('typescript', { limit: 1 }))
    expect(out).toHaveLength(1)
  })

  it('with an empty frecency table, order matches pure MiniSearch relevance', async () => {
    initializeUnifiedSearch([
      toSearchableCourse(makeCourse('c1', 'React Fundamentals')),
      toSearchableCourse(makeCourse('c2', 'React Fundamentals')),
    ])
    const { result } = renderHook(() => useUnifiedSearchIndex())
    await waitFor(() => expect(result.current.ready).toBe(true))
    // No frecency rows — no multiplier distortion. Sanity: same pool length as pure search.
    const bm = await act(async () => result.current.searchBestMatches('React', { limit: 10 }))
    const pure = result.current.search('React', { limit: 10 })
    expect(bm.map(r => r.id)).toEqual(pure.map(r => r.id))
  })

  it('searchBestMatches reference identity is stable across re-renders where `ready` did not change', async () => {
    initializeUnifiedSearch([toSearchableCourse(makeCourse('c1', 'stable'))])
    const { result, rerender } = renderHook(() => useUnifiedSearchIndex())
    await waitFor(() => expect(result.current.ready).toBe(true))
    const ref1 = result.current.searchBestMatches
    rerender()
    const ref2 = result.current.searchBestMatches
    expect(ref1).toBe(ref2)
  })
})
