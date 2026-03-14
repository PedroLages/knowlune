---
story_id: E9B-S05
story_name: "AI Note Organization and Cross-Course Links"
status: in-progress
started: 2026-03-14
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 9.6: AI Note Organization

## Story

As a learner,
I want the AI to auto-tag, categorize, and link my notes across courses while showing me related concepts,
So that my notes are well-organized and I can discover connections between different subjects.

## Acceptance Criteria

**AC1: AI Organization Request**
**Given** I have notes across one or more courses
**When** I click "Organize Notes with AI" in the notes management area
**Then** the AI analyzes all my notes and generates proposed tags, categories, and cross-course links

**AC2: Preview Panel**
**Given** the AI has generated organization proposals
**When** the results are displayed
**Then** I see a preview panel showing each proposed change (new tags, category assignments, and note links)
**And** each change includes a brief AI rationale
**And** I can accept or reject each individual change before applying

**AC3: Apply Changes**
**Given** I am reviewing proposed changes in the preview panel
**When** I click "Apply Selected Changes"
**Then** only the changes I accepted are applied to my notes
**And** rejected changes are discarded
**And** a summary toast confirms the number of changes applied

**AC4: Related Concepts Panel**
**Given** I am viewing a note
**When** the note shares 1 or more tags or the AI determines topical overlap (minimum 2 shared key terms) with notes from other courses
**Then** a "Related Concepts" panel is displayed alongside the note
**And** each related note shows its title, source course, and the shared tags or overlapping terms

**AC5: Navigation Between Related Notes**
**Given** the "Related Concepts" panel lists related notes
**When** I click on a related note
**Then** I am navigated to that note's detail view
**And** a back-link to my original note is visible

**AC6: AI Unavailable Fallback**
**Given** the AI provider is unavailable
**When** I attempt to organize notes with AI
**Then** the system displays an "AI unavailable" message with retry option
**And** the "Related Concepts" panel falls back to tag-based matching only (no AI topical overlap)
**And** the fallback activates within 2 seconds

**AC7: Privacy**
**Given** the AI constructs the note organization request
**When** the API call is made
**Then** only note content, existing tags, and course context are transmitted
**And** no user metadata, file paths, or personally identifiable information is included

## Tasks / Subtasks

- [ ] Task 1: Create AI note organization service (`src/ai/noteOrganizer.ts`) (AC: 1, 7)
  - [ ] 1.1 Follow `generateLearningPath` pattern: config → consent → sanitize → fetch → parse
  - [ ] 1.2 LLM prompt with note content (truncated 200 chars), tags, course name
  - [ ] 1.3 Batch notes in groups of 20 for token limit protection
  - [ ] 1.4 Window mock for E2E tests

- [ ] Task 2: Create related concepts finder (`src/lib/relatedConcepts.ts`) (AC: 4, 6)
  - [ ] 2.1 Tag intersection matching (notes sharing 1+ tags)
  - [ ] 2.2 Vector similarity search via existing vectorStorePersistence
  - [ ] 2.3 Hybrid merge with deduplication
  - [ ] 2.4 2-second timeout fallback to tag-only matching

- [ ] Task 3: Create Related Concepts panel component (AC: 4, 5)
  - [ ] 3.1 Collapsible panel with note title, course badge, shared tags/terms
  - [ ] 3.2 Click navigation with back-link support
  - [ ] 3.3 Loading, empty, and fallback states

- [ ] Task 4: Create Organize Preview Dialog component (AC: 2, 3)
  - [ ] 4.1 Responsive Dialog/Sheet with proposal cards
  - [ ] 4.2 Per-proposal accept/reject checkboxes
  - [ ] 4.3 Apply changes → saveNote() + toast confirmation

- [ ] Task 5: Create Organize Notes button component (AC: 1, 6)
  - [ ] 5.1 Button with loading/error states
  - [ ] 5.2 AI availability and consent gates

- [ ] Task 6: Integrate into Notes page (AC: 1-6)
  - [ ] 6.1 Add OrganizeNotesButton to header
  - [ ] 6.2 Add RelatedConceptsPanel to expanded note view

- [ ] Task 7: Integrate into NoteCard expanded view (AC: 4-5)
  - [ ] 7.1 Add RelatedConceptsPanel after action buttons

- [ ] Task 8: ATDD E2E tests (AC: 1-7)
  - [ ] 8.1 Organization flow tests (AC1-3)
  - [ ] 8.2 Related concepts tests (AC4-5)
  - [ ] 8.3 Fallback and privacy tests (AC6-7)

## Design Guidance

### Layout Strategy

**Notes page header** — Add "Organize with AI" button inline with existing controls (QAChatPanel + sort dropdown). Use `variant="outline"` with `<Sparkles />` icon to match the AI-feature visual language established in QAChatPanel. Loading state uses `<Loader2 className="animate-spin" />`.

```
┌─ My Notes (12) ──────────────── [Q&A Chat] [Organize with AI ✨] [Sort ▼] ─┐
│ [Search notes...________________________] [Semantic toggle]                  │
│ [react] [hooks] [vue] [state-management] ...tag filters...                   │
│                                                                              │
│ ┌─ Note Card (expanded) ───────────────────────────────────────────────────┐ │
│ │ Note content preview...                                                  │ │
│ │ [Open in Lesson] [Export] [0:42]                                         │ │
│ │                                                                          │ │
│ │ ┌─ Related Concepts ──────────────────────────────────────────────────┐  │ │
│ │ │ 📎 "Vue composables..." — Vue Basics • shared: [state-management]  │  │ │
│ │ │ 📎 "State patterns..."  — Architecture • terms: reactivity, state  │  │ │
│ │ └────────────────────────────────────────────────────────────────────┘  │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
```

### Organize Preview Dialog

**Responsive**: `<Sheet>` on mobile (<768px, slides from right), `<Dialog>` on desktop (centered modal, max-w-2xl). Follows QAChatPanel's responsive pattern.

```
┌─ AI Organization Proposals (4 notes) ──────────────────── [×] ─┐
│                                                                 │
│ ☑ Note: "React hooks allow state management..."                 │
│   + Tags: [state-management] [functional-components]  (green)   │
│   + Category: [frontend-development]  (violet)                  │
│   + Links: → "Vue composables..." (course-2)                    │
│   💬 "This note covers state management via hooks..."           │
│ ─────────────────────────────────────────────────────────────── │
│ ☐ Note: "useEffect handles side effects..."                     │
│   + Tags: [lifecycle] [cleanup]  (green)                        │
│   + Category: [frontend-development]  (violet)                  │
│   💬 "Side effects and cleanup are lifecycle concepts..."       │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│        [Select All] [Deselect All]    [Apply Selected Changes]  │
└─────────────────────────────────────────────────────────────────┘
```

### Design Token Usage

| Element | Token | Why |
|---------|-------|-----|
| Organize button | `variant="outline"` + `<Sparkles />` | Consistent with AI feature pattern |
| Loading spinner | `<Loader2 className="animate-spin size-4" />` | Established loading pattern |
| New tag badges | `bg-success-soft text-success` (green tint) | Signals "addition" |
| Category badges | `bg-accent-violet-muted text-accent-violet` | Distinct from regular tags |
| Existing tag badges | `variant="outline"` | Matches current tag bar style |
| AI rationale text | `text-sm text-muted-foreground italic` | De-emphasized supporting text |
| Cross-course link | `text-brand hover:text-brand-hover underline` | Interactive link style |
| Fallback indicator | `text-xs text-muted-foreground` | Subtle, non-intrusive |
| Error toast | `toast.error()` | Sonner's destructive style |
| Success toast | `toast.success()` | Sonner's success style |

### Related Concepts Panel

Renders inside expanded NoteCard, below action buttons. Collapsible via `<Collapsible>` (Radix).

- **Header**: "Related Concepts" with count badge — `text-sm font-medium`
- **Each entry**: Clickable row with `hover:bg-accent rounded-lg p-2 transition-colors`
  - Note title/preview (truncated 60 chars) — `text-sm font-medium`
  - Course name — `<Badge variant="secondary" className="text-xs">`
  - Shared tags — `<Badge variant="outline" className="text-xs">` per tag
  - Shared terms — `text-xs text-muted-foreground` comma-separated
- **Empty state**: `"No related notes found"` in `text-sm text-muted-foreground`
- **Fallback mode**: Append `"(tag matches only)"` in `text-xs text-muted-foreground/70`
- **Loading**: 2-3 `<Skeleton className="h-10 w-full" />` rows

### Responsive Behavior

| Breakpoint | Organize Button | Preview Dialog | Related Panel |
|------------|----------------|----------------|---------------|
| < 640px | Icon only (`<Sparkles />`) | Full-screen Sheet | Stacked below actions |
| 640-1023px | "Organize" + icon | Sheet from right (w-96) | Stacked below actions |
| ≥ 1024px | "Organize with AI" + icon | Centered Dialog (max-w-2xl) | Stacked below actions |

### Accessibility (WCAG 2.1 AA+)

- `OrganizeNotesButton`: `aria-label="Organize notes with AI"`, `aria-busy` during loading
- `OrganizePreviewDialog`: Focus trap via Radix Dialog/Sheet, `aria-describedby` for rationale
- `RelatedConceptsPanel`: `role="region"` with `aria-label="Related concepts"`, links use `aria-label` with note title
- Checkboxes: Labeled via `aria-label` with note preview text
- All interactive elements: visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring`)
- Color contrast: All badge combinations meet 4.5:1 ratio against their backgrounds

## Implementation Plan

See [plan](plans/e9b-s05-ai-note-organization-plan.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
