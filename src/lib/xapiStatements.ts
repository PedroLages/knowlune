/**
 * xAPI (Experience API) statement generator for LevelUp data export.
 *
 * Transforms existing learning data into xAPI-compliant statements
 * following the Actor + Verb + Object structure.
 *
 * Reference: https://github.com/adlnet/xAPI-Spec
 * Verb IRIs: https://registry.tincanapi.com/
 */
import type { StudySession, ContentProgress, Challenge } from '@/data/types'
import { db } from '@/db/schema'
import { getSettings } from './settings'
import type { ExportProgressCallback } from './exportService'

// --- xAPI Types ---

interface XAPIActor {
  objectType: 'Agent'
  name: string
  account: {
    homePage: string
    name: string
  }
}

interface XAPIVerb {
  id: string
  display: { 'en-US': string }
}

interface XAPIObject {
  id: string
  objectType: 'Activity'
  definition: {
    name: { 'en-US': string }
    type: string
  }
}

interface XAPIResult {
  duration?: string
  completion?: boolean
  score?: { scaled: number }
}

export interface XAPIStatement {
  actor: XAPIActor
  verb: XAPIVerb
  object: XAPIObject
  result?: XAPIResult
  timestamp: string
}

// --- Standard xAPI Verbs (ADL registry) ---

const VERBS = {
  experienced: {
    id: 'http://adlnet.gov/expapi/verbs/experienced',
    display: { 'en-US': 'experienced' },
  },
  completed: {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'en-US': 'completed' },
  },
  progressed: {
    id: 'http://adlnet.gov/expapi/verbs/progressed',
    display: { 'en-US': 'progressed' },
  },
} as const

// --- Activity Types ---

const ACTIVITY_TYPES = {
  lesson: 'http://adlnet.gov/expapi/activities/lesson',
  module: 'http://adlnet.gov/expapi/activities/module',
  course: 'http://adlnet.gov/expapi/activities/course',
  assessment: 'http://adlnet.gov/expapi/activities/assessment',
} as const

// --- Helpers ---

function createActor(): XAPIActor {
  const settings = getSettings()
  return {
    objectType: 'Agent',
    name: settings.displayName,
    account: {
      homePage: 'app://levelup',
      name: settings.displayName.toLowerCase().replace(/\s+/g, '-'),
    },
  }
}

/** Convert seconds to ISO 8601 duration (e.g., PT1H30M) */
function secondsToIsoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  let duration = 'PT'
  if (h > 0) duration += `${h}H`
  if (m > 0) duration += `${m}M`
  if (s > 0 || duration === 'PT') duration += `${s}S`
  return duration
}

// --- Statement Generators ---

export function sessionToXAPI(session: StudySession): XAPIStatement {
  const isComplete = session.endTime !== undefined
  const actor = createActor()

  return {
    actor,
    verb: isComplete ? VERBS.completed : VERBS.experienced,
    object: {
      id: `app://levelup/courses/${session.courseId}/lessons/${session.contentItemId}`,
      objectType: 'Activity',
      definition: {
        name: { 'en-US': `Lesson ${session.contentItemId}` },
        type: ACTIVITY_TYPES.lesson,
      },
    },
    result: {
      duration: secondsToIsoDuration(session.duration),
      completion: isComplete,
      ...(session.qualityScore !== undefined && {
        score: { scaled: session.qualityScore / 100 },
      }),
    },
    timestamp: session.startTime,
  }
}

export function progressToXAPI(progress: ContentProgress): XAPIStatement {
  const actor = createActor()

  return {
    actor,
    verb: progress.status === 'completed' ? VERBS.completed : VERBS.progressed,
    object: {
      id: `app://levelup/courses/${progress.courseId}/items/${progress.itemId}`,
      objectType: 'Activity',
      definition: {
        name: { 'en-US': `Content ${progress.itemId}` },
        type: ACTIVITY_TYPES.module,
      },
    },
    result: {
      completion: progress.status === 'completed',
    },
    timestamp: progress.updatedAt,
  }
}

export function challengeToXAPI(challenge: Challenge): XAPIStatement | null {
  if (!challenge.completedAt) return null

  const actor = createActor()

  return {
    actor,
    verb: VERBS.completed,
    object: {
      id: `app://levelup/challenges/${challenge.id}`,
      objectType: 'Activity',
      definition: {
        name: { 'en-US': challenge.name },
        type: ACTIVITY_TYPES.assessment,
      },
    },
    result: {
      completion: true,
      score: { scaled: 1.0 },
    },
    timestamp: challenge.completedAt,
  }
}

// --- Bulk Export ---

export async function exportAsXAPI(onProgress?: ExportProgressCallback): Promise<XAPIStatement[]> {
  const statements: XAPIStatement[] = []

  onProgress?.(0, 'Loading sessions for xAPI...')
  const sessions = await db.studySessions.toArray()
  for (const session of sessions) {
    statements.push(sessionToXAPI(session))
  }

  onProgress?.(33, 'Loading progress for xAPI...')
  const progress = await db.contentProgress.toArray()
  for (const p of progress) {
    statements.push(progressToXAPI(p))
  }

  onProgress?.(66, 'Loading challenges for xAPI...')
  const challenges = await db.challenges.toArray()
  for (const challenge of challenges) {
    const stmt = challengeToXAPI(challenge)
    if (stmt) statements.push(stmt)
  }

  // Sort by timestamp
  statements.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  onProgress?.(100, 'Complete')
  return statements
}
