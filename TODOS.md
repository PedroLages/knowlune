# TODOS

Last updated: 2026-03-26 via /plan-ceo-review (AI strategy deep dive)

## Phase 1: Pre-Launch — Immediate Action Items

These items should be implemented before deploying to Vercel. See
[docs/reviews/code/eng-review-2026-03-25-ollama-proxy.md](docs/reviews/code/eng-review-2026-03-25-ollama-proxy.md)
for full implementation details on each.

### 1. Fix Hardcoded COURSES_ROOT → env var
- **File:** `vite.config.ts:14`
- **What:** Replace hardcoded `/Volumes/SSD/GFX/Chase Hughes - The Operative Kit` with `process.env.COURSES_ROOT || ''`
- **Why:** Personal filesystem path + course name is a committed secret in an open-source-bound repo
- **Effort:** ~2 min with CC
- **Depends on:** Nothing
- **Source:** /plan-eng-review Issue #4, upgraded from TODO to "fix now" by outside voice

### 2. Delete SSRF Validation from Vite Plugin
- **File:** `vite.config.ts` — remove `isAllowedOllamaUrl()` function and all references
- **What:** Remove SSRF protection from the dev-only Vite plugin entirely. Keep it in `server/index.ts` (Express)
- **Why:** SSRF on a dev-only localhost proxy is security theater. Worse: it blocks `localhost:11434`, the default Ollama address. The outside voice called this "a UX bug disguised as security"
- **Effort:** ~5 min with CC
- **Depends on:** Nothing
- **Source:** /plan-eng-review Issue #1 + outside voice finding #1

### 3. Add Streaming SSE Support to Vite Plugin
- **File:** `vite.config.ts` — new middleware handler for `POST /api/ai/ollama`
- **What:** Pipe Ollama streaming responses as Server-Sent Events through the Vite dev server
- **Why:** Critical gap — the plugin's value prop is "no `npm run server` needed for Ollama," but streaming chat (the primary AI interaction) still requires Express. Without this fix, streaming silently fails when Express isn't running
- **Effort:** ~15 min with CC (~20 lines of SSE piping)
- **Depends on:** Nothing (can be done independently)
- **Source:** /plan-eng-review Issue #2, upgraded from "doc issue" to "feature gap" by outside voice (HIGH severity)

### 4. Write Unit Tests for Ollama Proxy
- **File to create:** `src/__tests__/ollama-dev-proxy.test.ts`
- **What:** Test all 14+ code paths in `ollamaDevProxy()` — happy paths, error paths, timeouts, validation
- **Why:** Security-relevant proxy with zero test coverage. See test plan at [docs/test-plans/eng-review-2026-03-25-ollama-proxy.md](docs/test-plans/eng-review-2026-03-25-ollama-proxy.md)
- **Effort:** ~15 min with CC
- **Depends on:** Items 2 and 3 (so tests reflect final proxy shape)
- **Source:** /plan-eng-review Issue #6

### 5. Update Proxy Architecture Comments
- **File:** `vite.config.ts` lines 349-357
- **What:** Replace current proxy comments with clear architecture diagram showing which endpoints use embedded proxy vs Express
- **Effort:** ~5 min with CC
- **Depends on:** Item 3 (streaming must be added first)
- **Source:** /plan-eng-review Issue #2

## Phase 1: Pre-Launch — Deployment

### 6. Production Ollama Architecture
- **What:** Solve how Ollama works in production on Vercel (no server-side proxy available)
- **Why:** Vite `configureServer()` only works in dev mode. In production, Ollama proxy endpoints will 404
- **Recommended approach:** In production, switch to direct browser→Ollama requests. Users configure `OLLAMA_ORIGINS=*` on their Ollama server. This is the same pattern as Open WebUI and other browser-based Ollama tools. Write a "How to use Ollama with Knowlune" guide
- **Alternative:** Supabase Edge Function proxy (but can't reach user's localhost Ollama from cloud)
- **Depends on:** Vercel deployment setup
- **Source:** /plan-eng-review Issue #3 + outside voice finding #6 (HIGH severity)

### 7. Vercel Deployment Configuration
- **What:** Set up Vercel project, configure build, environment variables, auto-deploy on merge
- **Why:** Phase 1 launch target — get a public URL
- **Depends on:** E19-S02 (Stripe) completion
- **Source:** /office-hours design doc — Phase 1 timeline

### 8. Landing Page / Marketing Site
- **What:** Create a landing page for Knowlune, leading with the YouTube Course Builder hook
- **Why:** SEO play — note: "YouTube course builder" is now a CONTESTED keyword (YTCourse, Coursa, Everlearns exist). Positioning should emphasize "one place for everything you're learning" with YouTube as entry point, not "YouTube course builder" alone
- **Depends on:** Vercel deployment
- **Source:** /office-hours design doc — Distribution Plan

## Phase 2: YouTube Course Builder (Epic 23)

### 9. YouTube Data API v3 Integration
- **What:** New epic — paste YouTube URLs/playlists → AI organizes into structured courses
- **Why:** The launch marketing hook. Transforms addressable market from "people with local files" to "anyone who learns from YouTube"
- **Key decisions already made:**
  - **Tier:** Core (free) — this is the acquisition funnel. AI recommendations/summaries stay premium
  - **AI provider:** BYOK — user's configured LLM analyzes video metadata. Rule-based fallback for users without AI key
  - **API quota plan:** Default 10K units/day. Mitigation: cache aggressively (TTL 7d), oEmbed fallback, apply for quota increase at 500+ DAU
- **Full design:** [docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md](docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md)
- **Wireframe:** `/tmp/gstack-sketch-1711400000.html` (3 screens: input → AI processing → review & confirm)
- **Depends on:** Phase 1 launch + user feedback
- **Source:** /office-hours design doc — Phase 2

## Strategic Decisions (Think-About-It Items)

### 11. AI Strategy: Hybrid Model Decision
- **What:** Decide whether to adopt a hybrid AI model — embedded AI for the YouTube course builder acquisition hook (zero friction, ~$0.001/call), with BYOK for deep features (RAG, flashcards, knowledge gaps, learning paths)
- **Why:** Landscape check (2026-03-26 via /plan-ceo-review) found 5+ existing YouTube-to-course competitors (YTCourse, Coursa, TrackMyCourse, Everlearns, YouTube native). BYOK-only model creates a wall that bounces 90%+ of non-technical YouTube users. Hybrid lets the acquisition hook "just work" while keeping the deep AI features behind BYOK
- **Trade-offs to evaluate:**
  - **BYOK-only:** $0 AI cost, targets technical users (~500K market), high onboarding friction
  - **Hybrid:** ~$50/mo AI cost at 50K course builds, targets everyone (~10M market), low friction for hook
  - **Fully embedded:** Unpredictable cost ($50-500/mo), widest audience, margin pressure risk
- **Key question:** Is the YouTube audience (non-technical) worth the ~$50/mo embedded AI cost? Or should Knowlune double down on the technical self-learner niche?
- **User journey analysis:** See /plan-ceo-review session 2026-03-26 for detailed Maria persona walkthrough comparing all three models
- **Priority:** P1 — this decision shapes the entire YouTube feature implementation (Epic 23 item #9 above)
- **Depends on:** Nothing — this is a strategic decision, not a code task
- **Source:** /plan-ceo-review 2026-03-26 — AI strategy deep dive

### 12. AI Cost Modeling
- **What:** Build a detailed cost model for the hybrid AI approach — per-feature cost breakdown across providers, projected monthly spend at different user counts (100, 1K, 10K, 50K users)
- **Why:** Can't make the hybrid decision without understanding the financial commitment. Need to model: YouTube course structuring calls (cheap metadata analysis), transcript-based features (heavier), and where the cost curve bends
- **Key dimensions:**
  - Cost per YouTube course build (metadata → chapters): ~$0.0004-0.001 per call
  - Cost per transcript Q&A query (RAG): ~$0.01-0.03 per query
  - Cost per auto-flashcard generation: ~$0.005-0.01 per set
  - Break-even: at what user count does $12/mo premium revenue cover embedded AI costs?
- **Deliverable:** A spreadsheet or markdown table showing cost projections at 100/1K/10K/50K MAU
- **Priority:** P1 — feeds into item #11 above
- **Depends on:** Nothing
- **Source:** /plan-ceo-review 2026-03-26 — user requested cost analysis

## Code Quality (Non-Blocking)

### 13. Proxy Handler Deduplication
- **What:** The proxy handler logic (~175 lines) is duplicated between `vite.config.ts` and `server/index.ts` (Express). Consider extracting shared handler logic
- **Why:** DRY. Currently only `isAllowedOllamaUrl` extraction was approved; full handler extraction was deferred
- **Priority:** Low — the two implementations have legitimate differences (Express vs Vite middleware APIs)
- **Source:** Outside voice finding #4
