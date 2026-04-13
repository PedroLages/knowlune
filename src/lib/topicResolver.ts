/**
 * Topic Resolution Service (E56-S01)
 *
 * Extracts, normalizes, deduplicates, and categorizes topics from available
 * data signals: ImportedCourse.tags[], ImportedCourse.category, and
 * Question.topic. Pure functions — no DB calls, no side effects.
 *
 * Pattern reference: src/lib/qualityScore.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedTopic {
  /** Display name (title-cased) */
  name: string
  /** Normalized key used for deduplication and lookups */
  canonicalName: string
  /** Top-level category (from ImportedCourse.category) */
  category: string
  /** IDs of courses associated with this topic */
  courseIds: string[]
  /** Matching Question.topic values for quiz score mapping */
  questionTopics: string[]
}

/** Minimal course data needed for topic resolution */
export interface TopicCourseInput {
  id: string
  category: string
  tags: string[]
}

/** Minimal question data needed for topic resolution */
export interface TopicQuestionInput {
  topic?: string
  /** courseId must be resolved before passing to the resolver (quiz.lessonId → video.courseId) */
  courseId: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Regex patterns that match noise entries — dates, meta-topics, session labels,
 * and generic filler that should not appear as knowledge map topics.
 */
export const NOISE_PATTERNS: RegExp[] = [
  // Dates: "October 2023", "Jan 2024", "2023-10-15", "Q3 2024"
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i,
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$/i,
  /^\d{4}-\d{2}(-\d{2})?$/,
  /^q[1-4]\s+\d{4}$/i,

  // Meta-topics and session labels
  /^(course overview|getting started|introduction|conclusion|summary|recap|review|wrap up)$/i,
  /^(key takeaways|final thoughts|next steps|action items|homework|assignment)$/i,
  /^(weekly session|bonus content|extra material|supplementary|appendix)$/i,
  /^(part \d+|section \d+|module \d+|chapter \d+|lesson \d+|unit \d+|week \d+)$/i,

  // Generic filler
  /^(miscellaneous|other|general|various|unknown|n\/a|none|tbd|todo)$/i,

  // Too short to be meaningful (single character or two-letter)
  /^.{0,2}$/,
]

/**
 * Canonical synonym map. Keys are normalized forms that should be merged
 * into the value (the canonical form). All entries are lowercase.
 */
export const CANONICAL_MAP: Record<string, string> = {
  'lie detection': 'deception detection',
  'detecting lies': 'deception detection',
  'detecting deception': 'deception detection',
  'body language': 'nonverbal communication',
  'nonverbal cues': 'nonverbal communication',
  'non verbal communication': 'nonverbal communication',
  'facial expressions': 'facial expression analysis',
  'reading faces': 'facial expression analysis',
  'micro expressions': 'microexpression recognition',
  'microexpressions': 'microexpression recognition',
  'machine learning': 'ml',
  'deep learning': 'dl',
  'artificial intelligence': 'ai',
  'natural language processing': 'nlp',
  'data science': 'data analysis',
  'data analytics': 'data analysis',
  'web development': 'web dev',
  'web design': 'web dev',
  'user experience': 'ux design',
  'user interface': 'ui design',
  'public speaking': 'presentation skills',
  'speech delivery': 'presentation skills',
  'time management': 'productivity',
  'project management': 'project planning',
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw topic string: lowercase, trim, replace hyphens/underscores
 * with spaces, collapse multiple spaces into one.
 */
export function normalizeTopic(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Convert a normalized (lowercase) topic name to Title Case for display.
 */
export function toTitleCase(normalized: string): string {
  return normalized
    .split(' ')
    .map((word) => (word.length === 0 ? '' : word[0].toUpperCase() + word.slice(1)))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Noise filter
// ---------------------------------------------------------------------------

/**
 * Returns true if the normalized topic matches any noise pattern.
 */
export function isNoiseTopic(normalized: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized))
}

// ---------------------------------------------------------------------------
// Canonicalization
// ---------------------------------------------------------------------------

/**
 * Look up a normalized topic in the canonical map. Returns the canonical
 * form if a synonym exists, otherwise returns the input unchanged.
 */
export function canonicalize(normalized: string): string {
  return CANONICAL_MAP[normalized] ?? normalized
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve topics from available data signals.
 *
 * Pure function — takes pre-fetched course and question data as input.
 * Does NOT query Dexie or any other data store.
 *
 * @param courses - Array of ImportedCourse-like objects (id, category, tags)
 * @param questions - Array of Question-like objects (topic, courseId pre-resolved)
 * @returns Deduplicated, normalized, categorized topics
 */
export function resolveTopics(
  courses: TopicCourseInput[],
  questions: TopicQuestionInput[] = []
): ResolvedTopic[] {
  // Accumulator: canonicalName → partial ResolvedTopic
  const topicMap = new Map<
    string,
    {
      canonicalName: string
      courseIds: Set<string>
      questionTopics: Set<string>
      // category votes: category → count of course associations
      categoryVotes: Map<string, number>
    }
  >()

  function getOrCreate(canonical: string) {
    let entry = topicMap.get(canonical)
    if (!entry) {
      entry = {
        canonicalName: canonical,
        courseIds: new Set(),
        questionTopics: new Set(),
        categoryVotes: new Map(),
      }
      topicMap.set(canonical, entry)
    }
    return entry
  }

  // --- Phase 1: Extract topics from course tags ---
  for (const course of courses) {
    for (const tag of course.tags) {
      const normalized = normalizeTopic(tag)
      if (!normalized || isNoiseTopic(normalized)) continue
      const canonical = canonicalize(normalized)

      const entry = getOrCreate(canonical)
      entry.courseIds.add(course.id)
      entry.categoryVotes.set(
        course.category,
        (entry.categoryVotes.get(course.category) ?? 0) + 1
      )
    }
  }

  // --- Phase 2: Extract topics from course categories ---
  // Each category itself is a topic signal
  for (const course of courses) {
    const normalized = normalizeTopic(course.category)
    if (!normalized || isNoiseTopic(normalized)) continue
    const canonical = canonicalize(normalized)

    const entry = getOrCreate(canonical)
    entry.courseIds.add(course.id)
    entry.categoryVotes.set(
      course.category,
      (entry.categoryVotes.get(course.category) ?? 0) + 1
    )
  }

  // --- Phase 3: Map Question.topic values ---
  for (const question of questions) {
    if (!question.topic) continue
    const normalized = normalizeTopic(question.topic)
    if (!normalized || isNoiseTopic(normalized)) continue
    const canonical = canonicalize(normalized)

    const entry = getOrCreate(canonical)
    entry.questionTopics.add(question.topic)
    entry.courseIds.add(question.courseId)
  }

  // --- Phase 4: Build output ---
  const results: ResolvedTopic[] = []

  for (const entry of topicMap.values()) {
    // Determine winning category by highest vote count
    let bestCategory = 'Uncategorized'
    let bestCount = 0
    for (const [cat, count] of entry.categoryVotes) {
      if (count > bestCount) {
        bestCategory = cat
        bestCount = count
      }
    }

    results.push({
      name: toTitleCase(entry.canonicalName),
      canonicalName: entry.canonicalName,
      category: bestCategory,
      courseIds: [...entry.courseIds].sort(),
      questionTopics: [...entry.questionTopics].sort(),
    })
  }

  // Sort alphabetically by canonical name for deterministic output
  return results.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName))
}
