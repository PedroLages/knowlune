import type { CourseCategory, Difficulty } from '@/data/types'

// ── Schema types ──────────────────────────────────────────────

export interface ManifestLesson {
  title: string
  filename: string
  description?: string
}

export interface ManifestModule {
  title: string
  description?: string
  lessons: ManifestLesson[]
}

/** Full author shape shared by course-manifest.json and track-manifest.json. */
export interface ManifestAuthor {
  name: string
  title?: string
  shortBio?: string
  bio?: string
  avatar?: string
  specialties?: string[]
  yearsExperience?: number
  education?: string
  website?: string
  linkedin?: string
  twitter?: string
  featuredQuote?: string
}

export interface CourseManifest {
  version: string
  course: {
    name: string
    description?: string
    category?: CourseCategory
    difficulty?: Difficulty
    tags: string[]
    author?: ManifestAuthor
    modules?: ManifestModule[]
    track?: {
      name: string
      position?: number
    }
    coverImage?: string
  }
}

export interface TrackManifestCourse {
  folder: string
  position: number
  /** Optional notes stored as LearningPathEntry.justification during import. */
  notes?: string
  /** Optional per-course lesson count cap for track progress. */
  completionTarget?: { targetLessonCount?: number }
}

export interface TrackManifest {
  version: string
  track: {
    name: string
    description?: string
    difficulty?: Difficulty
    author?: ManifestAuthor
    courses: TrackManifestCourse[]
  }
}

// ── Validation types ──────────────────────────────────────────

export interface ManifestError {
  path: string
  message: string
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ManifestError[] }

// ── Helpers ───────────────────────────────────────────────────

const VALID_DIFFICULTIES: readonly string[] = ['beginner', 'intermediate', 'advanced', 'expert']

const VALID_CATEGORIES: readonly string[] = [
  'behavioral-analysis',
  'influence-authority',
  'confidence-mastery',
  'operative-training',
  'research-library',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCompletionTarget(
  value: unknown,
): { targetLessonCount?: number } | null {
  if (value === undefined || value === null) return {} // absent = no target
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const obj = value as Record<string, unknown>
  if (obj.targetLessonCount === undefined) return {} // no lesson count = no target
  if (typeof obj.targetLessonCount !== 'number' || !Number.isInteger(obj.targetLessonCount) || obj.targetLessonCount < 1) {
    return null
  }
  return { targetLessonCount: obj.targetLessonCount }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return typeof value === 'string' ? value : undefined
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every(v => typeof v === 'string')) return null
  return value as string[]
}

function validateNonEmptyString(value: unknown, _path: string): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  return value.trim()
}

// ── Lesson / Module parsers ───────────────────────────────────

function parseLesson(value: unknown, modulePath: string): ManifestLesson | ManifestError[] {
  const errors: ManifestError[] = []
  if (!isRecord(value)) {
    return [{ path: modulePath, message: 'Lesson must be an object' }]
  }
  const title = validateNonEmptyString(value.title, `${modulePath}.title`)
  if (!title) {
    errors.push({
      path: `${modulePath}.title`,
      message: 'Lesson title is required and must be a non-empty string',
    })
  }
  const filename = validateNonEmptyString(value.filename, `${modulePath}.filename`)
  if (!filename) {
    errors.push({
      path: `${modulePath}.filename`,
      message: 'Lesson filename is required and must be a non-empty string',
    })
  }
  if (errors.length > 0) return errors
  return {
    title: title!,
    filename: filename!,
    description: asOptionalString(value.description),
  }
}

function parseModule(value: unknown, index: number): ManifestModule | ManifestError[] {
  const errors: ManifestError[] = []
  if (!isRecord(value)) {
    return [{ path: `course.modules[${index}]`, message: 'Module must be an object' }]
  }

  const title = validateNonEmptyString(value.title, `course.modules[${index}].title`)
  if (!title) {
    errors.push({
      path: `course.modules[${index}].title`,
      message: 'Module title is required and must be a non-empty string',
    })
  }

  if (!Array.isArray(value.lessons)) {
    return [
      { path: `course.modules[${index}].lessons`, message: 'Module lessons must be an array' },
    ]
  }

  const lessons: ManifestLesson[] = []
  for (let li = 0; li < value.lessons.length; li++) {
    const result = parseLesson(value.lessons[li], `course.modules[${index}].lessons[${li}]`)
    if (Array.isArray(result)) {
      errors.push(...result)
    } else {
      lessons.push(result)
    }
  }

  if (errors.length > 0) return errors

  return {
    title: title!,
    description: asOptionalString(value.description),
    lessons,
  }
}

// ── Author parser (shared by course + track manifests) ────────

function asPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined
  return value
}

function parseManifestAuthor(value: unknown, parentPath: string): ManifestAuthor | ManifestError[] {
  const errors: ManifestError[] = []

  if (!isRecord(value)) {
    return [{ path: parentPath, message: 'Author must be an object with a "name" field' }]
  }

  const name = validateNonEmptyString(value.name, `${parentPath}.name`)
  if (!name) {
    errors.push({ path: `${parentPath}.name`, message: 'Author name must be a non-empty string' })
  }

  let specialties: string[] | undefined
  if (value.specialties !== undefined) {
    const parsed = asStringArray(value.specialties)
    if (parsed) {
      specialties = parsed
    } else {
      errors.push({
        path: `${parentPath}.specialties`,
        message: 'Specialties must be an array of strings',
      })
    }
  }

  let yearsExperience: number | undefined
  if (value.yearsExperience !== undefined) {
    const parsed = asPositiveInteger(value.yearsExperience)
    if (parsed !== undefined) {
      yearsExperience = parsed
    } else {
      errors.push({
        path: `${parentPath}.yearsExperience`,
        message: 'Years of experience must be a non-negative integer',
      })
    }
  }

  if (errors.length > 0) return errors

  return {
    name: name!,
    title: asOptionalString(value.title),
    shortBio: asOptionalString(value.shortBio),
    bio: asOptionalString(value.bio),
    avatar: asOptionalString(value.avatar),
    specialties,
    yearsExperience,
    education: asOptionalString(value.education),
    website: asOptionalString(value.website),
    linkedin: asOptionalString(value.linkedin),
    twitter: asOptionalString(value.twitter),
    featuredQuote: asOptionalString(value.featuredQuote),
  }
}

// ── Course manifest parser ────────────────────────────────────

export function parseCourseManifest(json: unknown): ParseResult<CourseManifest> {
  const errors: ManifestError[] = []

  if (!isRecord(json)) {
    return {
      ok: false,
      errors: [{ path: '', message: 'Manifest must be a JSON object' }],
    }
  }

  // Version
  const version = asString(json.version)
  if (!version || !version.startsWith('1.')) {
    errors.push({
      path: 'version',
      message: `Unsupported manifest version "${String(json.version)}". Only version 1.x is supported.`,
    })
  }
  // Narrow to string after validation (errors.length check before return guarantees validity)
  const courseVersion = version as string

  // Course object
  if (!isRecord(json.course)) {
    errors.push({ path: 'course', message: 'The "course" field must be an object' })
    return { ok: false, errors }
  }

  const course = json.course

  // Name (required)
  const name = validateNonEmptyString(course.name, 'course.name')
  if (!name) {
    errors.push({
      path: 'course.name',
      message: 'Course name is required and must be a non-empty string',
    })
  }

  // Description (optional)
  const description = asOptionalString(course.description)

  // Category (optional, validated)
  let category: CourseCategory | undefined
  if (course.category !== undefined) {
    const cat = asString(course.category)
    if (cat && (VALID_CATEGORIES as readonly string[]).includes(cat)) {
      category = cat as CourseCategory
    } else {
      errors.push({
        path: 'course.category',
        message: `Invalid category "${String(course.category)}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      })
    }
  }

  // Difficulty (optional, validated)
  let difficulty: Difficulty | undefined
  if (course.difficulty !== undefined) {
    const diff = asString(course.difficulty)
    if (diff && (VALID_DIFFICULTIES as readonly string[]).includes(diff)) {
      difficulty = diff as Difficulty
    } else {
      errors.push({
        path: 'course.difficulty',
        message: `Invalid difficulty "${String(course.difficulty)}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
      })
    }
  }

  // Tags
  let tags: string[] = []
  if (course.tags !== undefined) {
    const parsed = asStringArray(course.tags)
    if (parsed) {
      tags = parsed
    } else {
      errors.push({ path: 'course.tags', message: 'Tags must be an array of strings' })
    }
  }

  // Author
  let author: ManifestAuthor | undefined
  if (course.author !== undefined) {
    const result = parseManifestAuthor(course.author, 'course.author')
    if (Array.isArray(result)) {
      errors.push(...result)
    } else {
      author = result
    }
  }

  // Modules (takes precedence over flat lessons)
  let modules: ManifestModule[] | undefined
  if (course.modules !== undefined) {
    if (Array.isArray(course.modules)) {
      const parsedModules: ManifestModule[] = []
      for (let mi = 0; mi < course.modules.length; mi++) {
        const result = parseModule(course.modules[mi], mi)
        if (Array.isArray(result)) {
          errors.push(...result)
        } else {
          parsedModules.push(result)
        }
      }
      if (parsedModules.length > 0) {
        modules = parsedModules
      }
    } else {
      errors.push({ path: 'course.modules', message: 'Modules must be an array' })
    }
  } else if (course.lessons !== undefined) {
    // Flat lessons: wrap into a single unnamed module
    if (Array.isArray(course.lessons)) {
      const parsedLessons: ManifestLesson[] = []
      for (let li = 0; li < course.lessons.length; li++) {
        const result = parseLesson(course.lessons[li], `course.lessons[${li}]`)
        if (Array.isArray(result)) {
          errors.push(...result)
        } else {
          parsedLessons.push(result)
        }
      }
      if (parsedLessons.length > 0) {
        modules = [{ title: '', lessons: parsedLessons }]
      }
    } else {
      errors.push({ path: 'course.lessons', message: 'Lessons must be an array' })
    }
  }

  // Track
  let track: CourseManifest['course']['track'] | undefined
  if (course.track !== undefined) {
    if (isRecord(course.track)) {
      const trackName = validateNonEmptyString(course.track.name, 'course.track.name')
      if (trackName) {
        track = {
          name: trackName,
          position: typeof course.track.position === 'number' ? course.track.position : undefined,
        }
      } else {
        errors.push({
          path: 'course.track.name',
          message: 'Track name must be a non-empty string',
        })
      }
    } else {
      errors.push({ path: 'course.track', message: 'Track must be an object with a "name" field' })
    }
  }

  // Cover image
  const coverImage = asOptionalString(course.coverImage)

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      version: courseVersion,
      course: {
        name: name!,
        description,
        category,
        difficulty,
        tags,
        author,
        modules,
        track,
        coverImage,
      },
    },
  }
}

// ── Track manifest parser ─────────────────────────────────────

export function parseTrackManifest(json: unknown): ParseResult<TrackManifest> {
  const errors: ManifestError[] = []

  if (!isRecord(json)) {
    return {
      ok: false,
      errors: [{ path: '', message: 'Track manifest must be a JSON object' }],
    }
  }

  // Version
  const version = asString(json.version)
  if (!version || !version.startsWith('1.')) {
    errors.push({
      path: 'version',
      message: `Unsupported track manifest version "${String(json.version)}". Only version 1.x is supported.`,
    })
  }
  // Narrow to string after validation
  const trackVersion = version as string

  // Track object
  if (!isRecord(json.track)) {
    errors.push({ path: 'track', message: 'The "track" field must be an object' })
    return { ok: false, errors }
  }

  const track = json.track

  // Name (required)
  const name = validateNonEmptyString(track.name, 'track.name')
  if (!name) {
    errors.push({
      path: 'track.name',
      message: 'Track name is required and must be a non-empty string',
    })
  }

  // Description
  const description = asOptionalString(track.description)

  // Difficulty
  let difficulty: Difficulty | undefined
  if (track.difficulty !== undefined) {
    const diff = asString(track.difficulty)
    if (diff && (VALID_DIFFICULTIES as readonly string[]).includes(diff)) {
      difficulty = diff as Difficulty
    } else {
      errors.push({
        path: 'track.difficulty',
        message: `Invalid difficulty "${String(track.difficulty)}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
      })
    }
  }

  // Author
  let author: ManifestAuthor | undefined
  if (track.author !== undefined) {
    const result = parseManifestAuthor(track.author, 'track.author')
    if (Array.isArray(result)) {
      errors.push(...result)
    } else {
      author = result
    }
  }

  // Courses array
  if (!Array.isArray(track.courses)) {
    errors.push({ path: 'track.courses', message: 'Track courses must be an array' })
    return { ok: false, errors }
  }

  const courses: TrackManifestCourse[] = []
  for (let ci = 0; ci < track.courses.length; ci++) {
    const entry = track.courses[ci]
    if (!isRecord(entry)) {
      errors.push({
        path: `track.courses[${ci}]`,
        message: 'Each course entry must be an object',
      })
      continue
    }
    const folder = validateNonEmptyString(entry.folder, `track.courses[${ci}].folder`)
    if (!folder) {
      errors.push({
        path: `track.courses[${ci}].folder`,
        message: 'Course folder name is required and must be a non-empty string',
      })
    }
    if (
      typeof entry.position !== 'number' ||
      !Number.isInteger(entry.position) ||
      entry.position < 1
    ) {
      errors.push({
        path: `track.courses[${ci}].position`,
        message: 'Course position must be a positive integer >= 1',
      })
    }
    const notes = asOptionalString(entry.notes)
    const completionTarget = parseCompletionTarget(entry.completionTarget)
    if (completionTarget === null) {
      errors.push({
        path: `track.courses[${ci}].completionTarget`,
        message:
          'completionTarget must be an object with an optional targetLessonCount (positive integer >= 1)',
      })
    }
    if (folder) {
      courses.push({ folder, position: entry.position as number, notes, ...(completionTarget && { completionTarget }) })
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      version: trackVersion,
      track: {
        name: name!,
        description,
        difficulty,
        author,
        courses,
      },
    },
  }
}
