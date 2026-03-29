---
story_id: E74-S02
story_name: "Notion OAuth Connection and Token Management"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 74.2: Notion OAuth Connection and Token Management

## Story

As a learner using Notion,
I want to connect my Notion workspace via a one-click OAuth flow,
so that Knowlune can securely access my workspace to create and update databases without me handling API tokens manually.

## Acceptance Criteria

**Given** the user is on the Settings page and the Integrations section is visible
**When** the user views the Notion integration card
**Then** a card following the IntegrationCard pattern shows the Notion icon, "Notion" title, "Not connected" badge, value proposition text ("Export notes and flashcards to Notion databases"), a "Connect Notion" brand button, and permission explanation text
**And** the card is accessible with `aria-label="Connect your Notion account"` on the button

**Given** the user clicks "Connect Notion"
**When** the OAuth flow initiates
**Then** the browser redirects to `https://api.notion.com/v1/oauth/authorize` with the correct client_id, redirect_uri (Supabase Edge Function URL), response_type=code, owner=user, and an encrypted state parameter containing user_id + nonce for CSRF protection

**Given** the user authorizes on Notion and is redirected to the callback
**When** the `notion-oauth-callback` Supabase Edge Function receives the authorization code
**Then** the Edge Function validates the state parameter (CSRF check), exchanges the code for access_token and refresh_token via `POST /v1/oauth/token`, stores both tokens in Supabase Vault via `integration_tokens` table with workspace_id and workspace_name, and redirects to `knowlune://settings/integrations?notion=connected`
**And** if the state validation fails, the Edge Function returns 403 and does not store tokens
**And** if the user denies authorization (error param present), the Edge Function redirects with `?notion=error&reason={error}`

**Given** the Notion connection succeeds
**When** the client detects the success redirect
**Then** the Notion card updates to connected state showing workspace name, "Connected" success badge, last synced timestamp ("Never"), Sync Now button, Configure Export button, Disconnect button, and auto-sync toggle with frequency selector
**And** a toast displays "Connected to Notion workspace {workspaceName}"

**Given** the Notion access token has expired (1-2 day lifetime)
**When** the `SyncWorker` receives a 401 response from the Notion API
**Then** `notionTokenManager.ts` calls the `notion-token-refresh` Supabase Edge Function which reads the refresh_token from Vault, exchanges it for a new access_token and refresh_token (rotation), stores both new tokens, and returns the new access_token
**And** if the refresh token is also invalid (revoked), the provider status is set to 'token_expired', the queue is paused, and the card shows an amber "Reconnect required" badge with a one-click reconnect button
**And** concurrent 401s from multiple queue items are deduplicated via a shared refresh promise (single refresh call)

**Given** the Notion connection is established and Supabase becomes unavailable
**When** token storage falls back to local mode
**Then** tokens are stored in the Dexie `integrationTokens` table with client-side encryption
**And** the integration continues to function using the locally cached access token until it expires

**Given** the user clicks "Disconnect" on the connected Notion card
**When** the disconnect confirmation AlertDialog appears
**Then** it displays "Your exported data remains in Notion. Future changes will not be synced."
**And** confirming the dialog pauses the sync queue, clears all pending Notion queue items, revokes/deletes tokens from Supabase Vault and local storage, and sets the card back to disconnected state
**And** a toast displays "Disconnected from Notion"

## Tasks / Subtasks

- [ ] Task 1: Create IntegrationsPanel and IntegrationCard components (AC: 1)
  - [ ] 1.1 Create `src/app/components/settings/IntegrationsPanel.tsx` with section header, description, and card slots
  - [ ] 1.2 Create `src/app/components/settings/IntegrationCard.tsx` with disconnected/connected/syncing/error/token_expired state rendering
  - [ ] 1.3 Add Integrations section to Settings page between Notifications and Data & Privacy
  - [ ] 1.4 Implement Notion disconnected card with icon, badge, value proposition, connect button, permission text

- [ ] Task 2: Implement Notion OAuth redirect (AC: 2)
  - [ ] 2.1 Create `src/services/integrations/notion/notionAuth.ts` with `initiateOAuth()` that builds the authorization URL with client_id, redirect_uri, response_type, owner, and encrypted state parameter
  - [ ] 2.2 Generate state parameter: encrypt `{userId, nonce}` for CSRF protection
  - [ ] 2.3 Handle OAuth redirect on Settings page mount (check URL params for `notion=connected` or `notion=error`)

- [ ] Task 3: Create Supabase Edge Functions (AC: 3)
  - [ ] 3.1 Create `supabase/functions/notion-oauth-callback/index.ts` Edge Function
  - [ ] 3.2 Implement state validation, code exchange (`POST /v1/oauth/token`), token storage in Vault
  - [ ] 3.3 Handle error cases: invalid state (403), user denied auth (redirect with error)
  - [ ] 3.4 Create `supabase/functions/notion-token-refresh/index.ts` Edge Function
  - [ ] 3.5 Implement refresh token rotation: read from Vault, exchange, store new pair

- [ ] Task 4: Implement connected state UI (AC: 4)
  - [ ] 4.1 Update IntegrationCard to show connected state: workspace name, "Connected" badge, last synced timestamp, action buttons
  - [ ] 4.2 Add auto-sync toggle with frequency selector (Select: 15min, 30min, 1hr, 6hr, 12hr, 24hr)
  - [ ] 4.3 Wire connect success to toast notification

- [ ] Task 5: Implement token refresh and expiry handling (AC: 5)
  - [ ] 5.1 Create `src/services/integrations/notion/notionTokenManager.ts` with `refreshToken()` and `getAccessToken()`
  - [ ] 5.2 Implement shared refresh promise to deduplicate concurrent 401 refresh calls
  - [ ] 5.3 Implement token_expired state: amber badge, reconnect button, paused queue

- [ ] Task 6: Implement local-only fallback (AC: 6)
  - [ ] 6.1 Store tokens in Dexie `integrationTokens` table when Supabase is unavailable
  - [ ] 6.2 Implement client-side encryption for locally stored tokens

- [ ] Task 7: Implement disconnect flow (AC: 7)
  - [ ] 7.1 Create disconnect AlertDialog with warning text
  - [ ] 7.2 Implement disconnect: pause queue, clear Notion queue items, revoke/delete tokens, reset card state
  - [ ] 7.3 Wire disconnect success to toast notification

- [ ] Task 8: Tests (AC: all)
  - [ ] 8.1 Unit tests: OAuth URL construction, state parameter encryption/validation, token manager refresh deduplication
  - [ ] 8.2 E2E tests: Notion card renders in disconnected state, disconnect dialog shows warning, connected state displays workspace info

## Design Guidance

**Layout:** IntegrationsPanel is a section within Settings page. Each integration is an IntegrationCard following the pattern from the UX spec.

**Components:** Card, CardHeader, CardContent, Button (variant="brand"), Badge, AlertDialog, Switch, Select, Separator

**States:** Disconnected (muted border, connect CTA), Connected (workspace name, sync controls), Token expired (warning border, amber badge, reconnect button)

**Accessibility:**
- `aria-label="Connect your Notion account"` on connect button
- `role="status"` with `aria-live="polite"` on sync status area
- Focus trap in AlertDialog (built into Radix UI)
- Keyboard tab order: connect -> mapping config -> sync controls -> disconnect

**Design tokens:** `bg-success-soft text-success` for connected badge, `text-warning` for source-of-truth text, `text-destructive` for disconnect. Never hardcode colors.

**Source-of-truth warning:** Display `text-xs text-warning` warning on connected card: "Knowlune is the source of truth. Changes made directly in Notion will be overwritten on the next sync."

## Implementation Notes

- Notion OAuth requires server-side code exchange (client_secret must not be in frontend). Supabase Edge Functions handle this.
- `@notionhq/client` npm package needed as a new dependency.
- CSP allowlist must include `https://api.notion.com` for the OAuth redirect.
- The `notion-oauth-callback` Edge Function URL must be registered in the Notion integration settings as the redirect URI.

## Testing Notes

E2E tests can verify the card UI states but cannot test the actual OAuth flow (requires Notion authorization). Use mocked responses for token refresh scenarios in unit tests.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
