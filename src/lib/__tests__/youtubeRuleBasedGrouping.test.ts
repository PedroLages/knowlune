/**
 * Unit tests for rule-based video grouping algorithm.
 *
 * Story: E28-S06
 */
import { describe, it, expect } from 'vitest'
import {
  groupVideosByRules,
  generateChapterId,
  type GroupingVideo,
} from '../youtubeRuleBasedGrouping'

function makeVideo(videoId: string, title: string, duration = 600): GroupingVideo {
  return { videoId, title, duration }
}

describe('groupVideosByRules', () => {
  describe('fallback to single chapter', () => {
    it('returns single "All Videos" chapter for fewer than 3 videos', () => {
      const videos = [makeVideo('v1', 'First Video'), makeVideo('v2', 'Second Video')]
      const result = groupVideosByRules(videos)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('All Videos')
      expect(result[0].videoIds).toEqual(['v1', 'v2'])
      expect(result[0].source).toBe('rule-based')
    })

    it('returns single chapter for a single video', () => {
      const videos = [makeVideo('v1', 'Solo Video')]
      const result = groupVideosByRules(videos)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('All Videos')
    })

    it('returns single chapter for empty array', () => {
      const result = groupVideosByRules([])
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('All Videos')
      expect(result[0].videoIds).toEqual([])
    })
  })

  describe('numbered sequence detection', () => {
    it('groups videos with "Lesson N" pattern', () => {
      const videos = [
        makeVideo('v1', 'Python Basics Lesson 1: Variables'),
        makeVideo('v2', 'Python Basics Lesson 2: Functions'),
        makeVideo('v3', 'Python Basics Lesson 3: Classes'),
        makeVideo('v4', 'Advanced Python Lesson 1: Decorators'),
        makeVideo('v5', 'Advanced Python Lesson 2: Generators'),
      ]
      const result = groupVideosByRules(videos)
      expect(result.length).toBeGreaterThan(1)
      // All videos should be accounted for
      const allVideoIds = result.flatMap(c => c.videoIds)
      expect(allVideoIds).toHaveLength(5)
    })

    it('groups videos with "Part N" pattern', () => {
      const videos = [
        makeVideo('v1', 'React Tutorial Part 1'),
        makeVideo('v2', 'React Tutorial Part 2'),
        makeVideo('v3', 'React Tutorial Part 3'),
        makeVideo('v4', 'Vue Tutorial Part 1'),
        makeVideo('v5', 'Vue Tutorial Part 2'),
        makeVideo('v6', 'Vue Tutorial Part 3'),
      ]
      const result = groupVideosByRules(videos)
      expect(result.length).toBeGreaterThan(1)
      // Should detect "React Tutorial" and "Vue Tutorial" groups
      const allVideoIds = result.flatMap(c => c.videoIds)
      expect(allVideoIds).toHaveLength(6)
    })

    it('detects "N." numbered prefix patterns', () => {
      const videos = [
        makeVideo('v1', '1. Introduction to React'),
        makeVideo('v2', '2. Components and Props'),
        makeVideo('v3', '3. State Management'),
      ]
      // With numbered prefixes but same empty prefix, they go to one group
      const result = groupVideosByRules(videos)
      // All should be in result
      const allVideoIds = result.flatMap(c => c.videoIds)
      expect(allVideoIds).toHaveLength(3)
      result.forEach(c => expect(c.source).toBe('rule-based'))
    })
  })

  describe('common prefix detection', () => {
    it('groups by shared prefix separated by dash/pipe', () => {
      const videos = [
        makeVideo('v1', 'JavaScript - Variables'),
        makeVideo('v2', 'JavaScript - Functions'),
        makeVideo('v3', 'JavaScript - Arrays'),
        makeVideo('v4', 'TypeScript - Types'),
        makeVideo('v5', 'TypeScript - Interfaces'),
        makeVideo('v6', 'TypeScript - Generics'),
      ]
      const result = groupVideosByRules(videos)
      expect(result.length).toBeGreaterThanOrEqual(2)
      const jsChapter = result.find(c => c.title === 'JavaScript')
      const tsChapter = result.find(c => c.title === 'TypeScript')
      expect(jsChapter).toBeDefined()
      expect(tsChapter).toBeDefined()
      expect(jsChapter!.videoIds).toHaveLength(3)
      expect(tsChapter!.videoIds).toHaveLength(3)
    })
  })

  describe('keyword clustering', () => {
    it('clusters videos by keyword similarity when no other pattern matches', () => {
      const videos = [
        makeVideo('v1', 'Understanding React Hooks useState'),
        makeVideo('v2', 'Deep Dive into React Hooks useEffect'),
        makeVideo('v3', 'React Hooks Custom Hook Patterns'),
        makeVideo('v4', 'CSS Grid Layout Fundamentals'),
        makeVideo('v5', 'CSS Grid Advanced Techniques'),
        makeVideo('v6', 'CSS Flexbox Responsive Design'),
        makeVideo('v7', 'Node.js Express Server Setup'),
        makeVideo('v8', 'Node.js Express REST API'),
        makeVideo('v9', 'Node.js Express Authentication'),
      ]
      const result = groupVideosByRules(videos)
      // Should create multiple clusters
      const allVideoIds = result.flatMap(c => c.videoIds)
      expect(allVideoIds).toHaveLength(9)
      result.forEach(c => expect(c.source).toBe('rule-based'))
    })
  })

  describe('preserves playlist order', () => {
    it('maintains original video order within each chapter', () => {
      const videos = [
        makeVideo('v1', 'JavaScript - Basics'),
        makeVideo('v2', 'TypeScript - Basics'),
        makeVideo('v3', 'JavaScript - Advanced'),
        makeVideo('v4', 'TypeScript - Advanced'),
      ]
      const result = groupVideosByRules(videos)
      if (result.length > 1) {
        for (const chapter of result) {
          // Check that video indices are ascending (original order preserved)
          const indices = chapter.videoIds.map(id => videos.findIndex(v => v.videoId === id))
          for (let i = 1; i < indices.length; i++) {
            expect(indices[i]).toBeGreaterThan(indices[i - 1])
          }
        }
      }
    })
  })

  describe('chapter IDs and source', () => {
    it('all chapters have unique IDs', () => {
      const videos = [
        makeVideo('v1', 'React - Part 1'),
        makeVideo('v2', 'React - Part 2'),
        makeVideo('v3', 'Vue - Part 1'),
        makeVideo('v4', 'Vue - Part 2'),
        makeVideo('v5', 'Angular - Part 1'),
        makeVideo('v6', 'Angular - Part 2'),
      ]
      const result = groupVideosByRules(videos)
      const ids = result.map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('all chapters have source "rule-based"', () => {
      const videos = [
        makeVideo('v1', 'JavaScript - Basics'),
        makeVideo('v2', 'JavaScript - Advanced'),
        makeVideo('v3', 'TypeScript - Basics'),
        makeVideo('v4', 'TypeScript - Advanced'),
      ]
      const result = groupVideosByRules(videos)
      result.forEach(c => expect(c.source).toBe('rule-based'))
    })
  })
})

describe('generateChapterId', () => {
  it('returns unique IDs', () => {
    const ids = Array.from({ length: 10 }, () => generateChapterId())
    expect(new Set(ids).size).toBe(10)
  })

  it('returns string starting with "chapter-"', () => {
    const id = generateChapterId()
    expect(id).toMatch(/^chapter-/)
  })
})
