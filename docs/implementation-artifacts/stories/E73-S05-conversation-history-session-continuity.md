---
story_id: E73-S05
story_name: "Conversation History & Session Continuity"
status: review
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests-skipped
  - design-review
  - code-review
  - code-review-testing
  - performance-benchmark-skipped
  - security-review
  - exploratory-qa
burn_in_validated: false
---

# Story 73.5: Conversation History & Session Continuity

Status: ready-for-dev

## Story

As a learner,
I want to browse my past tutor conversations and continue where I left off,
so that returning to a lesson feels natural and I don't lose my learning context.

## Acceptance Criteria

**Given** the learner is in the Tutor tab
**When** a History button (History icon, variant="ghost", size="icon") is rendered in the TranscriptBadge row
**Then** it has a badge overlay showing the conversation count if > 1
**And** tapping it opens a ConversationHistorySheet (shadcn/ui Sheet, side="right", width 320px on desktop, side="bottom" on mobile < 640px)

**Given** the ConversationHistorySheet is open
**When** it renders
**Then** it shows conversations grouped by "This Lesson" and "Other Lessons in Course"
**And** each ConversationSessionCard shows: timestamp (formatted: "Today, 2:30 PM" / "Yesterday" / "Mar 25"), topic labels (max 3, "+N more" with tooltip), modes used (labels from MODE_REGISTRY), message count, and Continue/Delete buttons

**Given** a session card's "Continue" button is tapped
**When** the conversation loads
**Then** the Sheet closes, the selected conversation's messages replace the current chat, the mode is restored to the conversation's currentMode, and the hint ladder is reset to 0

**Given** a session card's "Delete" button is tapped
**When** confirmation is given via an AlertDialog
**Then** the conversation is deleted from the chatConversations Dexie table and removed from the Sheet's list

**Given** the learner navigates to a lesson that has an existing conversation older than 5 minutes
**When** the Tutor tab loads
**Then** a ContinueConversationPrompt inline card appears at the top of the MessageList
**And** the card uses bg-brand-soft, border-brand/20, rounded-xl and shows "Continue your previous conversation?" with last session timestamp and topics
**And** "Continue" (variant="brand") loads the conversation; "Start Fresh" (variant="outline") dismisses the card and shows the empty state
**And** the card is not shown if the conversation was updated less than 5 minutes ago

**Given** the ConversationHistorySheet and ContinueConversationPrompt are rendered
**When** accessibility is tested
**Then** the Sheet has focus trap when open, Escape closes it returning focus to the trigger button
**And** session cards use article elements with time elements for timestamps
**And** the continue prompt's buttons meet 44x44px touch target requirements on mobile

**Given** keyboard shortcuts are active on desktop
**When** the learner presses Cmd+H
**Then** the ConversationHistorySheet toggles open/closed
**And** Cmd+M toggles the TutorMemoryIndicator expand/collapse
**And** Cmd+1 through Cmd+5 switch to modes 1-5 (Socratic, Explain, ELI5, Quiz Me, Debug)

## Tasks / Subtasks

- [ ] Task 1: Create History button with badge overlay (AC: 1)
  - [ ] 1.1 Add History icon button (variant="ghost", size="icon") to TranscriptBadge row
  - [ ] 1.2 Show badge overlay with conversation count when > 1
  - [ ] 1.3 Wire button to open ConversationHistorySheet

- [ ] Task 2: Create ConversationHistorySheet (AC: 1, 2)
  - [ ] 2.1 Implement Sheet (side="right" desktop, side="bottom" mobile < 640px, width 320px)
  - [ ] 2.2 Group conversations by "This Lesson" and "Other Lessons in Course"
  - [ ] 2.3 Create ConversationSessionCard with timestamp, topic labels, modes, message count, actions

- [ ] Task 3: Implement conversation loading (AC: 3)
  - [ ] 3.1 "Continue" button: close Sheet, load conversation messages, restore currentMode, reset hintLevel
  - [ ] 3.2 Ensure smooth transition when replacing current chat content

- [ ] Task 4: Implement conversation deletion (AC: 4)
  - [ ] 4.1 "Delete" button: show AlertDialog confirmation
  - [ ] 4.2 On confirm: delete from chatConversations Dexie table, remove from Sheet list

- [ ] Task 5: Create ContinueConversationPrompt (AC: 5)
  - [ ] 5.1 Inline card at top of MessageList with bg-brand-soft, border-brand/20, rounded-xl
  - [ ] 5.2 Show "Continue your previous conversation?" with timestamp and topics
  - [ ] 5.3 "Continue" (variant="brand") loads conversation; "Start Fresh" (variant="outline") dismisses
  - [ ] 5.4 Only show when conversation is older than 5 minutes

- [ ] Task 6: Implement accessibility (AC: 6)
  - [ ] 6.1 Sheet: focus trap, Escape closes, focus returns to trigger
  - [ ] 6.2 Session cards: article elements with time elements
  - [ ] 6.3 Continue prompt buttons: 44x44px touch targets on mobile

- [ ] Task 7: Implement keyboard shortcuts (AC: 7)
  - [ ] 7.1 Cmd+H: toggle ConversationHistorySheet
  - [ ] 7.2 Cmd+M: toggle TutorMemoryIndicator expand/collapse
  - [ ] 7.3 Cmd+1-5: switch modes (Socratic, Explain, ELI5, Quiz Me, Debug)
  - [ ] 7.4 Ensure shortcuts don't conflict with browser defaults
  - [ ] 7.5 Only active on desktop (skip on mobile)

- [ ] Task 8: Write tests
  - [ ] 8.1 Unit test: ConversationHistorySheet rendering, grouping logic
  - [ ] 8.2 Unit test: ContinueConversationPrompt visibility logic (5-minute threshold)
  - [ ] 8.3 Unit test: keyboard shortcut registration and dispatch
  - [ ] 8.4 Unit test: conversation loading restores mode and resets hint ladder

## Design Guidance

- **History Button**: Lucide History icon, variant="ghost", size="icon"; badge overlay (absolute -top-1 -right-1 bg-brand text-brand-foreground text-[10px] rounded-full min-w-[18px] h-[18px])
- **ConversationHistorySheet**: shadcn/ui Sheet, side="right" (desktop), side="bottom" (mobile < 640px); width 320px; bg-card border-l
- **ConversationSessionCard**: bg-card rounded-xl p-3 border; timestamp in text-xs text-muted-foreground; topic labels as small badges (bg-muted rounded-full px-2 py-0.5 text-xs); mode labels in text-xs text-muted-foreground italic; Continue (variant="brand" size="sm") and Delete (variant="ghost" size="sm" text-destructive)
- **ContinueConversationPrompt**: bg-brand-soft border-brand/20 rounded-xl p-4; "Continue your previous conversation?" in font-medium; timestamp and topics in text-sm text-muted-foreground; Continue (variant="brand") and Start Fresh (variant="outline") buttons side by side (stacked on mobile)
- **Mobile**: Sheet slides from bottom; ContinueConversationPrompt buttons stack vertically; all touch targets >= 44x44px

## Implementation Notes

- Conversations are loaded from chatConversations Dexie table (from E57-S03)
- Timestamp formatting: "Today, 2:30 PM" / "Yesterday" / "Mar 25" — use relative date logic
- Topic labels extracted from conversation messages (first few user messages or topicsExplored from learner model)
- Modes used: derive from unique mode tags across conversation messages
- Keyboard shortcuts: register via useEffect with event listener on document; clean up on unmount
- Cmd+1-5 for mode switching must check if mode is available (transcript-dependent modes)

## Testing Notes

- Sheet rendering: test open/close, grouping logic, session card content
- ContinueConversationPrompt: test 5-minute threshold, continue/dismiss actions
- Keyboard shortcuts: test registration, dispatch, cleanup, conflict avoidance
- Conversation loading: test messages replacement, mode restoration, hint ladder reset
- Deletion: test AlertDialog flow, Dexie deletion, list update

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
