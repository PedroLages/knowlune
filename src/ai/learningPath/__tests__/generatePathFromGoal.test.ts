import { describe, it, expect, beforeEach, vi } from 'vitest'

let generatePathFromGoal: (typeof import('@/ai/learningPath/generatePathFromGoal'))['generatePathFromGoal']
let parseAndValidateResponse: (typeof import('@/ai/learningPath/generatePathFromGoal'))['parseAndValidateResponse']

// Build minimal ImportedCourse fixtures
function makeCourse(
  overrides: Partial<{
    id: string
    name: string
    tags: string[]
    category: string
  }> = {}
): Parameters<typeof generatePathFromGoal>[1][number] {
  return {
    id: overrides.id ?? 'course-1',
    name: overrides.name ?? 'Test Course',
    importedAt: '2026-01-01T00:00:00Z',
    category: overrides.category ?? 'programming',
    tags: overrides.tags ?? ['beginner'],
    status: 'active' as const,
    videoCount: 5,
    pdfCount: 2,
    directoryHandle: null as unknown as FileSystemDirectoryHandle,
  }
}

/** Build a raw AI JSON response string for testing the parser */
function rawResponse(
  overrides: Partial<{
    pathName: string
    pathDescription: string
    entries: Array<Record<string, unknown>>
    rationale: string
  }> = {}
) {
  return JSON.stringify({
    pathName: overrides.pathName ?? 'Generated Path',
    pathDescription: overrides.pathDescription ?? 'A generated learning path',
    entries: overrides.entries ?? [
      { courseId: 'course-1', position: 1, justification: 'Start here', isGap: false },
    ],
    rationale: overrides.rationale ?? 'AI generated this path based on your goal.',
  })
}

beforeEach(async () => {
  vi.resetModules()
  // Reset mocks on window
  delete (window as unknown as { __mockGoalPathResponse?: unknown }).__mockGoalPathResponse
  delete (window as unknown as { __mockGoalPathRawText?: unknown }).__mockGoalPathRawText

  const mod = await import('@/ai/learningPath/generatePathFromGoal')
  generatePathFromGoal = mod.generatePathFromGoal
  parseAndValidateResponse = mod.parseAndValidateResponse
})

describe('generatePathFromGoal', () => {
  describe('guard clauses', () => {
    it('throws when goal is empty', async () => {
      await expect(generatePathFromGoal('  ', [makeCourse()])).rejects.toThrow(
        'Goal description is empty'
      )
    })

    it('throws when goal is whitespace-only', async () => {
      await expect(generatePathFromGoal('\t  \n', [makeCourse()])).rejects.toThrow(
        'Goal description is empty'
      )
    })
  })

  describe('mock injection (E2E test support)', () => {
    it('returns mock result when __mockGoalPathResponse is set', async () => {
      const mockResult = {
        pathName: 'Mock Path',
        pathDescription: 'A mocked path',
        entries: [
          {
            courseId: 'course-1',
            position: 1,
            justification: 'Start here',
            isGap: false,
          },
          {
            gapTopic: 'Advanced Topics',
            position: 2,
            justification: 'Learn later',
            isGap: true,
          },
        ],
        rationale: 'Mock rationale',
      }

      ;(window as unknown as { __mockGoalPathResponse: typeof mockResult }).__mockGoalPathResponse =
        mockResult

      const result = await generatePathFromGoal('Test goal', [makeCourse({ id: 'course-1' })])

      expect(result).toEqual(mockResult)
      expect(result.entries).toHaveLength(2)
      expect(result.entries[0].isGap).toBe(false)
      expect(result.entries[1].isGap).toBe(true)
    })
  })

  describe('raw text mock (unit test validation path)', () => {
    it('validates and filters unknown courseIds', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText = rawResponse(
        {
          entries: [
            { courseId: 'valid-course', position: 1, justification: 'Valid', isGap: false },
            { courseId: 'unknown-course', position: 2, justification: 'Unknown', isGap: false },
          ],
        }
      )

      const result = await generatePathFromGoal('Test goal', [
        makeCourse({ id: 'valid-course', name: 'Valid Course' }),
      ])

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].courseId).toBe('valid-course')
    })

    it('rejects entries missing required fields', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText = rawResponse(
        {
          entries: [
            { courseId: 'course-1', position: 1, justification: 'Valid', isGap: false },
            { courseId: 'course-2', position: 2, isGap: false }, // missing justification
          ] as Array<Record<string, unknown>>,
        }
      )

      const result = await generatePathFromGoal('Test goal', [
        makeCourse({ id: 'course-1' }),
        makeCourse({ id: 'course-2' }),
      ])

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].courseId).toBe('course-1')
    })

    it('normalizes positions to sequential 1-indexed', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText = rawResponse(
        {
          entries: [
            { courseId: 'course-c', position: 10, justification: 'Third', isGap: false },
            { courseId: 'course-a', position: 5, justification: 'First', isGap: false },
            { gapTopic: 'Gap Topic', position: 3, justification: 'Middle', isGap: true },
          ],
        }
      )

      const result = await generatePathFromGoal('Test goal', [
        makeCourse({ id: 'course-a' }),
        makeCourse({ id: 'course-c' }),
      ])

      expect(result.entries).toHaveLength(3)
      // After normalization (sorted by position then renumbered):
      // Gap (pos 3) -> pos 1, course-a (pos 5) -> pos 2, course-c (pos 10) -> pos 3
      expect(result.entries[0].position).toBe(1)
      expect(result.entries[0].gapTopic).toBe('Gap Topic')
      expect(result.entries[1].position).toBe(2)
      expect(result.entries[1].courseId).toBe('course-a')
      expect(result.entries[2].position).toBe(3)
      expect(result.entries[2].courseId).toBe('course-c')
    })

    it('handles zero courses (pure gap analysis)', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText = rawResponse(
        {
          entries: [
            {
              gapTopic: 'Python Fundamentals',
              position: 1,
              justification: 'Foundational',
              isGap: true,
            },
            { gapTopic: 'Advanced Python', position: 2, justification: 'Advanced', isGap: true },
          ],
        }
      )

      const result = await generatePathFromGoal('Learn Python', [])

      expect(result.entries).toHaveLength(2)
      expect(result.entries.every(e => e.isGap)).toBe(true)
      expect(result.entries.every(e => !e.courseId)).toBe(true)
      expect(result.entries[0].gapTopic).toBe('Python Fundamentals')
    })

    it('generates path with matched courses and gaps', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText = rawResponse(
        {
          pathName: 'Python for Data Science',
          pathDescription: 'Learn Python and data science',
          entries: [
            {
              courseId: 'course-python',
              position: 1,
              justification: 'Foundational Python',
              isGap: false,
            },
            {
              gapTopic: 'Statistics Basics',
              position: 2,
              justification: 'Essential for DS',
              isGap: true,
            },
            {
              courseId: 'course-ml',
              position: 3,
              justification: 'ML builds on stats',
              isGap: false,
            },
          ],
          rationale: 'Structured learning path',
        }
      )

      const result = await generatePathFromGoal('I want to become a data scientist', [
        makeCourse({ id: 'course-python', name: 'Python' }),
        makeCourse({ id: 'course-ml', name: 'Machine Learning' }),
      ])

      expect(result.pathName).toBe('Python for Data Science')
      expect(result.pathDescription).toBeTruthy()
      expect(result.entries).toHaveLength(3)
      expect(result.entries[0].courseId).toBe('course-python')
      expect(result.entries[0].isGap).toBe(false)
      expect(result.entries[1].gapTopic).toBe('Statistics Basics')
      expect(result.entries[1].isGap).toBe(true)
      expect(result.entries[2].courseId).toBe('course-ml')
    })

    it('handles all-matched case (0 gaps)', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText = rawResponse(
        {
          entries: [
            { courseId: 'course-1', position: 1, justification: 'First', isGap: false },
            { courseId: 'course-2', position: 2, justification: 'Second', isGap: false },
          ],
        }
      )

      const result = await generatePathFromGoal('Learn everything', [
        makeCourse({ id: 'course-1' }),
        makeCourse({ id: 'course-2' }),
      ])

      expect(result.entries).toHaveLength(2)
      expect(result.entries.every(e => !e.isGap)).toBe(true)
      expect(result.entries.every(e => !!e.courseId)).toBe(true)
    })
  })

  describe('error paths', () => {
    it('throws on invalid JSON via raw text mock', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText =
        'not valid json at all'

      await expect(
        generatePathFromGoal('Test goal', [makeCourse()], { timeout: 100 })
      ).rejects.toThrow('AI response is not valid JSON')
    })

    it('throws on empty entries via raw text mock', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText =
        JSON.stringify({
          pathName: 'Empty',
          entries: [],
          rationale: 'None',
        })

      await expect(
        generatePathFromGoal('Test goal', [makeCourse()], { timeout: 100 })
      ).rejects.toThrow('AI response is empty')
    })

    it('throws on missing pathName via raw text mock', async () => {
      ;(window as unknown as { __mockGoalPathRawText: string }).__mockGoalPathRawText =
        JSON.stringify({
          entries: [{ courseId: 'c1', position: 1, justification: 'X', isGap: false }],
        })

      await expect(
        generatePathFromGoal('Test goal', [makeCourse({ id: 'c1' })], { timeout: 100 })
      ).rejects.toThrow('AI response format is invalid')
    })
  })
})

describe('parseAndValidateResponse', () => {
  it('parses valid JSON directly', () => {
    const validIds = new Set(['c1', 'c2'])
    const raw = JSON.stringify({
      pathName: 'Test Path',
      pathDescription: 'A test',
      entries: [
        { courseId: 'c1', position: 1, justification: 'First', isGap: false },
        { courseId: 'c2', position: 2, justification: 'Second', isGap: false },
      ],
      rationale: 'Test rationale',
    })

    const result = parseAndValidateResponse(raw, validIds)
    expect(result.pathName).toBe('Test Path')
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].courseId).toBe('c1')
  })

  it('parses JSON from markdown code block', () => {
    const validIds = new Set(['c1'])
    const raw =
      '```json\n' +
      JSON.stringify({
        pathName: 'From Code Block',
        entries: [{ courseId: 'c1', position: 1, justification: 'Only one', isGap: false }],
        rationale: 'OK',
      }) +
      '\n```'

    const result = parseAndValidateResponse(raw, validIds)
    expect(result.pathName).toBe('From Code Block')
    expect(result.entries).toHaveLength(1)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAndValidateResponse('not valid json', new Set(['c1']))).toThrow(
      'AI response is not valid JSON'
    )
  })

  it('throws on missing pathName', () => {
    const raw = JSON.stringify({
      entries: [{ courseId: 'c1', position: 1, justification: 'X', isGap: false }],
    })
    expect(() => parseAndValidateResponse(raw, new Set(['c1']))).toThrow(
      'AI response format is invalid'
    )
  })

  it('throws on empty entries array', () => {
    const raw = JSON.stringify({
      pathName: 'Empty',
      entries: [],
      rationale: 'None',
    })
    expect(() => parseAndValidateResponse(raw, new Set(['c1']))).toThrow('AI response is empty')
  })

  it('filters entries with unknown courseIds', () => {
    const raw = JSON.stringify({
      pathName: 'Filter',
      entries: [
        { courseId: 'c1', position: 1, justification: 'OK', isGap: false },
        { courseId: 'unknown', position: 2, justification: 'Bad', isGap: false },
      ],
      rationale: 'Test',
    })
    const result = parseAndValidateResponse(raw, new Set(['c1']))
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].courseId).toBe('c1')
  })

  it('falls back to gapTopic when courseId is unknown but gapTopic present', () => {
    const raw = JSON.stringify({
      pathName: 'Fallback',
      entries: [
        {
          courseId: 'unknown',
          gapTopic: 'Fallback Topic',
          position: 1,
          justification: 'Should become gap',
          isGap: false,
        },
      ],
      rationale: 'Test',
    })
    const result = parseAndValidateResponse(raw, new Set(['c1']))
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].isGap).toBe(true)
    expect(result.entries[0].gapTopic).toBe('Fallback Topic')
    expect(result.entries[0].courseId).toBeUndefined()
  })
})
