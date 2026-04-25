import { describe, it, expect } from 'vitest'
import { getGridClassName } from '@/app/components/courses/gridClassName'

describe('getGridClassName (E99-S02)', () => {
  it('returns the canonical responsive default for "auto"', () => {
    expect(getGridClassName('auto')).toBe(
      'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    )
  })

  it('caps at 2 columns for `2`', () => {
    expect(getGridClassName(2)).toBe(
      'grid grid-cols-1 sm:grid-cols-2 gap-[var(--content-gap)]'
    )
  })

  it('caps at 3 columns at lg+ for `3`', () => {
    expect(getGridClassName(3)).toBe(
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--content-gap)]'
    )
  })

  it('caps at 4 columns at lg+ for `4`', () => {
    expect(getGridClassName(4)).toBe(
      'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[var(--content-gap)]'
    )
  })

  it('reaches 5 columns at xl+ for `5`', () => {
    expect(getGridClassName(5)).toBe(
      'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    )
  })

  it('every branch enforces mobile-1-column (AC6 invariant)', () => {
    const inputs = ['auto', 2, 3, 4, 5] as const
    for (const input of inputs) {
      const result = getGridClassName(input)
      expect(result).toContain('grid-cols-1')
      expect(result).toContain('sm:grid-cols-2')
    }
  })

  it('"auto" matches the canonical pre-S02 hardcoded literal exactly', () => {
    // This guards against accidental drift: the existing Courses.tsx default
    // string must equal the resolver's "auto" output so behavior is unchanged
    // for users who never touch the column control.
    const canonicalDefault =
      'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    expect(getGridClassName('auto')).toBe(canonicalDefault)
  })

  it('omitting viewMode preserves grid behavior (back-compat)', () => {
    expect(getGridClassName('auto')).toBe(getGridClassName('auto', 'grid'))
    expect(getGridClassName(4)).toBe(getGridClassName(4, 'grid'))
  })
})

describe('getGridClassName — compact mode (E99-S04)', () => {
  it('returns the dense default for "auto"', () => {
    expect(getGridClassName('auto', 'compact')).toBe(
      'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'
    )
  })

  it('scales 2 → 3 columns in compact mode', () => {
    expect(getGridClassName(2, 'compact')).toBe(
      'grid grid-cols-2 sm:grid-cols-3 gap-3'
    )
  })

  it('scales 3 → 5 columns in compact mode', () => {
    expect(getGridClassName(3, 'compact')).toBe(
      'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3'
    )
  })

  it('scales 4 → 6 columns in compact mode', () => {
    expect(getGridClassName(4, 'compact')).toBe(
      'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3'
    )
  })

  it('scales 5 → 8 columns in compact mode', () => {
    expect(getGridClassName(5, 'compact')).toBe(
      'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'
    )
  })

  it('every compact branch enforces the mobile-2-column floor', () => {
    const inputs = ['auto', 2, 3, 4, 5] as const
    for (const input of inputs) {
      const result = getGridClassName(input, 'compact')
      expect(result).toContain('grid-cols-2')
      expect(result).toContain('sm:grid-cols-3')
    }
  })

  it('every compact branch uses gap-3 instead of var(--content-gap)', () => {
    const inputs = ['auto', 2, 3, 4, 5] as const
    for (const input of inputs) {
      const result = getGridClassName(input, 'compact')
      expect(result).toContain('gap-3')
      expect(result).not.toContain('var(--content-gap)')
    }
  })
})
