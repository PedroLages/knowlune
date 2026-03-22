# Epic 22: Ollama Integration & Smart Course Categorization

## Context

Knowlune's Courses page had hardcoded category tabs tied to one instructor's content. We've already replaced those with dynamic filter chips (done in this session). The next step is enabling **local AI via Ollama** to auto-categorize courses on import, so filter chips populate automatically without manual tagging.

Users like Pedro run Ollama on Unraid servers with models already loaded. The integration should be dead simple: enter a URL, pick a model, done.

## Epic Overview

| Story | Title | Scope |
|-------|-------|-------|
| E22-S01 | Ollama provider integration | Add Ollama to AI provider registry, proxy + direct connection |
| E22-S02 | Model auto-discovery | Fetch available models from Ollama `/api/tags`, model picker UI |
| E22-S03 | Connection testing & health check | Verify Ollama reachability, show status in Settings |
| E22-S04 | Auto-categorize courses on import | Use Ollama to analyze course content and generate tags |
| E22-S05 | Dynamic filter chips from AI tags | Wire AI-generated tags into the Courses page filter chips |

---

## E22-S01: Ollama Provider Integration

**As a** user with Ollama on my local network,
**I want to** add Ollama as an AI provider in Settings,
**So that** I can use my own local models without API keys or costs.

### Acceptance Criteria

- AC1: "Ollama" appears as a provider option in Settings > AI Configuration
- AC2: User enters a server URL (e.g., `http://192.168.1.x:11434`) instead of an API key
- AC3: Requests route through the Express proxy by default (no CORS issues)
- AC4: Advanced toggle enables direct browser-to-Ollama connection
- AC5: CSP `connect-src` updated to allow user-configured Ollama endpoints
- AC6: OllamaLLMClient created extending BaseLLMClient, supporting streaming

### Key Files
- `src/lib/aiConfiguration.ts` — Add `'ollama'` to `AIProviderId`, URL-based config
- `src/ai/llm/ollama-client.ts` — New OllamaLLMClient
- `src/ai/llm/factory.ts` — Add `case 'ollama'`
- `server/providers.ts` — Ollama proxy adapter
- `server/index.ts` — Proxy route for Ollama
- `src/app/components/figma/AIConfigurationSettings.tsx` — URL input field for Ollama

### Ollama API Reference
- Base URL: `http://{host}:11434`
- Chat: `POST /api/chat` (OpenAI-compatible format)
- Generate: `POST /api/generate`
- Embeddings: `POST /api/embeddings` (can replace Transformers.js for larger models)
- List models: `GET /api/tags`
- No authentication required by default

---

## E22-S02: Model Auto-Discovery

**As a** user,
**I want to** see my available Ollama models in a dropdown,
**So that** I don't have to manually type model names.

### Acceptance Criteria

- AC1: After entering Ollama URL, app calls `GET /api/tags` to list models
- AC2: Models shown in a searchable dropdown with name and size
- AC3: Selected model is persisted in AI configuration
- AC4: If Ollama is unreachable, show clear error with troubleshooting hint
- AC5: Model list refreshes when URL changes

### Key Files
- `src/lib/aiConfiguration.ts` — Store selected model name
- `src/app/components/figma/AIConfigurationSettings.tsx` — Model picker dropdown
- `src/ai/llm/ollama-client.ts` — `listModels()` method

---

## E22-S03: Connection Testing & Health Check

**As a** user,
**I want to** verify my Ollama connection works before using AI features,
**So that** I know if something is misconfigured.

### Acceptance Criteria

- AC1: "Test Connection" button pings Ollama and shows success/failure
- AC2: Connection status indicator (green/red dot) in Settings
- AC3: If connection fails, show actionable error messages:
  - Unreachable → "Cannot reach Ollama at {url}. Is the server running?"
  - CORS error (direct mode) → "CORS blocked. Set OLLAMA_ORIGINS=* or use proxy mode"
  - Model not found → "Model {name} not available. Pull it with `ollama pull {name}`"
- AC4: Health check runs on app startup if Ollama is configured

### Key Files
- `src/lib/aiConfiguration.ts` — `testConnection()` implementation for Ollama
- `src/app/components/figma/AIConfigurationSettings.tsx` — Status indicator + test button

---

## E22-S04: Auto-Categorize Courses on Import

**As a** user,
**I want** imported courses to be automatically tagged with relevant categories,
**So that** I don't have to manually organize my course library.

### Acceptance Criteria

- AC1: When a course is imported, Ollama analyzes title + description + file names
- AC2: AI generates 2-5 topic tags per course (e.g., "Python", "Machine Learning", "Web Dev")
- AC3: Tags are stored on the imported course record in IndexedDB
- AC4: If Ollama is not configured, import works normally without auto-tagging (graceful degradation)
- AC5: User can edit/remove AI-generated tags after import
- AC6: Prompt is optimized for fast models (Llama 3.2 3B, Phi-3 Mini) — structured JSON output

### Prompt Design
```
Analyze this course and return 2-5 topic tags as a JSON array.
Course title: "{title}"
Content files: {file_list}
Return ONLY a JSON array of short tags, e.g.: ["Python", "Data Science", "Machine Learning"]
```

### Key Files
- `src/lib/courseImport.ts` — Hook into import flow for auto-tagging
- `src/ai/courseTagger.ts` — New module: send course metadata to Ollama, parse tags
- `src/stores/useCourseImportStore.ts` — Store AI-generated tags on course record

---

## E22-S05: Dynamic Filter Chips from AI Tags

**As a** user,
**I want** the Courses page to show filter chips based on AI-generated tags,
**So that** I can quickly find courses by topic.

### Acceptance Criteria

- AC1: Filter chips include both pre-seeded course categories AND imported course AI tags
- AC2: Chips are deduplicated and sorted by frequency (most courses first)
- AC3: Selecting a chip filters both imported and pre-seeded courses
- AC4: "Clear filters" resets to show all courses
- AC5: New tags appear automatically after importing a course (no page refresh needed)

### Key Files
- `src/app/pages/Courses.tsx` — Merge imported course tags with pre-seeded categories
- Already partially done: dynamic filter chips are implemented, need to extend to imported courses

---

## BMAD Commands to Formalize

Once you're ready to start implementation, run these in order:

```
/bmad-create-epics-and-stories    ← If you want BMAD to review/refine this epic structure
/bmad-create-story E22-S01        ← Create detailed story file for Ollama provider
/bmad-create-story E22-S02        ← Model auto-discovery story
/bmad-create-story E22-S03        ← Connection testing story
/bmad-create-story E22-S04        ← Auto-categorization story
/bmad-create-story E22-S05        ← Dynamic filter chips story
```

Then for implementation:
```
/start-story E22-S01              ← Branch, plan, implement
/review-story E22-S01             ← Quality gates + review agents
/finish-story E22-S01             ← PR creation
```

## Technical Notes

- Ollama API docs: https://docs.ollama.com/api/introduction
- Ollama GitHub: https://github.com/ollama/ollama/blob/main/docs/api.md
- Recommended models for tagging: Llama 3.2 3B, Phi-3 Mini, Gemma 2 2B
- Vercel AI SDK has an Ollama community provider: `ollama-ai-provider`
