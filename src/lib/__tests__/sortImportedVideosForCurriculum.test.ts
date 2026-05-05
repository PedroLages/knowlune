import { describe, it, expect } from 'vitest'
import type { ImportedVideo } from '@/data/types'
import { sortImportedVideosForCurriculum } from '../sortImportedVideosForCurriculum'

function video(partial: Pick<ImportedVideo, 'id' | 'filename' | 'order'>): ImportedVideo {
  return {
    courseId: 'c1',
    path: partial.filename,
    duration: 0,
    format: 'mp4',
    fileHandle: null,
    ...partial,
  } as ImportedVideo
}

describe('sortImportedVideosForCurriculum', () => {
  it('orders by numeric-leading titles when stored order is scrambled', () => {
    const sorted = sortImportedVideosForCurriculum([
      video({ id: 'a', filename: '3 - Third.mp4', order: 0 }),
      video({ id: 'b', filename: '1 - First.mp4', order: 4 }),
      video({ id: 'c', filename: '2 - Second.mp4', order: 3 }),
    ])
    expect(sorted.map(v => v.id)).toEqual(['b', 'c', 'a'])
  })

  it('uses order as tiebreaker when titles compare equal', () => {
    const sorted = sortImportedVideosForCurriculum([
      video({ id: 'x', filename: 'Intro.mp4', order: 2 }),
      video({ id: 'y', filename: 'Intro.mp4', order: 1 }),
    ])
    expect(sorted.map(v => v.id)).toEqual(['y', 'x'])
  })
})
