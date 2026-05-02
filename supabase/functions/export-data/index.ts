// E119-S05: Registry-Driven Export ZIP Edge Function
// Handles: GET /functions/v1/export-data
// Auth: requires Supabase JWT
//
// Streams a ZIP archive containing:
//   - data.json  — all 38 sync tables, user-scoped via RLS
//   - media/<bucket>/…  — all user-owned Storage objects from 4 buckets
//   - README.md  — manifest with row counts, bucket counts, versions, contact
//
// 500 MB size probe runs BEFORE streaming starts. If estimated size exceeds
// the threshold, returns { status: 'too-large', route: 'async' } without
// opening a ZIP stream.
//
// Registry-driven: TABLE_NAMES must stay in sync with
// src/lib/sync/tableRegistry.ts → tableRegistry (ERASURE_TABLE_NAMES).
// See also: supabase/functions/_shared/hardDeleteUser.ts → TABLE_NAMES
// (same list — update both when a new table is added to the registry).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// fflate: ZIP library for Deno — std/archive only supports tar.
import { Zip, ZipDeflate } from 'https://esm.sh/fflate@0.8.2'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Notice version — must be bumped whenever CURRENT_NOTICE_VERSION changes in
 * src/lib/compliance/noticeVersion.ts (Edge Functions cannot import src/).
 */
const CURRENT_NOTICE_VERSION = '2026-04-23.1'

/**
 * Schema version — mirrors CURRENT_SCHEMA_VERSION in src/lib/exportService.ts.
 */
const CURRENT_SCHEMA_VERSION = 14

/** Contact email for GDPR enquiries, included in the README manifest. */
const CONTACT_EMAIL = 'privacy@pedrolages.net'

/**
 * Maximum estimated export size in bytes (500 MB).
 * If the probe finds the user's data exceeds this, return too-large response.
 */
const MAX_EXPORT_BYTES = 500 * 1024 * 1024

/**
 * Ordered list of Supabase table names — mirrors tableRegistry.ts (P0→P4).
 *
 * IMPORTANT: This list must stay in sync with:
 *   - src/lib/sync/tableRegistry.ts → tableRegistry / ERASURE_TABLE_NAMES
 *   - supabase/functions/_shared/hardDeleteUser.ts → TABLE_NAMES
 * Adding a table to tableRegistry.ts without updating this list will cause
 * that table to be silently excluded from GDPR exports.
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

/**
 * Storage buckets containing user-prefixed objects.
 * Objects are stored at `{userId}/{filename}` — same set as hardDeleteUser.ts.
 */
const STORAGE_BUCKETS: string[] = [
  'course-thumbnails',
  'screenshots',
  'avatars',
  'pdfs',
  'book-files',
  'book-covers',
]

/**
 * Vault fields by Supabase table name.
 * These contain sensitive credentials that MUST NOT appear in the export.
 * Column names are snake_case (as returned by Supabase SELECT *).
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
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
// Shared secret used to authenticate the fire-and-forget call to export-worker.
// If absent, the job is still enqueued but the worker is not immediately invoked
// (S11 retention-tick or a manual retry can pick it up later).
const EXPORT_WORKER_SECRET = Deno.env.get('EXPORT_WORKER_SECRET')

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required')

// Service-role admin client — bypasses RLS for authoritative server-truth export.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// CORS: restrict to APP_URL (or localhost dev fallback).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Authenticate the request using the caller's JWT. Returns userId or error Response. */
async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()

  if (error || !user) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  return { userId: user.id }
}

/**
 * Strip vault fields from a row object in-place.
 * Returns whether any fields were stripped (for README manifest note).
 */
function stripVaultFields(row: Record<string, unknown>, table: string): boolean {
  const fields = VAULT_FIELDS[table]
  if (!fields) return false
  let stripped = false
  for (const field of fields) {
    if (field in row) {
      delete row[field]
      stripped = true
    }
  }
  return stripped
}

// ---------------------------------------------------------------------------
// Async export path (E119-S06)
// ---------------------------------------------------------------------------

/**
 * Handle the async export path when estimated data size exceeds MAX_EXPORT_BYTES.
 *
 * Flow:
 *   1. Check for an existing active (queued/processing) job for this user.
 *      If found, return 202 with the existing request_id (de-duplication).
 *   2. Insert a new job using ON CONFLICT DO NOTHING against the partial
 *      unique index (export_jobs_active_unique). This handles the concurrent
 *      race where two requests both pass the check before either inserts.
 *      If insert yields nothing (conflict), re-query for the active job.
 *   3. Fire-and-forget POST to export-worker. Job stays queued if worker
 *      call fails — S11 cron or a user retry will pick it up later.
 *   4. Return 202 { status: 'queued', eta, request_id }.
 */
async function handleAsyncExport(userId: string): Promise<Response> {
  // Step 1: check for existing active job (de-duplication).
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('export_jobs')
    .select('request_id')
    .eq('user_id', userId)
    .in('status', ['queued', 'processing'])
    .limit(1)
    .maybeSingle()

  if (selectError) {
    console.error('[export-data] async path: de-dup select error:', selectError.message)
    // Non-fatal: continue to insert and let ON CONFLICT handle it.
  }

  if (existing) {
    console.log(
      `[export-data] async path: active job exists for user ${userId}, ` +
        `request_id=${existing.request_id}`
    )
    return json(
      { status: 'queued', eta: 'within a few minutes', request_id: existing.request_id },
      202
    )
  }

  // Step 2: insert new job. ON CONFLICT handles the race condition where two
  // concurrent requests both pass the de-duplication check.
  // Note: Supabase JS client does not expose ON CONFLICT directly for .insert().
  // We use .upsert() with ignoreDuplicates or raw SQL via rpc if needed.
  // Since the partial unique index is on (user_id) WHERE status IN ('queued','processing'),
  // we attempt a plain insert and catch the conflict gracefully.
  const { data: newJob, error: insertError } = await supabaseAdmin
    .from('export_jobs')
    .insert({ user_id: userId })
    .select('request_id')
    .maybeSingle()

  let requestId: string

  if (insertError) {
    if (insertError.code === '23505') {
      // Unique constraint violation — another request raced us. Re-query.
      console.log(`[export-data] async path: concurrent insert conflict for user ${userId}, re-querying`)
      const { data: raceJob, error: raceSelectError } = await supabaseAdmin
        .from('export_jobs')
        .select('request_id')
        .eq('user_id', userId)
        .in('status', ['queued', 'processing'])
        .limit(1)
        .maybeSingle()

      if (raceSelectError || !raceJob) {
        console.error('[export-data] async path: race recovery select failed:', raceSelectError?.message)
        return json({ success: false, error: 'Failed to enqueue export job' }, 500)
      }

      requestId = raceJob.request_id
    } else {
      console.error('[export-data] async path: insert error:', insertError.message)
      return json({ success: false, error: 'Failed to enqueue export job' }, 500)
    }
  } else if (!newJob) {
    console.error('[export-data] async path: insert returned no row')
    return json({ success: false, error: 'Failed to enqueue export job' }, 500)
  } else {
    requestId = newJob.request_id

    // Step 3: fire-and-forget to export-worker.
    if (!EXPORT_WORKER_SECRET) {
      console.warn(
        '[export-data] EXPORT_WORKER_SECRET not set — job enqueued but export-worker ' +
          'not triggered. Set EXPORT_WORKER_SECRET to enable automatic processing.'
      )
    } else {
      const workerUrl = `${SUPABASE_URL}/functions/v1/export-worker`
      // Intentionally not awaited — fire and forget.
      // silent-catch-ok — worker failure is non-fatal; job stays queued for S11 retry.
      fetch(workerUrl, {
        method: 'POST',
        headers: { 'X-Worker-Secret': EXPORT_WORKER_SECRET },
      }).catch(err =>
        console.error('[export-data] async path: worker invocation failed (non-fatal):', err)
      )
    }
  }

  console.log(`[export-data] async path: enqueued job request_id=${requestId} for user ${userId}`)

  return json(
    { status: 'queued', eta: 'within a few minutes', request_id: requestId },
    202
  )
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  }

  // Only GET allowed
  if (req.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const authResult = await authenticate(req)
    if (authResult instanceof Response) return authResult
    const { userId } = authResult

    // -----------------------------------------------------------------------
    // Phase 0: Size probe
    // Estimate total export size before opening the ZIP stream.
    // -----------------------------------------------------------------------
    let estimatedBytes = 0

    // Probe tables: COUNT(*) for each table, estimate ~500 bytes/row average.
    for (const table of TABLE_NAMES) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) {
        // Non-fatal for probe: if count fails, use 0 (under-estimate is safer
        // than blocking the export entirely during the probe phase).
        console.warn(`[export-data] size probe failed for ${table}: ${error.message}`)
        continue
      }

      // Conservative 500 bytes/row average across all table types.
      estimatedBytes += (count ?? 0) * 500
    }

    // Probe Storage buckets: sum object sizes.
    for (const bucket of STORAGE_BUCKETS) {
      const { data: objects, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(userId + '/', { limit: 1000 })

      if (error || !objects) continue

      for (const obj of objects) {
        estimatedBytes += obj.metadata?.size ?? 0
      }
    }

    if (estimatedBytes > MAX_EXPORT_BYTES) {
      return await handleAsyncExport(userId)
    }

    // -----------------------------------------------------------------------
    // Phase 1: Collect all data (tables + Storage object metadata)
    // -----------------------------------------------------------------------
    const tableData: Record<string, unknown[]> = {}
    const tableCounts: Record<string, number> = {}
    const tablesWithVaultStrip: string[] = []

    for (const table of TABLE_NAMES) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .eq('user_id', userId)

      if (error) {
        // AC-8: RLS error must fail the export closed with an explicit message.
        throw new Error(`RLS error on table ${table}: ${error.message}`)
      }

      const rows = (data ?? []) as Record<string, unknown>[]

      // Strip vault fields and tag rows with _origin: 'server'
      let anyVaultFieldStripped = false
      const processedRows = rows.map(row => {
        const r = { ...row, _origin: 'server' as const }
        if (stripVaultFields(r as Record<string, unknown>, table)) {
          anyVaultFieldStripped = true
        }
        return r
      })

      if (anyVaultFieldStripped) {
        tablesWithVaultStrip.push(table)
      }

      tableData[table] = processedRows
      tableCounts[table] = processedRows.length
    }

    // Storage object inventory for buckets section of manifest
    const bucketCounts: Record<string, number> = {}
    const storageObjects: Record<string, Array<{ key: string; size: number }>> = {}

    for (const bucket of STORAGE_BUCKETS) {
      const allObjects: Array<{ key: string; size: number }> = []
      let offset = 0
      const pageSize = 1000

      // Paginate Storage list
      while (true) {
        const { data: page, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(userId + '/', { limit: pageSize, offset })

        if (error || !page) break

        for (const obj of page) {
          allObjects.push({
            key: obj.name,
            size: obj.metadata?.size ?? 0,
          })
        }

        if (page.length < pageSize) break
        offset += pageSize
      }

      storageObjects[bucket] = allObjects
      bucketCounts[bucket] = allObjects.length
    }

    // -----------------------------------------------------------------------
    // Phase 2: Build README manifest
    // -----------------------------------------------------------------------
    const exportedAt = new Date().toISOString()

    const readmeLines = [
      '# Knowlune Data Export',
      '',
      '## Export Details',
      '',
      `- **Exported at:** ${exportedAt}`,
      `- **Schema version:** ${CURRENT_SCHEMA_VERSION}`,
      `- **Privacy notice version acknowledged:** ${CURRENT_NOTICE_VERSION}`,
      `- **Contact:** ${CONTACT_EMAIL}`,
      '',
      '## Contents',
      '',
      '- `data.json` — All your personal data from Knowlune\'s database',
      '- `media/` — All media files you have uploaded (per storage bucket)',
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

    if (tablesWithVaultStrip.length > 0) {
      readmeLines.push(
        '',
        '## Security Note',
        '',
        'Sensitive credentials (passwords, API keys) were omitted from the following tables',
        'for your security:',
        '',
      )
      for (const table of tablesWithVaultStrip) {
        const fields = VAULT_FIELDS[table] ?? []
        readmeLines.push(`- \`${table}\`: ${fields.join(', ')}`)
      }
    }

    readmeLines.push(
      '',
      '---',
      '',
      '*This export was generated in compliance with GDPR Articles 15 and 20.*',
    )

    const readmeContent = readmeLines.join('\n')

    // -----------------------------------------------------------------------
    // Phase 3: Stream ZIP
    // Use fflate Zip for streaming output — avoids buffering entire archive.
    // -----------------------------------------------------------------------
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()

    const encoder = new TextEncoder()

    // Build ZIP asynchronously — stream to TransformStream
    // fflate's Zip callback is synchronous — it does not await the returned Promise.
    // Buffer chunks in a queue and drain them sequentially to avoid backpressure issues.
    const chunkQueue: Uint8Array[] = []
    let draining = false
    async function drainQueue() {
      if (draining) return
      draining = true
      while (chunkQueue.length > 0) {
        const chunk = chunkQueue.shift()!
        await writer.write(chunk)
      }
      draining = false
    }

    const zipPromise = (async () => {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          writer.abort(err)
          return
        }
        chunkQueue.push(chunk)
        drainQueue()
        if (final) {
          drainQueue().then(() => writer.close())
        }
      })

      // --- data.json ---
      const dataJsonBytes = encoder.encode(JSON.stringify(tableData, null, 2))
      const dataJsonEntry = new ZipDeflate('data.json', { level: 6 })
      zip.add(dataJsonEntry)
      dataJsonEntry.push(dataJsonBytes, true)

      // --- media/<bucket>/<key> ---
      const skippedFiles: string[] = []
      for (const bucket of STORAGE_BUCKETS) {
        const objects = storageObjects[bucket] ?? []
        for (const obj of objects) {
          const path = `media/${bucket}/${obj.key}`
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from(bucket)
            .download(`${userId}/${obj.key}`)

          if (downloadError || !fileData) {
            console.warn(`[export-data] failed to download ${bucket}/${obj.key}: ${downloadError?.message}`)
            skippedFiles.push(path)
            continue
          }

          const fileBytes = new Uint8Array(await fileData.arrayBuffer())
          // Sanitize path to prevent Zip Slip (path traversal in ZIP entry names)
          const safePath = path.replace(/\.\.\//g, '').replace(/^\/+/, '').replace(/[<>:"\\|?*]/g, '_')
          const fileEntry = new ZipDeflate(safePath, { level: 1 }) // low compression for binary
          zip.add(fileEntry)
          fileEntry.push(fileBytes, true)
        }
      }

      // --- skipped-files.txt (GDPR Art 15/20: inform user of incomplete exports) ---
      if (skippedFiles.length > 0) {
        const skippedContent = [
          '# Skipped Files',
          '',
          'The following files could not be downloaded and are missing from this export:',
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

      // --- README.md ---
      const readmeBytes = encoder.encode(readmeContent)
      const readmeEntry = new ZipDeflate('README.md', { level: 6 })
      zip.add(readmeEntry)
      readmeEntry.push(readmeBytes, true)

      zip.end()
    })()

    // Don't await zipPromise here — it runs concurrently with the stream being consumed.
    // Errors in zipPromise will abort the writer, causing the stream to terminate.
    // silent-catch-ok — Deno Edge Function server-side; no UI toast available; error logged to console.
    zipPromise.catch(err => {
      console.error('[export-data] zip stream error:', err)
      // Ensure the stream is properly terminated even if the Zip callback's error path didn't fire.
      // silent-catch-ok — abort error means stream already closed, which is the desired outcome.
      writer.abort(err).catch(() => {})
    })

    const dateStr = exportedAt.slice(0, 10) // YYYY-MM-DD
    return new Response(readable, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="knowlune-gdpr-export-${dateStr}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    // silent-catch-ok — Deno Edge Function; no UI toast available. Error returned as structured JSON to caller.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[export-data] error:', message)
    return json({ success: false, error: message }, 500)
  }
})
