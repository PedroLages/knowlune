// E119-S06: Export Worker Edge Function
// Handles: POST /functions/v1/export-worker
// Auth: X-Worker-Secret header (internal service-to-service, not user JWT)
//
// Picks up the oldest queued export job from the export_jobs table,
// builds the ZIP archive (same data as the inline export-data path),
// uploads it to the 'exports' Storage bucket, creates a 7-day signed URL,
// and emails the user.
//
// Retry logic:
//   - attempt_count is incremented BEFORE processing begins.
//   - If attempt_count reaches 2 at the start of a processing attempt,
//     the job is marked failed and a failure email is sent immediately
//     (i.e., maximum 2 attempts: attempt_count 1 and 2).
//   - On exception: if attempt_count < 2 after increment, job is re-queued.
//     If attempt_count >= 2, job is failed.
//
// De-duplication:
//   The export_jobs_active_unique partial index prevents two active jobs
//   per user. De-duplication is enforced at the export-data (enqueue) level.
//   This worker simply processes whichever job it dequeues.
//
// Registry-driven: TABLE_NAMES and STORAGE_BUCKETS must stay in sync with
//   src/lib/sync/tableRegistry.ts and supabase/functions/export-data/index.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Zip, ZipDeflate } from 'https://esm.sh/fflate@0.8.2'
import { sendEmail } from '../_shared/sendEmail.ts'
import { exportReadyEmail, exportFailedEmail } from '../_shared/emailTemplates.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * GDPR export signed URL TTL: 7 days in seconds.
 * Must match the retention-tick (S11) purge window for the 'exports' bucket.
 */
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60 // 604800

/**
 * Maximum attempts before a job is permanently failed.
 * Attempt 1: initial worker run. Attempt 2: retry. Fail after 2.
 */
const MAX_ATTEMPTS = 2

/**
 * Ordered list of Supabase table names — mirrors tableRegistry.ts (P0→P4).
 *
 * IMPORTANT: This list must stay in sync with:
 *   - src/lib/sync/tableRegistry.ts → tableRegistry / ERASURE_TABLE_NAMES
 *   - supabase/functions/export-data/index.ts → TABLE_NAMES
 *   - supabase/functions/_shared/hardDeleteUser.ts → TABLE_NAMES
 */
const TABLE_NAMES: string[] = [
  // P0 — Core progress / session data
  'content_progress',
  'study_sessions',
  'video_progress',
  // P1 — Notes, flashcards, annotations, AI learning data
  'notes',
  'bookmarks',
  'flashcards',
  'review_records',
  'embeddings',
  'book_highlights',
  'vocabulary_items',
  'audio_bookmarks',
  'audio_clips',
  'chat_conversations',
  'learner_models',
  // P2 — Imported content metadata, books, shelves
  'imported_courses',
  'imported_videos',
  'imported_pdfs',
  'authors',
  'books',
  'book_reviews',
  'shelves',
  'book_shelves',
  'reading_queue',
  'chapter_mappings',
  // P3 — Learning paths, scheduling, notifications, integrations
  'learning_paths',
  'learning_path_entries',
  'challenges',
  'course_reminders',
  'notifications',
  'career_paths',
  'path_enrollments',
  'study_schedules',
  'opds_catalogs',
  'audiobookshelf_servers',
  'notification_preferences',
  // P4 — Analytics / append-only events, quizzes
  'quizzes',
  'quiz_attempts',
  'ai_usage_events',
]

/** Storage buckets containing user-prefixed objects. */
const STORAGE_BUCKETS: string[] = ['avatars', 'course-media', 'audio', 'exports']

/**
 * Vault fields that MUST NOT appear in the export.
 * Must stay in sync with export-data/index.ts → VAULT_FIELDS.
 */
const VAULT_FIELDS: Record<string, string[]> = {
  opds_catalogs: ['password'],
  audiobookshelf_servers: ['api_key'],
}

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// Shared secret for service-to-service auth. Set the same value in both
// this function's env and in export-data's env as EXPORT_WORKER_SECRET.
const EXPORT_WORKER_SECRET = Deno.env.get('EXPORT_WORKER_SECRET')

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

// Service-role admin client — bypasses RLS for all job management operations.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportJob {
  id: string
  user_id: string
  request_id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  attempt_count: number
  created_at: string
  updated_at: string
  completed_at: string | null
  signed_url: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stripVaultFields(row: Record<string, unknown>, table: string): void {
  const fields = VAULT_FIELDS[table]
  if (!fields) return
  for (const field of fields) {
    delete row[field]
  }
}

/**
 * Dequeue the oldest queued job.
 *
 * Uses a simple SELECT ORDER BY created_at LIMIT 1. This is safe for the
 * solo-operator deployment where concurrent worker invocations are unlikely.
 * If concurrent safety is needed in the future, add a `dequeue_export_job`
 * Postgres function using FOR UPDATE SKIP LOCKED and call it via RPC.
 */
async function dequeueJob(): Promise<ExportJob | null> {
  const { data, error } = await supabaseAdmin
    .from('export_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[export-worker] dequeue SELECT error:', error.message)
    return null
  }

  return data as ExportJob | null
}

/**
 * Build a ZIP archive buffer for the given user.
 * Returns a Uint8Array of the complete ZIP, or throws on fatal error.
 */
async function buildZipBuffer(userId: string, requestId: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const exportedAt = new Date().toISOString()

  // ── Collect table data ──────────────────────────────────────────────────────
  const tableData: Record<string, unknown[]> = {}
  const tableCounts: Record<string, number> = {}
  const tablesWithVaultStrip: string[] = []

  for (const table of TABLE_NAMES) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`RLS error on table ${table}: ${error.message}`)
    }

    const rows = (data ?? []) as Record<string, unknown>[]
    let anyStripped = false
    const processed = rows.map(row => {
      const r = { ...row, _origin: 'server' as const }
      const before = Object.keys(r).length
      stripVaultFields(r as Record<string, unknown>, table)
      if (Object.keys(r).length < before) anyStripped = true
      return r
    })

    if (anyStripped) tablesWithVaultStrip.push(table)
    tableData[table] = processed
    tableCounts[table] = processed.length
  }

  // ── Collect Storage object metadata ────────────────────────────────────────
  const bucketCounts: Record<string, number> = {}
  const storageObjects: Record<string, Array<{ key: string; size: number }>> = {}

  for (const bucket of STORAGE_BUCKETS) {
    const allObjects: Array<{ key: string; size: number }> = []
    let offset = 0
    const pageSize = 1000

    while (true) {
      const { data: page, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(userId + '/', { limit: pageSize, offset })

      if (error || !page) break

      for (const obj of page) {
        allObjects.push({ key: obj.name, size: obj.metadata?.size ?? 0 })
      }

      if (page.length < pageSize) break
      offset += pageSize
    }

    storageObjects[bucket] = allObjects
    bucketCounts[bucket] = allObjects.length
  }

  // ── Build README manifest ───────────────────────────────────────────────────
  const readmeLines = [
    '# Knowlune Data Export',
    '',
    '## Export Details',
    '',
    `- **Exported at:** ${exportedAt}`,
    `- **Request ID:** ${requestId}`,
    `- **Export type:** async (large dataset)`,
    '',
    '## Table Row Counts',
    '',
  ]

  for (const [table, count] of Object.entries(tableCounts)) {
    const vaultNote = tablesWithVaultStrip.includes(table)
      ? ' *(credentials omitted for security)*'
      : ''
    readmeLines.push(`- \`${table}\`: ${count} row(s)${vaultNote}`)
  }

  readmeLines.push('', '## Storage Bucket Object Counts', '')
  for (const [bucket, count] of Object.entries(bucketCounts)) {
    readmeLines.push(`- \`${bucket}\`: ${count} object(s)`)
  }

  readmeLines.push(
    '',
    '---',
    '',
    '*This export was generated in compliance with GDPR Articles 15 and 20.*'
  )

  const readmeContent = readmeLines.join('\n')

  // ── Stream ZIP into a buffer ────────────────────────────────────────────────
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = []

    const zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err)
        return
      }
      chunks.push(chunk)
      if (final) {
        // Concatenate all chunks into a single buffer.
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
        const buffer = new Uint8Array(totalLength)
        let offset = 0
        for (const c of chunks) {
          buffer.set(c, offset)
          offset += c.length
        }
        resolve(buffer)
      }
    })

    // data.json
    const dataJsonBytes = encoder.encode(JSON.stringify(tableData, null, 2))
    const dataJsonEntry = new ZipDeflate('data.json', { level: 6 })
    zip.add(dataJsonEntry)
    dataJsonEntry.push(dataJsonBytes, true)

    // media/<bucket>/<key>
    const skippedFiles: string[] = []

    // We need to handle async downloads inside a sync ZIP callback context.
    // Build a promise chain for all downloads, then end the ZIP after.
    const downloadPromises: Array<Promise<void>> = []

    for (const bucket of STORAGE_BUCKETS) {
      const objects = storageObjects[bucket] ?? []
      for (const obj of objects) {
        const rawPath = `media/${bucket}/${obj.key}`
        const safePath = rawPath
          .replace(/\.\.\//g, '')
          .replace(/^\/+/, '')
          .replace(/[<>:"\\|?*]/g, '_')

        const p = supabaseAdmin.storage
          .from(bucket)
          .download(`${userId}/${obj.key}`)
          .then(async ({ data: fileData, error: downloadError }) => {
            if (downloadError || !fileData) {
              console.warn(
                `[export-worker] failed to download ${bucket}/${obj.key}:`,
                downloadError?.message
              )
              skippedFiles.push(rawPath)
              return
            }
            const fileBytes = new Uint8Array(await fileData.arrayBuffer())
            const fileEntry = new ZipDeflate(safePath, { level: 1 })
            zip.add(fileEntry)
            fileEntry.push(fileBytes, true)
          })

        downloadPromises.push(p)
      }
    }

    // After all downloads complete, add remaining entries and end the ZIP.
    Promise.all(downloadPromises)
      .then(() => {
        // skipped-files.txt
        if (skippedFiles.length > 0) {
          const skippedContent = [
            '# Skipped Files',
            '',
            'The following files could not be downloaded:',
            '',
            ...skippedFiles.map(f => `- ${f}`),
            '',
            'Please contact support if you need these files.',
          ].join('\n')
          const skippedBytes = encoder.encode(skippedContent)
          const skippedEntry = new ZipDeflate('skipped-files.txt', { level: 6 })
          zip.add(skippedEntry)
          skippedEntry.push(skippedBytes, true)
        }

        // README.md
        const readmeBytes = encoder.encode(readmeContent)
        const readmeEntry = new ZipDeflate('README.md', { level: 6 })
        zip.add(readmeEntry)
        readmeEntry.push(readmeBytes, true)

        zip.end()
      })
      .catch(reject)
  })
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Only POST allowed
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  // ── Auth: shared secret ───────────────────────────────────────────────────
  const incomingSecret = req.headers.get('X-Worker-Secret')
  if (EXPORT_WORKER_SECRET) {
    if (!incomingSecret || incomingSecret !== EXPORT_WORKER_SECRET) {
      console.error('[export-worker] unauthorized — invalid or missing X-Worker-Secret')
      return json({ success: false, error: 'Unauthorized' }, 401)
    }
  } else {
    // EXPORT_WORKER_SECRET not set — warn but allow (dev/test environment).
    console.warn(
      '[export-worker] EXPORT_WORKER_SECRET not set — skipping auth check. ' +
        'Set this env var in production to secure the worker endpoint.'
    )
  }

  try {
    // ── Dequeue oldest queued job ───────────────────────────────────────────
    const job = await dequeueJob()

    if (!job) {
      console.log('[export-worker] no queued jobs found — no-op')
      return json({ status: 'no-op' })
    }

    console.log(
      `[export-worker] picked up job ${job.id} for user ${job.user_id}, ` +
        `attempt_count=${job.attempt_count}`
    )

    // ── Increment attempt_count + mark processing ───────────────────────────
    const newAttemptCount = job.attempt_count + 1

    const { error: updateToProcessingError } = await supabaseAdmin
      .from('export_jobs')
      .update({
        status: 'processing',
        attempt_count: newAttemptCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    if (updateToProcessingError) {
      console.error(
        '[export-worker] failed to mark job processing:',
        updateToProcessingError.message
      )
      return json({ success: false, error: 'Failed to claim job' }, 500)
    }

    // ── Guard: too many attempts → fail immediately ─────────────────────────
    if (newAttemptCount > MAX_ATTEMPTS) {
      console.error(
        `[export-worker] job ${job.id} exceeded max attempts (${MAX_ATTEMPTS}) — failing`
      )

      await supabaseAdmin
        .from('export_jobs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', job.id)

      // Fetch user email for failure notification.
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(job.user_id)
      const userEmail = userData?.user?.email

      if (userEmail) {
        const emailResult = await sendEmail({ to: userEmail, ...exportFailedEmail() })
        if (!emailResult.sent && !('skipped' in emailResult)) {
          console.error('[export-worker] failed to send failure email:', emailResult)
        }
      } else {
        console.warn(`[export-worker] no email found for user ${job.user_id} — failure email not sent`)
      }

      return json({ status: 'failed', jobId: job.id })
    }

    // ── Build ZIP ───────────────────────────────────────────────────────────
    let zipBuffer: Uint8Array
    try {
      zipBuffer = await buildZipBuffer(job.user_id, job.request_id)
      console.log(
        `[export-worker] ZIP built for job ${job.id}: ${zipBuffer.length} bytes`
      )
    } catch (buildError) {
      const message = buildError instanceof Error ? buildError.message : String(buildError)
      console.error(`[export-worker] ZIP build failed for job ${job.id}:`, message)

      // Re-queue if under max attempts, otherwise fail.
      const newStatus = newAttemptCount < MAX_ATTEMPTS ? 'queued' : 'failed'
      await supabaseAdmin
        .from('export_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      if (newStatus === 'failed') {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(job.user_id)
        const userEmail = userData?.user?.email
        if (userEmail) {
          // silent-catch-ok — best-effort failure notification; original error already logged.
          await sendEmail({ to: userEmail, ...exportFailedEmail() }).catch(e =>
            console.error('[export-worker] failed to send failure email after build error:', e)
          )
        }
      }

      return json({ success: false, error: message }, 500)
    }

    // ── Upload ZIP to Storage ────────────────────────────────────────────────
    const storagePath = `${job.user_id}/${job.request_id}.zip`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('exports')
      .upload(storagePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      })

    if (uploadError) {
      console.error(`[export-worker] upload failed for job ${job.id}:`, uploadError.message)

      const newStatus = newAttemptCount < MAX_ATTEMPTS ? 'queued' : 'failed'
      await supabaseAdmin
        .from('export_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      if (newStatus === 'failed') {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(job.user_id)
        const userEmail = userData?.user?.email
        if (userEmail) {
          // silent-catch-ok — best-effort failure notification; upload error already logged.
          await sendEmail({ to: userEmail, ...exportFailedEmail() }).catch(e =>
            console.error('[export-worker] failed to send failure email after upload error:', e)
          )
        }
      }

      return json({ success: false, error: uploadError.message }, 500)
    }

    console.log(`[export-worker] uploaded ${storagePath} to exports bucket`)

    // ── Create signed URL (7-day TTL) ────────────────────────────────────────
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('exports')
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

    if (signedError || !signedData?.signedUrl) {
      const errMsg = signedError?.message ?? 'no signedUrl returned'
      console.error(`[export-worker] createSignedUrl failed for job ${job.id}:`, errMsg)

      // Mark failed — signed URL creation failure is unlikely to be transient.
      await supabaseAdmin
        .from('export_jobs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', job.id)

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(job.user_id)
      const userEmail = userData?.user?.email
      if (userEmail) {
        // silent-catch-ok — best-effort failure notification; signed URL error already logged.
        await sendEmail({ to: userEmail, ...exportFailedEmail() }).catch(e =>
          console.error('[export-worker] failed to send failure email after signed URL error:', e)
        )
      }

      return json({ success: false, error: errMsg }, 500)
    }

    const signedUrl = signedData.signedUrl
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString()

    // ── Mark job done ────────────────────────────────────────────────────────
    const now = new Date().toISOString()
    await supabaseAdmin
      .from('export_jobs')
      .update({
        status: 'done',
        signed_url: signedUrl,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', job.id)

    console.log(`[export-worker] job ${job.id} done — signed URL expires ${expiresAt}`)

    // ── Email user ───────────────────────────────────────────────────────────
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(job.user_id)
    const userEmail = userData?.user?.email

    if (userEmail) {
      const emailResult = await sendEmail({
        to: userEmail,
        ...exportReadyEmail(signedUrl, expiresAt),
      })
      if (!emailResult.sent && !('skipped' in emailResult)) {
        console.error('[export-worker] failed to send ready email:', emailResult)
        // Non-fatal: signed URL is stored in DB; user can be notified via support.
      }
    } else {
      console.warn(
        `[export-worker] no email found for user ${job.user_id} — ready email not sent. ` +
          `Signed URL stored in export_jobs.signed_url for manual delivery.`
      )
    }

    return json({ status: 'done', jobId: job.id, expiresAt })
  } catch (err) {
    // silent-catch-ok — Deno Edge Function; no UI toast available. Error returned as JSON.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[export-worker] unhandled error:', message)
    return json({ success: false, error: message }, 500)
  }
})
