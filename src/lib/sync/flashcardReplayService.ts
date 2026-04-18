/**
 * flashcardReplayService — E93-S04
 *
 * Reconstructs FSRS card state from the append-only `flashcard_reviews` event
 * log in Supabase. Rather than using a raw LWW overwrite of derived scheduling
 * fields, this service fetches all review events for a card in chronological
 * order and replays them sequentially via `calculateNextReview` with `fsrsTest`
 * (deterministic, no fuzz) to produce an idempotent result across all devices.
 *
 * Why `fsrsTest` (not the production `fsrs` instance) for replay:
 *   - FSRS with fuzz adds randomized jitter to intervals, making results
 *     non-deterministic across time and location.
 *   - Replay must produce the same FSRS state regardless of when or where it
 *     runs — determinism is the correctness requirement for event-log replay.
 *   - Production scheduling on NEW ratings continues to use the `fsrs` instance
 *     (with fuzz) in `useFlashcardStore.rateFlashcard`. Only replay uses `fsrsTest`.
 *
 * Replay is non-fatal: if Supabase is unavailable, the card retains its
 * pre-replay LWW state and will be corrected on the next sync + replay cycle.
 *
 * @module flashcardReplayService
 * @since E93-S04
 */

import { db } from '@/db'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { syncableWrite, type SyncableRecord } from './syncableWrite'
import { calculateNextReview, fsrsTest } from '@/lib/spacedRepetition'
import type { ReviewRating } from '@/data/types'

// ---------------------------------------------------------------------------
// Replay function
// ---------------------------------------------------------------------------

/**
 * Fetch all review events for a flashcard from Supabase and replay them in
 * chronological order via `calculateNextReview(fsrsTest)` to reconstruct the
 * correct FSRS scheduling state. Writes the reconstructed state back to Dexie
 * via `syncableWrite` with `skipQueue: true` (the card was just downloaded —
 * re-enqueueing it would trigger a redundant upload cycle).
 *
 * Guard conditions (returns early without writing):
 *   - `supabase` client is null (env vars missing)
 *   - User is not authenticated
 *   - Supabase returns zero reviews (new card, or E93-S01 not yet deployed)
 *   - Supabase fetch returns an error (non-fatal — card keeps LWW state)
 *   - The card is not found in local Dexie (should not happen in normal flow)
 *
 * @param flashcardId - UUID of the flashcard whose review log should be replayed
 */
export async function replayFlashcardReviews(flashcardId: string): Promise<void> {
  // Guard: supabase client must be available.
  if (!supabase) {
    return
  }

  // Guard: user must be authenticated — replay fetches user-specific events.
  const userId = useAuthStore.getState().user?.id
  if (!userId) {
    return
  }

  // Fetch all review events for this card in chronological order.
  // reviewed_at is the canonical ordering column (device-local clock at review time).
  const { data: reviews, error } = await supabase
    .from('flashcard_reviews')
    .select('*')
    .eq('flashcard_id', flashcardId)
    .eq('user_id', userId)
    .order('reviewed_at', { ascending: true })

  if (error) {
    console.warn(
      `[flashcardReplayService] Supabase fetch failed for card "${flashcardId}" — keeping LWW state:`,
      error.message,
    )
    return
  }

  // Guard: no reviews → card has never been reviewed, or E93-S01 not deployed yet.
  if (!reviews || reviews.length === 0) {
    return
  }

  // Replay all review events in order, accumulating FSRS state.
  // Initial state: null (brand-new card with default FSRS fields).
  // Each call's output card becomes the next call's input.
  // fsrsTest (no fuzz) ensures identical output regardless of when/where replay runs.
  let accState = null
  for (const review of reviews) {
    accState = calculateNextReview(
      accState,
      review.rating as ReviewRating,
      new Date(review.reviewed_at as string),
      fsrsTest,
    )
  }

  // accState is guaranteed non-null here (reviews.length > 0).
  // TypeScript cannot infer this; the non-null assertion is safe.
  const fsrsState = accState!

  // Read the existing local card — must exist because the download phase wrote it
  // immediately before calling replayFlashcardReviews.
  const existingCard = await db.flashcards.get(flashcardId)
  if (!existingCard) {
    console.warn(
      `[flashcardReplayService] Card "${flashcardId}" not found in Dexie — skipping replay write.`,
    )
    return
  }

  // Merge: spread existingCard first to preserve non-FSRS fields (front, back,
  // courseId, noteId, etc.), then spread fsrsState to overwrite all FSRS
  // scheduling fields with the replayed values.
  const mergedCard = {
    ...existingCard,
    ...fsrsState,
  }

  // Write replayed state back to Dexie without enqueueing for upload.
  // skipQueue: true — the card was just downloaded; re-enqueueing would cause
  // an upload cycle that overwrites the server copy with the same data.
  await syncableWrite('flashcards', 'put', mergedCard as unknown as SyncableRecord, { skipQueue: true })
}
