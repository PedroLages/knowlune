---
story_id: E61-S06
story_name: "Push Settings Section in Settings Page"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.6: Push Settings Section in Settings Page

## Story

As a learner,
I want to manage my push notification preferences in the Settings page,
so that I can enable, disable, or check the status of push notifications.

## Acceptance Criteria

**Given** the user navigates to the Settings page
**When** the notification preferences section renders
**Then** a "Push Notifications" section is visible below the existing notification type toggles

**Given** push notifications are supported by the browser
**And** the user has subscribed to push
**When** the Settings page loads
**Then** a toggle switch shows push notifications as enabled
**And** the current permission state is displayed ("Enabled" with a success indicator)

**Given** push notifications are supported
**And** the user has not yet subscribed
**When** the Settings page loads
**Then** an "Enable Push Notifications" button is displayed
**And** clicking it triggers the subscription flow from Story 61.3

**Given** the user has denied push permission (`Notification.permission === 'denied'`)
**When** the Settings page loads
**Then** the push section shows "Blocked" status with muted styling
**And** a help text explains: "Push notifications are blocked. To re-enable, go to your browser settings > Site permissions > Notifications."

**Given** the browser does not support push notifications
**When** the Settings page loads
**Then** the push section shows "Not supported" with a brief explanation
**And** no enable/disable controls are shown

**Given** the user toggles push notifications off in Settings
**When** the toggle is switched
**Then** `unsubscribeFromPush()` is called
**And** the subscription is removed from Supabase
**And** the toggle reflects the new state

**Given** the push settings section is rendered
**When** inspected for accessibility
**Then** all controls have proper ARIA labels
**And** the section is keyboard navigable
**And** all text meets 4.5:1 contrast ratio using design tokens

## Tasks / Subtasks

- [ ] Task 1: Create `PushSettingsSection.tsx` component (AC: 1-6)
  - [ ] 1.1 Create `src/app/components/notifications/PushSettingsSection.tsx`
  - [ ] 1.2 Implement state detection: supported/subscribed/unsubscribed/blocked/unsupported
  - [ ] 1.3 Render toggle switch when subscribed (using shadcn `Switch`)
  - [ ] 1.4 Render "Enable Push Notifications" button when unsubscribed (using `variant="brand"`)
  - [ ] 1.5 Render "Blocked" message with help text when denied
  - [ ] 1.6 Render "Not supported" message when browser lacks push API
  - [ ] 1.7 Show status indicator: green dot for enabled, muted for blocked/unsupported
- [ ] Task 2: Integrate with existing Settings page (AC: 1)
  - [ ] 2.1 Import `PushSettingsSection` in `src/app/components/settings/NotificationPreferencesPanel.tsx`
  - [ ] 2.2 Place below existing notification type toggles with a visual separator
  - [ ] 2.3 Section heading: "Push Notifications" with brief subtitle
- [ ] Task 3: Wire toggle and button actions (AC: 3, 6)
  - [ ] 3.1 Toggle off: call `unsubscribeFromPush()` from `pushManager.ts`, update state
  - [ ] 3.2 Enable button: call `subscribeToPush()` from `pushManager.ts` (triggers permission if needed)
  - [ ] 3.3 Show loading state during subscribe/unsubscribe operations
  - [ ] 3.4 Show success/error toast via Sonner after operation completes
- [ ] Task 4: Extend `useNotificationPrefsStore` if needed
  - [ ] 4.1 Evaluate whether `pushEnabled` field should be added to the store
  - [ ] 4.2 If added, sync with actual push subscription state on Settings page mount
  - [ ] 4.3 Alternatively, derive push state directly from `getPushPermissionState()` + localStorage opt-in state
- [ ] Task 5: Accessibility (AC: 7)
  - [ ] 5.1 ARIA labels on toggle switch: "Push notifications toggle"
  - [ ] 5.2 ARIA labels on enable button: "Enable push notifications"
  - [ ] 5.3 Keyboard navigation: Tab through all controls
  - [ ] 5.4 Screen reader: status text is announced
  - [ ] 5.5 Contrast: all text uses design tokens (verified by ESLint rule)
- [ ] Task 6: Unit and E2E tests
  - [ ] 6.1 Unit: component renders correct state for each permission scenario
  - [ ] 6.2 Unit: toggle calls `unsubscribeFromPush()` on disable
  - [ ] 6.3 Unit: enable button calls `subscribeToPush()` on click
  - [ ] 6.4 E2E: Settings page shows push section
  - [ ] 6.5 E2E: accessibility checks (ARIA, keyboard, contrast)

## Design Guidance

### Layout

- Section card within the existing notification preferences area
- Visual separator (thin line or spacing) above the push section
- Status indicator (colored dot or badge) next to section title

### Component Structure

```
NotificationPreferencesPanel.tsx
  ├── [Existing notification type toggles]
  ├── <Separator />
  └── <PushSettingsSection />
        ├── Section title: "Push Notifications"
        ├── Status badge: "Enabled" / "Not subscribed" / "Blocked" / "Not supported"
        ├── Toggle switch (when subscribed) OR Enable button (when unsubscribed)
        └── Help text (when blocked or unsupported)
```

### Design System Usage

- **Section title:** `text-foreground font-semibold text-sm`
- **Status badge (enabled):** `text-success` with `bg-success/10` pill
- **Status badge (blocked):** `text-muted-foreground` with `bg-muted` pill
- **Toggle:** shadcn `Switch` component (inherits design tokens)
- **Enable button:** `variant="brand"` `size="sm"`
- **Help text:** `text-muted-foreground text-xs`
- No hardcoded colors anywhere

### Responsive Strategy

- Stack vertically on mobile
- Toggle/button right-aligned on desktop (flex row with justify-between)
- Touch targets >= 44x44px for toggle and button

### Accessibility

- Toggle switch gets `role="switch"` and `aria-checked` (shadcn Switch provides this)
- Status announcements via `aria-live="polite"` region
- Help text linked to control via `aria-describedby`

## Implementation Notes

### Existing Files to Modify

- `src/app/components/settings/NotificationPreferencesPanel.tsx` — add PushSettingsSection below existing toggles
- `src/app/pages/Settings.tsx` — may not need changes if NotificationPreferencesPanel is already integrated
- `src/stores/useNotificationPrefsStore.ts` — evaluate if `pushEnabled` field is needed

### Existing Patterns to Follow

- **NotificationPreferencesPanel** already renders toggle switches for each notification type — follow the same visual pattern for the push toggle
- **Settings page** uses card-based layout with sections — push settings should match
- **Toast messages:** Use Sonner (same as S04's success toast)

### Key Technical Details

- Push permission state can change outside the app (user goes to browser settings) — check `Notification.permission` on component mount, not just cached state
- `getPushPermissionState()` from `pushManager.ts` returns the current browser permission
- Combine browser permission with localStorage opt-in state for full picture:
  - `permission === 'granted'` + subscribed in localStorage = show toggle ON
  - `permission === 'granted'` + not subscribed = show enable button
  - `permission === 'denied'` = show blocked message
  - `permission === 'default'` = show enable button (will trigger permission prompt)
  - Push API not supported = show unsupported message

### Dependencies

- Depends on S03: `subscribeToPush()` and `unsubscribeFromPush()` fully implemented
- Depends on S04: `getPushPermissionState()` and opt-in state management
- `NotificationPreferencesPanel.tsx` already exists (from E58)

## Testing Notes

- Mock `Notification.permission` to test all 4 states (granted, denied, default, unsupported)
- Mock `pushManager.ts` functions to test toggle/button actions
- E2E: Navigate to Settings, verify push section renders
- Accessibility: axe-core or Playwright accessibility assertions

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
