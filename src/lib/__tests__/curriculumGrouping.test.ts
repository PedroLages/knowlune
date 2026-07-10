import { describe, it, expect } from 'vitest'
import {
  groupByChapter,
  groupByFolder,
  buildGroupedCurriculum,
  cleanFolderTitle,
} from '@/lib/curriculumGrouping'
import type { ImportedVideo, ImportedPdf, YouTubeCourseChapter } from '@/data/types'

function vid(
  overrides: Partial<ImportedVideo> & Pick<ImportedVideo, 'id' | 'courseId' | 'filename'>
): ImportedVideo {
  return {
    path: 'root.mp4',
    duration: 0,
    format: 'mp4',
    order: 0,
    fileHandle: null,
    ...overrides,
  }
}

function pdf(
  overrides: Partial<ImportedPdf> & Pick<ImportedPdf, 'id' | 'courseId' | 'filename'>
): ImportedPdf {
  return {
    path: 'root.pdf',
    pageCount: 0,
    fileHandle: null,
    ...overrides,
  }
}

describe('cleanFolderTitle', () => {
  it('strips "NN - " prefix', () => {
    expect(cleanFolderTitle('01 - Overview')).toBe('Overview')
  })

  it('strips "NN-" prefix and humanizes hyphens', () => {
    expect(cleanFolderTitle('03-Linux-Fundamentals')).toBe('Linux Fundamentals')
  })

  it('handles already-decoded paths with numeric prefix', () => {
    expect(cleanFolderTitle('03 - Linux Fundamentals')).toBe('Linux Fundamentals')
  })

  it('handles encoded folder names (should be decoded before calling)', () => {
    // getFolderName already decodes, so cleanFolderTitle receives decoded input
    expect(cleanFolderTitle('03 - Linux Fundamentals')).toBe('Linux Fundamentals')
  })

  it('returns Course Content for empty string', () => {
    expect(cleanFolderTitle('')).toBe('Course Content')
  })

  it('returns raw folder name for numeric-only (no separator)', () => {
    // "01" has no separator to indicate it's a prefix; treat as a title
    expect(cleanFolderTitle('01')).toBe('01')
  })

  it('preserves folder names without numeric prefix', () => {
    expect(cleanFolderTitle('mod-a')).toBe('mod-a')
  })

  it('preserves simple names', () => {
    expect(cleanFolderTitle('Overview')).toBe('Overview')
  })

  it('strips "NN. " prefix', () => {
    expect(cleanFolderTitle('01. Introduction')).toBe('Introduction')
  })
})

describe('curriculumGrouping', () => {
  it('groupByFolder splits by path prefix', () => {
    const videos = [
      vid({ id: 'a', courseId: 'c', filename: '1.mp4', path: 'mod-a/1.mp4' }),
      vid({ id: 'b', courseId: 'c', filename: '2.mp4', path: 'mod-b/2.mp4' }),
    ]
    const g = groupByFolder(videos, [])
    expect(g.map(x => x.title)).toEqual(['mod-a', 'mod-b'])
    expect(g[0].videos.map(v => v.id)).toEqual(['a'])
    expect(g[1].videos.map(v => v.id)).toEqual(['b'])
  })

  it('groupByFolder decodes URL-encoded folder names', () => {
    const videos = [
      vid({
        id: 'a',
        courseId: 'c',
        filename: '1.mp4',
        path: '01%20-%20Overview/1.mp4',
      }),
      vid({
        id: 'b',
        courseId: 'c',
        filename: '2.mp4',
        path: '03%20-%20Linux%20Fundamentals/2.mp4',
      }),
    ]
    const g = groupByFolder(videos, [])
    // Titles should be human-readable — no %20, no numeric prefixes
    expect(g.map(x => x.title)).toEqual(['Overview', 'Linux Fundamentals'])
  })

  it('groupByFolder cleans decoded IndexedDB paths with numeric prefixes', () => {
    const videos = [
      vid({
        id: 'a',
        courseId: 'c',
        filename: '1.mp4',
        path: '01 - Overview/1.mp4',
      }),
      vid({
        id: 'b',
        courseId: 'c',
        filename: '2.mp4',
        path: '03-Linux-Fundamentals/2.mp4',
      }),
    ]
    const g = groupByFolder(videos, [])
    expect(g.map(x => x.title)).toEqual(['Overview', 'Linux Fundamentals'])
  })

  it('groupByFolder preserves sort order by raw folder name', () => {
    const videos = [
      vid({
        id: 'b',
        courseId: 'c',
        filename: 'b.mp4',
        path: '03 - Advanced/2.mp4',
      }),
      vid({
        id: 'a',
        courseId: 'c',
        filename: 'a.mp4',
        path: '01 - Basics/1.mp4',
      }),
    ]
    const g = groupByFolder(videos, [])
    // Sorted by raw folder name (numeric), but titles are cleaned
    expect(g.map(x => x.title)).toEqual(['Basics', 'Advanced'])
  })

  it('groupByFolder handles mixed encoded and decoded paths', () => {
    const videos = [
      vid({
        id: 'a',
        courseId: 'c',
        filename: 'a.mp4',
        path: '01%20-%20Start/a.mp4',
      }),
      vid({
        id: 'b',
        courseId: 'c',
        filename: 'b.mp4',
        path: '02 - Middle/b.mp4',
      }),
      vid({
        id: 'c',
        courseId: 'c',
        filename: 'c.mp4',
        path: '03-End/c.mp4',
      }),
    ]
    const g = groupByFolder(videos, [])
    expect(g.map(x => x.title)).toEqual(['Start', 'Middle', 'End'])
  })

  it('groupByFolder includes PDFs alongside videos', () => {
    const videos = [
      vid({
        id: 'v1',
        courseId: 'c',
        filename: 'v.mp4',
        path: '01 - Section/v.mp4',
      }),
    ]
    const pdfs = [
      pdf({
        id: 'p1',
        courseId: 'c',
        filename: 'p.pdf',
        path: '01 - Section/p.pdf',
      }),
    ]
    const g = groupByFolder(videos, pdfs)
    expect(g).toHaveLength(1)
    expect(g[0].title).toBe('Section')
    expect(g[0].videos).toHaveLength(1)
    expect(g[0].pdfs).toHaveLength(1)
  })

  it('groupByChapter buckets by playlist chapter title', () => {
    const chapters: YouTubeCourseChapter[] = [
      { id: 'ch1', courseId: 'c', videoId: 'yt1', title: 'Intro', startTime: 0, order: 0 },
      { id: 'ch2', courseId: 'c', videoId: 'yt2', title: 'Deep dive', startTime: 0, order: 1 },
    ]
    const videos = [
      vid({ id: 'a', courseId: 'c', filename: 'a.mp4', youtubeVideoId: 'yt1', path: '' }),
      vid({ id: 'b', courseId: 'c', filename: 'b.mp4', youtubeVideoId: 'yt2', path: '' }),
    ]
    const g = groupByChapter(videos, chapters)
    expect(g.map(x => x.title)).toEqual(['Intro', 'Deep dive'])
  })

  it('buildGroupedCurriculum uses chapters when preferChapterGrouping and chapters exist', () => {
    const chapters: YouTubeCourseChapter[] = [
      { id: 'ch1', courseId: 'c', videoId: 'yt1', title: 'A', startTime: 0, order: 0 },
    ]
    const videos = [
      vid({
        id: 'x',
        courseId: 'c',
        filename: 'x.mp4',
        youtubeVideoId: 'yt1',
        path: 'folder/x.mp4',
      }),
    ]
    const pdfs: ImportedPdf[] = []
    const g = buildGroupedCurriculum({
      videos,
      pdfs,
      chapters,
      preferChapterGrouping: true,
    })
    expect(g).toHaveLength(1)
    expect(g[0].title).toBe('A')
  })

  it('buildGroupedCurriculum falls back to folder grouping for YouTube without chapters', () => {
    const videos = [
      vid({
        id: 'x',
        courseId: 'c',
        filename: 'x.mp4',
        youtubeVideoId: 'yt1',
        path: 'folder/x.mp4',
      }),
    ]
    const g = buildGroupedCurriculum({
      videos,
      pdfs: [],
      chapters: [],
      preferChapterGrouping: true,
    })
    expect(g).toHaveLength(1)
    expect(g[0].title).toBe('folder')
  })
})
