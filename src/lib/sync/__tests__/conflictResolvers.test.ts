/**
 * conflictResolvers.test.ts — E93-S03
 *
 * Unit tests for the pure `applyConflictCopy` resolver function.
 * No Dexie, Supabase, or React imports — this module is intentionally pure.
 *
 * @module conflictResolvers.test
 * @since E93-S03
 */
import { describe, it, expect } from 'vitest'
import { applyConflictCopy } from '../conflictResolvers'
import type { Note } from '@/data/types'

function makeNote(overrides?: Partial<Note>): Note {
  return {
    id: 'note-local',
    courseId: 'course-1',
    videoId: 'video-1',
    content: 'Local content',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    tags: ['local-tag'],
    ...overrides,
  }
}

describe('applyConflictCopy', () => {
  // --- Happy paths ---

  it('returns remote as winner: id and content come from remote', () => {
    const local = makeNote({ id: 'note-local', content: 'Local content' })
    const remote = makeNote({
      id: 'note-remote',
      content: 'Remote content',
      updatedAt: '2026-01-01T11:00:00.000Z',
    })

    const result = applyConflictCopy(local, remote)

    expect(result.id).toBe(remote.id)
    expect(result.content).toBe(remote.content)
  })

  it('stores local content in conflictCopy.content', () => {
    const local = makeNote({ content: 'Local content' })
    const remote = makeNote({ content: 'Remote content' })

    const result = applyConflictCopy(local, remote)

    expect(result.conflictCopy?.content).toBe(local.content)
  })

  it('stores local tags in conflictCopy.tags', () => {
    const local = makeNote({ tags: ['tag-a', 'tag-b'] })
    const remote = makeNote({ tags: ['remote-tag'] })

    const result = applyConflictCopy(local, remote)

    expect(result.conflictCopy?.tags).toEqual(['tag-a', 'tag-b'])
  })

  it('stores local updatedAt as conflictCopy.savedAt', () => {
    const local = makeNote({ updatedAt: '2026-01-01T09:00:00.000Z' })
    const remote = makeNote({ updatedAt: '2026-01-01T11:00:00.000Z' })

    const result = applyConflictCopy(local, remote)

    expect(result.conflictCopy?.savedAt).toBe('2026-01-01T09:00:00.000Z')
  })

  it('sets conflictNoteId to local.id', () => {
    const local = makeNote({ id: 'note-local-id' })
    const remote = makeNote({ id: 'note-remote-id' })

    const result = applyConflictCopy(local, remote)

    expect(result.conflictNoteId).toBe('note-local-id')
  })

  // --- Edge cases ---

  it('handles empty local.tags — conflictCopy.tags is []', () => {
    const local = makeNote({ tags: [] })
    const remote = makeNote({ tags: ['remote-tag'] })

    const result = applyConflictCopy(local, remote)

    expect(result.conflictCopy?.tags).toEqual([])
  })

  it('handles very long local.content — snapshot stored without truncation', () => {
    const longContent = 'x'.repeat(1100)
    const local = makeNote({ content: longContent })
    const remote = makeNote({ content: 'Remote content' })

    const result = applyConflictCopy(local, remote)

    expect(result.conflictCopy?.content).toBe(longContent)
    expect(result.conflictCopy?.content.length).toBe(1100)
  })

  it('applies even when local.content === remote.content — resolver is a transform, not a guard', () => {
    const local = makeNote({ content: 'Same content', id: 'local-id' })
    const remote = makeNote({ content: 'Same content', id: 'remote-id' })

    const result = applyConflictCopy(local, remote)

    // Remote still wins; local is still preserved
    expect(result.id).toBe('remote-id')
    expect(result.conflictCopy?.content).toBe('Same content')
  })

  // --- Integration (immutability) ---

  it('returns a new object — does not mutate local or remote', () => {
    const local = makeNote({ id: 'local-id', content: 'Local' })
    const remote = makeNote({ id: 'remote-id', content: 'Remote' })

    const localBefore = JSON.stringify(local)
    const remoteBefore = JSON.stringify(remote)

    const result = applyConflictCopy(local, remote)

    expect(JSON.stringify(local)).toBe(localBefore)
    expect(JSON.stringify(remote)).toBe(remoteBefore)
    expect(result).not.toBe(remote)
    expect(result).not.toBe(local)
  })

  it('result has conflictCopy as an object (not null, not undefined)', () => {
    const local = makeNote()
    const remote = makeNote()

    const result = applyConflictCopy(local, remote)

    expect(result.conflictCopy).not.toBeNull()
    expect(result.conflictCopy).not.toBeUndefined()
    expect(typeof result.conflictCopy).toBe('object')
  })
})
