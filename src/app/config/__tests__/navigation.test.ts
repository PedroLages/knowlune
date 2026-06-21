import { describe, it, expect } from 'vitest'
import {
  navigationGroups,
  getPrimaryNav,
  getOverflowNav,
  getIsActive,
  resolveNavActive,
} from '../navigation'

describe('navigationGroups', () => {
  it('has exactly 3 groups: Library, Study, Track', () => {
    expect(navigationGroups).toHaveLength(3)
    expect(navigationGroups.map(g => g.label)).toEqual(['Library', 'Study', 'Track'])
  })

  it('Library group has 5 items in correct order', () => {
    const library = navigationGroups[0]
    expect(library.items.map(i => i.name)).toEqual([
      'Overview',
      'Courses',
      'Learning Tracks',
      'Books',
      'Authors',
    ])
  })

  it('Study group has 9 items in correct order', () => {
    const study = navigationGroups[1]
    expect(study.items.map(i => i.name)).toEqual([
      'My Courses',
      'Notes',
      'Flashcards',
      'Vocabulary',
      'Highlight Review',
      'Cross-Book Search',
      'Review',
      'Learning Path',
      'AI Tutor',
    ])
  })

  it('Track group has 6 items in correct order', () => {
    const track = navigationGroups[2]
    expect(track.items.map(i => i.name)).toEqual([
      'Challenges',
      'Knowledge Map',
      'Knowledge Gaps',
      'Retention',
      'Session History',
      'Reports',
    ])
  })

  it('all items have unique navigation keys (path or path+tab)', () => {
    const allItems = navigationGroups.flatMap(g => g.items)
    const keys = allItems.map(i => (i.tab ? `${i.path}?tab=${i.tab}` : i.path))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('no "Connect" group exists', () => {
    const labels = navigationGroups.map(g => g.label)
    expect(labels).not.toContain('Connect')
  })
})

describe('getPrimaryNav', () => {
  it('returns 4 primary items for mobile bottom bar', () => {
    const primary = getPrimaryNav()
    // The bottom bar has exactly 4 slots — length must stay at 4
    expect(primary).toHaveLength(4)
    expect(primary.map(i => i.name)).toEqual(['Overview', 'Courses', 'My Courses', 'Notes'])
  })
})

describe('getOverflowNav', () => {
  it('returns remaining items including Authors, Settings, and all Study/Track items', () => {
    const overflow = getOverflowNav()
    const names = overflow.map(i => i.name)
    // 20 total group items (5+9+6) + 1 Settings = 21 - 4 primary = 17 overflow
    expect(overflow).toHaveLength(17)
    expect(names).toContain('Learning Tracks')
    expect(names).toContain('Authors')
    expect(names).toContain('Settings')
    expect(names).toContain('Learning Path')
    expect(names).toContain('AI Tutor')
    expect(names).toContain('Knowledge Map')
    expect(names).toContain('Knowledge Gaps')
    expect(names).toContain('Review')
    expect(names).toContain('Retention')
    expect(names).toContain('Flashcards')
    expect(names).not.toContain('Overview')
    expect(names).not.toContain('My Courses')
    expect(names).not.toContain('Courses')
    expect(names).not.toContain('Notes')
  })
})

describe('getIsActive', () => {
  it('matches exact path for root', () => {
    expect(getIsActive({ path: '/' }, '/', '')).toBe(true)
    expect(getIsActive({ path: '/' }, '/courses', '')).toBe(false)
  })

  it('uses prefix matching for non-root paths', () => {
    expect(getIsActive({ path: '/courses' }, '/courses', '')).toBe(true)
    expect(getIsActive({ path: '/courses' }, '/courses/123', '')).toBe(true)
    expect(getIsActive({ path: '/courses' }, '/courses/123/lessons/456', '')).toBe(true)
    expect(getIsActive({ path: '/courses' }, '/learning-tracks', '')).toBe(false)
    expect(getIsActive({ path: '/learning-tracks' }, '/courses/123', '')).toBe(false)
  })

  it('matches /learning-tracks and sub-routes', () => {
    expect(getIsActive({ path: '/learning-tracks' }, '/learning-tracks', '')).toBe(true)
    expect(getIsActive({ path: '/learning-tracks' }, '/learning-tracks/abc', '')).toBe(true)
  })
})

describe('resolveNavActive', () => {
  const noState = undefined
  const withTrack = { fromTrack: { trackId: 't1', trackName: 'My Track' } }
  const invalidTrack = { fromTrack: { trackId: 123 } } // wrong shape

  it('delegates to getIsActive when no fromTrack state', () => {
    expect(resolveNavActive({ path: '/courses' }, '/courses/123', '', noState)).toBe(true)
    expect(
      resolveNavActive({ path: '/learning-tracks' }, '/learning-tracks/abc', '', noState)
    ).toBe(true)
    expect(resolveNavActive({ path: '/overview' }, '/overview', '', noState)).toBe(true)
  })

  it('delegates to getIsActive when fromTrack shape is invalid', () => {
    expect(resolveNavActive({ path: '/courses' }, '/courses/123', '', invalidTrack)).toBe(true)
    expect(
      resolveNavActive({ path: '/learning-tracks' }, '/learning-tracks/abc', '', invalidTrack)
    ).toBe(true)
  })

  it('forces /learning-tracks active when fromTrack is present', () => {
    // On a course page arrived from a track — Learning Tracks should highlight
    expect(resolveNavActive({ path: '/learning-tracks' }, '/courses/123', '', withTrack)).toBe(true)
    expect(
      resolveNavActive({ path: '/learning-tracks' }, '/courses/123/lessons/456', '', withTrack)
    ).toBe(true)
  })

  it('forces /courses inactive when fromTrack is present', () => {
    // On a course page arrived from a track — Courses should NOT highlight
    expect(resolveNavActive({ path: '/courses' }, '/courses/123', '', withTrack)).toBe(false)
    expect(resolveNavActive({ path: '/courses' }, '/courses/123/lessons/456', '', withTrack)).toBe(
      false
    )
  })

  it('does not affect unrelated nav items when fromTrack is present', () => {
    expect(resolveNavActive({ path: '/overview' }, '/overview', '', withTrack)).toBe(true)
    expect(resolveNavActive({ path: '/overview' }, '/courses/123', '', withTrack)).toBe(false)
    expect(resolveNavActive({ path: '/library' }, '/library', '', withTrack)).toBe(true)
    expect(resolveNavActive({ path: '/library' }, '/overview', '', withTrack)).toBe(false)
  })
})
