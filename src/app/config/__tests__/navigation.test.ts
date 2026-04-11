import { describe, it, expect } from 'vitest'
import { navigationGroups, getPrimaryNav, getOverflowNav } from '../navigation'

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
      'Learning Paths',
      'Books',
      'Authors',
    ])
  })

  it('Study group has 8 items in correct order', () => {
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
    ])
  })

  it('Track group has 5 items in correct order', () => {
    const track = navigationGroups[2]
    expect(track.items.map(i => i.name)).toEqual([
      'Challenges',
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
    // 18 total group items + 1 Settings = 19 - 4 primary = 15 overflow
    expect(overflow).toHaveLength(15)
    expect(names).toContain('Learning Paths')
    expect(names).toContain('Authors')
    expect(names).toContain('Settings')
    expect(names).toContain('Learning Path')
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
