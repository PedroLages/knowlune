/**
 * hydrateP3P4.ts — E96-S02 fan-out hydrator for P3/P4 LWW tables.
 *
 * On sign-in (`SIGNED_IN` / `INITIAL_SESSION`), pulls the current user's rows
 * for each of the 9 LWW tables from Supabase in parallel and dispatches them
 * into the corresponding Dexie store's `hydrateFromRemote` setter.
 *
 * **Insert-only tables are intentionally skipped**:
 *   - `quizAttempts` (append-only analytics)
 *   - `aiUsageEvents` (append-only analytics)
 *
 * For these tables the remote is authoritative and historical rows never
 * round-trip back to the client. See plan §"Scope Boundaries" — no backfill
 * of historical analytics rows.
 *
 * **Echo-loop guard**: every store's `hydrateFromRemote` writes Dexie via
 * `bulkPut` (not `syncableWrite`). This orchestrator therefore enqueues zero
 * `syncQueue` rows on a full hydration pass. The p3-p4-hydrate-fanout
 * integration test asserts this invariant directly.
 *
 * **Error posture**: `Promise.allSettled` — a single table query rejection
 * does NOT cancel the remaining 8. Failures are logged to `console.error` for
 * beta observability; the call resolves to `undefined` regardless. This
 * matches the `hydrateSettingsFromSupabase` error posture in `@/lib/settings`.
 *
 * @module hydrateP3P4
 * @since E96-S02
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/auth/supabase'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useStudyScheduleStore } from '@/stores/useStudyScheduleStore'
import { useChallengeStore } from '@/stores/useChallengeStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { hydrateCourseRemindersFromRemote } from '@/lib/courseReminders'
import { toCamelCase } from '@/lib/sync/fieldMapper'
import { tableRegistry } from '@/lib/sync/tableRegistry'
import type { TableRegistryEntry } from '@/lib/sync/tableRegistry'
import type {
  LearningPath,
  LearningPathEntry,
  Challenge,
  CourseReminder,
  Notification,
  StudySchedule,
} from '@/data/types'

type SupabaseRow = Record<string, unknown>

/**
 * Fetches all rows from a Supabase table for a given user and maps them back
 * to camelCase Dexie records via the existing `fromSnakeCase` translator.
 * Returns `[]` on any query error (logged and swallowed).
 */
async function fetchTableRows(
  client: SupabaseClient,
  dexieTable: string,
  userId: string,
): Promise<SupabaseRow[]> {
  const entry = tableRegistry.find(e => e.dexieTable === dexieTable) as
    | TableRegistryEntry
    | undefined
  if (!entry) {
    console.error(`[hydrateP3P4] Unknown dexieTable: ${dexieTable}`)
    return []
  }
  const { data, error } = await client
    .from(entry.supabaseTable)
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error(
      `[hydrateP3P4] Supabase query failed for ${entry.supabaseTable}:`,
      error,
    )
    return []
  }

  return (data ?? []).map(row =>
    toCamelCase(entry, row as Record<string, unknown>),
  )
}

/**
 * Hydrate the 9 P3/P4 LWW Dexie stores from Supabase.
 *
 * Runs all 9 queries in parallel via `Promise.allSettled` — a single failure
 * does not cancel the remaining queries.
 *
 * No-op if `userId` is falsy (no signed-in user).
 */
export async function hydrateP3P4FromSupabase(userId: string | null | undefined): Promise<void> {
  if (!userId) return
  if (!supabase) return

  const client = supabase

  // Dispatch all 9 table queries in parallel. Each resolves to `undefined`
  // on success (side-effect only) or catches its own error below.
  await Promise.allSettled([
    // learningPaths + learningPathEntries — single hydrate call for both.
    (async () => {
      const [paths, entries] = await Promise.all([
        fetchTableRows(client, 'learningPaths', userId),
        fetchTableRows(client, 'learningPathEntries', userId),
      ])
      await useLearningPathStore.getState().hydrateFromRemote({
        paths: paths as unknown as LearningPath[],
        entries: entries as unknown as LearningPathEntry[],
      })
    })(),
    (async () => {
      const rows = await fetchTableRows(client, 'studySchedules', userId)
      await useStudyScheduleStore
        .getState()
        .hydrateFromRemote(rows as unknown as StudySchedule[])
    })(),
    (async () => {
      const rows = await fetchTableRows(client, 'challenges', userId)
      await useChallengeStore.getState().hydrateFromRemote(rows as unknown as Challenge[])
    })(),
    (async () => {
      const rows = await fetchTableRows(client, 'courseReminders', userId)
      await hydrateCourseRemindersFromRemote(rows as unknown as CourseReminder[])
    })(),
    (async () => {
      const rows = await fetchTableRows(client, 'notifications', userId)
      await useNotificationStore.getState().hydrateFromRemote(rows as unknown as Notification[])
    })(),
    // `quizzes` — LWW collection. No store-owned hydrate exists today; a
    // future story that introduces a `useQuizStore.hydrateFromRemote` should
    // add the dispatch here. For E96-S02 we intentionally skip quizzes so
    // the orchestrator only touches tables with a defined hydrate contract.
    // careerPaths / pathEnrollments — no write sites and no store-owned
    // hydrate yet; see plan Unit 6 / tableRegistry.ts deferral note. Skipped
    // intentionally. When added, wire them through here.
  ])

  // Insert-only tables (quizAttempts, aiUsageEvents) are NEVER hydrated —
  // remote is authoritative; the local ledger stays as-is.
}
