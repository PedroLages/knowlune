import type { ImportedVideo } from '@/data/types'

function stripExtension(filename: string): string {
  return filename.replace(/\.\w+$/, '')
}

/**
 * Sort lessons for display: natural order by visible title (filename stem), then
 * by stored `order`. Fixes wrong sequences when IndexedDB `order` disagrees with
 * numbered titles (e.g. "1 - …", "2 - …").
 */
export function sortImportedVideosForCurriculum(videos: ImportedVideo[]): ImportedVideo[] {
  return [...videos].sort((a, b) => {
    const titleA = stripExtension(a.filename)
    const titleB = stripExtension(b.filename)
    const nameCmp = titleA.localeCompare(titleB, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
    if (nameCmp !== 0) return nameCmp
    return a.order - b.order
  })
}
