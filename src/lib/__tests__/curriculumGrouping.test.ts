import { describe, it, expect } from 'vitest'
import { groupByChapter, groupByFolder, buildGroupedCurriculum } from '@/lib/curriculumGrouping'
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
