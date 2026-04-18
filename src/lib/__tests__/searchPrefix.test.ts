import { describe, it, expect } from 'vitest'
import { parsePrefix, PREFIX_MAP } from '@/lib/searchPrefix'

describe('PREFIX_MAP', () => {
  it('maps all six prefixes to their entity types', () => {
    expect(PREFIX_MAP['c']).toBe('course')
    expect(PREFIX_MAP['b']).toBe('book')
    expect(PREFIX_MAP['l']).toBe('lesson')
    expect(PREFIX_MAP['a']).toBe('author')
    expect(PREFIX_MAP['n']).toBe('note')
    expect(PREFIX_MAP['h']).toBe('highlight')
  })
})

describe('parsePrefix', () => {
  it('parses c: with space-separated content', () => {
    expect(parsePrefix('c: postgres')).toEqual({ scope: 'course', rest: ' postgres' })
  })

  it('parses a: with no space (direct char after colon)', () => {
    expect(parsePrefix('a:michel')).toEqual({ scope: 'author', rest: 'michel' })
  })

  it('parses all six prefixes to correct entity types', () => {
    expect(parsePrefix('c:x')?.scope).toBe('course')
    expect(parsePrefix('b:x')?.scope).toBe('book')
    expect(parsePrefix('l:x')?.scope).toBe('lesson')
    expect(parsePrefix('a:x')?.scope).toBe('author')
    expect(parsePrefix('n:x')?.scope).toBe('note')
    expect(parsePrefix('h:x')?.scope).toBe('highlight')
  })

  it('returns null for uppercase prefix (case-sensitive)', () => {
    expect(parsePrefix('C: postgres')).toBeNull()
  })

  it('returns null for unknown prefix char', () => {
    expect(parsePrefix('x: foo')).toBeNull()
  })

  it('returns null when input is too short (colon only, no trailing content)', () => {
    // "c:" is length 2, fails the length < 3 guard
    expect(parsePrefix('c:')).toBeNull()
  })

  it('returns null when leading space is present (literal-content escape)', () => {
    expect(parsePrefix(' c: postgres')).toBeNull()
  })

  it('returns null when prefix is not at position 0', () => {
    expect(parsePrefix('hello c: world')).toBeNull()
  })

  it('returns null when no colon at position 1', () => {
    expect(parsePrefix('cX postgres')).toBeNull()
  })

  it('preserves rest content verbatim', () => {
    const result = parsePrefix('b: some book title')
    expect(result?.rest).toBe(' some book title')
  })
})
