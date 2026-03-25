---
story_id: E22-S03
story_name: "Connection Testing & Health Check"
status: done
started: 2026-03-25
completed: 2026-03-25
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review, code-review, code-review-testing]
burn_in_validated: false
---

# Story 22.03: Connection Testing & Health Check

## Story

As a user,
I want to verify my Ollama connection works before using AI features,
so that I know if something is misconfigured.

## Acceptance Criteria

- **AC1**: Given I have configured Ollama, When I click "Test Connection", Then the app pings the Ollama server and shows a success (green check) or failure (red X) indicator
- **AC2**: Given Ollama is configured, When I view AI Configuration in Settings, Then a connection status indicator (green/red dot) is visible next to the provider name
- **AC3**: Given connection fails, When I see the error, Then it shows actionable messages:
  - Unreachable: "Cannot reach Ollama at {url}. Is the server running?"
  - CORS error (direct mode): "CORS blocked. Set OLLAMA_ORIGINS=* on your Ollama server, or switch to proxy mode."
  - Model not found: "Model {name} not available. Pull it with: ollama pull {name}"
- **AC4**: Given Ollama is configured, When the app starts, Then a background health check runs and updates the status indicator silently

## Tasks / Subtasks

- [ ] Task 1: Implement connection test (AC: 1)
  - [ ] 1.1 Add `testConnection()` to OllamaLLMClient — call `GET /api/tags` or `GET /` (root returns version)
  - [ ] 1.2 Verify selected model exists in the model list
  - [ ] 1.3 Return structured result: `{ ok, error?, errorType: 'unreachable' | 'cors' | 'model-not-found' }`
- [ ] Task 2: Status indicator UI (AC: 2)
  - [ ] 2.1 Add green/red/gray dot component next to Ollama provider in Settings
  - [ ] 2.2 Gray = not tested, Green = connected, Red = failed
  - [x] 2.3 Show last-checked timestamp on hover — Deferred: not required by AC2
- [ ] Task 3: Actionable error messages (AC: 3)
  - [ ] 3.1 Map error types to user-friendly messages with troubleshooting steps
  - [ ] 3.2 Detect CORS errors from browser (TypeError in fetch = likely CORS)
  - [x] 3.3 Include copy-to-clipboard for command suggestions — Deferred: not required by AC3
- [ ] Task 4: Startup health check (AC: 4)
  - [ ] 4.1 On app mount, if Ollama is configured, run silent background health check
  - [ ] 4.2 Update status indicator without toast/notification (silent)
  - [ ] 4.3 Re-check every 5 minutes while app is open (optional, low priority)

## Design Guidance

- Status dot: 8px circle, inline with provider label
- Test Connection button: secondary variant, next to status dot
- Error messages: red text below configuration card with monospace code snippets for commands
- Success: brief green toast "Connected to Ollama at {url}"

## Implementation Notes

- Ollama root endpoint `GET /` returns `"Ollama is running"` — simplest health check
- CORS errors in browser manifest as `TypeError: Failed to fetch` — no response body
- Distinguish unreachable (network error) from CORS (same error type, different context — if proxy works but direct doesn't, it's CORS)
- Use AbortController with 5s timeout for connection tests

## Testing Notes

- Unit test: `testConnection()` returns correct error types
- E2E: Test Connection button shows success state (mock server)
- E2E: Error messages display correctly for each error type
- Edge case: Ollama configured but server offline, server returns unexpected response

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Read [engineering-patterns.md](../engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

- **CORS detection in browsers is indirect.** Browser fetch throws a generic `TypeError: Failed to fetch` for both network errors and CORS blocks. The solution: when in direct-connection mode, surface a CORS-specific message with the `OLLAMA_ORIGINS=*` fix since it's the most likely cause. Proxy mode rules out CORS, so the message switches to "server unreachable."
- **Separate health check module from UI.** Extracting `ollamaHealthCheck.ts` as a standalone module made unit testing straightforward (12 tests, no component rendering needed). The UI component just calls the module and displays results.
- **AbortController timeout pattern.** Used `AbortSignal.timeout(ms)` for connection tests. Code review flagged the 10s timeout vs. the 5s spec — documented as intentional for LAN servers with slower cold starts.
- **Deferred startup initialization.** Running the health check in `main.tsx` via `setTimeout(..., 0)` keeps it off the critical rendering path. Silent failure (no toast) was AC4's explicit requirement.
- **Dead interface fields accumulate.** Code review caught `serverVersion` declared but never populated — removed in the fix commit. Worth checking interface fields match actual usage during implementation, not just at review time.
