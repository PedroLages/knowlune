/**
 * Unit tests for the lesson-based curriculum grouping engine.
 */

import { describe, it, expect } from 'vitest'
import {
  parseNumericPrefix,
  cleanLessonTitle,
  buildLessonBasedCurriculum,
  type LessonGroup,
} from '../lessonBasedCurriculum'

describe('parseNumericPrefix', () => {
  it('extracts numeric prefix from video filenames', () => {
    expect(parseNumericPrefix('001 The Linux Directory Structure.mp4')).toEqual({
      prefix: '001',
      stem: 'the linux directory structure',
    })
  })

  it('extracts numeric prefix from text filenames', () => {
    expect(parseNumericPrefix('002 Welcome-to-Shell-Text.txt')).toEqual({
      prefix: '002',
      stem: 'welcome to shell text',
    })
  })

  it('extracts numeric prefix from PDF cheat sheets', () => {
    expect(parseNumericPrefix('011 vi-cheat-sheet.pdf')).toEqual({
      prefix: '011',
      stem: 'vi cheat sheet',
    })
  })

  it('handles files without numeric prefix', () => {
    expect(parseNumericPrefix('Resources.pdf')).toEqual({
      prefix: null,
      stem: 'resources',
    })
  })
})

describe('cleanLessonTitle', () => {
  it('cleans video filenames', () => {
    expect(cleanLessonTitle('001 The Linux Directory Structure.mp4')).toBe(
      'The Linux Directory Structure'
    )
  })

  it('strips "Text" suffix from material filenames', () => {
    expect(cleanLessonTitle('002 Welcome-to-Shell-Text.txt')).toBe('Welcome To Shell')
  })

  it('strips "cheat sheet" suffix from material filenames', () => {
    // "vi-cheat-sheet" → stem "vi cheat sheet" → clean removes "cheat sheet" → "Vi"
    expect(cleanLessonTitle('011 vi-cheat-sheet.pdf')).toBe('Vi')
  })

  it('handles filenames with dashes', () => {
    expect(cleanLessonTitle('004 Teach-Yourself-to-Fish-Text.txt')).toBe('Teach Yourself To Fish')
  })
})

describe('buildLessonBasedCurriculum', () => {
  it('groups files by numeric prefix and identifies main lesson', () => {
    const sections = buildLessonBasedCurriculum({
      videos: [
        {
          id: 'v1',
          courseId: 'c1',
          filename: '001 The Linux Directory Structure.mp4',
          path: 'section1/001 The Linux Directory Structure.mp4',
          duration: 540,
          format: 'mp4',
          order: 0,
          fileHandle: null,
        },
        {
          id: 'v2',
          courseId: 'c1',
          filename: '002 The Shell.mp4',
          path: 'section1/002 The Shell.mp4',
          duration: 520,
          format: 'mp4',
          order: 1,
          fileHandle: null,
        },
      ],
      pdfs: [
        {
          id: 'p1',
          courseId: 'c1',
          filename: '002 Welcome-to-Shell-Text.txt',
          path: 'section1/002 Welcome-to-Shell-Text.txt',
          pageCount: 0,
          fileHandle: null,
        },
        {
          id: 'p2',
          courseId: 'c1',
          filename: '001 Linux-Directory-Structure-Text.txt',
          path: 'section1/001 Linux-Directory-Structure-Text.txt',
          pageCount: 0,
          fileHandle: null,
        },
      ],
      chapters: [],
      preferChapterGrouping: false,
    })

    expect(sections).toHaveLength(1)
    const section = sections[0]
    expect(section.lessons).toHaveLength(2)

    // First lesson: 001
    const lesson1 = section.lessons[0]
    expect(lesson1.numericPrefix).toBe('001')
    expect(lesson1.primary.displayTitle).toBe('The Linux Directory Structure')
    expect(lesson1.primary.type).toBe('video')
    expect(lesson1.materials).toHaveLength(1)
    expect(lesson1.materials[0].type).toBe('text')

    // Second lesson: 002
    const lesson2 = section.lessons[1]
    expect(lesson2.numericPrefix).toBe('002')
    expect(lesson2.primary.displayTitle).toBe('The Shell')
    expect(lesson2.primary.type).toBe('video')
    expect(lesson2.materials).toHaveLength(1)
    expect(lesson2.materials[0].type).toBe('text')
  })

  it('handles PDF-only lessons (no video at prefix)', () => {
    const sections = buildLessonBasedCurriculum({
      videos: [],
      pdfs: [
        {
          id: 'p1',
          courseId: 'c1',
          filename: '004 Teach-Yourself-to-Fish-Text.txt',
          path: 'section1/004 Teach-Yourself-to-Fish-Text.txt',
          pageCount: 5,
          fileHandle: null,
        },
      ],
      chapters: [],
      preferChapterGrouping: false,
    })

    expect(sections).toHaveLength(1)
    const lesson = sections[0].lessons[0]
    expect(lesson.primary.type).toBe('text')
    expect(lesson.primary.displayTitle).toBe('Teach Yourself To Fish')
    expect(lesson.materials).toHaveLength(0)
  })

  it('attaches cheat sheets as materials to their matching video', () => {
    const sections = buildLessonBasedCurriculum({
      videos: [
        {
          id: 'v1',
          courseId: 'c1',
          filename: '011 Vim Basics.mp4',
          path: 'section1/011 Vim Basics.mp4',
          duration: 300,
          format: 'mp4',
          order: 0,
          fileHandle: null,
        },
      ],
      pdfs: [
        {
          id: 'p1',
          courseId: 'c1',
          filename: '011 vi-cheat-sheet.pdf',
          path: 'section1/011 vi-cheat-sheet.pdf',
          pageCount: 2,
          fileHandle: null,
        },
      ],
      chapters: [],
      preferChapterGrouping: false,
    })

    const lesson = sections[0].lessons[0]
    expect(lesson.primary.type).toBe('video')
    expect(lesson.primary.displayTitle).toBe('Vim Basics')
    expect(lesson.materials).toHaveLength(1)
    expect(lesson.materials[0].type).toBe('pdf')
  })

  it('sorts lessons by numeric prefix', () => {
    const sections = buildLessonBasedCurriculum({
      videos: [
        {
          id: 'v3',
          courseId: 'c1',
          filename: '003 Final Lesson.mp4',
          path: 'section1/003 Final Lesson.mp4',
          duration: 300,
          format: 'mp4',
          order: 2,
          fileHandle: null,
        },
        {
          id: 'v1',
          courseId: 'c1',
          filename: '001 First Lesson.mp4',
          path: 'section1/001 First Lesson.mp4',
          duration: 300,
          format: 'mp4',
          order: 0,
          fileHandle: null,
        },
        {
          id: 'v2',
          courseId: 'c1',
          filename: '002 Middle Lesson.mp4',
          path: 'section1/002 Middle Lesson.mp4',
          duration: 300,
          format: 'mp4',
          order: 1,
          fileHandle: null,
        },
      ],
      pdfs: [],
      chapters: [],
      preferChapterGrouping: false,
    })

    const prefixes = sections[0].lessons.map(l => l.numericPrefix)
    expect(prefixes).toEqual(['001', '002', '003'])
  })
})
