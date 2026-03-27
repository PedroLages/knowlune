/**
 * Unit tests for AI-Powered Course Structuring (E28-S07)
 *
 * Tests the parseAIResponse function and aiChaptersToVideoChapters conversion.
 * The structureCourseWithAI function is integration-level (requires LLM client).
 */

import { describe, it, expect } from 'vitest'
import {
  parseAIResponse,
  aiChaptersToVideoChapters,
  type StructuringVideo,
} from '../courseStructurer'

// --- Test fixtures ---

const VIDEOS: StructuringVideo[] = [
  { videoId: 'v1', title: 'React Intro', duration: 600 },
  { videoId: 'v2', title: 'React Components', duration: 900 },
  { videoId: 'v3', title: 'State Management', duration: 1200 },
  { videoId: 'v4', title: 'Hooks Deep Dive', duration: 800 },
  { videoId: 'v5', title: 'Advanced Patterns', duration: 1500 },
]

const VALID_AI_RESPONSE = JSON.stringify({
  chapters: [
    {
      title: 'React Fundamentals',
      videoIds: ['v1', 'v2'],
      rationale: 'Introduction and core component concepts.',
    },
    {
      title: 'State & Hooks',
      videoIds: ['v3', 'v4'],
      rationale: 'State management techniques and hooks.',
    },
    {
      title: 'Advanced Topics',
      videoIds: ['v5'],
      rationale: 'Advanced design patterns.',
    },
  ],
  suggestedCourseTitle: 'Complete React Course',
  suggestedDescription: 'Learn React from basics to advanced patterns.',
  suggestedTags: ['react', 'javascript', 'frontend'],
})

describe('parseAIResponse', () => {
  it('parses valid JSON response correctly', () => {
    const result = parseAIResponse(VALID_AI_RESPONSE, VIDEOS)

    expect(result).not.toBeNull()
    expect(result!.chapters).toHaveLength(3)
    expect(result!.chapters[0].title).toBe('React Fundamentals')
    expect(result!.chapters[0].videoIds).toEqual(['v1', 'v2'])
    expect(result!.chapters[0].rationale).toBe('Introduction and core component concepts.')
    expect(result!.suggestedCourseTitle).toBe('Complete React Course')
    expect(result!.suggestedDescription).toBe('Learn React from basics to advanced patterns.')
    expect(result!.suggestedTags).toEqual(['react', 'javascript', 'frontend'])
  })

  it('extracts JSON from markdown code fences', () => {
    const fenced = '```json\n' + VALID_AI_RESPONSE + '\n```'
    const result = parseAIResponse(fenced, VIDEOS)

    expect(result).not.toBeNull()
    expect(result!.chapters).toHaveLength(3)
  })

  it('extracts JSON from brace match fallback', () => {
    const messy = 'Here is the result:\n' + VALID_AI_RESPONSE + '\n\nDone!'
    const result = parseAIResponse(messy, VIDEOS)

    expect(result).not.toBeNull()
    expect(result!.chapters).toHaveLength(3)
  })

  it('returns null for empty content', () => {
    expect(parseAIResponse('', VIDEOS)).toBeNull()
  })

  it('returns null for non-JSON content', () => {
    expect(parseAIResponse('This is not JSON at all', VIDEOS)).toBeNull()
  })

  it('returns null for valid JSON without chapters array', () => {
    expect(parseAIResponse('{"title": "test"}', VIDEOS)).toBeNull()
  })

  it('returns null for empty chapters array', () => {
    expect(parseAIResponse('{"chapters": []}', VIDEOS)).toBeNull()
  })

  it('filters out invalid video IDs', () => {
    const response = JSON.stringify({
      chapters: [
        {
          title: 'Chapter 1',
          videoIds: ['v1', 'INVALID_ID', 'v2'],
          rationale: 'Test',
        },
        {
          title: 'Chapter 2',
          videoIds: ['v3'],
          rationale: 'Test',
        },
      ],
    })

    const result = parseAIResponse(response, VIDEOS)
    expect(result).not.toBeNull()
    expect(result!.chapters[0].videoIds).toEqual(['v1', 'v2'])
  })

  it('assigns unassigned videos to "Other Videos" chapter', () => {
    const response = JSON.stringify({
      chapters: [
        {
          title: 'Chapter 1',
          videoIds: ['v1', 'v2'],
          rationale: 'Test',
        },
      ],
    })

    const result = parseAIResponse(response, VIDEOS)
    expect(result).not.toBeNull()
    expect(result!.chapters).toHaveLength(2)
    expect(result!.chapters[1].title).toBe('Other Videos')
    expect(result!.chapters[1].videoIds).toEqual(['v3', 'v4', 'v5'])
  })

  it('prevents duplicate video ID assignments', () => {
    const response = JSON.stringify({
      chapters: [
        { title: 'A', videoIds: ['v1', 'v2'], rationale: 'Test' },
        { title: 'B', videoIds: ['v2', 'v3'], rationale: 'Test' }, // v2 already assigned
      ],
    })

    const result = parseAIResponse(response, VIDEOS)
    expect(result).not.toBeNull()
    // v2 should only appear in chapter A
    expect(result!.chapters[0].videoIds).toEqual(['v1', 'v2'])
    expect(result!.chapters[1].videoIds).toEqual(['v3'])
  })

  it('limits tags to 5 and lowercases them', () => {
    const response = JSON.stringify({
      chapters: [{ title: 'All', videoIds: ['v1', 'v2', 'v3', 'v4', 'v5'], rationale: 'All' }],
      suggestedTags: ['React', 'JavaScript', 'Frontend', 'Web Dev', 'TypeScript', 'Extra Tag'],
    })

    const result = parseAIResponse(response, VIDEOS)
    expect(result).not.toBeNull()
    expect(result!.suggestedTags).toHaveLength(5)
    expect(result!.suggestedTags).toEqual([
      'react',
      'javascript',
      'frontend',
      'web dev',
      'typescript',
    ])
  })

  it('handles missing rationale gracefully', () => {
    const response = JSON.stringify({
      chapters: [{ title: 'Chapter 1', videoIds: ['v1', 'v2', 'v3', 'v4', 'v5'] }],
    })

    const result = parseAIResponse(response, VIDEOS)
    expect(result).not.toBeNull()
    expect(result!.chapters[0].rationale).toBe('')
  })

  it('skips chapters with no title', () => {
    const response = JSON.stringify({
      chapters: [
        { videoIds: ['v1', 'v2'], rationale: 'No title' },
        { title: 'Valid', videoIds: ['v3', 'v4', 'v5'], rationale: 'Has title' },
      ],
    })

    const result = parseAIResponse(response, VIDEOS)
    expect(result).not.toBeNull()
    // First chapter skipped due to no title, unassigned v1, v2 go to "Other Videos"
    expect(result!.chapters).toHaveLength(2)
    expect(result!.chapters[0].title).toBe('Valid')
    expect(result!.chapters[1].title).toBe('Other Videos')
    expect(result!.chapters[1].videoIds).toEqual(['v1', 'v2'])
  })
})

describe('aiChaptersToVideoChapters', () => {
  it('converts AI chapters to VideoChapter format', () => {
    const aiChapters = [
      { title: 'Ch 1', videoIds: ['v1', 'v2'], rationale: 'Basics' },
      { title: 'Ch 2', videoIds: ['v3'], rationale: 'Advanced' },
    ]

    const result = aiChaptersToVideoChapters(aiChapters)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('ai-chapter-0')
    expect(result[0].source).toBe('ai')
    expect(result[0].rationale).toBe('Basics')
    expect(result[1].id).toBe('ai-chapter-1')
    expect(result[1].title).toBe('Ch 2')
  })
})
