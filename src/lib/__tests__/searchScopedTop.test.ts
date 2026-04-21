import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import { getScopedTopResults } from '@/lib/searchScopedTop'
import { initializeUnifiedSearch, getCorpusEntries } from '@/lib/unifiedSearch'
import type { SearchableDoc } from '@/lib/unifiedSearch'

function makeCourseDoc(id: string, title: string): SearchableDoc {
  return {
    _searchId: `course:${id}`,
    id,
    type: 'course',
    displayTitle: title,
    name: title,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  // Re-initialize the index as empty before each test.
  initializeUnifiedSearch([])
})

describe('getCorpusEntries', () => {
  it('returns empty map for empty index', () => {
    expect(getCorpusEntries('course').size).toBe(0)
  })

  it('returns entries for indexed type', () => {
    initializeUnifiedSearch([
      makeCourseDoc('c1', 'Alpha'),
      makeCourseDoc('c2', 'Beta'),
      { _searchId: 'author:a1', id: 'a1', type: 'author', displayTitle: 'Alice' },
    ])
    const entries = getCorpusEntries('course')
    expect(entries.size).toBe(2)
    expect(entries.get('c1')).toBe('Alpha')
    expect(entries.get('c2')).toBe('Beta')
    expect(entries.has('a1')).toBe(false)
  })
})

describe('getScopedTopResults', () => {
  it('returns empty array when corpus is empty', async () => {
    const results = await getScopedTopResults('course', 50)
    expect(results).toEqual([])
  })

  it('returns alphabetical results when no frecency rows exist', async () => {
    initializeUnifiedSearch([
      makeCourseDoc('c2', 'Banana Course'),
      makeCourseDoc('c1', 'Apple Course'),
      makeCourseDoc('c3', 'Cherry Course'),
    ])
    const results = await getScopedTopResults('course', 50)
    expect(results.map(r => r.displayTitle)).toEqual([
      'Apple Course',
      'Banana Course',
      'Cherry Course',
    ])
    expect(results.every(r => r.type === 'course')).toBe(true)
  })

  it('returns only the requested entity type', async () => {
    initializeUnifiedSearch([
      makeCourseDoc('c1', 'My Course'),
      { _searchId: 'author:a1', id: 'a1', type: 'author', displayTitle: 'Author One' },
    ])
    const results = await getScopedTopResults('course', 50)
    expect(results.every(r => r.type === 'course')).toBe(true)
    expect(results.length).toBe(1)
  })

  it('respects the limit cap', async () => {
    const docs = Array.from({ length: 10 }, (_, i) => makeCourseDoc(`c${i}`, `Course ${i}`))
    initializeUnifiedSearch(docs)
    const results = await getScopedTopResults('course', 3)
    expect(results.length).toBe(3)
  })

  it('gracefully handles frecency query failure with alphabetical fallback', async () => {
    initializeUnifiedSearch([makeCourseDoc('c1', 'Resilient Course')])
    const { db } = await import('@/db/schema')
    vi.spyOn(db.searchFrecency, 'where').mockImplementation(() => {
      throw new Error('Simulated Dexie failure')
    })
    const results = await getScopedTopResults('course', 50)
    expect(results.length).toBe(1)
    expect(results[0].displayTitle).toBe('Resilient Course')
    vi.restoreAllMocks()
  })
})
