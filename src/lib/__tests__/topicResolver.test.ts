import { describe, it, expect } from 'vitest'
import {
  normalizeTopic,
  toTitleCase,
  isNoiseTopic,
  canonicalize,
  resolveTopics,
  type TopicCourseInput,
  type TopicQuestionInput,
} from '../topicResolver'

// ---------------------------------------------------------------------------
// normalizeTopic
// ---------------------------------------------------------------------------

describe('normalizeTopic', () => {
  it('lowercases and trims', () => {
    expect(normalizeTopic('  Body Language  ')).toBe('body language')
  })

  it('replaces hyphens with spaces', () => {
    expect(normalizeTopic('body-language')).toBe('body language')
  })

  it('replaces underscores with spaces', () => {
    expect(normalizeTopic('body_language')).toBe('body language')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeTopic('Body  Language')).toBe('body language')
  })

  it('handles mixed casing and formatting', () => {
    expect(normalizeTopic('BODY LANGUAGE')).toBe('body language')
    expect(normalizeTopic('Body-Language')).toBe('body language')
    expect(normalizeTopic('  body_language  ')).toBe('body language')
  })
})

// ---------------------------------------------------------------------------
// toTitleCase
// ---------------------------------------------------------------------------

describe('toTitleCase', () => {
  it('capitalizes first letter of each word', () => {
    expect(toTitleCase('nonverbal communication')).toBe('Nonverbal Communication')
  })

  it('handles single word', () => {
    expect(toTitleCase('ai')).toBe('Ai')
  })

  it('handles empty string', () => {
    expect(toTitleCase('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// isNoiseTopic
// ---------------------------------------------------------------------------

describe('isNoiseTopic', () => {
  it.each([
    'october 2023',
    'jan 2024',
    'q3 2024',
    '2023-10-15',
    '2024-01',
  ])('filters date pattern: %s', (topic) => {
    expect(isNoiseTopic(topic)).toBe(true)
  })

  it.each([
    'course overview',
    'getting started',
    'introduction',
    'conclusion',
    'key takeaways',
    'weekly session',
    'part 1',
    'section 3',
    'module 2',
  ])('filters meta-topic: %s', (topic) => {
    expect(isNoiseTopic(topic)).toBe(true)
  })

  it.each([
    'miscellaneous',
    'other',
    'n/a',
    'tbd',
  ])('filters generic filler: %s', (topic) => {
    expect(isNoiseTopic(topic)).toBe(true)
  })

  it('filters strings that are too short', () => {
    expect(isNoiseTopic('a')).toBe(true)
    expect(isNoiseTopic('ab')).toBe(true)
    expect(isNoiseTopic('')).toBe(true)
  })

  it('allows legitimate topics', () => {
    expect(isNoiseTopic('deception detection')).toBe(false)
    expect(isNoiseTopic('nonverbal communication')).toBe(false)
    expect(isNoiseTopic('machine learning')).toBe(false)
    expect(isNoiseTopic('react')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canonicalize
// ---------------------------------------------------------------------------

describe('canonicalize', () => {
  it('maps known synonyms to canonical form', () => {
    expect(canonicalize('lie detection')).toBe('deception detection')
    expect(canonicalize('body language')).toBe('nonverbal communication')
    expect(canonicalize('micro expressions')).toBe('microexpression recognition')
  })

  it('passes through unknown topics unchanged', () => {
    expect(canonicalize('react')).toBe('react')
    expect(canonicalize('typescript')).toBe('typescript')
  })
})

// ---------------------------------------------------------------------------
// resolveTopics
// ---------------------------------------------------------------------------

describe('resolveTopics', () => {
  const makeCourse = (
    id: string,
    category: string,
    tags: string[]
  ): TopicCourseInput => ({ id, category, tags })

  it('extracts topics from course tags', () => {
    const courses = [makeCourse('c1', 'Psychology', ['Body Language', 'Deception Detection'])]
    const result = resolveTopics(courses)

    expect(result).toHaveLength(3) // 2 tags + 1 category
    const names = result.map((t) => t.canonicalName)
    expect(names).toContain('nonverbal communication') // body language → canonical
    expect(names).toContain('deception detection')
    expect(names).toContain('psychology')
  })

  it('merges synonyms into a single canonical topic', () => {
    const courses = [
      makeCourse('c1', 'Psychology', ['lie detection']),
      makeCourse('c2', 'Psychology', ['deception detection']),
      makeCourse('c3', 'Psychology', ['detecting lies']),
    ]
    const result = resolveTopics(courses)

    const dd = result.find((t) => t.canonicalName === 'deception detection')
    expect(dd).toBeDefined()
    expect(dd!.courseIds).toEqual(['c1', 'c2', 'c3'])
  })

  it('normalizes mixed casing and formatting', () => {
    const courses = [
      makeCourse('c1', 'Tech', ['Body  Language']),
      makeCourse('c2', 'Tech', ['body-language']),
      makeCourse('c3', 'Tech', ['BODY LANGUAGE']),
    ]
    const result = resolveTopics(courses)

    // All variants should merge into "nonverbal communication" via canonical map
    const nv = result.find((t) => t.canonicalName === 'nonverbal communication')
    expect(nv).toBeDefined()
    expect(nv!.courseIds).toEqual(['c1', 'c2', 'c3'])
  })

  it('filters noise entries', () => {
    const courses = [
      makeCourse('c1', 'Psychology', [
        'October 2023',
        'weekly session',
        'course overview',
        'getting started',
        'Deception Detection',
      ]),
    ]
    const result = resolveTopics(courses)

    const names = result.map((t) => t.canonicalName)
    expect(names).not.toContain('october 2023')
    expect(names).not.toContain('weekly session')
    expect(names).not.toContain('course overview')
    expect(names).not.toContain('getting started')
    expect(names).toContain('deception detection')
  })

  it('assigns category from course with more matching sources', () => {
    // "react" tag appears in 2 Web Dev courses, 1 Data Science course
    const courses = [
      makeCourse('c1', 'Web Development', ['react', 'javascript']),
      makeCourse('c2', 'Web Development', ['react']),
      makeCourse('c3', 'Data Science', ['react']),
    ]
    const result = resolveTopics(courses)

    const react = result.find((t) => t.canonicalName === 'react')
    expect(react).toBeDefined()
    // Web Development has 2 votes vs Data Science 1
    expect(react!.category).toBe('Web Development')
  })

  it('maps Question.topic values to resolved topics', () => {
    const courses = [makeCourse('c1', 'Psychology', ['deception detection'])]
    const questions: TopicQuestionInput[] = [
      { topic: 'Deception Detection', courseId: 'c1' },
      { topic: 'lie detection', courseId: 'c1' },
    ]
    const result = resolveTopics(courses, questions)

    const dd = result.find((t) => t.canonicalName === 'deception detection')
    expect(dd).toBeDefined()
    expect(dd!.questionTopics).toContain('Deception Detection')
    // "lie detection" canonicalizes to "deception detection"
    expect(dd!.questionTopics).toContain('lie detection')
  })

  it('handles empty tags array', () => {
    const courses = [makeCourse('c1', 'Psychology', [])]
    const result = resolveTopics(courses)

    // Only the category itself should appear
    expect(result).toHaveLength(1)
    expect(result[0].canonicalName).toBe('psychology')
  })

  it('handles courses with no quizzes', () => {
    const courses = [makeCourse('c1', 'Psychology', ['deception detection'])]
    const result = resolveTopics(courses, [])

    const dd = result.find((t) => t.canonicalName === 'deception detection')
    expect(dd).toBeDefined()
    expect(dd!.questionTopics).toEqual([])
  })

  it('handles questions with undefined topic', () => {
    const courses = [makeCourse('c1', 'Psychology', ['deception detection'])]
    const questions: TopicQuestionInput[] = [
      { topic: undefined, courseId: 'c1' },
    ]
    const result = resolveTopics(courses, questions)

    const dd = result.find((t) => t.canonicalName === 'deception detection')
    expect(dd!.questionTopics).toEqual([])
  })

  it('handles duplicate topics across courses', () => {
    const courses = [
      makeCourse('c1', 'Psychology', ['negotiation']),
      makeCourse('c2', 'Business', ['negotiation']),
    ]
    const result = resolveTopics(courses)

    const neg = result.find((t) => t.canonicalName === 'negotiation')
    expect(neg).toBeDefined()
    expect(neg!.courseIds).toEqual(['c1', 'c2'])
  })

  it('returns sorted results by canonical name', () => {
    const courses = [
      makeCourse('c1', 'Tech', ['zsh scripting', 'angular', 'bash']),
    ]
    const result = resolveTopics(courses)

    const names = result.map((t) => t.canonicalName)
    expect(names).toEqual([...names].sort())
  })

  it('adds courseId from question even if topic not in course tags', () => {
    const courses = [makeCourse('c1', 'Psychology', ['negotiation'])]
    const questions: TopicQuestionInput[] = [
      { topic: 'empathy', courseId: 'c1' },
    ]
    const result = resolveTopics(courses, questions)

    const empathy = result.find((t) => t.canonicalName === 'empathy')
    expect(empathy).toBeDefined()
    expect(empathy!.courseIds).toContain('c1')
    expect(empathy!.questionTopics).toContain('empathy')
  })

  it('handles empty inputs gracefully', () => {
    expect(resolveTopics([])).toEqual([])
    expect(resolveTopics([], [])).toEqual([])
  })
})
