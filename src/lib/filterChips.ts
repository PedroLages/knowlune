export interface FilterChip {
  value: string
  label: string
  count: number
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export function buildUnifiedFilterChips(
  preseededCourses: Array<{ category: string; tags: string[] }>,
  categoryLabels: Record<string, string>,
  importedCourses: Array<{ tags: string[]; category: string }>
): FilterChip[] {
  // Collect chips with normalized key → label
  // Pre-seeded categories take priority for label (more formal)
  const chipMap = new Map<string, string>()

  for (const course of preseededCourses) {
    const key = course.category.toLowerCase()
    if (!chipMap.has(key)) {
      chipMap.set(key, categoryLabels[course.category] ?? titleCase(course.category))
    }
  }

  for (const course of importedCourses) {
    for (const tag of course.tags) {
      const key = tag.toLowerCase()
      if (!chipMap.has(key)) {
        chipMap.set(key, titleCase(tag))
      }
    }
  }

  return [...chipMap.entries()]
    .map(([value, label]) => {
      const preCount = preseededCourses.filter(
        c =>
          c.category.toLowerCase() === value ||
          c.tags.some(t => t.toLowerCase() === value)
      ).length

      const importCount = importedCourses.filter(
        c =>
          c.tags.some(t => t.toLowerCase() === value) ||
          c.category.toLowerCase() === value
      ).length

      return { value, label, count: preCount + importCount }
    })
    .filter(chip => chip.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
