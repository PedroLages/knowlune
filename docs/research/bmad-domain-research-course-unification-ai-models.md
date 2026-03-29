# BMad Domain Research: Course Unification & AI Model Configuration

**Date:** 2026-03-29
**Researcher:** Claude (BMad domain researcher)
**Context:** Knowlune roadmap — informing unified course model, AI feature architecture, and content parity patterns

---

## 1. Unified Course Models for Mixed Content Sources

### How Platforms Structure Multi-Source Content

**Udemy content hierarchy:**
Udemy organizes content as **Course > Module > Lesson > Activity**. Modules are top-level groupings within a course. Lessons sit inside modules and represent a single teaching unit. Activities are the atomic content items within lessons (video, quiz, reading, exercise). This hierarchy is source-agnostic — the same structure holds whether content is instructor-uploaded video, an embedded quiz, or a coding exercise.

**Coursera catalog API model:**
Coursera exposes courses via a RESTful JSON API with fields like `courseType` (e.g., `v1.session`, `v2.ondemand`), `workload`, `domainTypes`, `specializations`, and `previewLink`. A minimal field set is returned by default; additional fields are requested via `?fields=` query parameters. Linked objects (instructors, partners) use `?includes=` parameters. The API normalizes across their different course formats (sessions vs on-demand) behind a single schema.

**Unified.to normalized LMS model:**
The Unified.to API — a multi-provider LMS integration layer — normalizes data across providers into four core objects:
- **Course**: `name`, `description`, `active`, `languages`, `categories`, `pricing`, `media` references
- **Class**: A specific offering/session, linked via `course_id`, with `student[]` and `instructor[]` arrays
- **Student**: Learner identity (contact fields, distinct from HR/ATS identities)
- **Instructor**: Educator profile with contact info

Key pattern: *normalization with escape hatches* — core fields are standardized while provider-specific fields remain accessible. Write support varies by provider and is explicitly documented rather than assumed.

**Schema.org Course markup:**
Schema.org provides `Course` and `CourseInstance` types used for structured data across the web. `CourseInstance` represents a specific offering with `courseMode` (online, onsite, blended) — a source-agnostic abstraction.

### Route Patterns Observed

| Platform | URL Pattern | Notes |
|----------|------------|-------|
| Udemy | `/course/{slug}/learn/lecture/{id}` | Flat slug + numeric lecture ID |
| Coursera | `/learn/{slug}/home/week/{n}` | Slug + week-based navigation |
| Next.js pattern | `/courses/[slug]/lessons/[id]` | File-system routing with dynamic segments |
| React Router pattern | `/courses/:courseId/modules/:moduleId/lessons/:lessonId` | Nested parametric routes |

Common pattern: a human-readable slug for the course, then numeric or parametric IDs for sub-resources. No platform differentiates routes by content source — imported and native content share identical URL structures.

### Actionable Patterns for Knowlune

1. **Single hierarchy regardless of source**: Use `Course > Module > Lesson > ContentItem` where `ContentItem` has a `sourceType` discriminator field (e.g., `uploaded`, `scraped`, `api-fetched`, `manual`) but the hierarchy is identical.
2. **Normalization with escape hatches**: Store normalized fields (`title`, `description`, `duration`, `contentType`, `order`) on every item, plus a `sourceMetadata` JSON blob for provider-specific data (YouTube video ID, Coursera course ID, etc.).
3. **Route pattern**: `/courses/:courseSlug/modules/:moduleId/lessons/:lessonId` — source-agnostic, clean, nested. The slug provides SEO/readability; IDs provide stability.
4. **Lazy enrichment**: Start with minimal required fields at import time; enrich progressively (thumbnails, duration, transcripts) via background processing.

---

## 2. AI Model Configuration for Learning Features

### How AI Study Tools Handle Model Selection

**StudyFetch (Spark.E tutor):**
Does *not* expose model selection to users. The AI tutor "Spark.E" is a branded abstraction — users interact with it as a single persona that answers questions based on their uploaded materials. The underlying model is an implementation detail hidden from the user. No per-feature model configuration exists.

**Mindgrasp:**
Similarly opaque — users upload content and receive summaries, flashcards, quizzes, and interactive explanations. Mindgrasp offers control over *answer sourcing* (from uploaded content, past sessions, or external sources like Google Scholar) but not over which AI model generates the output. The differentiator is source selection, not model selection.

**Quizgecko:**
Pure quiz generator — no model selection exposed. Users paste text or upload files and receive quizzes. The AI is invisible infrastructure.

**Notion AI:**
Integrated into the workspace as a single "AI" capability. No model picker. Users invoke AI via inline commands (summarize, explain, translate) without choosing between models.

**Key finding: Consumer study tools universally hide model selection.** The AI is branded as a product feature, not a configurable component.

### Where Model Selection *Does* Appear

Model selection surfaces in **developer/power-user tools**, not consumer learning apps:

- **OpenRouter**: Unified API for 500+ models. Users explicitly choose models or use auto-routing (`:nitro` for speed, `:floor` for cost). Supports model-per-request selection.
- **LiteLLM**: Proxy server that normalizes the OpenAI API format across providers. Configuration is per-deployment, not per-end-user.
- **OpenClaw**: Open-source assistant letting users connect their own API keys and switch between Claude, GPT, Gemini, DeepSeek within a unified UI.
- **TypingMind / AICoven / Witsy**: BYOK chat interfaces that expose model dropdowns to power users.

### Task-Based Model Routing (2026 Pattern)

The emerging pattern in 2026 is **task-based model routing** rather than user-facing model selection:

| Task Type | Recommended Model | Cost Tier |
|-----------|------------------|-----------|
| Complex reasoning, architecture | Claude Opus 4.6 | High ($5/$25 per MTok) |
| Daily work, summaries | Claude Sonnet 4.6 | Medium ($3/$15 per MTok) |
| Batch processing, classification | Claude Haiku 4.5 | Low ($1/$5 per MTok) |
| Long-form analysis | Claude (1M context) | High |
| Code generation | GPT-5.3-Codex | Medium |

Combining prompt caching (90% savings) and batch API (50% off) can reduce costs by up to 95%.

### Actionable Patterns for Knowlune

1. **Default: hide model selection.** Follow the StudyFetch/Mindgrasp pattern — brand the AI as a Knowlune feature, not a model picker. Users should see "Generate Quiz" not "Generate Quiz with Claude Sonnet."
2. **Settings page: expose model routing for power users.** A single "AI Configuration" section in Settings with:
   - **Provider**: Anthropic (default), OpenRouter, or custom endpoint
   - **Model tier**: Auto (recommended), Quality (Opus), Balanced (Sonnet), Economy (Haiku)
   - **BYOK toggle**: Users can enter their own API key for direct billing
3. **Internal routing table**: Map features to model tiers automatically:
   - Socratic tutoring → Opus/Sonnet (needs reasoning)
   - Quiz generation → Sonnet/Haiku (structured output)
   - Flashcard generation → Haiku (simple extraction)
   - Summary generation → Sonnet (balanced)
4. **OpenRouter as fallback gateway**: If users want non-Anthropic models, route through OpenRouter rather than implementing each provider's API.

---

## 3. Claude Code / Anthropic Subscription Auth Reuse

### The Definitive Answer: OAuth Token Reuse is Prohibited

**February 2026 policy clarification:**
Anthropic explicitly banned OAuth token reuse in third-party applications. Key facts:

- OAuth tokens from Claude Free, Pro, and Max subscriptions (prefix `sk-ant-oat01-*`) are **only authorized for Claude Code and claude.ai**.
- Using these tokens in any other product, tool, or service — including the Agent SDK — violates the Consumer Terms of Service.
- As of ~February 20, 2026, OAuth workspace tokens generated via `claude setup-token` are **actively rejected by the API** when called from unauthorized clients.
- Anthropic sent legal requests to projects like OpenCode confirming OAuth support removal from third-party integrations.

**Why Anthropic enforces this:**
Subscription pricing ($20/month Pro, $100/month Max) is significantly cheaper per-token than API pricing. This created "token arbitrage" — users accessed Claude via subscriptions through third-party harnesses at a fraction of API cost. Anthropic closed this explicitly.

**Community impact:**
- Tools like Auto-Claude, Goose (by Block), and various open-source wrappers were forced to drop OAuth-based authentication.
- GitHub issues document widespread disruptions in January-February 2026 when enforcement began.

### What *Is* Allowed

| Method | Use Case | Allowed in Third-Party Apps? |
|--------|----------|------------------------------|
| OAuth tokens (subscription) | Claude Code, claude.ai | No |
| API keys (pay-as-you-go) | Direct API integration | Yes |
| AWS Bedrock | Enterprise/managed access | Yes |
| Google Vertex AI | Enterprise/managed access | Yes |
| OpenRouter | Aggregated multi-model access | Yes (via their API key) |

### BYOK (Bring Your Own Key) Pattern

The industry-standard pattern for third-party apps is BYOK:

1. User creates an Anthropic API account at console.anthropic.com
2. User generates an API key
3. User pastes the API key into the third-party app's settings
4. App stores key locally (browser localStorage/IndexedDB) or encrypted server-side
5. App makes API calls using the user's key — billing goes directly to user's Anthropic account

Apps using this pattern: CodeGPT, TypingMind, Witsy, AICoven, OpenClaw, Warp, and 50+ others listed on BYOKList.com.

### Actionable Patterns for Knowlune

1. **Do not attempt OAuth token reuse.** This is explicitly prohibited and technically blocked.
2. **Implement BYOK for Anthropic API keys.** Store user's API key in IndexedDB (encrypted) — never send to a backend server. Make API calls directly from the browser or through a thin proxy that adds CORS headers but doesn't store keys.
3. **Consider OpenRouter as a simpler alternative.** One API key gives access to Claude + GPT + Gemini + open-source models. Users only need one account.
4. **Pricing transparency in UI.** Show estimated cost per operation (e.g., "~$0.003 per quiz generation with Haiku") so users understand BYOK costs vs. the free tier (if Knowlune offers one with its own API budget).
5. **Browser-side API calls.** Since Knowlune is a client-side app (Vite + React), API calls can go directly from the browser to Anthropic's API. No backend needed — but CORS may require a lightweight proxy. Anthropic's API does support browser-origin requests when properly configured.

---

## 4. Feature Parity: Imported vs Native Content

### How Platforms Handle the Parity Problem

**StudyFetch approach — "content-agnostic processing":**
Regardless of input type (PDF, PowerPoint, video recording, YouTube link, handwritten notes photo), StudyFetch processes everything through the same AI pipeline and outputs identical study materials: flashcards, quizzes, summaries, and AI tutor responses. The user never sees a difference between a quiz generated from a PDF vs. one from a YouTube video. This is the gold standard for feature parity.

**Mindgrasp approach — "source-aware with parity":**
Mindgrasp similarly generates the same output types from any input, but adds source attribution. When combining uploaded materials with external research, outputs include "clickable source links" so users can verify provenance. Features like the Chrome extension (pulling content from Canvas/Blackboard) and LMS integrations mean imported content gets the same treatment as uploaded content.

**SCORM/xAPI standards — "wrapper normalization":**
Enterprise LMS platforms achieve feature parity across imported content via standards:
- **SCORM packages**: Wrap any content in a standardized container that reports completion, score, and duration back to the LMS. The LMS tracks progress identically regardless of content origin.
- **xAPI statements**: More granular — track any learning experience as `Actor-Verb-Object` triples (e.g., "Pedro completed Lesson 3"). Works across platforms via a Learning Record Store (LRS).
- **SCORM-to-xAPI wrapper**: A JavaScript bridge that automatically converts SCORM runtime calls to xAPI statements, enabling feature parity between legacy SCORM content and modern xAPI tracking.
- **LTI (Learning Tools Interoperability)**: Allows external tools to be embedded in an LMS with grade passback — the LMS treats external tool content as if it were native.

**WordPress LMS plugins (LearnDash, Tutor LMS, Academy LMS):**
These handle imported content via "content type" abstractions. A lesson can contain a native video, an embedded YouTube video, a SCORM package, or a PDF — all tracked with the same completion/progress mechanisms. The lesson wrapper provides parity; the content type is an implementation detail.

### Common Patterns vs. Innovative Approaches

| Pattern | Common (Most Platforms) | Innovative (Leaders) |
|---------|------------------------|---------------------|
| Content normalization | Extract text, generate study materials | Source-aware attribution with verification links (Mindgrasp) |
| Progress tracking | Completion percentage per item | xAPI granular statements across platforms |
| Quiz generation | Same quiz types from any input | Adaptive quiz difficulty based on learner performance |
| Notes | Manual notes on any content | AI-generated notes merged with manual annotations |
| Navigation | Linear lesson-by-lesson | Smart navigation based on knowledge gaps |
| Feature availability | Core features on all content | Degraded gracefully (e.g., no transcript = no keyword search, but everything else works) |

### Graceful Degradation Pattern

The most mature platforms don't enforce 100% parity — they use **graceful degradation**:
- Video content: full features (transcript search, speed control, bookmarks, quiz generation)
- PDF content: most features (text search, highlights, quiz generation) minus video-specific ones
- Audio content: some features (transcript, quiz generation) minus visual features
- External link: minimal features (notes, manual progress tracking)

Each content type has a **capability manifest** declaring what features are available, and the UI adapts accordingly.

### Actionable Patterns for Knowlune

1. **Content-agnostic processing pipeline**: Regardless of source (uploaded PDF, scraped web article, API-fetched course data), normalize to a common intermediate representation (extracted text + metadata) before generating study materials.
2. **Capability manifest per content type**: Define a `ContentCapabilities` interface:
   ```
   { hasTranscript: boolean, hasVideo: boolean, isSearchable: boolean,
     supportsQuizGen: boolean, supportsFlashcards: boolean, hasProgress: boolean }
   ```
   UI components check capabilities and show/hide features accordingly.
3. **Source attribution**: Show where content came from (uploaded, YouTube, Coursera, etc.) but never let source type reduce core feature availability. If text can be extracted, quizzes and flashcards should work.
4. **Unified progress tracking**: One progress model for all content types — `{ contentItemId, userId, completionPct, lastAccessed, timeSpent, score? }`. The source of the content doesn't affect how progress is stored or queried.
5. **Wrapper pattern for external content**: When importing from external sources, wrap in a Knowlune `ContentItem` that provides the standard interface. The wrapper handles source-specific quirks (e.g., YouTube needs iframe embedding, PDFs need a viewer component) while the rest of the system sees a uniform API.

---

## Summary: What's Common vs. Innovative

| Dimension | Common Practice | Innovative Edge |
|-----------|----------------|-----------------|
| Content model | Hierarchical (Course > Module > Lesson) | Source-discriminated with metadata escape hatches |
| AI model config | Hidden from users (branded feature) | Task-based auto-routing with power-user override |
| Auth for AI | BYOK API keys | OpenRouter as single gateway for multi-provider |
| Feature parity | Same features regardless of source | Capability manifests with graceful degradation |
| Route patterns | Slug + numeric IDs, source-agnostic | No platform differentiates routes by content origin |
| Progress tracking | Per-item completion percentage | xAPI-style granular activity statements |

---

## Sources

### Unified Course Models
- [Unified.to — LMS API Integration](https://unified.to/blog/learning_management_system_lms_api_integration_real_time_course_data_and_learning_platforms)
- [Coursera Catalog APIs](https://build.coursera.org/app-platform/catalog/)
- [Coursera CourseMetadata API](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/CourseMetadata)
- [Udemy — Modules, Lessons, Activities Hierarchy](https://business-support.udemy.com/hc/en-us/articles/13292139859991-Definitions-and-Hierarchy-of-Modules-Lessons-and-Activities-Leadership-Academy)
- [Schema.org Course Type](https://validator.schema.org/Course)
- [GeeksforGeeks — Database Design for LMS](https://www.geeksforgeeks.org/sql/how-to-design-a-database-for-learning-management-system-lms/)
- [GeeksforGeeks — Database Design for Online Learning Platform](https://www.geeksforgeeks.org/sql/how-to-design-a-database-for-online-learning-platform/)
- [Red Gate — Database Design for LMS](https://www.red-gate.com/blog/database-design-management-system/)
- [Hygraph — Creating Learning Platform with Next.js 13](https://hygraph.com/blog/creating-learning-platform-nextjs-13-app-router)

### AI Model Configuration
- [Mindgrasp vs StudyFetch AI Comparison](https://www.mindgrasp.ai/blog/mindgrasp-vs-studyfetch-ai-which-study-tool-works-better-for-college-students)
- [StudyFetch — AI Learning Platform](https://www.studyfetch.com/)
- [Mindgrasp — AI Study Tool](https://www.mindgrasp.ai/)
- [StudyFetch AI Flashcard Generator](https://www.studyfetch.com/features/flashcards)
- [StudyFetch Alternatives 2026 (Cramberry)](https://www.cramberry.study/blog/studyfetch-alternatives-2026)
- [Best AI Study Tools 2026 (Laxu AI)](https://laxuai.com/blog/best-ai-study-tools-2026)
- [OpenRouter — Unified LLM API](https://openrouter.ai/)
- [OpenRouter Models Documentation](https://openrouter.ai/docs/guides/overview/models)
- [LiteLLM — OpenRouter Integration](https://docs.litellm.ai/docs/providers/openrouter)
- [OpenClaw Model Selection Guide](https://blog.laozhang.ai/en/posts/openclaw-best-model-selection-guide)

### Anthropic OAuth & API Authentication
- [Claude Code Authentication Docs](https://code.claude.com/docs/en/authentication)
- [The Register — Anthropic Clarifies Ban on Third-Party Tool Access](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)
- [GitHub Issue — Anthropic Disabled OAuth Tokens for Third-Party Apps](https://github.com/anthropics/claude-code/issues/28091)
- [Lobsters — Anthropic Blocks Third-Party OAuth](https://lobste.rs/s/mhgog9/anthropic_blocks_third_party_tools_using)
- [Claude OAuth Update — What Happened and What to Do Next](https://daveswift.com/claude-oauth-update/)
- [GitHub Issue — Goose OAuth for Claude Subscription Users](https://github.com/block/goose/issues/3647)
- [Medium — Claude API Authentication in 2026](https://lalatenduswain.medium.com/claude-api-authentication-in-2026-oauth-tokens-vs-api-keys-explained-12e8298bed3d)
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Claude Pricing Breakdown (MetaCTO)](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)

### BYOK Pattern
- [BYOKList — Anthropic-Supporting Apps](https://byoklist.com/?platform=anthropic)
- [Warp — Bring Your Own API Key](https://docs.warp.dev/support-and-community/plans-and-billing/bring-your-own-api-key)
- [CodeGPT — BYOK](https://www.codegpt.co/bring-your-own-api-key)
- [Factory CLI — OpenAI & Anthropic BYOK](https://docs.factory.ai/cli/byok/openai-anthropic)
- [ngrok — AI Gateway with API Keys](https://ngrok.com/blog/ai-gateway-api-keys-credits)

### Feature Parity & Content Standards
- [SCORM vs xAPI vs LTI Explained (Mindsmith)](https://www.mindsmith.ai/blog/scorm-vs-xapi-vs-lti-understanding-elearning-standards-and-compatibility)
- [xAPI vs SCORM Comparison 2026 (iSpring)](https://www.ispringsolutions.com/blog/xapi-vs-scorm)
- [SCORM-to-xAPI Wrapper (GitHub)](https://github.com/adlnet/SCORM-to-xAPI-Wrapper)
- [EdTech Interoperability 101 (EVNE Developers)](https://evnedev.com/blog/company/edtech-interoperability/)
- [Best LMS for WordPress 2025 (Academy LMS)](https://academylms.net/best-lms-for-wordpress-in-2025/)
- [LMS Features Checklist 2025 (SchoolMaker)](https://www.schoolmaker.com/blog/lms-features-checklist)
- [Top LMS Features (Itransition)](https://www.itransition.com/elearning/lms/features)
- [Mindgrasp AI Review (Unite.AI)](https://www.unite.ai/mindgrasp-ai-review/)
- [Study Fetch Review 2026 (Dupple)](https://dupple.com/tools/study-fetch)
