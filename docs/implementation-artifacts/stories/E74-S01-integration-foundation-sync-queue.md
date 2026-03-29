---
story_id: E74-S01
story_name: "Integration Foundation and Sync Queue Infrastructure"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 74.1: Integration Foundation and Sync Queue Infrastructure

## Story

As a developer,
I want a shared integration provider interface, sync queue, and Zustand store,
so that both Notion and Readwise providers can be built on a consistent, queue-based architecture with reactive UI state.

## Acceptance Criteria

**Given** the integration module does not yet exist
**When** this story is complete
**Then** the `ExternalIntegrationProvider` interface is defined in `src/services/integrations/types.ts` with connect, disconnect, getStatus, sync, syncEntity, getExportMapping, and updateExportMapping methods
**And** `IntegrationStatus` type includes 'disconnected', 'connected', 'syncing', 'error', 'token_expired' states
**And** `SyncResult`, `SyncError`, `IntegrationState`, `ExportMappingConfig`, `EntityMapping` types are defined

**Given** the sync queue infrastructure is needed for rate-limited export
**When** this story is complete
**Then** `SyncQueue` class in `src/services/integrations/syncQueue.ts` is backed by a new Dexie `syncQueue` table with fields: provider, entityType, entityId, operation, status, priority, retryCount, maxRetries, scheduledAt, lastError, createdAt, completedAt
**And** `SyncWorker` class in `src/services/integrations/syncWorker.ts` processes queue items respecting per-provider rate limits (3 req/s for Notion, 4 req/s for Readwise)
**And** `SyncWorker.handleFailure` handles 429 (Retry-After header), 5xx (exponential backoff), 401 (pause queue + trigger refresh), and non-retryable errors separately
**And** stale 'processing' items are recovered to 'pending' on app startup

**Given** the Dexie schema needs new tables
**When** this story is complete
**Then** `src/db/schema.ts` includes `syncState`, `syncQueue`, and `integrationTokens` tables with appropriate indexes and a version bump

**Given** the UI needs reactive state for integration status and sync progress
**When** this story is complete
**Then** `useIntegrationStore` Zustand store in `src/stores/useIntegrationStore.ts` exposes provider states, sync progress (current/total items), and actions for connect/disconnect/sync
**And** the store subscribes to Dexie `syncQueue` changes for real-time progress updates

**Given** future providers need a registration mechanism
**When** this story is complete
**Then** `integrationRegistry.ts` provides `registerProvider`, `getProvider`, and `listProviders` functions
**And** unit tests cover queue enqueue/dequeue, rate limiting, failure handling, stale recovery, and registry operations

## Tasks / Subtasks

- [ ] Task 1: Define TypeScript types and interfaces (AC: 1)
  - [ ] 1.1 Create `src/services/integrations/types.ts` with `ExternalIntegrationProvider`, `IntegrationStatus`, `SyncResult`, `SyncError`, `IntegrationState`, `ExportMappingConfig`, `EntityMapping`, `NotionTargetConfig`, `ReadwiseTargetConfig`, `SyncState` types
  - [ ] 1.2 Create `src/services/integrations/index.ts` barrel export

- [ ] Task 2: Add Dexie schema tables (AC: 3)
  - [ ] 2.1 Add `syncState` table: `++id, provider, entityType, [provider+entityType]`
  - [ ] 2.2 Add `syncQueue` table: `++id, provider, entityType, entityId, status, priority, scheduledAt, [provider+status], [status+scheduledAt]`
  - [ ] 2.3 Add `integrationTokens` table: `++id, provider, [provider]`
  - [ ] 2.4 Bump Dexie schema version

- [ ] Task 3: Implement SyncQueue class (AC: 2)
  - [ ] 3.1 Create `src/services/integrations/syncQueue.ts` with enqueue, dequeue, markComplete, markFailed, getByProvider, getPendingCount methods
  - [ ] 3.2 Implement priority-based ordering (higher priority processed first)
  - [ ] 3.3 Implement stale recovery on construction (reset 'processing' items older than 5 minutes to 'pending')

- [ ] Task 4: Implement SyncWorker class (AC: 2)
  - [ ] 4.1 Create `src/services/integrations/syncWorker.ts` with start, stop, processNext methods
  - [ ] 4.2 Implement per-provider rate limiting (token bucket: 3 req/s Notion, 4 req/s Readwise)
  - [ ] 4.3 Implement `handleFailure` with error-specific strategies: 429 (Retry-After), 5xx (exponential backoff), 401 (pause + trigger token refresh), non-retryable (mark failed)
  - [ ] 4.4 Implement max retries (3 attempts) with exponential backoff

- [ ] Task 5: Implement integration registry (AC: 5)
  - [ ] 5.1 Create `src/services/integrations/integrationRegistry.ts` with `registerProvider`, `getProvider`, `listProviders`
  - [ ] 5.2 Use Map-based in-memory registry

- [ ] Task 6: Create Zustand store (AC: 4)
  - [ ] 6.1 Create `src/stores/useIntegrationStore.ts` with provider states, sync progress, actions
  - [ ] 6.2 Implement Dexie `syncQueue` live query subscription for real-time progress
  - [ ] 6.3 Expose `connect`, `disconnect`, `sync`, `retryFailed` actions

- [ ] Task 7: Unit tests (AC: 5)
  - [ ] 7.1 Test SyncQueue: enqueue, dequeue, priority ordering, stale recovery
  - [ ] 7.2 Test SyncWorker: rate limiting, failure handling per error type, max retries
  - [ ] 7.3 Test integration registry: register, get, list, duplicate registration

## Design Guidance

This is a service/infrastructure story with no UI. Focus on clean TypeScript interfaces, comprehensive error handling, and thorough unit test coverage. The types defined here are the contract for all subsequent E74 and E75 stories.

**Key architecture references:**
- `ExternalIntegrationProvider` interface: `_bmad-output/planning-artifacts/architecture-notion-readwise-integration.md` Decision 1
- Dexie schema pattern: `src/db/schema.ts` (existing)
- Zustand store pattern: `src/stores/` (existing stores)
- Rate limits: Notion 3 req/s, Readwise 4 req/s (240 req/min)

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

Unit tests should use fake-indexeddb for Dexie operations. SyncWorker rate limiting tests should use fake timers. No E2E tests needed for this infrastructure story.

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
