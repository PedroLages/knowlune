/**
 * Genre detection service — maps Open Library subjects to a predefined genre taxonomy.
 *
 * Uses keyword matching against Open Library subject strings.
 * The genre with the most keyword matches wins. Defaults to 'Other' if no match.
 *
 * @module GenreDetectionService
 * @since E108-S05
 */

export type BookGenre =
  | 'Fiction'
  | 'Non-Fiction'
  | 'Science'
  | 'Technology'
  | 'History'
  | 'Biography'
  | 'Fantasy'
  | 'Mystery'
  | 'Romance'
  | 'Self-Help'
  | 'Philosophy'
  | 'Science Fiction'
  | 'Psychology'
  | 'Business'
  | 'Other'

/**
 * Keyword-to-genre map. Each genre has keywords that, when found in Open Library
 * subjects (case-insensitive), count as a match for that genre.
 *
 * Order matters for tie-breaking: earlier genres win ties.
 * More specific genres (Science Fiction, Fantasy) are listed before broader ones (Fiction).
 */
const GENRE_KEYWORDS: Record<BookGenre, string[]> = {
  'Science Fiction': [
    'science fiction',
    'sci-fi',
    'scifi',
    'dystopia',
    'cyberpunk',
    'space opera',
    'alien',
  ],
  Fantasy: ['fantasy', 'magic', 'dragon', 'wizard', 'mytholog', 'faerie', 'fae'],
  Mystery: ['mystery', 'detective', 'crime', 'thriller', 'suspense', 'noir', 'whodunit'],
  Romance: ['romance', 'love story', 'romantic', 'love stories'],
  Biography: ['biography', 'autobiography', 'memoir', 'biograph'],
  Psychology: ['psychology', 'psycholog', 'cognitive', 'behavioral', 'mental health'],
  Philosophy: ['philosophy', 'philosophi', 'ethics', 'metaphysics', 'epistemology', 'stoicism'],
  History: ['history', 'histor', 'ancient', 'medieval', 'world war', 'civil war'],
  Science: ['science', 'physics', 'chemistry', 'biology', 'mathematics', 'astronomy', 'geology'],
  Technology: [
    'technology',
    'computer',
    'programming',
    'software',
    'engineering',
    'artificial intelligence',
    'machine learning',
    'data science',
  ],
  Business: ['business', 'entrepreneur', 'management', 'marketing', 'finance', 'economics'],
  'Self-Help': [
    'self-help',
    'self help',
    'personal development',
    'productivity',
    'motivation',
    'habit',
    'mindfulness',
  ],
  'Non-Fiction': ['non-fiction', 'nonfiction', 'non fiction', 'essays', 'journalism', 'true crime'],
  Fiction: ['fiction', 'novel', 'literary fiction', 'short stories', 'literature'],
  Other: [],
}

/**
 * Detect genre from Open Library subjects via keyword matching.
 *
 * For each subject string, checks if any genre keyword appears (case-insensitive).
 * The genre with the most keyword matches wins. Ties broken by declaration order.
 *
 * @param subjects - Array of Open Library subject strings
 * @returns Best-matching genre, or 'Other' if no keywords match
 */
export function detectGenre(subjects: string[]): BookGenre {
  if (!subjects || subjects.length === 0) return 'Other'

  const scores = new Map<BookGenre, number>()
  const lowerSubjects = subjects.map(s => s.toLowerCase())

  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS) as [BookGenre, string[]][]) {
    if (keywords.length === 0) continue
    let score = 0
    for (const subject of lowerSubjects) {
      for (const keyword of keywords) {
        if (subject.includes(keyword)) {
          score++
          break // Intentional: one match per subject per genre is enough
        }
      }
    }
    if (score > 0) scores.set(genre, score)
  }

  if (scores.size === 0) return 'Other'

  // Return genre with highest score (Map iteration order = insertion order = declaration order for ties)
  let bestGenre: BookGenre = 'Other'
  let bestScore = 0
  for (const [genre, score] of scores) {
    if (score > bestScore) {
      bestScore = score
      bestGenre = genre
    }
  }

  return bestGenre
}

/** All available genres for UI dropdowns */
export const ALL_GENRES: BookGenre[] = [
  'Fiction',
  'Non-Fiction',
  'Science',
  'Technology',
  'History',
  'Biography',
  'Fantasy',
  'Mystery',
  'Romance',
  'Self-Help',
  'Philosophy',
  'Science Fiction',
  'Psychology',
  'Business',
  'Other',
]
