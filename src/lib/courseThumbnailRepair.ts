import { db } from '@/db'
import type { CourseThumbnail, ImportedCourse, ImportedVideo } from '@/data/types'
import {
  extractThumbnailFromVideo,
  fetchThumbnailFromUrl,
  loadThumbnailFromFile,
} from '@/lib/thumbnailService'
import { parseYouTubeUrl } from '@/lib/youtubeUrlParser'

export type CourseThumbnailRepair =
  | { kind: 'blob'; blob: Blob; source: 'auto' | 'local' | 'url' }
  | { kind: 'remote'; url: string; source: 'url' | 'server' }

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function videoIdFromLegacyVideo(video: ImportedVideo): string | undefined {
  if (video.youtubeVideoId) return video.youtubeVideoId

  if (video.youtubeUrl) {
    const parsed = parseYouTubeUrl(video.youtubeUrl)
    if (parsed.valid && parsed.videoId) return parsed.videoId
  }

  const path = typeof video.path === 'string' ? video.path : ''
  if (path.startsWith('youtube://')) {
    const pathId = path.slice('youtube://'.length).split(/[/?#]/, 1)[0]
    return pathId || undefined
  }

  return undefined
}

function youtubeThumbnailCandidates(video: ImportedVideo): string[] {
  const videoId = videoIdFromLegacyVideo(video)
  return unique([
    video.thumbnailUrl,
    videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
    videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : undefined,
    videoId ? `https://i.ytimg.com/vi/${videoId}/default.jpg` : undefined,
  ])
}

function hasYouTubeVideoMetadata(video: ImportedVideo): boolean {
  const path = typeof video.path === 'string' ? video.path : ''
  return Boolean(
    video.youtubeVideoId || video.youtubeUrl || path.startsWith('youtube://') || video.thumbnailUrl
  )
}

function isLegacyYouTubeCourse(course: ImportedCourse, videos: ImportedVideo[]): boolean {
  const category = typeof course.category === 'string' ? course.category : ''
  return (
    course.source === 'youtube' ||
    category.trim().toLowerCase() === 'youtube' ||
    videos.some(hasYouTubeVideoMetadata)
  )
}

/** A non-empty Blob can still contain an HTML error page or corrupt image data. */
async function isThumbnailBlobUsable(blob: Blob): Promise<boolean> {
  if (blob.size <= 0) return false
  if (typeof createImageBitmap !== 'function') return true

  try {
    const bitmap = await createImageBitmap(blob)
    bitmap.close()
    return true
  } catch {
    return false
  }
}

/** Validate a remote image without decoding it into a canvas. */
function isImageReachable(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(true)

  return new Promise(resolve => {
    const image = new Image()
    const timeout = window.setTimeout(() => {
      image.src = ''
      resolve(false)
    }, 6000)
    const finish = (result: boolean) => {
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      resolve(result)
    }
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = url
  })
}

async function repairFromRemoteCandidates(
  candidates: readonly string[]
): Promise<CourseThumbnailRepair | null> {
  for (const url of candidates) {
    if (!(await isImageReachable(url))) continue

    try {
      const blob = await fetchThumbnailFromUrl(url)
      return { kind: 'blob', blob, source: 'url' }
    } catch {
      // The browser may display an image even when canvas fetch is blocked by
      // CORS. Keep the validated URL as a remote fallback in that case.
      return { kind: 'remote', url, source: 'url' }
    }
  }
  return null
}

async function repairFromYouTube(videos: ImportedVideo[]): Promise<CourseThumbnailRepair | null> {
  const candidates = videos.flatMap(youtubeThumbnailCandidates)
  return repairFromRemoteCandidates(candidates)
}

/**
 * Finds a low-cost, deterministic cover for a course that has no local cover.
 * The repair is intentionally best-effort: disconnected sources are surfaced
 * to the card's Add cover action instead of blocking course loading.
 */
export async function findCourseThumbnailRepair(
  course: ImportedCourse
): Promise<CourseThumbnailRepair | null> {
  const existing = await db.courseThumbnails.get(course.id)
  if (existing?.blob && (await isThumbnailBlobUsable(existing.blob))) return null
  if (existing?.remoteUrl && (await isImageReachable(existing.remoteUrl))) return null

  const videos = await db.importedVideos.where('courseId').equals(course.id).sortBy('order')

  if (course.youtubeThumbnailUrl) {
    const courseThumbnailRepair = await repairFromRemoteCandidates([course.youtubeThumbnailUrl])
    if (courseThumbnailRepair) return courseThumbnailRepair
  }

  if (isLegacyYouTubeCourse(course, videos)) {
    const youtubeRepair = await repairFromYouTube(videos)
    if (youtubeRepair) return youtubeRepair
  }

  if (course.coverImageHandle) {
    try {
      const file = await course.coverImageHandle.getFile()
      const blob = await loadThumbnailFromFile(file)
      return { kind: 'blob', blob, source: 'local' }
    } catch {
      // A stale FileSystemFileHandle is expected after a device change.
    }
  }

  const firstLocalVideo = videos.find(video => video.fileHandle)
  if (firstLocalVideo?.fileHandle) {
    try {
      const blob = await extractThumbnailFromVideo(firstLocalVideo.fileHandle)
      return { kind: 'blob', blob, source: 'auto' }
    } catch {
      // Unsupported codecs and stale handles fall through to the visible CTA.
    }
  }

  return null
}

export function toCourseThumbnailRecord(
  courseId: string,
  repair: CourseThumbnailRepair,
  createdAt: string
): CourseThumbnail {
  return repair.kind === 'blob'
    ? { courseId, blob: repair.blob, source: repair.source, createdAt }
    : { courseId, remoteUrl: repair.url, source: repair.source, createdAt }
}
