import { describe, it, expect } from 'vitest'
import { parseCourseManifest, parseTrackManifest } from '@/lib/courseManifest'

// ── Course manifest tests ─────────────────────────────────────

describe('parseCourseManifest', () => {
  // Happy path
  it('parses a fully populated course manifest', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Advanced Behavioral Design',
        description: 'A comprehensive course on behavioral design patterns.',
        category: 'behavioral-analysis',
        difficulty: 'advanced',
        tags: ['psychology', 'design', 'ux'],
        author: {
          name: 'Dr. Sarah Chen',
          title: 'Behavioral Psychologist',
          bio: '15 years of experience in behavioral design.',
          avatar: 'sarah-chen.jpg',
        },
        modules: [
          {
            title: 'Module 1: Foundations',
            description: 'Core concepts and terminology',
            lessons: [
              { title: 'Welcome & Overview', filename: '01-welcome.mp4', description: 'Course introduction' },
              { title: 'Key Concepts', filename: '02-concepts.mp4' },
            ],
          },
          {
            title: 'Module 2: Application',
            lessons: [
              { title: 'Case Study: E-commerce', filename: '03-ecommerce.mp4' },
              { title: 'Case Study: Healthcare', filename: '04-healthcare.mp4' },
            ],
          },
        ],
        track: { name: 'Behavioral Design Mastery', position: 1 },
        coverImage: 'cover.png',
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.version).toBe('1.0')
    expect(result.value.course.name).toBe('Advanced Behavioral Design')
    expect(result.value.course.description).toBe('A comprehensive course on behavioral design patterns.')
    expect(result.value.course.category).toBe('behavioral-analysis')
    expect(result.value.course.difficulty).toBe('advanced')
    expect(result.value.course.tags).toEqual(['psychology', 'design', 'ux'])
    expect(result.value.course.author).toEqual({
      name: 'Dr. Sarah Chen',
      title: 'Behavioral Psychologist',
      bio: '15 years of experience in behavioral design.',
      avatar: 'sarah-chen.jpg',
    })
    expect(result.value.course.modules).toHaveLength(2)
    expect(result.value.course.modules![0].title).toBe('Module 1: Foundations')
    expect(result.value.course.modules![0].lessons).toHaveLength(2)
    expect(result.value.course.modules![1].lessons).toHaveLength(2)
    expect(result.value.course.track).toEqual({ name: 'Behavioral Design Mastery', position: 1 })
    expect(result.value.course.coverImage).toBe('cover.png')
  })

  it('parses a minimal manifest with only version and course name', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: 'Minimal Course' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.course.name).toBe('Minimal Course')
    expect(result.value.course.description).toBeUndefined()
    expect(result.value.course.category).toBeUndefined()
    expect(result.value.course.difficulty).toBeUndefined()
    expect(result.value.course.tags).toEqual([])
    expect(result.value.course.author).toBeUndefined()
    expect(result.value.course.modules).toBeUndefined()
    expect(result.value.course.track).toBeUndefined()
    expect(result.value.course.coverImage).toBeUndefined()
  })

  it('parses a manifest with flat lessons (wraps into unnamed module)', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Flat Lessons Course',
        lessons: [
          { title: 'Introduction', filename: '01-intro.mp4' },
          { title: 'Core Principles', filename: '02-principles.mp4' },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.course.modules).toHaveLength(1)
    expect(result.value.course.modules![0].title).toBe('')
    expect(result.value.course.modules![0].lessons).toHaveLength(2)
    expect(result.value.course.modules![0].lessons[0].title).toBe('Introduction')
    expect(result.value.course.modules![0].lessons[1].title).toBe('Core Principles')
  })

  it('modules take precedence when both modules and lessons are present', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Dual Spec Course',
        lessons: [{ title: 'Flat Lesson', filename: 'flat.mp4' }],
        modules: [
          {
            title: 'Module 1',
            lessons: [{ title: 'Module Lesson', filename: 'mod.mp4' }],
          },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.course.modules).toHaveLength(1)
    expect(result.value.course.modules![0].title).toBe('Module 1')
  })

  it('parses a manifest with modules but no flat lessons', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Modular Course',
        modules: [
          {
            title: 'Chapter 1',
            lessons: [
              { title: 'Section A', filename: 'a.mp4' },
              { title: 'Section B', filename: 'b.mp4' },
            ],
          },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.course.modules).toHaveLength(1)
    expect(result.value.course.modules![0].title).toBe('Chapter 1')
    expect(result.value.course.modules![0].lessons[0].filename).toBe('a.mp4')
  })

  // Edge cases
  it('rejects unknown manifest version', () => {
    const result = parseCourseManifest({
      version: '2.0',
      course: { name: 'Future Course' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].path).toBe('version')
    expect(result.errors[0].message).toContain('2.0')
  })

  it('rejects missing version', () => {
    const result = parseCourseManifest({
      course: { name: 'No Version Course' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'version')).toBe(true)
  })

  it('rejects invalid difficulty value', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: 'Test', difficulty: 'super-expert' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const diffError = result.errors.find((e) => e.path === 'course.difficulty')
    expect(diffError).toBeDefined()
    expect(diffError!.message).toContain('super-expert')
  })

  it('rejects invalid category value', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: 'Test', category: 'quantum-physics' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const catError = result.errors.find((e) => e.path === 'course.category')
    expect(catError).toBeDefined()
  })

  it('rejects missing course name', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {},
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const nameError = result.errors.find((e) => e.path === 'course.name')
    expect(nameError).toBeDefined()
  })

  it('rejects empty string course name', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: '' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const nameError = result.errors.find((e) => e.path === 'course.name')
    expect(nameError).toBeDefined()
  })

  it('rejects whitespace-only course name', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: '   ' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const nameError = result.errors.find((e) => e.path === 'course.name')
    expect(nameError).toBeDefined()
  })

  it('rejects empty string author name', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: 'Test', author: { name: '' } },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const authError = result.errors.find((e) => e.path === 'course.author.name')
    expect(authError).toBeDefined()
  })

  it('accepts empty modules array as valid (no module structure)', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: 'Test', modules: [] },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.course.modules).toBeUndefined()
  })

  it('accepts empty lessons array with empty module normalized away', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: 'Test', lessons: [] },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.course.modules).toBeUndefined()
  })

  it('rejects lesson with missing title', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Test',
        lessons: [{ filename: 'vid.mp4' }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const titleError = result.errors.find((e) => e.path.includes('title'))
    expect(titleError).toBeDefined()
  })

  it('rejects lesson with missing filename', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Test',
        lessons: [{ title: 'Intro' }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    const fileError = result.errors.find((e) => e.path.includes('filename'))
    expect(fileError).toBeDefined()
  })

  it('rejects tags that are not an array of strings', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: { name: 'Test', tags: 'not-an-array' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'course.tags')).toBe(true)
  })

  // Error paths
  it('rejects null input', () => {
    const result = parseCourseManifest(null)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors).toHaveLength(1)
  })

  it('rejects array input', () => {
    const result = parseCourseManifest([{ version: '1.0', course: { name: 'X' } }])

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors[0].path).toBe('')
  })

  it('rejects missing course object', () => {
    const result = parseCourseManifest({ version: '1.0' })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'course')).toBe(true)
  })

  it('rejects malformed module object', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Test',
        modules: ['not-an-object'],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path.includes('modules[0]'))).toBe(true)
  })

  it('rejects module with missing lessons array', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Test',
        modules: [{ title: 'Module 1' }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path.includes('lessons'))).toBe(true)
  })

  it('rejects module with empty title', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Test',
        modules: [{ title: '', lessons: [{ title: 'L1', filename: 'l1.mp4' }] }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path.includes('module') && e.path.includes('title'))).toBe(true)
  })
})

// ── Track manifest tests ──────────────────────────────────────

describe('parseTrackManifest', () => {
  it('parses a valid track manifest with multiple courses', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Behavioral Design Mastery',
        description: 'Master behavioral design from foundations to advanced applications.',
        difficulty: 'advanced',
        courses: [
          { folder: '01-foundations', position: 1 },
          { folder: '02-advanced-patterns', position: 2 },
          { folder: '03-capstone-project', position: 3 },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.track.name).toBe('Behavioral Design Mastery')
    expect(result.value.track.description).toBe('Master behavioral design from foundations to advanced applications.')
    expect(result.value.track.difficulty).toBe('advanced')
    expect(result.value.track.courses).toHaveLength(3)
    expect(result.value.track.courses[0]).toEqual({ folder: '01-foundations', position: 1 })
    expect(result.value.track.courses[2]).toEqual({ folder: '03-capstone-project', position: 3 })
  })

  it('parses a minimal track manifest (name + courses only)', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Minimal Track',
        courses: [{ folder: 'course1', position: 1 }],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.track.name).toBe('Minimal Track')
    expect(result.value.track.description).toBeUndefined()
    expect(result.value.track.difficulty).toBeUndefined()
  })

  // Edge cases
  it('rejects unknown version', () => {
    const result = parseTrackManifest({
      version: '3.0',
      track: { name: 'Test', courses: [] },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors[0].message).toContain('3.0')
  })

  it('rejects missing track name', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: { courses: [{ folder: 'x', position: 1 }] },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'track.name')).toBe(true)
  })

  it('rejects missing courses array', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: { name: 'Test' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'track.courses')).toBe(true)
  })

  it('rejects course entry missing folder', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        courses: [{ position: 1 }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path.includes('folder'))).toBe(true)
  })

  it('rejects course entry missing position', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        courses: [{ folder: 'x' }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path.includes('position'))).toBe(true)
  })

  it('rejects empty course folder name', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        courses: [{ folder: '', position: 1 }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path.includes('folder'))).toBe(true)
  })

  it('rejects invalid difficulty', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        difficulty: 'legendary',
        courses: [{ folder: 'x', position: 1 }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'track.difficulty')).toBe(true)
  })

  // Error paths
  it('rejects null input', () => {
    const result = parseTrackManifest(null)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors).toHaveLength(1)
  })

  it('rejects missing track object', () => {
    const result = parseTrackManifest({ version: '1.0' })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'track')).toBe(true)
  })
})
