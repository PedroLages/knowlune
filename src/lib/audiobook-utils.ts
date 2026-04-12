import type { Book } from '@/data/types'

/** Get the start time (in seconds) for a chapter from its position. */
export function getChapterStartTime(chapter: {
  position: Book['chapters'][0]['position']
}): number {
  if (chapter.position.type === 'time') return chapter.position.seconds
  return 0
}
