import { useCourseStore } from '@/stores/useCourseStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { Course, Author, ImportedAuthor } from '@/data/types'
import { allAuthors } from '@/data/authors'

/**
 * Unified author view type for display purposes.
 * Normalizes differences between pre-seeded Author and ImportedAuthor types.
 */
export interface AuthorView {
  id: string
  name: string
  avatar: string
  title: string
  bio: string
  shortBio: string
  specialties: string[]
  yearsExperience: number
  education?: string
  socialLinks: { website?: string; linkedin?: string; twitter?: string }
  featuredQuote?: string
  courseCount: number
  isPreseeded: boolean
  createdAt: string
  /** Original ImportedAuthor if from store (for edit/delete) */
  importedAuthor?: ImportedAuthor
  /** Original pre-seeded Author if from static data */
  preseededAuthor?: Author
}

/** Convert a pre-seeded Author to AuthorView */
function preseededToView(author: Author): AuthorView {
  const stats = getAuthorStats(author)
  return {
    id: author.id,
    name: author.name,
    avatar: author.avatar,
    title: author.title,
    bio: author.bio,
    shortBio: author.shortBio,
    specialties: author.specialties,
    yearsExperience: author.yearsExperience,
    education: author.education,
    socialLinks: author.socialLinks,
    featuredQuote: author.featuredQuote,
    courseCount: stats.courseCount,
    isPreseeded: true,
    createdAt: '2000-01-01T00:00:00.000Z', // static data has no timestamp
    preseededAuthor: author,
  }
}

/** Convert an ImportedAuthor to AuthorView */
function importedToView(author: ImportedAuthor): AuthorView {
  const stats = getImportedAuthorStats(author)
  return {
    id: author.id,
    name: author.name,
    avatar: author.photoUrl ?? '',
    title: '', // ImportedAuthor has no title field
    bio: author.bio ?? '',
    shortBio: author.bio ? author.bio.slice(0, 120) + (author.bio.length > 120 ? '...' : '') : '',
    specialties: author.specialties ?? [],
    yearsExperience: 0,
    education: undefined,
    socialLinks: author.socialLinks ?? {},
    featuredQuote: undefined,
    courseCount: stats.courseCount,
    isPreseeded: author.isPreseeded,
    createdAt: author.createdAt,
    importedAuthor: author,
  }
}

/**
 * Merge pre-seeded authors with imported authors from the store.
 * If an imported author has `isPreseeded: true` and the same ID as a static author,
 * the imported version takes precedence (it contains user edits).
 * Static-only authors (not in IndexedDB) are included as fallback.
 */
export function getMergedAuthors(storeAuthors: ImportedAuthor[]): AuthorView[] {
  const storeIds = new Set(storeAuthors.map(a => a.id))
  const views: AuthorView[] = []

  // Add all store authors
  for (const author of storeAuthors) {
    views.push(importedToView(author))
  }

  // Add pre-seeded authors not already in the store (fallback for migration failure)
  for (const author of allAuthors) {
    if (!storeIds.has(author.id)) {
      views.push(preseededToView(author))
    }
  }

  return views
}

/** Extract initials from a full name (e.g., "Jane Smith" -> "JS") */
export function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

/** Get stats for a pre-seeded Author (using Course.authorId) */
export function getAuthorStats(author: Author) {
  const courses = useCourseStore.getState().courses.filter(c => c.authorId === author.id)
  return {
    courses,
    courseCount: courses.length,
    totalLessons: courses.reduce((sum, c) => sum + c.totalLessons, 0),
    totalHours: courses.reduce((sum, c) => sum + c.estimatedHours, 0),
    totalVideos: courses.reduce((sum, c) => sum + c.totalVideos, 0),
    categories: [...new Set(courses.map(c => c.category))],
  }
}

/** Get stats for an ImportedAuthor (using courseIds array) */
export function getImportedAuthorStats(author: ImportedAuthor) {
  const courses = useCourseStore.getState().courses.filter(c => c.authorId === author.id)
  return {
    courses,
    courseCount: courses.length,
    totalLessons: courses.reduce((sum, c) => sum + c.totalLessons, 0),
    totalHours: courses.reduce((sum, c) => sum + c.estimatedHours, 0),
    totalVideos: courses.reduce((sum, c) => sum + c.totalVideos, 0),
    categories: [...new Set(courses.map(c => c.category))],
  }
}

export function getAuthorForCourse(course: Course): Author | undefined {
  const state = useAuthorStore.getState()
  // Ensure authors are loaded -- loadAuthors is idempotent (no-ops if already loaded/loading)
  if (!state.isLoaded && !state.isLoading) {
    state.loadAuthors()
  }
  return state.getAuthorById(course.authorId) as unknown as Author | undefined
}

/** Available responsive avatar widths (px) */
const AVATAR_WIDTHS = [48, 96, 192, 256] as const

/**
 * Returns src + srcSet props for an author avatar at a given display size.
 * Picks the smallest width >= displaySize for 1x, and >= displaySize*2 for 2x.
 * Falls back to the largest available width.
 */
export function getAvatarSrc(basePath: string, displaySize: number) {
  // If it's an external URL (e.g. Unsplash), just return it directly
  if (basePath.startsWith('http')) {
    return { src: basePath }
  }

  // Empty string — no avatar
  if (!basePath) {
    return { src: '' }
  }

  const w1x = AVATAR_WIDTHS.find(w => w >= displaySize) ?? AVATAR_WIDTHS[AVATAR_WIDTHS.length - 1]
  const w2x =
    AVATAR_WIDTHS.find(w => w >= displaySize * 2) ?? AVATAR_WIDTHS[AVATAR_WIDTHS.length - 1]

  return {
    src: `${basePath}-${w1x}w.jpg`,
    srcSet: `${basePath}-${w1x}w.webp ${w1x}w, ${basePath}-${w2x}w.webp ${w2x}w`,
  }
}
