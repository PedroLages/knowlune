/**
 * Rule-Based Video Grouping
 *
 * Analyzes video titles to detect natural chapter groupings using:
 * 1. Numbered sequence detection (e.g., "Lesson 1", "Part 2")
 * 2. Common prefix extraction (e.g., "React Basics - ...")
 * 3. TF-IDF keyword similarity clustering
 *
 * Falls back to a single "All Videos" chapter when:
 * - Fewer than 3 videos
 * - No meaningful patterns detected
 *
 * Story: E28-S06
 * @see YouTubeChapterEditor.tsx — consumer of this algorithm
 */

export interface GroupingVideo {
  videoId: string
  title: string
  description?: string
  duration: number // seconds
}

export interface VideoChapter {
  id: string
  title: string
  videoIds: string[]
  source: 'rule-based' | 'ai' | 'manual'
}

/**
 * Group videos into chapters using rule-based heuristics.
 * Preserves original playlist order within each chapter.
 */
export function groupVideosByRules(videos: GroupingVideo[]): VideoChapter[] {
  // Fewer than 3 videos — single chapter
  if (videos.length < 3) {
    return [makeSingleChapter(videos)]
  }

  // Strategy 1: Numbered sequence detection
  const numberedGroups = detectNumberedSequences(videos)
  if (numberedGroups.length > 1) {
    return numberedGroups
  }

  // Strategy 2: Common prefix grouping
  const prefixGroups = detectCommonPrefixes(videos)
  if (prefixGroups.length > 1) {
    return prefixGroups
  }

  // Strategy 3: TF-IDF keyword clustering
  const keywordGroups = clusterByKeywords(videos)
  if (keywordGroups.length > 1 && keywordGroups.length <= Math.ceil(videos.length / 2)) {
    return keywordGroups
  }

  // Fallback: single chapter
  return [makeSingleChapter(videos)]
}

// --- Strategy 1: Numbered Sequences ---

/** Patterns like "Lesson 1", "Part 2", "Chapter 3", "#4", "01.", "1." etc. */
const NUMBERED_PATTERNS = [
  /(?:lesson|part|chapter|module|section|episode|ep\.?|lec\.?|unit)\s*[#]?\s*(\d+)/i,
  /^(\d+)\.\s/,
  /^#(\d+)\s/,
  /\b(\d+)\s*[-–—:]\s/,
]

/**
 * Detect numbered series prefixes (e.g., "React Basics - Part 1: ...").
 * Groups videos sharing the same series prefix.
 */
function detectNumberedSequences(videos: GroupingVideo[]): VideoChapter[] {
  const groups = new Map<string, GroupingVideo[]>()

  for (const video of videos) {
    let matched = false
    for (const pattern of NUMBERED_PATTERNS) {
      const match = video.title.match(pattern)
      if (match) {
        // Extract the prefix before the number for grouping
        const prefixEnd = video.title.indexOf(match[0])
        const prefix = video.title.slice(0, prefixEnd).replace(/[-–—:,\s]+$/, '').trim()
        const groupKey = prefix || 'Series'
        if (!groups.has(groupKey)) groups.set(groupKey, [])
        groups.get(groupKey)!.push(video)
        matched = true
        break
      }
    }
    if (!matched) {
      const key = '__ungrouped__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(video)
    }
  }

  // Only return if we found meaningful groups (at least one with >1 video)
  const meaningfulGroups = [...groups.entries()].filter(
    ([key]) => key !== '__ungrouped__'
  )
  if (meaningfulGroups.length === 0) return []

  const chapters: VideoChapter[] = []
  let chapterIdx = 0
  for (const [key, vids] of groups) {
    const title = key === '__ungrouped__' ? 'Other Videos' : key || 'Series'
    chapters.push({
      id: `chapter-${chapterIdx++}`,
      title,
      videoIds: vids.map(v => v.videoId),
      source: 'rule-based',
    })
  }

  return chapters.length > 1 ? chapters : []
}

// --- Strategy 2: Common Prefix ---

/**
 * Group videos by shared title prefixes.
 * E.g., "React Hooks - useState", "React Hooks - useEffect" → "React Hooks"
 */
function detectCommonPrefixes(videos: GroupingVideo[]): VideoChapter[] {
  const SEPARATORS = /\s*[-–—:|]\s*/

  const groups = new Map<string, GroupingVideo[]>()

  for (const video of videos) {
    const parts = video.title.split(SEPARATORS)
    const prefix = parts.length > 1 ? parts[0].trim() : null

    if (prefix && prefix.length >= 3) {
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix)!.push(video)
    } else {
      const key = '__ungrouped__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(video)
    }
  }

  // Only use prefix grouping if at least 2 groups with 2+ videos each
  const meaningfulGroups = [...groups.entries()].filter(
    ([key, vids]) => key !== '__ungrouped__' && vids.length >= 2
  )
  if (meaningfulGroups.length < 2) return []

  const chapters: VideoChapter[] = []
  let chapterIdx = 0
  for (const [key, vids] of groups) {
    const title = key === '__ungrouped__' ? 'Other Videos' : key
    chapters.push({
      id: `chapter-${chapterIdx++}`,
      title,
      videoIds: vids.map(v => v.videoId),
      source: 'rule-based',
    })
  }

  return chapters
}

// --- Strategy 3: TF-IDF Keyword Clustering ---

/** Stop words to filter from TF-IDF analysis */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'this', 'that', 'are', 'was',
  'be', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'how', 'what', 'why', 'when',
  'where', 'who', 'which', 'part', 'lesson', 'chapter', 'episode',
  'tutorial', 'introduction', 'intro', 'video', 'full', 'complete',
])

/** Tokenize a string into lowercase words, filtering stop words and short tokens */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

/** Compute TF-IDF vectors for documents */
function computeTfIdf(documents: string[][]): Map<number, Map<string, number>> {
  const docCount = documents.length
  // Document frequency
  const df = new Map<string, number>()
  for (const doc of documents) {
    const seen = new Set(doc)
    for (const word of seen) {
      df.set(word, (df.get(word) || 0) + 1)
    }
  }

  const vectors = new Map<number, Map<string, number>>()
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]
    const tf = new Map<string, number>()
    for (const word of doc) {
      tf.set(word, (tf.get(word) || 0) + 1)
    }

    const tfidf = new Map<string, number>()
    for (const [word, count] of tf) {
      const idf = Math.log(docCount / (df.get(word) || 1))
      tfidf.set(word, (count / doc.length) * idf)
    }
    vectors.set(i, tfidf)
  }

  return vectors
}

/** Cosine similarity between two TF-IDF vectors */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (const [word, va] of a) {
    normA += va * va
    const vb = b.get(word)
    if (vb !== undefined) dot += va * vb
  }
  for (const [, vb] of b) normB += vb * vb

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom > 0 ? dot / denom : 0
}

/**
 * Simple agglomerative clustering using cosine similarity on TF-IDF vectors.
 * Merges the two most similar clusters until similarity drops below threshold.
 */
function clusterByKeywords(videos: GroupingVideo[]): VideoChapter[] {
  const documents = videos.map(v => {
    const titleTokens = tokenize(v.title)
    const descTokens = v.description ? tokenize(v.description).slice(0, 20) : []
    return [...titleTokens, ...descTokens]
  })

  // Filter out empty documents
  if (documents.every(d => d.length === 0)) return []

  const vectors = computeTfIdf(documents)

  // Initialize clusters: each video in its own cluster
  type Cluster = { indices: number[] }
  let clusters: Cluster[] = videos.map((_, i) => ({ indices: [i] }))

  const SIMILARITY_THRESHOLD = 0.15
  const MAX_CLUSTERS = Math.min(5, Math.ceil(videos.length / 2))

  // Agglomerative: merge most similar clusters
  while (clusters.length > MAX_CLUSTERS) {
    let bestSim = -1
    let bestI = -1
    let bestJ = -1

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = clusterSimilarity(clusters[i], clusters[j], vectors)
        if (sim > bestSim) {
          bestSim = sim
          bestI = i
          bestJ = j
        }
      }
    }

    if (bestSim < SIMILARITY_THRESHOLD) break

    // Merge bestJ into bestI
    clusters[bestI] = {
      indices: [...clusters[bestI].indices, ...clusters[bestJ].indices],
    }
    clusters.splice(bestJ, 1)
  }

  // Filter out single-video clusters if we have enough groups
  // Merge singletons into closest cluster
  if (clusters.length > 1) {
    const singletons: Cluster[] = []
    const multiClusters: Cluster[] = []
    for (const c of clusters) {
      if (c.indices.length === 1) singletons.push(c)
      else multiClusters.push(c)
    }

    if (multiClusters.length >= 2) {
      // Merge singletons into nearest multi-cluster
      for (const singleton of singletons) {
        let bestSim = -1
        let bestCluster = 0
        for (let i = 0; i < multiClusters.length; i++) {
          const sim = clusterSimilarity(singleton, multiClusters[i], vectors)
          if (sim > bestSim) {
            bestSim = sim
            bestCluster = i
          }
        }
        multiClusters[bestCluster].indices.push(...singleton.indices)
      }
      clusters = multiClusters
    }
  }

  if (clusters.length <= 1) return []

  // Sort indices within each cluster to preserve original order
  const chapters: VideoChapter[] = clusters.map((cluster, idx) => {
    const sortedIndices = [...cluster.indices].sort((a, b) => a - b)
    const clusterVideos = sortedIndices.map(i => videos[i])

    // Name the chapter by top keywords
    const allTokens = clusterVideos.flatMap(v => tokenize(v.title))
    const freq = new Map<string, number>()
    for (const token of allTokens) {
      freq.set(token, (freq.get(token) || 0) + 1)
    }
    const topWords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w[0].toUpperCase() + w.slice(1))

    const title = topWords.length > 0 ? topWords.join(', ') : `Chapter ${idx + 1}`

    return {
      id: `chapter-${idx}`,
      title,
      videoIds: sortedIndices.map(i => videos[i].videoId),
      source: 'rule-based' as const,
    }
  })

  return chapters
}

/** Average-link similarity between two clusters */
function clusterSimilarity(
  a: { indices: number[] },
  b: { indices: number[] },
  vectors: Map<number, Map<string, number>>
): number {
  let totalSim = 0
  let count = 0
  for (const i of a.indices) {
    for (const j of b.indices) {
      const va = vectors.get(i)
      const vb = vectors.get(j)
      if (va && vb) {
        totalSim += cosineSimilarity(va, vb)
        count++
      }
    }
  }
  return count > 0 ? totalSim / count : 0
}

/** Create a single "All Videos" chapter containing all videos */
function makeSingleChapter(videos: GroupingVideo[]): VideoChapter {
  return {
    id: 'chapter-0',
    title: 'All Videos',
    videoIds: videos.map(v => v.videoId),
    source: 'rule-based',
  }
}

/** Generate a simple unique ID for new chapters */
export function generateChapterId(): string {
  return `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
