# E22-S04: Auto-Categorize Courses on Import — Implementation Plan

**Story:** [22-4-auto-categorize-courses-on-import.md](../implementation-artifacts/22-4-auto-categorize-courses-on-import.md)
**Date:** 2026-03-23
**Status:** Planning

---

## Overview

Add Ollama-powered auto-categorization to the course import flow. When a course is imported and Ollama is configured, the system sends the course title and file list to a local Ollama model, which returns 2-5 topic tags as structured JSON. Tags are persisted on the course and displayed immediately on the card.

## Key Findings from Codebase Research

### Existing Infrastructure (What We Leverage)

1. **`autoAnalysis.ts` already exists** — Fire-and-forget tag extraction via the Express proxy (uses configured cloud provider). E22-S04 adds a parallel Ollama-specific path that uses structured JSON output for higher reliability.

2. **Tags are fully functional** — `ImportedCourse.tags: string[]` exists, `updateCourseTags()` normalizes (lowercase, trim, sort, dedupe), `TagBadgeList` + `TagEditor` render and edit tags on cards.

3. **`autoAnalysisStatus` tracked in store** — `Record<string, AutoAnalysisStatus>` already tracks `'analyzing' | 'complete' | 'error' | null` per course. Currently not displayed on ImportedCourseCard.

4. **IndexedDB schema v19** — `importedCourses` table already has `*tags` array index. No migration needed.

5. **File list available post-import** — Video and PDF filenames are in `ImportedVideo[]` and `ImportedPdf[]` (persisted in same transaction). Can query `db.importedVideos.where('courseId').equals(id)` after import.

### Dependencies & Constraints

- **E22-S01 (Ollama provider) is in backlog** — Ollama is NOT yet in `AIProviderId`. This story needs a minimal Ollama configuration mechanism.
- **Approach:** Add an `ollamaUrl` field to AI configuration (localStorage). This is the minimum viable integration — E22-S01 will later formalize Ollama as a full provider with proxy support, model selection, etc.
- **No schema migration needed** — tags already exist on `ImportedCourse`.

### Design Decision: Ollama Direct vs. Proxy

| Option | Pros | Cons |
|--------|------|------|
| **Direct browser→Ollama** | Simpler, no server needed, uses `format` param for schema-enforced JSON | Requires CORS (`OLLAMA_ORIGINS=*`) |
| **Through Express proxy** | No CORS issues | Proxy doesn't support Ollama yet (E22-S01), can't use `format` param |

**Decision: Direct browser→Ollama** — The `format` parameter is the killer feature (99%+ JSON validity). Most Ollama users already run with permissive CORS or can set `OLLAMA_ORIGINS=*`. The existing auto-analysis via proxy serves as fallback for cloud providers.

---

## Implementation Steps

### Step 1: Extend AI Configuration for Ollama URL

**File:** `src/lib/aiConfiguration.ts`

Add Ollama-specific fields to `AIConfigurationSettings`:

```typescript
export interface AIConfigurationSettings {
  // ... existing fields ...

  /** Ollama server URL (e.g., "http://192.168.1.100:11434") */
  ollamaUrl?: string
  /** Selected Ollama model name (e.g., "llama3.2") */
  ollamaModel?: string
}
```

Add helper:

```typescript
export function getOllamaConfig(): { url: string; model: string } | null {
  const config = getAIConfiguration()
  if (!config.ollamaUrl) return null
  return {
    url: config.ollamaUrl.replace(/\/+$/, ''), // strip trailing slash
    model: config.ollamaModel || 'llama3.2',
  }
}
```

**Rationale:** Minimal surface area — just a URL and model name. E22-S01 will later expand this into a full provider with connection testing, model discovery, proxy support, etc.

### Step 2: Add Ollama URL Input to Settings UI

**File:** `src/app/components/figma/AIConfigurationSettings.tsx`

Add an "Ollama (Local)" section below the existing provider configuration:

- Text input for Ollama URL with placeholder `http://localhost:11434`
- Text input for model name with placeholder `llama3.2`
- Brief help text: "Run AI features locally with Ollama. No API key needed."
- Save to localStorage via `saveAIConfiguration({ ollamaUrl, ollamaModel })`

**Design:** Separate from the cloud provider selection — Ollama is additive, not mutually exclusive. Users can have both a cloud provider (for summaries, Q&A) and Ollama (for fast local tagging).

### Step 3: Create Course Tagger Module

**New file:** `src/ai/courseTagger.ts`

```typescript
export interface CourseTagResult {
  tags: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}

export async function generateCourseTags(
  courseMetadata: { title: string; fileNames: string[] },
  signal?: AbortSignal
): Promise<CourseTagResult>
```

**Implementation details:**

1. Read Ollama config via `getOllamaConfig()`
2. If null, return `{ tags: [] }` immediately (graceful degradation — AC4)
3. Call `POST {ollamaUrl}/api/chat` with:
   - `model`: from config (default `llama3.2`)
   - `format`: JSON schema object (schema-enforced output):
     ```json
     {
       "type": "object",
       "properties": {
         "tags": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 5 },
         "difficulty": { "type": "string", "enum": ["beginner", "intermediate", "advanced"] }
       },
       "required": ["tags"]
     }
     ```
   - `messages`: system prompt + user prompt with title and file list
   - `options`: `{ temperature: 0, num_predict: 200 }`
   - `stream: false` (we want the complete response, not streaming)
4. 10-second AbortController timeout (AC6)
5. Parse JSON response (guaranteed valid structure by `format` param)
6. Normalize tags: trim, lowercase, slice to 5 max

**JSON fallback chain (defensive only):**
1. Direct `JSON.parse(response.message.content)` — should always work with `format`
2. Extract from markdown fences: `` ```json ... ``` ``
3. Regex brace match: `/{[\s\S]*}/`
4. Return `{ tags: [] }` on total failure

**System prompt:**
```
You are a course classifier. Given a course title and file list, assign 1-5 short, descriptive topic tags. Focus on the subject matter, programming languages, frameworks, or skills taught. Return JSON only.
```

**User prompt:**
```
Title: "{title}"
Files: {comma-separated file list, max 50 files}
```

### Step 4: Hook Tagger into Import Flow

**File:** `src/lib/courseImport.ts`

After Step 9 (triggerAutoAnalysis), add Ollama tagging:

```typescript
// Step 9: Trigger auto-analysis (fire-and-forget, consent-gated)
triggerAutoAnalysis(course)

// Step 10: Trigger Ollama auto-tagging (fire-and-forget, independent of cloud AI)
triggerOllamaTagging(course, videos, pdfs)
```

**New function in `courseImport.ts` or `autoAnalysis.ts`:**

```typescript
function triggerOllamaTagging(
  course: ImportedCourse,
  videos: ImportedVideo[],
  pdfs: ImportedPdf[]
): void {
  // Skip if Ollama not configured
  const ollamaConfig = getOllamaConfig()
  if (!ollamaConfig) return

  runOllamaTagging(course, videos, pdfs).catch(error => {
    console.warn('[OllamaTagging] Failed:', error)
  })
}
```

**`runOllamaTagging` implementation:**
1. Set `autoAnalysisStatus` to `'analyzing'` for the course
2. Build file list from `videos.map(v => v.filename)` and `pdfs.map(p => p.filename)`
3. Call `generateCourseTags({ title: course.name, fileNames })` with 10s timeout
4. If tags returned:
   - Merge with any existing tags (from cloud auto-analysis)
   - Update Dexie: `db.importedCourses.update(course.id, { tags: merged })`
   - Update Zustand store
5. Set `autoAnalysisStatus` to `'complete'`
6. Show toast: "Added {n} topic tags to {courseName}"
7. On error: set status to `'error'`, show non-blocking toast

**Key design:** File list is available immediately after import (the `videos` and `pdfs` arrays from Step 5 of import). No need for a second IndexedDB query.

### Step 5: Show Tagging Progress on Course Card

**File:** `src/app/components/figma/ImportedCourseCard.tsx`

Add a subtle "AI tagging..." indicator when `autoAnalysisStatus` is `'analyzing'`:

```tsx
const analysisStatus = useCourseImportStore(
  state => state.autoAnalysisStatus[course.id]
)

// In the tags section, before TagBadgeList:
{analysisStatus === 'analyzing' && (
  <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
    <Loader2 className="size-3 animate-spin" />
    AI tagging...
  </span>
)}
```

**Design notes:**
- Non-blocking — card is fully interactive during tagging
- Disappears when tags arrive (status changes to `'complete'`)
- Accessible: `aria-live="polite"` region for screen readers

### Step 6: Tag Editing Enhancements (AC5)

**Already supported** — `TagBadgeList` with `onRemove` and `TagEditor` with `onAddTag` are already rendered on `ImportedCourseCard` (lines 399-400). No changes needed for basic tag editing.

**Optional enhancement (if time permits):** Add a visual indicator for AI-generated vs. manual tags (e.g., small sparkle icon on AI tags). This requires extending the `tags` field or adding a parallel `aiTags` field. Defer to E22-S05 if complex.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/ai/courseTagger.ts` | Ollama-powered course tag generation |
| `src/ai/__tests__/courseTagger.test.ts` | Unit tests for tagger |

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/aiConfiguration.ts` | Add `ollamaUrl`, `ollamaModel` fields + `getOllamaConfig()` helper |
| `src/lib/courseImport.ts` | Add Step 10: Ollama tagging call after import |
| `src/app/components/figma/ImportedCourseCard.tsx` | Add "AI tagging..." indicator |
| `src/app/components/figma/AIConfigurationSettings.tsx` | Add Ollama URL + model inputs |

## Files NOT Modified (No Changes Needed)

| File | Reason |
|------|--------|
| `src/data/types.ts` | `ImportedCourse.tags: string[]` already exists |
| `src/db/schema.ts` | No migration — `*tags` array index already present |
| `src/stores/useCourseImportStore.ts` | `updateCourseTags()`, `autoAnalysisStatus`, `getAllTags()` all exist |
| `server/` | Direct browser→Ollama call, no proxy needed |

---

## Testing Strategy

### Unit Tests (`src/ai/__tests__/courseTagger.test.ts`)

1. **Happy path:** Mock fetch → valid JSON response → returns parsed tags
2. **Malformed JSON fallback:** Response wrapped in markdown fences → still parses
3. **Ollama not configured:** `getOllamaConfig()` returns null → returns empty tags
4. **Timeout:** fetch aborted after 10s → returns empty tags, no throw
5. **Network error:** fetch rejects → returns empty tags, no throw
6. **Tag normalization:** Uppercase tags → lowercased; >5 tags → sliced to 5
7. **Empty file list:** Only title provided → still generates tags
8. **Model returns too few/many tags:** Validated and clamped

### E2E Tests (`tests/e2e/regression/e22-s04-auto-categorize.spec.ts`)

1. **AC1+AC2:** Seed Ollama mock (via `page.route()` to intercept `/api/chat`), import course, verify 2-5 tags appear on card
2. **AC3:** After import with mock Ollama, verify tags in IndexedDB via `page.evaluate()`
3. **AC4:** No Ollama configured → import succeeds, no tags, no error
4. **AC5:** After AI tags appear, click X to remove a tag → tag disappears; use TagEditor to add new tag
5. **AC6:** Verify mock request uses structured JSON `format` parameter

**E2E Mocking strategy:** Use Playwright's `page.route()` to intercept `**/api/chat` requests and return mock Ollama responses. No real Ollama server needed.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| CORS blocks browser→Ollama | Medium | Document `OLLAMA_ORIGINS=*` requirement; E22-S01 will add proxy fallback |
| Ollama returns wrong tags (semantic, not structural) | Low | `format` param guarantees structure; semantic quality is model-dependent |
| Race condition: cloud auto-analysis + Ollama tagging update tags simultaneously | Low | Both use merge semantics (`[...existing, ...new]` with dedup). Worst case: duplicate-free union |
| E22-S01 refactors Ollama config location | Expected | Keep config surface minimal. Migration is trivial (rename fields) |
| 10s timeout too short for slow hardware | Low | Configurable via constant; models like Llama 3.2 3B typically respond in 0.5-2s |

---

## Dependency Graph

```
E22-S04 (this story)
├── src/ai/courseTagger.ts (NEW)
│   ├── reads: aiConfiguration.ts (ollamaUrl, ollamaModel)
│   └── calls: Ollama /api/chat (direct HTTP)
├── src/lib/courseImport.ts (MODIFY)
│   ├── calls: courseTagger.generateCourseTags()
│   └── updates: useCourseImportStore (existing)
├── src/app/components/figma/ImportedCourseCard.tsx (MODIFY)
│   └── reads: useCourseImportStore.autoAnalysisStatus
└── src/app/components/figma/AIConfigurationSettings.tsx (MODIFY)
    └── writes: aiConfiguration (ollamaUrl, ollamaModel)
```

---

## Implementation Order

1. **Step 1** — Extend AI config (foundation, enables everything else)
2. **Step 3** — Create courseTagger module (core logic, unit-testable in isolation)
3. **Step 3 tests** — Unit tests for tagger
4. **Step 4** — Hook into import flow (integration point)
5. **Step 5** — Card progress indicator (UI feedback)
6. **Step 2** — Settings UI for Ollama URL (enables user configuration)
7. **Step 6** — Tag editing verification (should work already)
8. **E2E tests** — Full integration verification

---

## Open Questions for User Input

1. **Cloud auto-analysis coexistence:** Should Ollama tagging replace the existing `triggerAutoAnalysis()` when Ollama is configured, or run alongside it? Current plan: run alongside (both produce tags, merged with dedup).

2. **AI vs. manual tag distinction:** AC5 says users can edit/remove AI tags. Should we visually distinguish AI-generated tags from manual ones (e.g., sparkle icon)? Current plan: defer visual distinction — all tags treated equally.

3. **Consent gating:** Should Ollama tagging require the `analytics` consent toggle (like cloud auto-analysis), or should it be ungated since it's local/private? Current plan: ungated for local Ollama (data never leaves the network).
