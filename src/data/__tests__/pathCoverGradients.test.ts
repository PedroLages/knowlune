import { describe, it, expect } from 'vitest'
import {
  HASH_FALLBACK_GRADIENTS,
  MUTED_PATH_COVER_GRADIENT,
  resolvePathCoverTheme,
  hashPathNameForCover,
  normalizePathCoverCompletionPct,
} from '@/data/pathCoverGradients'

describe('normalizePathCoverCompletionPct', () => {
  it('clamps to 0–100', () => {
    expect(normalizePathCoverCompletionPct(-10)).toBe(0)
    expect(normalizePathCoverCompletionPct(150)).toBe(100)
  })

  it('treats non-finite as 0', () => {
    expect(normalizePathCoverCompletionPct(Number.NaN)).toBe(0)
    expect(normalizePathCoverCompletionPct(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('resolvePathCoverTheme', () => {
  it('returns image kind when coverImageUrl is set', () => {
    expect(
      resolvePathCoverTheme({
        pathName: 'X',
        coverImageUrl: ' https://cdn.example/a.jpg ',
        coverPreset: 'purple-indigo',
        completionPct: 0,
      })
    ).toEqual({
      kind: 'image',
      url: 'https://cdn.example/a.jpg',
      heroTextOnDark: true,
    })
  })

  it('uses preset when no image and key is valid', () => {
    expect(
      resolvePathCoverTheme({
        pathName: 'Any',
        completionPct: 50,
        coverPreset: 'purple-indigo',
      })
    ).toEqual({
      kind: 'gradient',
      tailwindFragment: 'from-purple-500 to-indigo-700',
      heroTextOnDark: true,
    })
  })

  it('prefers preset over muted when completion is 0%', () => {
    expect(
      resolvePathCoverTheme({
        pathName: 'New',
        completionPct: 0,
        coverPreset: 'cyan-blue',
      })
    ).toEqual({
      kind: 'gradient',
      tailwindFragment: 'from-cyan-400 to-blue-600',
      heroTextOnDark: true,
    })
  })

  it('uses muted when not started and no preset', () => {
    expect(
      resolvePathCoverTheme({
        pathName: 'Fresh',
        completionPct: 0,
      })
    ).toEqual({
      kind: 'gradient',
      tailwindFragment: MUTED_PATH_COVER_GRADIENT,
      heroTextOnDark: false,
    })
  })

  it('treats NaN progress as not started for theme', () => {
    expect(
      resolvePathCoverTheme({
        pathName: 'N',
        completionPct: Number.NaN,
      })
    ).toEqual({
      kind: 'gradient',
      tailwindFragment: MUTED_PATH_COVER_GRADIENT,
      heroTextOnDark: false,
    })
  })

  it('uses deterministic hash fallback for Stable Name at 40%', () => {
    expect(
      resolvePathCoverTheme({
        pathName: 'Stable Name',
        completionPct: 40,
      })
    ).toEqual({
      kind: 'gradient',
      tailwindFragment: 'from-cyan-400 to-blue-600',
      heroTextOnDark: true,
    })
  })

  it('uses hash fallback when progress > 0 and no preset (membership)', () => {
    const theme = resolvePathCoverTheme({
      pathName: 'Other Name',
      completionPct: 40,
    })
    expect(theme.kind).toBe('gradient')
    if (theme.kind !== 'gradient') return
    expect(theme.heroTextOnDark).toBe(true)
    expect(HASH_FALLBACK_GRADIENTS).toContain(theme.tailwindFragment)
  })

  it('ignores invalid preset and uses hash when progress > 0', () => {
    const theme = resolvePathCoverTheme({
      pathName: 'X',
      completionPct: 10,
      coverPreset: 'not-a-real-preset',
    })
    expect(theme.kind).toBe('gradient')
    if (theme.kind !== 'gradient') return
    expect(theme.tailwindFragment).not.toContain('not-a-real')
    expect(HASH_FALLBACK_GRADIENTS).toContain(theme.tailwindFragment)
  })

  it('ignores invalid preset and uses muted when completion is 0%', () => {
    expect(
      resolvePathCoverTheme({
        pathName: 'Y',
        completionPct: 0,
        coverPreset: 'invalid',
      })
    ).toEqual({
      kind: 'gradient',
      tailwindFragment: MUTED_PATH_COVER_GRADIENT,
      heroTextOnDark: false,
    })
  })
})

describe('hashPathNameForCover', () => {
  it('is stable for the same name', () => {
    expect(hashPathNameForCover('Hello')).toBe(hashPathNameForCover('Hello'))
  })
})
