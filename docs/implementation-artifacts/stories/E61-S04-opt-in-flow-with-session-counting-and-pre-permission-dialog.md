---
story_id: E61-S04
story_name: "Opt-In Flow with Session Counting and Pre-Permission Dialog"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.4: Opt-In Flow with Session Counting and Pre-Permission Dialog

## Story

As a learner,
I want to be asked about push notifications at the right time with a clear explanation,
so that I understand the value and can make an informed choice.

## Acceptance Criteria

**Given** the user has visited the app fewer than 3 sessions
**When** the app loads
**Then** no push notification prompt is shown
**And** the session counter in localStorage is incremented

**Given** the user has visited the app 3 or more sessions
**And** push notifications are supported by the browser
**And** the user has not previously subscribed or dismissed the prompt
**When** the user completes a lesson, views streak statistics, or sets a study schedule
**Then** the `PushOptInDialog` component is displayed

**Given** the `PushOptInDialog` is displayed
**When** the user views the dialog
**Then** it shows a clear value proposition: "Never miss a study session -- get gentle reminders to maintain your streak"
**And** it has an "Enable Notifications" primary button and a "Not Now" secondary button
**And** it uses design tokens (no hardcoded colors) and follows accessibility standards (4.5:1 contrast, keyboard navigable)

**Given** the user clicks "Enable Notifications" in the pre-permission dialog
**When** `Notification.requestPermission()` is called
**And** the user grants permission in the browser prompt
**Then** the push subscription flow from Story 61.3 is triggered
**And** the opt-in state is set to `subscribed` in localStorage
**And** a success toast is shown: "Push notifications enabled!"

**Given** the user clicks "Enable Notifications" in the pre-permission dialog
**When** `Notification.requestPermission()` is called
**And** the user denies permission in the browser prompt
**Then** the opt-in state is set to `blocked` in localStorage
**And** the dialog closes with no error
**And** the app continues to use in-app notifications only

**Given** the user clicks "Not Now" in the pre-permission dialog
**When** the dialog closes
**Then** the opt-in state is set to `dismissed` with the current timestamp
**And** the dialog will not appear again for 7 days

**Given** `Notification.permission` is `denied`
**When** the app checks push notification state
**Then** the opt-in flow never triggers
**And** the Settings page shows a message explaining how to re-enable in browser settings

## Tasks / Subtasks

- [ ] Task 1: Implement session counting logic (AC: 1)
  - [ ] 1.1 Create `src/lib/pushOptIn.ts` module with session counting
  - [ ] 1.2 Increment `knowlune_session_count` in localStorage on app load
  - [ ] 1.3 Export `getOptInState()`, `setOptInState()`, `isEligibleForPrompt()`, `incrementSessionCount()`
  - [ ] 1.4 Define opt-in state interface: `{ state: 'waiting'|'eligible'|'dismissed'|'subscribed'|'blocked', sessionCount, dismissedAt?, subscribedAt? }`
- [ ] Task 2: Create `PushOptInDialog.tsx` component (AC: 3)
  - [ ] 2.1 Create `src/app/components/notifications/PushOptInDialog.tsx`
  - [ ] 2.2 Use shadcn `Dialog` or `AlertDialog` component as base
  - [ ] 2.3 Value proposition text: "Never miss a study session -- get gentle reminders to maintain your streak"
  - [ ] 2.4 "Enable Notifications" button with `variant="brand"` (primary CTA)
  - [ ] 2.5 "Not Now" button with `variant="ghost"` or `variant="brand-ghost"` (secondary)
  - [ ] 2.6 Ensure WCAG AA: 4.5:1 contrast, keyboard navigable, proper ARIA labels
  - [ ] 2.7 Use design tokens only (ESLint `design-tokens/no-hardcoded-colors` enforced)
- [ ] Task 3: Implement permission request flow (AC: 4, 5, 6)
  - [ ] 3.1 On "Enable" click: call `Notification.requestPermission()`
  - [ ] 3.2 On `granted`: call `subscribeToPush()` from pushManager.ts, set state to `subscribed`, show success toast via Sonner
  - [ ] 3.3 On `denied`: set state to `blocked`, close dialog silently
  - [ ] 3.4 On "Not Now" click: set state to `dismissed` with `dismissedAt` timestamp, close dialog
- [ ] Task 4: Implement contextual trigger points (AC: 2)
  - [ ] 4.1 Identify existing components for lesson completion, streak viewing, schedule setting
  - [ ] 4.2 Add opt-in eligibility check at these trigger points
  - [ ] 4.3 Show `PushOptInDialog` when eligible (session >= 3, not dismissed/subscribed/blocked)
  - [ ] 4.4 Implement 7-day cooldown check for `dismissed` state
- [ ] Task 5: Wire session counting into app initialization (AC: 1)
  - [ ] 5.1 Call `incrementSessionCount()` in App.tsx or Layout.tsx on mount
  - [ ] 5.2 Guard with push API support check
- [ ] Task 6: Unit tests
  - [ ] 6.1 Test session counter increments correctly
  - [ ] 6.2 Test eligibility: returns false when sessionCount < 3
  - [ ] 6.3 Test eligibility: returns false when state is `dismissed` and within 7-day cooldown
  - [ ] 6.4 Test eligibility: returns false when state is `subscribed` or `blocked`
  - [ ] 6.5 Test eligibility: returns true when sessionCount >= 3 and state is `waiting` or `eligible`
- [ ] Task 7: E2E test for dialog component
  - [ ] 7.1 Test dialog renders with correct text and buttons
  - [ ] 7.2 Test "Not Now" closes dialog and sets dismissed state
  - [ ] 7.3 Test accessibility: keyboard navigation, ARIA labels

## Design Guidance

### Layout

- Modal dialog centered on screen with backdrop overlay
- Compact layout — not a full page, just a focused prompt
- Icon or illustration at top (optional — Bell icon from Lucide would work)

### Component Structure

- Use shadcn `AlertDialog` (better semantics for a permission prompt than `Dialog`)
- `AlertDialogContent` > `AlertDialogHeader` > title + description
- `AlertDialogFooter` > "Not Now" (ghost) + "Enable Notifications" (brand)

### Design System Usage

- Primary CTA: `variant="brand"` on Button
- Secondary: `variant="brand-ghost"` on Button
- Text: `text-foreground` for title, `text-muted-foreground` for description
- Background: `bg-background` (dialog inherits from shadcn)
- No hardcoded colors — ESLint will block `bg-blue-600` etc.

### Responsive Strategy

- Dialog width constrained with `max-w-md`
- Touch targets >= 44x44px for buttons
- Works on mobile, tablet, and desktop

### Accessibility

- `AlertDialog` provides correct ARIA role and focus management
- Escape key closes dialog (set to "Not Now" behavior)
- Focus trapped within dialog while open
- Screen reader: title and description announced

## Implementation Notes

### Architecture Compliance (from ADR-5)

- **State stored in localStorage** (not IndexedDB) because opt-in state is needed before Dexie initializes
- **Session count key:** `knowlune_session_count`
- **Opt-in state key:** `push_opt_in_state`
- **State machine:** UNKNOWN -> WAITING -> ELIGIBLE -> SUBSCRIBED/BLOCKED/DISMISSED

### Existing Patterns to Follow

- **Toast notifications:** Use Sonner (already in the project via shadcn `toast` component)
- **Dialog components:** shadcn `AlertDialog` in `src/app/components/ui/alert-dialog.tsx`
- **Button variants:** Use `variant="brand"` (defined in `src/app/components/ui/button.tsx`)
- **Component location:** `src/app/components/notifications/` (new directory — consistent with architecture doc)

### Existing Files Context

- `src/stores/useNotificationPrefsStore.ts` — existing preferences store, may need `pushEnabled` field extension
- `src/app/pages/Settings.tsx` — will be modified in S06 to show push settings
- `src/app/components/settings/NotificationPreferencesPanel.tsx` — existing panel, S06 adds push section

### Key Technical Details

- `Notification.requestPermission()` returns a Promise in modern browsers but uses a callback in older ones — use the Promise form, which all target browsers support (Chrome 50+, Firefox 44+, Safari 16.4+)
- Always check `Notification.permission` before calling `requestPermission()` — if already `denied`, don't show the dialog
- The pre-permission dialog is crucial for opt-in rate (NFR-2: >70%) — the browser prompt has no context, our dialog provides the "why"

### Dependencies

- Depends on S03: `subscribeToPush()` must be fully implemented
- Uses `getPushPermissionState()` from S01's `pushManager.ts`

## Testing Notes

- Mock localStorage for session counting tests
- Mock `Notification.requestPermission()` for permission flow tests
- E2E: Can set localStorage values to simulate session count >= 3
- Verify 7-day cooldown by manipulating `dismissedAt` timestamp in localStorage

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
