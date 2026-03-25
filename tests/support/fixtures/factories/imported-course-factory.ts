/**
 * Data factory for ImportedCourse test objects.
 *
 * Creates ImportedCourse-shaped data for seeding IndexedDB (Dexie)
 * in E2E tests. Uses unique IDs and varied data to avoid collisions
 * in parallel test runs.
 *
 * Pattern: factory function with Partial<T> overrides
 * Reference: TEA knowledge base - data-factories.md
 */

import { FIXED_DATE, FIXED_TIMESTAMP } from './../../../utils/test-time'

let counter = 0
function uid(): string {
  counter++
  return `imported-${FIXED_TIMESTAMP}-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Test-safe subset of ImportedCourse.
 * Omits `directoryHandle` (browser-only API, not storable in test seeding).
 */
export interface ImportedCourseTestData {
  id: string
  name: string
  importedAt: string
  category: string
  tags: string[]
  status: 'active' | 'completed' | 'paused'
  videoCount: number
  pdfCount: number
  authorId?: string
}

export function createImportedCourse(
  overrides: Partial<ImportedCourseTestData> = {}
): ImportedCourseTestData {
  const id = overrides.id ?? uid()
  return {
    id,
    name: `Imported Course ${id.slice(-6)}`,
    importedAt: FIXED_DATE,
    category: 'Development',
    tags: ['test', 'imported'],
    status: 'active',
    videoCount: Math.floor(Math.random() * 20) + 1,
    pdfCount: Math.floor(Math.random() * 10),
    ...overrides,
  }
}

export function createImportedCourses(
  count: number,
  overridesFn?: (index: number) => Partial<ImportedCourseTestData>
): ImportedCourseTestData[] {
  return Array.from({ length: count }, (_, i) => createImportedCourse(overridesFn?.(i)))
}
