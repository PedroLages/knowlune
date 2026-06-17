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

  it('parses a full 12-field author in course manifest', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Test',
        author: {
          name: 'Chase Hughes',
          title: 'Behavior Expert',
          shortBio: 'Author and speaker',
          bio: 'Chase Hughes is a leading expert in behavioral analysis.',
          avatar: 'https://example.com/photo.jpg',
          specialties: ['behavioral-analysis', 'influence'],
          yearsExperience: 20,
          education: 'Harvard University',
          website: 'https://chasehughes.com',
          linkedin: 'https://linkedin.com/in/chasehughes',
          twitter: 'https://twitter.com/chasehughes',
          featuredQuote: 'Behavior is a language.',
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    const author = result.value.course.author!
    expect(author.name).toBe('Chase Hughes')
    expect(author.title).toBe('Behavior Expert')
    expect(author.shortBio).toBe('Author and speaker')
    expect(author.bio).toBe('Chase Hughes is a leading expert in behavioral analysis.')
    expect(author.avatar).toBe('https://example.com/photo.jpg')
    expect(author.specialties).toEqual(['behavioral-analysis', 'influence'])
    expect(author.yearsExperience).toBe(20)
    expect(author.education).toBe('Harvard University')
    expect(author.website).toBe('https://chasehughes.com')
    expect(author.linkedin).toBe('https://linkedin.com/in/chasehughes')
    expect(author.twitter).toBe('https://twitter.com/chasehughes')
    expect(author.featuredQuote).toBe('Behavior is a language.')
  })

  it('parses legacy 4-field course author (backward compatible)', () => {
    const result = parseCourseManifest({
      version: '1.0',
      course: {
        name: 'Test',
        author: {
          name: 'Chase Hughes',
          title: 'Behavior Expert',
          bio: 'Leading expert.',
          avatar: 'https://example.com/photo.jpg',
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    const author = result.value.course.author!
    expect(author.name).toBe('Chase Hughes')
    expect(author.title).toBe('Behavior Expert')
    expect(author.bio).toBe('Leading expert.')
    expect(author.avatar).toBe('https://example.com/photo.jpg')
    // New fields should be undefined
    expect(author.shortBio).toBeUndefined()
    expect(author.specialties).toBeUndefined()
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

  it('parses course notes field', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test Track',
        courses: [
          { folder: 'c1', position: 1, notes: 'Skip post-processing; use field sections only' },
          { folder: 'c2', position: 2 },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.track.courses[0].notes).toBe('Skip post-processing; use field sections only')
    expect(result.value.track.courses[1].notes).toBeUndefined()
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

  // ── Track author ─────────────────────────────────────────────

  it('parses a full 12-field author in track manifest', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Behavioral Design Mastery',
        author: {
          name: 'Chase Hughes',
          title: 'Behavior Expert',
          shortBio: 'Author and speaker',
          bio: 'Chase Hughes is a leading expert in behavioral analysis.',
          avatar: 'https://example.com/photo.jpg',
          specialties: ['behavioral-analysis', 'influence'],
          yearsExperience: 20,
          education: 'Harvard University',
          website: 'https://chasehughes.com',
          linkedin: 'https://linkedin.com/in/chasehughes',
          twitter: 'https://twitter.com/chasehughes',
          featuredQuote: 'Behavior is a language.',
        },
        courses: [{ folder: '01-basics', position: 1 }],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    const author = result.value.track.author!
    expect(author.name).toBe('Chase Hughes')
    expect(author.title).toBe('Behavior Expert')
    expect(author.shortBio).toBe('Author and speaker')
    expect(author.bio).toBe('Chase Hughes is a leading expert in behavioral analysis.')
    expect(author.avatar).toBe('https://example.com/photo.jpg')
    expect(author.specialties).toEqual(['behavioral-analysis', 'influence'])
    expect(author.yearsExperience).toBe(20)
    expect(author.education).toBe('Harvard University')
    expect(author.website).toBe('https://chasehughes.com')
    expect(author.linkedin).toBe('https://linkedin.com/in/chasehughes')
    expect(author.twitter).toBe('https://twitter.com/chasehughes')
    expect(author.featuredQuote).toBe('Behavior is a language.')
  })

  it('parses track author with name only', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test Track',
        author: { name: 'Jane Doe' },
        courses: [{ folder: 'x', position: 1 }],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.track.author!.name).toBe('Jane Doe')
    expect(result.value.track.author!.title).toBeUndefined()
  })

  it('rejects track author missing name', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        author: { title: 'No Name' },
        courses: [{ folder: 'x', position: 1 }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'track.author.name')).toBe(true)
  })

  it('rejects track author with specialties as non-array', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        author: { name: 'Jane', specialties: 'not-an-array' },
        courses: [{ folder: 'x', position: 1 }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'track.author.specialties')).toBe(true)
  })

  it('rejects track author with yearsExperience as non-number', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        author: { name: 'Jane', yearsExperience: 'twenty' },
        courses: [{ folder: 'x', position: 1 }],
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected error result')
    expect(result.errors.some((e) => e.path === 'track.author.yearsExperience')).toBe(true)
  })

  it('parses track author with website/linkedin/twitter social links', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        author: {
          name: 'Jane',
          website: 'https://jane.com',
          linkedin: 'https://linkedin.com/in/jane',
          twitter: 'https://twitter.com/jane',
        },
        courses: [{ folder: 'x', position: 1 }],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.track.author!.website).toBe('https://jane.com')
    expect(result.value.track.author!.linkedin).toBe('https://linkedin.com/in/jane')
    expect(result.value.track.author!.twitter).toBe('https://twitter.com/jane')
  })

  it('returns undefined author when track manifest has no author', () => {
    const result = parseTrackManifest({
      version: '1.0',
      track: {
        name: 'Test',
        courses: [{ folder: 'x', position: 1 }],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected ok result')
    expect(result.value.track.author).toBeUndefined()
  })
})
