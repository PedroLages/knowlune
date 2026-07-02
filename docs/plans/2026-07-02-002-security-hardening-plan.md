# Plan: Short-Term Security Hardening (2026-07-02 Audit)

**TL;DR** — Three hardening items: migrate GitHub feedback token from client-side to a Supabase Edge Function, restrict CSP `connect-src` from wildcard `https:` to specific allowed domains, and add `frame-ancestors 'self'` to the CSP meta tag.

**Steps**

### Phase 1: Feedback Edge Function (*can parallel with Phase 2*)

1. **Create Supabase Edge Function `submit-feedback`**
   - Path: `supabase/functions/submit-feedback/index.ts`
   - Accepts POST with JSON body: `{ mode, title, message, description, stepsToReproduce, context }`
   - Authenticates via Supabase auth JWT from `Authorization: Bearer` header (validates user is authenticated)
   - Holds `GITHUB_FEEDBACK_TOKEN` as Edge Function secret (set via `supabase secrets set`)
   - Posts to GitHub Issues API: `POST https://api.github.com/repos/PedroLages/Knowlune/issues`
   - Returns `{ ok: true }` or `{ ok: false, error: string }`

2. **Update `src/lib/feedbackService.ts`**
   - Replace direct GitHub API call with fetch to the Edge Function via `apiUrl('submit-feedback')`
   - Remove `VITE_GITHUB_FEEDBACK_TOKEN` import and usage
   - Keep the `buildIssueBody` and `buildFeedbackContext` functions (they only assemble data)
   - Keep `FEEDBACK_FALLBACK_EMAIL` as a fallback for when Edge Function is unreachable

3. **Update `src/app/hooks/useFeedbackSubmit.ts`**
   - Remove `VITE_GITHUB_FEEDBACK_TOKEN` import
   - Call the updated `feedbackService.submit()` which now routes through the Edge Function

4. **Clean up**
   - Remove `VITE_GITHUB_FEEDBACK_TOKEN` from `.env.example`
   - Remove from Cloudflare Pages environment variables (manual step, note in plan)
   - Verify the token is not referenced anywhere else in the codebase

### Phase 2: CSP Tightening (*can parallel with Phase 1*)

5. **Restrict `connect-src` in `index.html`**
   - File: `index.html:26` (the CSP meta tag)
   - Replace bare `https:` scheme with specific domains:
     - `https://*.supabase.co` — Supabase API + Edge Functions
     - `https://supabase.pedrolages.net` — self-hosted Supabase
     - `https://huggingface.co https://*.huggingface.co https://*.hf.co` — ML models
     - `https://raw.githubusercontent.com` — model files
     - `https://*.stripe.com` — payments
     - `https://www.googleapis.com https://books.google.com https://openlibrary.org https://covers.openlibrary.org` — book metadata
     - `https://itunes.apple.com https://*.mzstatic.com` — audiobook metadata
     - `https://api.audnex.us` — audiobook metadata
     - `https://www.youtube.com` — YouTube API
     - `https://*.ingest.sentry.io https://*.ingest.de.sentry.io` — error tracking
     - `https://openrouter.ai` — AI provider
     - `https://static.cloudflareinsights.com` — analytics
     - `http://titan.local:* http://localhost:* http://127.0.0.1:*` — local dev
   - Remove: bare `https:`, `ws:`, `wss:` (if WebSocket is needed, specify exact origins)
   - Keep: `'self'`, `blob:`

   **Domain Discovery Methodology:**
   The CSP domain list is sourced from three layers, prioritized by reliability:
   1. **Static code analysis** — grep the codebase for `fetch(`, `apiUrl(`, `axios`, `import.meta.env.VITE_`, and URL string literals to extract all external domains the app references in source. This catches Supabase, Stripe, Hugging Face, YouTube, OpenRouter, Sentry.
   2. **Runtime network audit** — run the app in a Playwright trace with `page.route()` logging every outbound request, then exercise all major features (YouTube import, AI tutor, Stripe checkout, Google OAuth, Supabase sync, book metadata lookup). Deduplicate and sort by origin. This catches domains only referenced at runtime (e.g., `*.mzstatic.com` for Apple artwork, `*.hf.co` redirects, `covers.openlibrary.org`).
   3. **Third-party docs cross-check** — for each integration (Stripe.js, Sentry SDK, Google Books API, Audnex, Hugging Face Inference, Cloudflare Insights), consult the official docs for the complete set of hostnames the SDK may contact. This catches domains the SDK loads lazily (e.g., Stripe's regional endpoints, Sentry's ingest fallback).

   **Ongoing maintenance:** when adding a new external integration, add its domains to the CSP list AND to this plan's domain inventory. When removing an integration, audit the CSP list for stale entries. Run the Playwright CSP audit spec (step 9) on every PR that touches `index.html` or adds a new external dependency.

6. **Add `frame-ancestors 'self'` to CSP**
   - File: `index.html:21` (inside the CSP meta tag)
   - Add `frame-ancestors 'self';` directive
   - Keep `X-Frame-Options: SAMEORIGIN` in `public/_headers` for legacy browser support

### Phase 3: Verification

7. **Test feedback flow end-to-end**
   - Submit bug report → verify GitHub Issue is created
   - Submit feedback → verify GitHub Issue is created
   - Test with unauthenticated user → verify Edge Function rejects with 401
   - Test with Edge Function down → verify fallback email link works

8. **Test CSP changes (manual smoke test)**
   - Deploy to preview environment
   - Check browser console for CSP violation reports
   - Test all major features: YouTube import, AI tutor, Stripe checkout, Google OAuth, Supabase sync, Sentry error reporting

9. **Automated CSP violation detection (Playwright E2E)**
   - New file: `tests/e2e/security/csp-audit.spec.ts`
   - **Strategy:** Use Playwright's `page.on('console')` listener to capture CSP violation messages. CSP violations are reported via `console.error` with text matching `Content Security Policy` or `Refused to connect to`.
   - **Test matrix:**
     | Test | Route | Action | Assertion |
     |------|-------|--------|-----------|
     | No CSP violations on landing | `/` | Load page, wait 3s | Zero CSP console errors |
     | No CSP violations on overview | `/overview` | Load page, wait for data | Zero CSP console errors |
     | No CSP violations on courses | `/courses` | Load + scroll 3 pages | Zero CSP console errors |
     | No CSP violations on settings | `/settings` | Load + interact (open dialogs) | Zero CSP console errors |
     | No CSP violations on library | `/library` | Load + navigate to a book | Zero CSP console errors |
   - **Fixture dependency:** Uses the merged `local-storage-fixture.ts` with auto `_knowluneE2eBrowserInit` for guarded routes.
   - **Failure mode:** Test fails with the violating domain logged — actionable triage (add to CSP list if legitimate, investigate if unexpected).

10. **Automated feedback flow (Playwright E2E)**
    - New file: `tests/e2e/security/feedback-submit.spec.ts`
    - **Strategy:** Mock the Edge Function endpoint with `page.route()` to avoid creating real GitHub Issues during test runs. Assert correct request shape, auth header, and fallback behavior.
    - **Test matrix:**
      | Test | Setup | Action | Assertion |
      |------|-------|--------|-----------|
      | Authenticated submit succeeds | Mock Edge Function returns `{ok:true}` | Open feedback dialog, fill form, submit | POST sent with `Authorization: Bearer <jwt>`, success toast shown |
      | Unauthenticated submit rejected | Clear session, mock Edge Function returns 401 | Open feedback dialog, fill form, submit | Error toast shown, no GitHub issue created |
      | Edge Function unreachable → fallback | Mock Edge Function returns network error | Open feedback dialog, fill form, submit | Fallback email link rendered with pre-filled body |
      | Payload shape is correct | Mock Edge Function captures body | Submit bug report with all fields | Body contains `{mode, title, message, description, stepsToReproduce, context}` |
    - **Fixture dependency:** Uses the merged `local-storage-fixture.ts`. Tests that require auth set session keys; unauth'd test clears them in `beforeEach`.

**Relevant files**
- `supabase/functions/submit-feedback/index.ts` — NEW: Edge Function
- `src/lib/feedbackService.ts:1-100` — Replace GitHub API call with Edge Function call
- `src/app/hooks/useFeedbackSubmit.ts:30-50` — Remove VITE_GITHUB_FEEDBACK_TOKEN
- `index.html:21-30` — Update CSP meta tag
- `public/_headers` — Verify X-Frame-Options stays as fallback
- `.env.example` — Remove VITE_GITHUB_FEEDBACK_TOKEN entry
- `tests/e2e/security/csp-audit.spec.ts` — NEW: Automated CSP violation detection
- `tests/e2e/security/feedback-submit.spec.ts` — NEW: Automated feedback flow tests

**Verification**
1. `npm run build` succeeds
2. Feedback submission creates GitHub Issue via Edge Function
3. Unauthenticated feedback submission returns 401
4. CSP evaluator shows `frame-ancestors 'self'` and no wildcard `connect-src`
5. Zero CSP violation reports in browser console across all major features
6. Fallback email link works when Edge Function is unreachable
7. `tests/e2e/security/csp-audit.spec.ts` — all 5 routes pass with zero CSP violations
8. `tests/e2e/security/feedback-submit.spec.ts` — all 4 scenarios pass (auth'd, unauth'd, fallback, payload shape)

**Scope boundaries**
- INCLUDES: Edge Function for feedback, CSP tightening, frame-ancestors
- EXCLUDES: Other CSP directives, rate limiting, CAPTCHA, IndexedDB encryption
