import { describe, it, expect } from 'vitest'
import {
  navigationGroups,
  getPrimaryNav,
  getOverflowNav,
  getIsActive,
  resolveNavActive,
} from '../navigation'

describe('navigationGroups', () => {
  it('has exactly 3 groups: Main, Review, Insights', () => {
    expect(navigationGroups).toHaveLength(3)
    expect(navigationGroups.map(g => g.label)).toEqual(['Main', 'Review', 'Insights'])
  })

  it('Main group has 5 items in correct order', () => {
    const main = navigationGroups[0]
    expect(main.items.map(i => i.name)).toEqual([
      'Dashboard',
      'Courses',
      'Learning Tracks',
      'Books',
      'Authors',
    ])
  })

  it('Review group has 5 items in correct order', () => {
    const review = navigationGroups[1]
    expect(review.items.map(i => i.name)).toEqual([
      'Notes',
      'Flashcards',
      'Vocabulary',
      'Highlights',
      'Review',
    ])
  })

  it('Insights group has 9 items in correct order', () => {
    const insights = navigationGroups[2]
    expect(insights.items.map(i => i.name)).toEqual([
      'Search',
      'Knowledge Map',
      'Reports',
      'Challenges',
      'Knowledge Gaps',
      'Retention',
      'Session History',
      'Learning Path',
      'AI Tutor',
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

  it('no "My Courses" item exists in sidebar', () => {
    const allNames = navigationGroups.flatMap(g => g.items.map(i => i.name))
    expect(allNames).not.toContain('My Courses')
  })

  it('Highlights label routes to /highlight-review', () => {
    const highlights = navigationGroups
      .flatMap(g => g.items)
      .find(i => i.name === 'Highlights')
    expect(highlights).toBeDefined()
    expect(highlights!.path).toBe('/highlight-review')
  })

  it('Search label routes to /search-annotations', () => {
    const search = navigationGroups
      .flatMap(g => g.items)
      .find(i => i.name === 'Search')
    expect(search).toBeDefined()
    expect(search!.path).toBe('/search-annotations')
  })
})

describe('getPrimaryNav', () => {
  it('returns 4 primary items for mobile bottom bar', () => {
    const primary = getPrimaryNav()
    // The bottom bar has exactly 4 slots — length must stay at 4
    expect(primary).toHaveLength(4)
    expect(primary.map(i => i.name)).toEqual(['Dashboard', 'Courses', 'Learning Tracks', 'Notes'])
  })

  it('does not include My Courses in primary nav', () => {
    const primary = getPrimaryNav()
    expect(primary.map(i => i.name)).not.toContain('My Courses')
  })
})

describe('getOverflowNav', () => {
  it('returns remaining items excluding primary items and Settings', () => {
    const overflow = getOverflowNav()
    const names = overflow.map(i => i.name)
    // 19 total group items (5+5+9) + 1 Settings = 20 - 4 primary = 16 overflow
    expect(overflow).toHaveLength(16)
    expect(names).toContain('Books')
    expect(names).toContain('Authors')
    expect(names).toContain('Settings')
    expect(names).toContain('Learning Path')
    expect(names).toContain('AI Tutor')
    expect(names).toContain('Knowledge Map')
    expect(names).toContain('Knowledge Gaps')
    expect(names).toContain('Review')
    expect(names).toContain('Retention')
    expect(names).toContain('Flashcards')
    expect(names).not.toContain('Dashboard')
    expect(names).not.toContain('Courses')
    expect(names).not.toContain('Learning Tracks')
    expect(names).not.toContain('Notes')
    expect(names).not.toContain('My Courses')
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
