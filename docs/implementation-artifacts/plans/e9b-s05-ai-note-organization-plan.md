# E9B-S05: AI Note Organization — Implementation Plan

## Context

LevelUp users accumulate notes across multiple courses but have no way to discover connections between them or systematically organize their growing note collection. This story adds AI-powered auto-tagging, categorization, and cross-course linking with a preview/accept/reject workflow, plus a "Related Concepts" panel that surfaces connections when viewing any note. The AI infrastructure (Vercel AI SDK, proxy server, embedding pipeline, vector store) is already operational from E9B-S01–S03.

## Setup (post plan-approval)

1. Create git worktree: `feature/e9b-s05-ai-note-organization`
2. Create story file from template → `docs/implementation-artifacts/9b-5-ai-note-organization-and-cross-course-links.md`
3. Update sprint-status.yaml → `in-progress`
4. Generate ATDD E2E tests → `tests/e2e/story-e9b-s05.spec.ts`
5. Generate design guidance via `/frontend-design` skill → append to story file
6. Initial commit: `chore: start story E9B-S05`

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM response format | Non-streaming `/api/ai/generate` | Structured JSON needed, not prose. Same pattern as `generateLearningPath` in `src/ai/learningPath/generatePath.ts` |
| Categories | Namespaced tags `category:xyz` | Avoids Dexie schema migration; works with existing `tags: string[]` and `*tags` index |
| Cross-course links | Computed on-the-fly | No schema migration needed; tag intersection + vector similarity search handles 10K notes in <11ms |
| Related Concepts placement | Expanded NoteCard + LessonPlayer notes sidebar | Both locations where users view note detail |

## Architecture

```
User clicks "Organize Notes with AI"
  → OrganizeNotesButton.tsx
    → noteOrganizer.ts (sanitize notes → /api/ai/generate → parse JSON proposals)
      → OrganizePreviewDialog.tsx (accept/reject per proposal)
        → useNoteStore.saveNote() for accepted changes
          → toast.success()

User expands a note
  → RelatedConceptsPanel.tsx
    → relatedConcepts.ts (tag matching + vector similarity hybrid)
      → display related notes with title, course, shared tags/terms
```

### Types (new, in `src/ai/noteOrganizer.ts`)

```ts
interface NoteOrganizationProposal {
  noteId: string
  suggestedTags: string[]        // new tags to add (lowercase)
  suggestedCategories: string[]  // "category:xyz" namespaced tags
  crossCourseLinks: string[]     // noteIds from other courses
  rationale: string              // AI explanation
}

interface RelatedNote {
  noteId: string
  title: string         // first line of content or lesson title
  courseName: string
  sharedTags: string[]
  sharedTerms: string[]
  similarityScore?: number
}
```

## Implementation Tasks

### Phase 1: Service Layer

**Task 1: `src/ai/noteOrganizer.ts`** — AI note organization service
- `organizeNotes(notes: Note[], courseNames: Map<string, string>): Promise<NoteOrganizationProposal[]>`
- Follow `generateLearningPath` pattern exactly: config check → consent check → sanitize → fetch `/api/ai/generate` → parse JSON → validate
- LLM prompt: note content (truncated to 200 chars each), existing tags, course name — NO noteIds, timestamps, or PII (AC7)
- Use internal indices (0, 1, 2...) in prompt, map back to real noteIds after response
- Temperature: 0.2, maxTokens: 4000
- Batch notes in groups of 20 if >20 notes (token limit protection)
- Window mock: `window.__mockNoteOrganizationResponse` for E2E tests
- **Reuse**: `getAIConfiguration()`, `getDecryptedApiKey()`, `isFeatureEnabled('noteOrganization')` from [src/lib/aiConfiguration.ts](src/lib/aiConfiguration.ts)

**Task 2: `src/lib/relatedConcepts.ts`** — Hybrid related note finder
- `findRelatedNotes(note: Note, allNotes: Note[]): Promise<RelatedNote[]>`
- Step 1: Tag intersection — notes sharing 1+ tags, scored by overlap count
- Step 2: Vector similarity — `vectorStorePersistence.getStore().search(embedding, 5)` if embeddings exist
- Step 3: Merge, deduplicate by noteId, sort by combined score, return top 5
- Extract shared key terms: compare word sets (stopwords removed, min 2 shared terms for "topical overlap" per AC4)
- Fallback (AC6): wrap vector search in `Promise.race` with 2s timeout; return tag-only results if vector fails
- **Reuse**: `vectorStorePersistence` from [src/ai/vector-store.ts](src/ai/vector-store.ts), `stripHtml()` from [src/lib/textUtils.ts](src/lib/textUtils.ts)

### Phase 2: UI Components

**Task 3: `src/app/components/notes/RelatedConceptsPanel.tsx`** — AC4-5
- Collapsible section with "Related Concepts" header
- Each entry: note title, course Badge, shared tags as Badge components, shared terms as text
- Click → navigate to note (Notes dashboard: scroll + expand; LessonPlayer: route to lesson)
- Back-link support (AC5): pass `from` query param for back navigation
- Loading: Skeleton placeholders
- Empty: "No related notes found" muted text
- Fallback indicator: if tag-only mode, subtle "(tag matches only)" label
- **Reuse**: `Badge`, `Collapsible`, `Skeleton` from [src/app/components/ui/](src/app/components/ui/)

**Task 4: `src/app/components/notes/OrganizePreviewDialog.tsx`** — AC2-3
- Responsive: `Sheet` on mobile (<768px), `Dialog` on desktop
- Header: "AI Organization Proposals" with note count
- List of `ProposalCard` items, each showing:
  - Note title/preview (first line of content)
  - Proposed tags as Badges (green for new, existing for current)
  - Proposed category as Badge with distinct style
  - Cross-course links as clickable note references
  - AI rationale in muted text
  - Checkbox to accept/reject (default: checked)
- Footer actions: "Select All" / "Deselect All" toggle, "Apply Selected Changes" button
- On apply: iterate accepted proposals, merge new tags into existing tags, call `useNoteStore.saveNote()` per note
- Toast: `toast.success(\`Applied changes to ${count} notes\`)` (AC3)
- **Reuse**: `Dialog`, `Sheet`, `Checkbox`, `Badge`, `Button`, `ScrollArea` from ui/

**Task 5: `src/app/components/notes/OrganizeNotesButton.tsx`** — AC1, AC6
- Button with `<Sparkles />` icon: "Organize with AI"
- States: idle → loading (Loader2 spinner) → done (opens dialog)
- Disabled when: `!isAIAvailable()` or `!isFeatureEnabled('noteOrganization')` or no notes
- Error: toast.error with retry option (AC6: "AI unavailable" message)
- On click: `loadNotes()` → `organizeNotes()` → set proposals state → open dialog
- **Reuse**: `isAIAvailable()`, `isFeatureEnabled()` from [src/lib/aiConfiguration.ts](src/lib/aiConfiguration.ts)

### Phase 3: Integration

**Task 6: Modify [src/app/pages/Notes.tsx](src/app/pages/Notes.tsx)**
- Import and add `OrganizeNotesButton` in header bar (alongside existing QAChatPanel toggle and sort dropdown)
- In expanded note view (~line 368): render `RelatedConceptsPanel` passing current note + all notes
- Wire up dialog state: `proposals` and `showPreview` state variables

**Task 7: Modify [src/app/components/notes/NoteCard.tsx](src/app/components/notes/NoteCard.tsx)**
- In expanded state: add `RelatedConceptsPanel` after existing action buttons section
- Props: pass `note` and `allNotes` from parent

### Phase 4: E2E Tests

**Task 8: `tests/e2e/story-e9b-s05.spec.ts`** — ATDD tests
- AC1: Click organize → loading state → proposals appear
- AC2: Preview panel shows proposals with rationale, individual accept/reject
- AC3: Apply selected → tags updated → toast confirmation
- AC4: Expand note with shared tags → Related Concepts panel visible
- AC5: Click related note → navigation with back-link
- AC6: AI unavailable → error message with retry; Related Concepts tag-only fallback
- AC7: Privacy — verify API payload contains no metadata (intercept route)
- **Reuse**: `mockLLMClient()` from [tests/support/helpers/mock-llm-client.ts](tests/support/helpers/mock-llm-client.ts), `seedIndexedDBStore()` from [tests/support/helpers/indexeddb-seed.ts](tests/support/helpers/indexeddb-seed.ts), `seedAIConfiguration()` from [tests/support/helpers/ai-summary-mocks.ts](tests/support/helpers/ai-summary-mocks.ts)

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/ai/noteOrganizer.ts` | AI service: sanitize → LLM → parse proposals |
| Create | `src/lib/relatedConcepts.ts` | Hybrid tag + vector related note finder |
| Create | `src/app/components/notes/OrganizeNotesButton.tsx` | Trigger button with loading/error states |
| Create | `src/app/components/notes/OrganizePreviewDialog.tsx` | Preview/accept/reject UI |
| Create | `src/app/components/notes/RelatedConceptsPanel.tsx` | Related notes sidebar panel |
| Create | `tests/e2e/story-e9b-s05.spec.ts` | ATDD E2E tests |
| Modify | `src/app/pages/Notes.tsx` | Add button + related panel integration |
| Modify | `src/app/components/notes/NoteCard.tsx` | Add related panel to expanded view |

## Key Reusable Patterns

| Pattern | Source | Reuse for |
|---------|--------|-----------|
| Non-streaming LLM + JSON parse | [src/ai/learningPath/generatePath.ts](src/ai/learningPath/generatePath.ts) | `noteOrganizer.ts` — exact same fetch/parse/validate pattern |
| Window mock injection | `window.__mockLearningPathResponse` | `window.__mockNoteOrganizationResponse` for E2E |
| AI config/consent gates | [src/lib/aiConfiguration.ts](src/lib/aiConfiguration.ts) | `isFeatureEnabled('noteOrganization')`, `isAIAvailable()` |
| Vector search | [src/ai/vector-store.ts](src/ai/vector-store.ts) | `findRelatedNotes()` similarity lookup |
| Tag system | [src/lib/progress.ts](src/lib/progress.ts) `getAllNoteTags()` | Tag intersection for related concepts |
| Note store optimistic updates | [src/stores/useNoteStore.ts](src/stores/useNoteStore.ts) | Applying accepted tag changes |
| E2E mock helpers | [tests/support/helpers/](tests/support/helpers/) | LLM mocking, IndexedDB seeding, AI config |

## Verification

1. **Build**: `npm run build` — no TS errors
2. **Lint**: `npm run lint` — no hardcoded colors, design tokens only
3. **Dev server**: `npm run dev` + `cd server && npm start` — navigate to `/notes`
4. **Manual test flow**:
   - Create 3+ notes across 2+ courses with some shared tags
   - Click "Organize with AI" → verify loading state → preview dialog opens
   - Accept some proposals, reject others → click Apply → verify tags updated + toast
   - Expand a note → verify Related Concepts panel shows related notes
   - Click a related note → verify navigation + back-link
   - Disable AI in Settings → verify fallback behavior
5. **E2E**: `npx playwright test tests/e2e/story-e9b-s05.spec.ts --project=chromium`
6. **Accessibility**: Tab through all new UI elements, verify ARIA labels on buttons/panels

## Workflow Recommendation

**Review first** (`/review-story` → `/finish-story`)

This story has **7 ACs**, **UI changes** across **8 tasks** touching notes page, NoteCard, and 5 new components — a design review will catch visual regressions and accessibility issues before shipping.
