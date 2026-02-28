import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { normalizeTags, getAllNoteTags, saveNote, getNotes } from './progress'
import { db } from '@/db'

describe('normalizeTags', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeTags(['  React ', 'TYPESCRIPT', ' css '])).toEqual([
      'css',
      'react',
      'typescript',
    ])
  })

  it('removes empty strings and blank-only entries', () => {
    expect(normalizeTags(['valid', '', '   ', 'ok'])).toEqual(['ok', 'valid'])
  })

  it('deduplicates case-insensitively', () => {
    expect(normalizeTags(['React', 'react', 'REACT'])).toEqual(['react'])
  })

  it('returns sorted output', () => {
    expect(normalizeTags(['zebra', 'alpha', 'middle'])).toEqual([
      'alpha',
      'middle',
      'zebra',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(normalizeTags([])).toEqual([])
  })
})

describe('getAllNoteTags', () => {
  beforeEach(async () => {
    await db.notes.clear()
  })

  it('returns empty array when no notes exist', async () => {
    const tags = await getAllNoteTags()
    expect(tags).toEqual([])
  })

  it('returns unique sorted tags from all notes', async () => {
    await saveNote('c1', 'v1', 'note 1', ['react', 'hooks'])
    await saveNote('c1', 'v2', 'note 2', ['react', 'typescript'])

    const tags = await getAllNoteTags()
    expect(tags).toEqual(['hooks', 'react', 'typescript'])
  })

  it('normalizes tags when saving', async () => {
    await saveNote('c1', 'v1', 'note', [' React ', 'HOOKS', 'react'])

    const notes = await getNotes('c1', 'v1')
    expect(notes[0].tags).toEqual(['hooks', 'react'])
  })
})
