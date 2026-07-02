// Knowlune Feedback Edge Function
// POST /functions/v1/submit-feedback
// Auth: requires Supabase JWT (Authorization: Bearer <token>)
//
// Proxies in-app bug reports and feedback to GitHub Issues on
// PedroLages/Knowlune. The GITHUB_FEEDBACK_TOKEN secret is held
// server-side — never exposed to the client.
//
// Body: { mode: 'bug'|'feedback', title, message, description, stepsToReproduce, context }
// Returns: { ok: true } on 201, or { ok: false, error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_API_URL = 'https://api.github.com/repos/PedroLages/Knowlune/issues'
const GITHUB_TOKEN = Deno.env.get('GITHUB_FEEDBACK_TOKEN')

// CORS headers — matches _shared/origin-check.ts pattern
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackRequest {
  mode: 'bug' | 'feedback'
  title: string
  message?: string
  description?: string
  stepsToReproduce?: string
  context?: Record<string, string>
}

interface IssuePayload {
  title: string
  body: string
  labels: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBody(req: FeedbackRequest): string {
  const lines: string[] = []

  if (req.mode === 'bug') {
    lines.push('## Description', '', req.description ?? '', '')
    if (req.stepsToReproduce?.trim()) {
      lines.push('## Steps to Reproduce', '', req.stepsToReproduce, '')
    }
  } else {
    if (req.message) {
      lines.push('## Message', '', req.message, '')
    }
  }

  // Auto-attached context
  if (req.context) {
    const ctxLines: string[] = ['| Field | Value |', '|-------|-------|']
    for (const [key, value] of Object.entries(req.context)) {
      ctxLines.push(`| ${key} | \`${value}\` |`)
    }
    lines.push('<details>')
    lines.push('<summary>Auto-attached context</summary>')
    lines.push('')
    lines.push(...ctxLines)
    lines.push('')
    lines.push('</details>')
  }

  return lines.join('\n')
}

function buildIssuePayload(req: FeedbackRequest): IssuePayload {
  const title = req.mode === 'bug'
    ? req.title
    : req.title?.trim() || 'User feedback'
  const labels = req.mode === 'bug'
    ? ['bug', 'beta-feedback']
    : ['enhancement', 'beta-feedback']

  return { title, body: buildBody(req), labels }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  // --- Auth ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.slice(7)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Unauthorized — valid Supabase JWT required' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  // --- Secret check ---
  if (!GITHUB_TOKEN) {
    console.error('submit-feedback: GITHUB_FEEDBACK_TOKEN secret is not set')
    return new Response(
      JSON.stringify({ ok: false, error: 'Server configuration error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  // --- Parse body ---
  let body: FeedbackRequest
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  if (!body.mode || !body.title) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing required fields: mode, title' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  // --- Post to GitHub ---
  const issuePayload = buildIssuePayload(body)

  try {
    const ghRes = await fetch(GITHUB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(issuePayload),
    })

    if (ghRes.status === 201) {
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const ghBody = await ghRes.text().catch(() => '')
    console.error(`submit-feedback: GitHub returned ${ghRes.status}: ${ghBody.slice(0, 200)}`)
    return new Response(
      JSON.stringify({ ok: false, error: `GitHub returned ${ghRes.status}. Please try the copy option below.` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('submit-feedback: GitHub request failed:', err)
    return new Response(
      JSON.stringify({ ok: false, error: 'Could not reach GitHub. Please try the copy option below.' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
