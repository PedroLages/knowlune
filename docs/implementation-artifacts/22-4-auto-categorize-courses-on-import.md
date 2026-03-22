---
story_id: E22-S04
story_name: "Auto-Categorize Courses on Import"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 22.04: Auto-Categorize Courses on Import

## Story

As a user,
I want imported courses to be automatically tagged with relevant categories by my local AI,
so that I don't have to manually organize my course library.

## Acceptance Criteria

- **AC1**: Given Ollama is configured and connected, When I import a course, Then the AI analyzes the course title, description, and file names to generate topic tags
- **AC2**: Given auto-tagging succeeds, When I view the imported course, Then it shows 2-5 AI-generated topic tags (e.g., "Python", "Machine Learning", "Web Development")
- **AC3**: Given auto-tagging succeeds, When I check IndexedDB, Then the tags are persisted on the imported course record
- **AC4**: Given Ollama is NOT configured or unreachable, When I import a course, Then the import completes normally without tags (graceful degradation — no errors, no blocking)
- **AC5**: Given a course has AI-generated tags, When I view the course card, Then I can edit or remove individual tags
- **AC6**: Given the AI prompt runs, When it executes, Then it returns structured JSON output optimized for fast models (Llama 3.2 3B, Phi-3 Mini, Gemma 2 2B) and completes within 10 seconds

## Tasks / Subtasks

- [ ] Task 1: Create course tagger module (AC: 1, 6)
  - [ ] 1.1 Create `src/ai/courseTagger.ts` with `generateCourseTags(courseMetadata)` function
  - [ ] 1.2 Design prompt: send title + file list, request JSON array of 2-5 tags
  - [ ] 1.3 Parse JSON response with fallback (if model returns malformed JSON, extract tags heuristically)
  - [ ] 1.4 Add 10-second timeout for tagging request
- [ ] Task 2: Hook into import flow (AC: 1, 4)
  - [ ] 2.1 Modify `src/lib/courseImport.ts` to call `generateCourseTags()` after successful import
  - [ ] 2.2 Wrap in try-catch — if tagging fails, log warning and continue without tags
  - [ ] 2.3 Check if Ollama is configured before attempting (skip silently if not)
- [ ] Task 3: Persist tags (AC: 3)
  - [ ] 3.1 Update imported course record in `useCourseImportStore` with `aiTags: string[]`
  - [ ] 3.2 Store tags in IndexedDB alongside course metadata
  - [ ] 3.3 Differentiate AI tags from manual user tags (optional: `tagSource: 'ai' | 'manual'`)
- [ ] Task 4: Tag editing UI (AC: 5)
  - [ ] 4.1 Add inline tag editor to ImportedCourseCard — small X button on each tag
  - [ ] 4.2 Allow adding new manual tags via input field
  - [ ] 4.3 Save tag changes to IndexedDB immediately
- [ ] Task 5: Show tagging progress (AC: 1, 2)
  - [ ] 5.1 Show subtle indicator during auto-tagging (e.g., "Analyzing course..." text or spinner on card)
  - [ ] 5.2 Update card with tags once tagging completes

## Design Guidance

- Auto-tagging should feel invisible — don't block the import UI
- Show a brief "AI tagging..." indicator on the course card that resolves to tag pills
- Tag pills: same style as TopicFilter chips (rounded-full, brand colors)
- Tag editing: click X to remove, small + button or input to add

## Implementation Notes

- **KEY FINDING: Use Ollama's schema-based `format` parameter** — it grammar-enforces valid JSON output.
  Structural validity is guaranteed (99%+). Risk is only semantic (wrong values, not wrong format).
- **Use `/api/chat`** (not `/api/generate`) — better instruction following with system messages
- **Use `temperature: 0`** for deterministic classification
- **Schema-enforced prompt approach:**
  ```typescript
  const response = await ollama.chat({
    model: 'llama3.2',
    format: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
        difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] }
      },
      required: ['tags']
    },
    messages: [
      { role: 'system', content: 'You are a course classifier. Assign 1-5 topic tags. Return JSON only.' },
      { role: 'user', content: `Title: "${title}"\nFiles: ${fileList}` }
    ],
    options: { temperature: 0, num_predict: 200 }
  });
  ```
- **Recommended models:**
  - **Llama 3.2 3B** — 100% JSON compliance, 0.5-2s per course (BEST PICK)
  - **Qwen3 4B** — Better reasoning, similar speed
  - **Phi-3 Mini** — NOT recommended (46.7% JSON compliance)
- **Expected latency:** 0.5-2s per course, 10-40s for batch of 20 (sequential)
- **JSON fallback (defensive only):** Try direct parse → extract from markdown fences → regex brace match → retry once
- Fire-and-forget pattern: import succeeds immediately, tagging runs async in background

## Testing Notes

- Unit test: `generateCourseTags()` parses valid JSON response
- Unit test: `generateCourseTags()` handles malformed JSON gracefully
- Unit test: Graceful degradation when Ollama not configured
- E2E: Import a course, verify tags appear on card
- E2E: Import works normally when Ollama is not configured
- Edge case: Very long course titles, no file list, Ollama timeout, model returns too many/few tags

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] Read [engineering-patterns.md](../engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
