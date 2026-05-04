import { useCourseStore } from '@/stores/useCourseStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { Author, Course, ImportedAuthor, ImportedCourse } from '@/data/types'

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

/**
 * Normalize specialty strings for display: split comma/semicolon/pipe-separated
 * blobs inside a single array entry, trim, drop empties, dedupe case-insensitively
 * (first spelling wins).
 */
export function flattenSpecialties(input: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const parts = trimmed
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean)
    const tokens = parts.length > 1 ? parts : [trimmed]
    for (const t of tokens) {
      const k = t.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(t)
    }
  }
  return out
}

/** Count canonical + imported courses attributed to an author (matches AuthorProfile / featured). */
export function totalCoursesForAuthor(
  authorId: string,
  courses: Course[],
  importedCourses: ImportedCourse[]
): number {
  const canonical = courses.filter(c => c.authorId === authorId).length
  const imported = importedCourses.filter(
    c => c.authorId !== undefined && c.authorId === authorId
  ).length
  return canonical + imported
}

/**
 * Override `courseCount` on merged author views using live course lists
 * (canonical + imported). Call from pages that subscribe to both stores.
 */
export function withAuthorCourseCounts(
  views: AuthorView[],
  courses: Course[],
  importedCourses: ImportedCourse[]
): AuthorView[] {
  return views.map(a => ({
    ...a,
    courseCount: totalCoursesForAuthor(a.id, courses, importedCourses),
  }))
}

/** Convert an ImportedAuthor to AuthorView */
function importedToView(author: ImportedAuthor): AuthorView {
  const bioText = author.bio ?? ''
  const canonicalCourseCount = useCourseStore
    .getState()
    .courses.filter(c => c.authorId === author.id).length
  return {
    id: author.id,
    name: author.name,
    avatar: author.photoUrl ?? '',
    title: author.title ?? '',
    bio: bioText,
    shortBio:
      author.shortBio ??
      (bioText ? bioText.slice(0, 120) + (bioText.length > 120 ? '...' : '') : ''),
    specialties: flattenSpecialties(author.specialties ?? []),
    yearsExperience: author.yearsExperience ?? 0,
    education: author.education,
    socialLinks: author.socialLinks ?? {},
    featuredQuote: author.featuredQuote,
    courseCount: canonicalCourseCount,
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
  // Only user-imported authors are shown. Pre-seeded static authors (src/data/authors/)
  // were removed to avoid confusing fresh users with pre-populated data.
  return storeAuthors.map(importedToView)
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

/**
 * Minimal author shape returned by getAuthorForCourse().
 * Explicitly maps ImportedAuthor fields to Author-compatible fields
 * needed by CourseCard (id, name, avatar).
 */
export interface CourseAuthor {
  id: string
  name: string
  avatar: string
}

/**
 * Look up the author for a given course from the store.
 *
 * Note: `loadAuthors()` is fired without await intentionally — this function
 * is called synchronously during render. On first call with an empty store,
 * it returns `undefined`; once the store loads, React re-renders with data.
 * Callers (e.g. CourseCard) already handle `undefined` gracefully.
 */
export function getAuthorForCourse(course: Course): CourseAuthor | undefined {
  const state = useAuthorStore.getState()
  // Ensure authors are loaded -- loadAuthors is idempotent (no-ops if already loaded/loading)
  if (!state.isLoaded && !state.isLoading) {
    // Fire-and-forget: store update triggers React re-render via subscription
    void state.loadAuthors()
  }
  const imported = state.getAuthorById(course.authorId)
  if (!imported) return undefined
  // Explicitly map ImportedAuthor fields to CourseAuthor shape
  return {
    id: imported.id,
    name: imported.name,
    avatar: imported.photoUrl ?? '',
  }
}

/**
 * Look up the author for an imported course by its authorId.
 * Same lazy-load pattern as getAuthorForCourse.
 */
export function getAuthorForImportedCourse(authorId?: string): CourseAuthor | undefined {
  if (!authorId) return undefined
  const state = useAuthorStore.getState()
  if (!state.isLoaded && !state.isLoading) {
    void state.loadAuthors()
  }
  const author = state.getAuthorById(authorId)
  if (!author) return undefined
  return {
    id: author.id,
    name: author.name,
    avatar: author.photoUrl ?? '',
  }
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
