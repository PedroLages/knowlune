---
story_id: E72-S02
story_name: "Mode-Tagged Messages & Memory Transparency UI"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 72.2: Mode-Tagged Messages & Memory Transparency UI

## Story

As a learner,
I want to see what the tutor remembers about me and which mode each message was sent in,
so that I trust the tutor's memory and can track how my conversation flowed across modes.

## Acceptance Criteria

**Given** the TutorMessage interface exists in `src/data/types.ts` (from E57-S03, currently has only `role`, `content`, `timestamp`)
**When** the schema is extended
**Then** each TutorMessage includes a required `mode: TutorMode` field, an optional `quizScore?: { correct: boolean; questionNumber: number }`, and an optional `debugAssessment?: 'green' | 'yellow' | 'red'`
**And** the chatConversations Dexie schema (blob-stored messages) does not need index changes, but the TutorMessage TypeScript interface is updated
**And** existing conversations without `mode` field gracefully default to `'socratic'` when loaded

**Given** a learner model exists for the current course
**When** the Tutor tab renders
**Then** a TutorMemoryIndicator component (shadcn/ui Collapsible + Card) appears below the mode chips
**And** the collapsed state shows "Tutor Memory: N insights about you" with a Brain icon and bg-brand-soft styling
**And** the expanded state shows strengths (text-success with check icon), misconceptions (text-destructive with x icon), vocabulary level, and last session summary

**Given** no learner model exists for the current course
**When** the Tutor tab renders
**Then** the TutorMemoryIndicator is not rendered (hidden, not empty)

**Given** the memory indicator is expanded
**When** the learner clicks "Clear memory"
**Then** a confirmation dialog appears and upon confirmation, clearLearnerModel is called and the indicator disappears
**And** when the learner clicks "Edit memory"
**Then** a TutorMemoryEditDialog opens where individual strength/misconception entries can be removed

**Given** a conversation has messages from multiple modes
**When** the MessageList renders
**Then** each assistant message shows a mode label (from MODE_REGISTRY.label) and timestamp at 10px text in text-muted-foreground at the bottom-left of the bubble
**And** mode badges are only shown when the conversation has used more than one mode

**Given** the TutorMemoryIndicator is rendered
**When** the component is tested for accessibility
**Then** the Collapsible trigger has aria-label="Toggle tutor memory panel" and aria-expanded state
**And** strengths/misconceptions lists use role="list" with role="listitem" children

## Tasks / Subtasks

- [ ] Task 1: Extend TutorMessage schema (AC: 1)
  - [ ] 1.1 Add `mode: TutorMode` required field to TutorMessage interface in `src/data/types.ts`
  - [ ] 1.2 Add `quizScore?: { correct: boolean; questionNumber: number }` to TutorMessage
  - [ ] 1.3 Add `debugAssessment?: 'green' | 'yellow' | 'red'` to TutorMessage
  - [ ] 1.4 No Dexie schema change needed (messages are blob-stored); add backward-compat default `mode: 'socratic'` in `toChatMessage()` in `useTutorStore.ts`

- [ ] Task 2: Create TutorMemoryIndicator component (AC: 2, 3)
  - [ ] 2.1 Create `src/app/components/tutor/TutorMemoryIndicator.tsx`
  - [ ] 2.2 Implement collapsed state: Brain icon, "Tutor Memory: N insights about you", bg-brand-soft
  - [ ] 2.3 Implement expanded state: strengths list (text-success, check icon), misconceptions list (text-destructive, x icon), vocabulary level, last session summary
  - [ ] 2.4 Conditional render: hide entirely when no learner model exists

- [ ] Task 3: Create TutorMemoryEditDialog (AC: 4)
  - [ ] 3.1 Create `src/app/components/tutor/TutorMemoryEditDialog.tsx`
  - [ ] 3.2 Implement "Clear memory" with AlertDialog confirmation that calls clearLearnerModel
  - [ ] 3.3 Implement "Edit memory" dialog showing individual strength/misconception entries with remove buttons
  - [ ] 3.4 Wire remove actions to updateLearnerModel (filter out removed entries)

- [ ] Task 4: Extend MessageBubble with mode badges (AC: 5)
  - [ ] 4.1 Add mode label + timestamp display at bottom-left of assistant MessageBubble
  - [ ] 4.2 Use MODE_REGISTRY.label for mode display text
  - [ ] 4.3 Style: text-[10px] text-muted-foreground, separated by middle dot
  - [ ] 4.4 Conditional rendering: only show mode badges when conversation uses multiple modes

- [ ] Task 5: Integrate TutorMemoryIndicator into Tutor tab layout (AC: 2)
  - [ ] 5.1 Add TutorMemoryIndicator below TutorModeChips in the Tutor tab
  - [ ] 5.2 Connect to useTutorStore learnerModel state

- [ ] Task 6: Accessibility (AC: 6)
  - [ ] 6.1 Add aria-label="Toggle tutor memory panel" and aria-expanded to Collapsible trigger
  - [ ] 6.2 Add role="list" and role="listitem" to strengths/misconceptions lists
  - [ ] 6.3 Ensure all interactive elements meet 44x44px touch targets on mobile
  - [ ] 6.4 Verify keyboard navigation (Tab, Enter/Space to toggle)

- [ ] Task 7: Unit + E2E tests
  - [ ] 7.1 Unit test TutorMemoryIndicator rendering (with model, without model, collapsed/expanded)
  - [ ] 7.2 Unit test TutorMemoryEditDialog (remove entries, clear all)
  - [ ] 7.3 Unit test MessageBubble mode badge conditional rendering
  - [ ] 7.4 E2E test: memory indicator appears when learner model exists
  - [ ] 7.5 E2E test: clear memory flow

## Design Guidance

**TutorMemoryIndicator layout:**
- Position: Below TutorModeChips, above MessageList
- Collapsed: Single-line Card with `bg-brand-soft`, `text-brand-soft-foreground`, Brain icon (16px), insight count, chevron toggle
- Expanded: Card body with strengths (check icon, text-success), misconceptions (x icon, text-destructive), vocabulary level, last session summary
- Clear/Edit buttons: `variant="ghost"`, `size="sm"` at bottom of expanded card

**MessageBubble mode badges:**
- Position: bottom-left of assistant message bubble
- Style: `text-[10px] text-muted-foreground`
- Format: `"socratic · 2:31 PM"` (mode label + middle dot + timestamp)
- Only rendered when conversation has messages from 2+ different modes

**Design tokens used:**
- Memory indicator: `bg-brand-soft`, `text-brand-soft-foreground`
- Strengths: `text-success`
- Misconceptions: `text-destructive`
- Mode badges: `text-muted-foreground`

**Responsive:**
- Mobile: abbreviated memory text ("3 insights" vs full descriptions), full-width card
- Desktop: full descriptions visible in expanded state

## Implementation Notes

**Key architecture references:**
- UX spec: `_bmad-output/planning-artifacts/ux-design-tutor-memory-modes.md` — Component specs 2, 8
- Architecture: `_bmad-output/planning-artifacts/architecture-tutor-memory-modes.md` — Decision 5 (mode-tagged messages)
- Existing MessageBubble: `src/app/components/chat/MessageBubble.tsx` (already exists from E57)
- Existing TutorModeChips: `src/app/components/tutor/TutorModeChips.tsx` (already exists from E57-S04, renders mode toggle UI)
- Existing `toChatMessage()`/`toTutorMessage()` converters in `src/stores/useTutorStore.ts` — must be updated to include `mode` field
- Current TutorMode type: `'socratic' | 'explain' | 'quiz'` (defined in `src/ai/tutor/types.ts`)

**Dependencies:**
- E72-S01 (learner model schema, CRUD service, store state) — must be complete first
- MODE_REGISTRY will be created in E73-S01; for now, use a simple label lookup or forward-declare

**Note on MODE_REGISTRY:** This story references MODE_REGISTRY.label for mode badges. Since E73-S01 creates the full registry, either:
1. Create a minimal mode label map in this story (preferred — no forward dependency)
2. Or forward-declare the registry type and implement the lookup

## Testing Notes

- Unit tests for component rendering (React Testing Library)
- E2E tests for memory indicator visibility and clear flow
- Test that mode badges only appear for multi-mode conversations
- Test accessibility: aria attributes, keyboard navigation, screen reader text

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
