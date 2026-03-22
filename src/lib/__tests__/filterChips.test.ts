import { describe, it, expect } from 'vitest'
import { buildUnifiedFilterChips } from '@/lib/filterChips'

const categoryLabels: Record<string, string> = {
  'behavioral-analysis': 'Behavioral Analysis',
  'influence-authority': 'Influence & Authority',
}

const preseededCourses = [
  { category: 'behavioral-analysis', tags: [] },
  { category: 'behavioral-analysis', tags: [] },
  { category: 'influence-authority', tags: ['python'] },
]

const importedCourses = [
  { category: '', tags: ['python', 'machine learning'] },
  { category: '', tags: ['Python'] }, // same tag, different casing
  { category: '', tags: ['machine learning', 'data science'] },
]

describe('buildUnifiedFilterChips', () => {
  it('deduplicates case-insensitively', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, importedCourses)
    const pythonChips = chips.filter(c => c.value === 'python')
    expect(pythonChips).toHaveLength(1)
  })

  it('sorts by frequency descending', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, importedCourses)
    // machine learning (2 imported) should outrank data science (1 imported)
    const mlIdx = chips.findIndex(c => c.value === 'machine learning')
    const dsIdx = chips.findIndex(c => c.value === 'data science')
    expect(mlIdx).toBeLessThan(dsIdx)
  })

  it('uses category label for pre-seeded chips', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, importedCourses)
    const ba = chips.find(c => c.value === 'behavioral-analysis')
    expect(ba?.label).toBe('Behavioral Analysis')
  })

  it('uses title case for AI tag chips', () => {
    const chips = buildUnifiedFilterChips([], {}, [{ category: '', tags: ['web development'] }])
    const chip = chips.find(c => c.value === 'web development')
    expect(chip?.label).toBe('Web Development')
  })

  it('counts pre-seeded category courses correctly', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, [])
    const ba = chips.find(c => c.value === 'behavioral-analysis')
    expect(ba?.count).toBe(2)
  })

  it('counts imported course tags correctly', () => {
    const chips = buildUnifiedFilterChips([], {}, importedCourses)
    const ml = chips.find(c => c.value === 'machine learning')
    expect(ml?.count).toBe(2)
  })

  it('pre-seeded label wins over AI tag label for same key', () => {
    // If an imported tag happens to match a pre-seeded category slug
    const courses = [{ category: 'behavioral-analysis', tags: [] }]
    const imported = [{ category: '', tags: ['behavioral-analysis'] }]
    const chips = buildUnifiedFilterChips(courses, categoryLabels, imported)
    const chip = chips.find(c => c.value === 'behavioral-analysis')
    expect(chip?.label).toBe('Behavioral Analysis') // formal label wins
  })

  it('returns empty array when no courses', () => {
    const chips = buildUnifiedFilterChips([], {}, [])
    expect(chips).toHaveLength(0)
  })

  it('handles no imported courses (only pre-seeded)', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, [])
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.every(c => c.count > 0)).toBe(true)
  })

  it('handles no pre-seeded courses (only AI tags)', () => {
    const chips = buildUnifiedFilterChips([], {}, importedCourses)
    expect(chips.length).toBeGreaterThan(0)
  })
})
