import { sortImportedVideosForCurriculum } from '@/lib/sortImportedVideosForCurriculum'
import type { ImportedVideo, ImportedPdf, YouTubeCourseChapter } from '@/data/types'

export interface ChapterGroup {
  title: string
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
}

function getFolderName(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : ''
}

export function groupByFolder(videos: ImportedVideo[], pdfs: ImportedPdf[] = []): ChapterGroup[] {
  const videoGroups = new Map<string, ImportedVideo[]>()
  const pdfGroups = new Map<string, ImportedPdf[]>()

  for (const video of videos) {
    const folder = getFolderName(video.path)
    if (!videoGroups.has(folder)) videoGroups.set(folder, [])
    videoGroups.get(folder)!.push(video)
  }

  for (const pdf of pdfs) {
    const folder = getFolderName(pdf.path)
    if (!pdfGroups.has(folder)) pdfGroups.set(folder, [])
    pdfGroups.get(folder)!.push(pdf)
  }

  const allFolders = new Set([...videoGroups.keys(), ...pdfGroups.keys()])
  return Array.from(allFolders)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(title => ({
      title,
      videos: videoGroups.get(title) ?? [],
      pdfs: pdfGroups.get(title) ?? [],
    }))
}

export function groupByChapter(videos: ImportedVideo[], chapters: YouTubeCourseChapter[]): ChapterGroup[] {
  if (chapters.length === 0) return [{ title: '', videos, pdfs: [] }]

  const videoChapterMap = new Map<string, string>()
  for (const ch of chapters) {
    if (!videoChapterMap.has(ch.videoId)) {
      videoChapterMap.set(ch.videoId, ch.title)
    }
  }

  const groups: ChapterGroup[] = []
  let currentTitle = ''
  let currentVideos: ImportedVideo[] = []

  for (const video of videos) {
    const chTitle = videoChapterMap.get(video.youtubeVideoId ?? '') ?? ''
    if (chTitle !== currentTitle && currentVideos.length > 0) {
      groups.push({ title: currentTitle, videos: currentVideos, pdfs: [] })
      currentVideos = []
    }
    currentTitle = chTitle
    currentVideos.push(video)
  }
  if (currentVideos.length > 0) {
    groups.push({ title: currentTitle, videos: currentVideos, pdfs: [] })
  }

  return groups
}

/** Same rules as CourseOverview `groupedContent`. */
export function buildGroupedCurriculum(opts: {
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
  chapters: YouTubeCourseChapter[]
  preferChapterGrouping: boolean
}): ChapterGroup[] {
  const { videos, pdfs, chapters, preferChapterGrouping } = opts
  const raw =
    preferChapterGrouping && chapters.length > 0
      ? groupByChapter(videos, chapters)
      : groupByFolder(videos, preferChapterGrouping ? [] : pdfs)
  return raw.map(group => ({
    ...group,
    videos: sortImportedVideosForCurriculum(group.videos),
  }))
}
