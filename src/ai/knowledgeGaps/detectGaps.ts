import { db } from '@/db'
import { getAIConfiguration, getDecryptedApiKey } from '@/lib/aiConfiguration'
import type { GapDetectionResult, GapItem, GapSeverity } from './types'
import './types' // Import window type declaration

const SEVERITY_ORDER: Record<GapSeverity, number> = { critical: 0, medium: 1, low: 2 }

function sortBySeverity(a: GapItem, b: GapItem): number {
  const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  if (diff !== 0) return diff
  // Secondary sort: by note ratio ascending (worse coverage first)
  const ratioA = a.videoCount > 0 ? a.noteCount / a.videoCount : 0
  const ratioB = b.videoCount > 0 ? b.noteCount / b.videoCount : 0
  return ratioA - ratioB
}

function underNotedSeverity(noteCount: number, videoCount: number): GapSeverity {
  if (noteCount === 0) return 'critical'
  if (noteCount < videoCount / 3) return 'medium'
  return 'low'
}

function skippedSeverity(watchPercentage: number): GapSeverity {
  if (watchPercentage < 25) return 'critical'
  return 'medium'
}

/**
 * Detect knowledge gaps from a learner's study data.
 *
 * Rule-based algorithm always runs. If AI is configured and
 * `knowledgeGaps` consent is enabled, the LLM enriches each gap with a
 * one-line description. On timeout or error the function returns the
 * rule-based result with `aiEnriched: false` — no exception is thrown.
 *
 * @param options.timeout - Milliseconds before AI enrichment is abandoned (default 2000)
 * @param options.signal - AbortSignal to cancel the entire operation
 */
export async function detectGaps(options: {
  timeout?: number
  signal?: AbortSignal
} = {}): Promise<GapDetectionResult> {
  const { timeout = 2000, signal } = options

  // ── Check for E2E test mock ────────────────────────────────────────────────
  if (typeof window !== 'undefined' && window.__mockKnowledgeGapsResponse) {
    return window.__mockKnowledgeGapsResponse
  }

  // ── Rule-based detection ───────────────────────────────────────────────────
  const [allNotes, allVideos, allProgress, allCourses] = await Promise.all([
    db.notes.toArray(),
    db.importedVideos.toArray(),
    db.progress.toArray(),
    db.importedCourses.toArray(),
  ])

  const courseMap = new Map(allCourses.map(c => [c.id, c]))
  const videosByCourse = new Map<string, typeof allVideos>()
  for (const v of allVideos) {
    const list = videosByCourse.get(v.courseId) ?? []
    list.push(v)
    videosByCourse.set(v.courseId, list)
  }

  // Count notes per video
  const notesByVideo = new Map<string, number>()
  for (const note of allNotes) {
    if (note.deleted) continue
    const key = `${note.courseId}:${note.videoId}`
    notesByVideo.set(key, (notesByVideo.get(key) ?? 0) + 1)
  }

  // Build progress map
  const progressMap = new Map(allProgress.map(p => [`${p.courseId}:${p.videoId}`, p]))

  const gaps: GapItem[] = []

  for (const [courseId, videos] of videosByCourse) {
    const course = courseMap.get(courseId)
    if (!course) continue
    const videoCount = videos.length
    if (videoCount === 0) continue

    for (const video of videos) {
      const key = `${courseId}:${video.id}`
      const noteCount = notesByVideo.get(key) ?? 0
      const progress = progressMap.get(key)

      // Under-noted: fewer than 1 note per 3 videos in the course
      if (noteCount < videoCount / 3) {
        gaps.push({
          courseId,
          courseTitle: course.name,
          videoId: video.id,
          videoTitle: video.filename.replace(/\.[^.]+$/, ''), // strip extension
          gapType: 'under-noted',
          severity: underNotedSeverity(noteCount, videoCount),
          noteCount,
          videoCount,
        })
        continue // don't double-flag the same video
      }

      // Skipped: marked complete but watched < 50%
      if (progress?.completedAt && progress.completionPercentage < 50) {
        gaps.push({
          courseId,
          courseTitle: course.name,
          videoId: video.id,
          videoTitle: video.filename.replace(/\.[^.]+$/, ''),
          gapType: 'skipped',
          severity: skippedSeverity(progress.completionPercentage),
          noteCount,
          videoCount,
          watchPercentage: progress.completionPercentage,
        })
      }
    }
  }

  gaps.sort(sortBySeverity)

  // ── AI enrichment (optional, non-blocking) ─────────────────────────────────
  if (gaps.length === 0) {
    return { gaps, aiEnriched: false }
  }

  const config = getAIConfiguration()
  if (config.connectionStatus !== 'connected' || !config.consentSettings.knowledgeGaps) {
    return { gaps, aiEnriched: false }
  }

  const apiKey = await getDecryptedApiKey().catch(() => null)
  if (!apiKey) {
    return { gaps, aiEnriched: false }
  }

  // Race AI enrichment against timeout
  const enriched = await Promise.race([
    enrichWithAI(gaps, config.provider, apiKey, signal),
    new Promise<null>(resolve => setTimeout(() => resolve(null), timeout)),
  ])

  if (!enriched) {
    return { gaps, aiEnriched: false }
  }

  return { gaps: enriched, aiEnriched: true }
}

async function enrichWithAI(
  gaps: GapItem[],
  provider: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<GapItem[] | null> {
  try {
    const gapSummaries = gaps.slice(0, 10).map(g => ({
      videoTitle: g.videoTitle,
      courseTitle: g.courseTitle,
      gapType: g.gapType,
      noteCount: g.noteCount,
      watchPercentage: g.watchPercentage,
    }))

    const prompt = `You are a study coach. For each learning gap below, write a 1-sentence actionable description (max 20 words) explaining why this gap matters and what the learner should do. Output ONLY valid JSON:

Gaps:
${JSON.stringify(gapSummaries, null, 2)}

Output format:
{ "descriptions": ["sentence1", "sentence2", ...] }

IMPORTANT: Return ONLY the JSON, no markdown, no extra text.`

    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500,
      }),
      signal,
    })

    if (!response.ok) return null

    const data = await response.json()
    const content: string = data.text ?? ''

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ?? content.match(/```\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : content
    const parsed = JSON.parse(jsonStr.trim()) as { descriptions: string[] }

    if (!Array.isArray(parsed.descriptions)) return null

    return gaps.map((gap, i) => ({
      ...gap,
      aiDescription: parsed.descriptions[i] ?? undefined,
    }))
  } catch {
    return null
  }
}
