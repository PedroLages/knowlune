# Epic 9 Web Worker Architecture Documentation

This directory contains the complete architectural design for Epic 9's Web Worker-based AI infrastructure.

## Documents

### 1. [epic-9-web-worker-design.md](./epic-9-web-worker-design.md)
**Complete Architecture Specification** (57KB)

The comprehensive design document covering:
- Worker pool management (lazy spawning, idle termination)
- Message passing protocol (requestId-based async tracking)
- State synchronization (Zustand + Dexie integration)
- Memory management (3GB ceiling, auto-downgrade)
- Error handling & recovery (crashes, timeouts, fallbacks)
- Performance characteristics (latency, throughput, memory)
- Migration path (4 phases from foundation to production)

**Use this for:** Architectural decisions, system design review, team alignment

---

### 2. [epic-9-worker-communication-flows.md](./epic-9-worker-communication-flows.md)
**Sequence Diagrams & Flow Documentation** (45KB)

Visual documentation of all communication patterns:
- Flow 1: Single embedding generation
- Flow 2: Batch embedding (100 notes)
- Flow 3: Semantic search with vector index
- Flow 4: Worker crash & recovery
- Flow 5: Streaming LLM inference
- Flow 6: Idle worker termination (memory reclaim)
- Flow 7: Parallel worker execution
- Flow 8: Model download with progress

**Use this for:** Understanding system behavior, debugging issues, sequence analysis

---

### 3. [epic-9-integration-checklist.md](./epic-9-integration-checklist.md)
**Developer Quick Reference** (24KB)

Practical guide for implementing AI features:
- When to use workers (vs main thread)
- Code examples (embedding, search, batch processing)
- Integration patterns (Zustand, Dexie, React)
- Error handling recipes
- Performance best practices
- Testing patterns (unit + E2E)
- Vite configuration
- Common pitfalls
- Migration checklist

**Use this for:** Day-to-day development, code review, onboarding new developers

---

## Quick Start

### For Architects
1. Read [epic-9-web-worker-design.md](./epic-9-web-worker-design.md) (full design)
2. Review Section 10 (Migration Path) for phased implementation
3. Use Section 7 (Integration with Existing Stack) for tech decisions

### For Developers
1. Start with [epic-9-integration-checklist.md](./epic-9-integration-checklist.md) (quick reference)
2. Copy code examples for common patterns (Section 2)
3. Reference [epic-9-worker-communication-flows.md](./epic-9-worker-communication-flows.md) when debugging

### For QA/Testing
1. Read Section 8 (Testing Strategy) in [epic-9-web-worker-design.md](./epic-9-web-worker-design.md)
2. Use Section 8 (Testing Patterns) in [epic-9-integration-checklist.md](./epic-9-integration-checklist.md)
3. Reference flows for E2E test scenarios

---

## Architecture Summary

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **3-worker pool** (embed, search, infer) | Dedicated workers per task type for memory predictability |
| **Lazy spawning** | Don't load 2GB models until user needs them |
| **Idle termination** (60s) | Reclaim memory on mobile/low-end devices |
| **Direct Dexie access** | Workers query IndexedDB directly (no proxy overhead) |
| **Event-driven Zustand updates** | Workers can't mutate main thread state (one-way flow) |
| **Transferable objects** | Zero-copy for large data (embeddings, vectors) |
| **3GB memory ceiling** | Auto-downgrade to cloud API if exceeded |

### Performance Targets

| Operation | Target Latency | Memory Budget |
|-----------|----------------|---------------|
| Single embedding | 50ms | +150MB |
| Batch embedding (100) | 5000ms | +150MB |
| Vector search (10k) | 20ms | +100MB |
| LLM inference (500 tokens) | 15s | +2GB |
| Worker spawn | 150ms | +0MB (lazy) |

### Integration Points

```
React UI → useNoteStore (Zustand) → Coordinator → Workers → Dexie (IndexedDB)
                                        ↓
                                   Event-driven updates
                                        ↓
                                   Zustand re-renders UI
```

---

## Implementation Status

**Current Phase:** Phase 1 - Foundation (In Progress)

- [x] Worker coordinator skeleton (`src/ai/workers/coordinator.ts`)
- [x] Message protocol types (`src/ai/workers/types.ts`)
- [x] Mock embedding worker (`src/ai/workers/embedding.worker.ts`)
- [x] Unit tests (`src/ai/workers/__tests__/coordinator.test.ts`)
- [ ] Real Transformers.js integration (Phase 2)
- [ ] Vector search worker (Phase 3)
- [ ] LLM inference worker (Phase 4)

See [epic-9-web-worker-design.md#migration-path](./epic-9-web-worker-design.md#migration-path) for full roadmap.

---

## Related Documentation

**Epic 9 Planning:**
- [docs/plans/epic-9-prep-sprint.md](../plans/epic-9-prep-sprint.md) - Prep sprint plan (7 action items)
- [docs/research/webllm-feasibility-report.md](../research/webllm-feasibility-report.md) - WebLLM PoC results

**Story Files:**
- [docs/implementation-artifacts/](../implementation-artifacts/) - Per-story specs (when Epic 9 starts)

**Test Knowledge:**
- [_bmad/tea/testarch/knowledge/](../../_bmad/tea/testarch/knowledge/) - Testing patterns and best practices

---

## Contributing

When updating this architecture:

1. **Design changes** → Update [epic-9-web-worker-design.md](./epic-9-web-worker-design.md)
2. **New flows** → Add to [epic-9-worker-communication-flows.md](./epic-9-worker-communication-flows.md)
3. **Developer patterns** → Update [epic-9-integration-checklist.md](./epic-9-integration-checklist.md)
4. **Version docs** → Append date and change summary to "Last Updated" section

---

## Questions?

**For design questions:** Review [epic-9-web-worker-design.md](./epic-9-web-worker-design.md) Section 1-6
**For implementation questions:** See [epic-9-integration-checklist.md](./epic-9-integration-checklist.md) Section 2-9
**For debugging questions:** Trace sequence in [epic-9-worker-communication-flows.md](./epic-9-worker-communication-flows.md)

**Still stuck?** Open a GitHub discussion with:
- Link to relevant architecture section
- Code snippet (if implementation question)
- Expected vs actual behavior (if debugging)

---

**Last Updated:** 2026-03-10
**Document Status:** ✅ Complete and Ready for Review
**Reviewers:** Epic 9 Team, Tech Lead, Product Owner
