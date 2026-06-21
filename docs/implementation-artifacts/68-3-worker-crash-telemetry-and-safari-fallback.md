---
story_id: 68-3
story_name: "Worker Crash Telemetry + Safari Fallback"
status: ready-for-dev
started: 2026-06-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 68-3: Worker Crash Telemetry + Safari Fallback

## Story

As a developer,
I want to receive structured crash telemetry with requestId, provider, and error class
and have Safari's missing module-worker support handled transparently,
so that crash paths produce actionable logs and Safari users don't lose embedding functionality.

## Acceptance Criteria

- R5: Worker crash path produces actionable telemetry (requestId, provider name, error class) — not opaque "worker died" logs.
- Safari module-worker fallback: new Worker(url, {type: 'module'}) failure is caught, retried without type: 'module' option.
- Deduplication: worker-crash event subscribers in vector-store don't double-dispatch on repeated crashes with the same requestId.
- Telemetry subscription: App.tsx (or telemetry module) subscribes to worker-crash and logs structured payload to console.

## Tasks / Subtasks

- [ ] Task 1: Enhance worker crash telemetry in coordinator.ts (AC: R5)
  - [ ] 1.1 Include `{requestId, provider: 'local', error: <class>, stack}` in CustomEvent('worker-crash') detail
  - [ ] 1.2 Change requestId from comma-joined string to single string (first pending requestId)

- [ ] Task 2: Implement Safari module-worker fallback in coordinator.ts (AC: Safari fallback)
  - [ ] 2.1 Catch new Worker(url, {type: 'module'}) failure (SyntaxError/TypeError)
  - [ ] 2.2 Retry without {type: 'module'} option
  - [ ] 2.3 Use separate error handler for fallback-attempt failures

- [ ] Task 3: Prevent double-dispatch in vector-store.ts (AC: Deduplication)
  - [ ] 3.1 Track last-crash requestId in module scope
  - [ ] 3.2 Skip handler if same requestId dispatched again within N ms

- [ ] Task 4: Wire telemetry subscriber in telemetry module (AC: Telemetry subscription)
  - [ ] 4.1 Create `src/ai/workers/workerCrashTelemetry.ts` — subscribes to worker-crash, logs structured payload
  - [ ] 4.2 Import and call initWorkerCrashTelemetry() from App.tsx

- [ ] Task 5: Write unit test for crash telemetry payload shape (AC: Tests)
  - [ ] 5.1 Create `src/ai/embeddings/__tests__/crashTelemetry.test.ts`
  - [ ] 5.2 Happy path: event payload contains requestId, provider, error.name
  - [ ] 5.3 Edge case: rapid repeat crashes (same requestId) -> dedupe, single event
  - [ ] 5.4 Error path: Safari-style module worker failure -> fallback succeeds

## Implementation Notes

- Existing `worker-crash` CustomEvent in coordinator.ts already dispatches with detail containing workerId, error message, provider, cacheUnavailable, and requestId (comma-joined string).
- Need to: change requestId to single string, add error class name, add stack trace.
- Safari fallback: try `new Worker(url, {type: 'module'})`. On TypeError/SyntaxError, retry `new Worker(url)` (no type option) — Vite already emits a non-module build via `?worker` import.
- No new UI. Pure telemetry + resilience pass.

## Testing Notes

- Happy path: Worker crash event payload contains requestId, provider, error.name.
- Edge case: Rapid repeat crashes (same requestId) -> dedupe, single event.
- Error path: Safari-style module worker failure -> fallback succeeds, embedding request completes.
- Integration: Crash during active embed request -> request rejects with typed error, caller falls back to OpenAI per S02.

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] Type guards on all dynamic lookups
- [ ] AC -> UI trace: For each acceptance criterion, verify the feature works
- [ ] tsc --noEmit: runs clean
- [ ] npm run build: passes
