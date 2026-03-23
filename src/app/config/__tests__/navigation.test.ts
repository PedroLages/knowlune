import { navigationGroups, getPrimaryNav, getOverflowNav } from '../navigation'

describe('navigationGroups', () => {
  it('has exactly 3 groups: Learn, Review, Track', () => {
    expect(navigationGroups).toHaveLength(3)
    expect(navigationGroups.map(g => g.label)).toEqual(['Learn', 'Review', 'Track'])
  })

  it('Learn group has 5 items in correct order', () => {
    const learn = navigationGroups[0]
    expect(learn.items.map(i => i.name)).toEqual([
      'Overview',
      'My Courses',
      'Courses',
      'Authors',
      'Notes',
    ])
  })

  it('Review group has 4 items in correct order', () => {
    const review = navigationGroups[1]
    expect(review.items.map(i => i.name)).toEqual([
      'Learning Path',
      'Knowledge Gaps',
      'Review',
      'Retention',
    ])
  })

  it('Track group has 5 items in correct order', () => {
    const track = navigationGroups[2]
    expect(track.items.map(i => i.name)).toEqual([
      'Challenges',
      'Session History',
      'Study Analytics',
      'Quiz Analytics',
      'AI Analytics',
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
    expect(primary.map(i => i.name)).toEqual(['Overview', 'My Courses', 'Courses', 'Notes'])
  })
})

describe('getOverflowNav', () => {
  it('returns remaining items including Authors, Settings, and all Review items', () => {
    const overflow = getOverflowNav()
    const names = overflow.map(i => i.name)
    expect(names).toContain('Authors')
    expect(names).toContain('Settings')
    expect(names).toContain('Learning Path')
    expect(names).toContain('Knowledge Gaps')
    expect(names).toContain('Review')
    expect(names).toContain('Retention')
    expect(names).not.toContain('Overview')
    expect(names).not.toContain('My Courses')
    expect(names).not.toContain('Courses')
    expect(names).not.toContain('Notes')
  })
})
