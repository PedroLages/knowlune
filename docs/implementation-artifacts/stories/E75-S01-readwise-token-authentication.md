---
story_id: E75-S01
story_name: "Readwise Token Authentication and Connection"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 75.1: Readwise Token Authentication and Connection

Status: ready-for-dev

## Story

As a learner using Readwise,
I want to connect my Readwise account by pasting my access token,
So that Knowlune can export my highlights and bookmarks to my Readwise library.

## Acceptance Criteria

**Given** the user is on the Settings > Integrations section
**When** the user views the Readwise integration card
**Then** a card shows the Readwise icon, "Readwise" title, "Not connected" badge, value proposition text ("Export highlights and bookmarks to your Readwise library"), and a "Connect Readwise" brand button
**And** the button has `aria-label="Connect your Readwise account"`

**Given** the user clicks "Connect Readwise"
**When** the Readwise Connect Dialog opens
**Then** it displays step-by-step instructions: "1. Go to readwise.io/access_token, 2. Copy your access token, 3. Paste it below"
**And** a link to readwise.io/access_token opens in a new tab
**And** the token input field is `type="password"` with a visibility toggle button and `aria-label="Readwise access token"`
**And** a "Validate & Connect" brand button is available

**Given** the user pastes a token and clicks "Validate & Connect"
**When** the validation request is sent to `GET /api/v2/auth/` with `Authorization: Token {token}`
**Then** if the response is 204 (success), the token is stored in Supabase Vault (or IndexedDB fallback with client-side encryption), the dialog closes, the card updates to connected state, and a toast displays "Connected to Readwise"
**And** if the response is 401, an inline error displays: "Invalid token. Please check and try again."
**And** if the response is any other status code (API change), a warning is logged and the error displayed is: "Unexpected response from Readwise. The API may have changed."

**Given** the Readwise connection is established
**When** the user views the connected Readwise card
**Then** it shows the "Connected" success badge, last synced timestamp, Sync Now button, Configure Export button, Disconnect button, and auto-sync toggle with frequency selector

**Given** the user's Readwise token has been externally revoked
**When** a sync attempt returns 401
**Then** the provider status is set to 'token_expired', the card shows an amber "Reconnect required" badge, and clicking it re-opens the token paste dialog pre-populated with instructions

**Given** the user clicks "Disconnect" on the connected Readwise card
**When** the disconnect confirmation appears
**Then** the AlertDialog states "Your exported data remains in Readwise. Future changes will not be synced."
**And** confirming clears the queue, deletes the token, and returns to disconnected state
**And** a toast displays "Disconnected from Readwise"

## Tasks / Subtasks

- [ ] Task 1: Create `ReadwiseProvider` class implementing `ExternalIntegrationProvider` (AC: all)
  - [ ] 1.1 Implement `connect()` — validate token via `GET /api/v2/auth/`, store on success
  - [ ] 1.2 Implement `disconnect()` — clear queue, delete token, reset state
  - [ ] 1.3 Implement `getStatus()` — return current connection state
  - [ ] 1.4 Register provider in `integrationRegistry`
- [ ] Task 2: Create Readwise token storage service (AC: 3, 5)
  - [ ] 2.1 Supabase Vault storage path (primary)
  - [ ] 2.2 IndexedDB `integrationTokens` fallback with client-side encryption
  - [ ] 2.3 Token revocation detection (401 on sync -> token_expired state)
- [ ] Task 3: Create `ReadwiseConnectDialog` component (AC: 2)
  - [ ] 3.1 Step-by-step instructions UI
  - [ ] 3.2 Password input with visibility toggle
  - [ ] 3.3 Validation loading state and inline error display
  - [ ] 3.4 Accessibility: aria-labels, focus trap, keyboard navigation
- [ ] Task 4: Create `ReadwiseIntegrationCard` component (AC: 1, 4)
  - [ ] 4.1 Disconnected state — icon, title, badge, value prop, connect button
  - [ ] 4.2 Connected state — badge, last synced, sync/configure/disconnect buttons, auto-sync toggle
  - [ ] 4.3 Token expired state — amber "Reconnect required" badge, re-auth flow
- [ ] Task 5: Create `ReadwiseDisconnectDialog` component (AC: 6)
  - [ ] 5.1 AlertDialog with data retention message
  - [ ] 5.2 Confirm action triggers provider disconnect
- [ ] Task 6: Wire into Settings > Integrations panel (AC: 1)
- [ ] Task 7: Unit tests (AC: all)
  - [ ] 7.1 Token validation success/failure/unexpected paths
  - [ ] 7.2 Token storage and retrieval (both Vault and fallback)
  - [ ] 7.3 Connect/disconnect state transitions
  - [ ] 7.4 Token expiry detection and recovery flow
- [ ] Task 8: E2E test spec (AC: 1, 2, 4, 6)
  - [ ] 8.1 Card renders in disconnected state
  - [ ] 8.2 Connect dialog flow (mocked API)
  - [ ] 8.3 Connected card renders with controls
  - [ ] 8.4 Disconnect flow

## Design Guidance

- Follow `IntegrationCard` pattern established in E74-S02 for Notion
- Use shadcn/ui `Dialog`, `AlertDialog`, `Button` (variant="brand"), `Input`, `Badge`, `Switch`
- Token input: `type="password"` with Eye/EyeOff toggle from lucide-react
- Design tokens: `bg-brand-soft` for card highlight, `text-success` for connected badge, `text-warning` for expired badge, `text-muted-foreground` for description text
- Responsive: card stacks vertically on mobile, side-by-side on desktop
- Accessibility: `aria-label` on connect button, focus trap in dialogs, `role="status"` on connection badge

## Implementation Notes

- Readwise API uses simple token auth (`Authorization: Token {token}`) — no OAuth complexity
- Validation endpoint: `GET https://readwise.io/api/v2/auth/` returns 204 on success
- Token never expires unless user revokes it on readwise.io — detect via 401 during sync
- Reuse shared `TokenManager` abstraction from E74-S01 infrastructure
- CSP allowlist: add `https://readwise.io` to connect-src

## Testing Notes

- Mock Readwise API responses in unit tests (204, 401, 500)
- E2E tests mock the API call to avoid real token dependency
- Test IndexedDB fallback path when Supabase is unavailable
- Verify no token leakage in console logs or error messages

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
