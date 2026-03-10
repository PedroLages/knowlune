# Epic 9 Low-Priority Validations - Implementation Plan

**Duration**: 3-5 hours total (parallel execution)
**Start Date**: 2026-03-10
**Status**: Non-blocking validation tasks
**Context**: Can be completed during E09-S03 and E09-S04 implementation

## Overview

Two validation tasks from Epic 9 prep sprint that are non-blocking but provide valuable performance data. Both tasks validate existing prototypes rather than creating new research.

## Validation Tasks

### Task 1: Vector Recall Validation (2-3h)

**Timing**: During E09-S03 (Embedding Pipeline & Vector Store)

**Objective**: Validate HNSW recall accuracy with real embeddings

**Context from Prep Sprint**:
- Custom HNSW implementation benchmarked with synthetic data
- Performance validated: 0.29ms queries, 32.9MB memory (10K vectors)
- Missing: Real-world recall accuracy with actual text embeddings

**Deliverable**: `docs/research/epic-9-vector-recall-validation.md`

**Scope**:
1. Generate 1000 real text embeddings using transformer.js
   - Sample from actual course content (video titles, descriptions, notes)
   - Use `all-MiniLM-L6-v2` model (384 dimensions, matches Epic 9 spec)

2. Build HNSW index with recommended parameters
   - M = 16 (connections per layer)
   - efConstruction = 200 (build-time search depth)
   - efSearch = 100 (query-time search depth)

3. Benchmark recall@10 and recall@50
   - Compare HNSW results vs brute-force exact search
   - Target: ≥95% recall@10, ≥98% recall@50
   - Document actual recall percentages achieved

4. Test edge cases
   - Empty query vector
   - Single-vector index
   - Duplicate embeddings
   - Out-of-distribution queries

5. Validate memory scaling
   - Measure actual memory footprint with 1K, 5K, 10K vectors
   - Compare to theoretical estimate (32.9MB @ 10K)

**Success Criteria**:
- [ ] 1000 real embeddings generated successfully
- [ ] Recall@10 ≥95% (acceptable for RAG use cases)
- [ ] Recall@50 ≥98% (comprehensive search coverage)
- [ ] Memory usage within ±10% of estimate
- [ ] Edge cases handled gracefully (no crashes)

**Output Format**:
```markdown
# Vector Recall Validation Report

## Setup
- Embeddings: 1000 real text samples from course content
- Model: all-MiniLM-L6-v2 (384 dimensions)
- Parameters: M=16, efConstruction=200, efSearch=100

## Recall Metrics
- Recall@10: XX.X%
- Recall@50: XX.X%
- Query latency: XX.XXms average

## Memory Scaling
| Vectors | Memory (MB) | Theoretical | Delta |
|---------|-------------|-------------|-------|
| 1,000   | XX.X        | 3.29        | ±X%   |
| 5,000   | XX.X        | 16.45       | ±X%   |
| 10,000  | XX.X        | 32.9        | ±X%   |

## Edge Cases
[Results for empty query, single vector, duplicates, etc.]

## Recommendation
✅ PROCEED / ⚠️ TUNE PARAMETERS / ❌ REVISIT APPROACH
```

---

### Task 2: WebLLM Streaming Performance (1-2h)

**Timing**: During E09-S04 (AI Q&A from Notes)

**Objective**: Validate streaming token latency for real-time UX

**Context from Prep Sprint**:
- Llama-3.2-1B-Instruct-q4f32 selected (40-60 tokens/s)
- Prototype shows streaming works
- Missing: Actual perceived latency measurement

**Deliverable**: `docs/research/epic-9-webllm-streaming-validation.md`

**Scope**:
1. Measure first-token latency
   - Time from request to first visible token
   - Test with 3 prompt sizes: short (50 tokens), medium (200 tokens), long (500 tokens)
   - Target: <500ms for responsive feel

2. Measure streaming smoothness
   - Token display intervals (time between consecutive tokens)
   - Calculate jitter (variance in token intervals)
   - Target: <50ms jitter for smooth visual flow

3. Test concurrent streaming scenarios
   - Single user, multiple sequential requests (chat history)
   - Validate token bufferring doesn't cause memory leaks
   - Measure memory delta after 10 streaming responses

4. Validate UI responsiveness
   - Scroll performance during streaming
   - Input field responsiveness while tokens render
   - Browser main thread FPS (target: ≥30 FPS)

5. Test streaming error handling
   - Model timeout (30s max response)
   - Truncation at max tokens (1024 limit)
   - Browser tab backgrounding/foregrounding

**Success Criteria**:
- [ ] First-token latency <500ms (90th percentile)
- [ ] Token interval jitter <50ms (smooth visual streaming)
- [ ] Zero memory leaks after 10 responses
- [ ] Main thread FPS ≥30 during streaming
- [ ] Error handling graceful (no UI freeze)

**Output Format**:
```markdown
# WebLLM Streaming Performance Validation

## First-Token Latency
| Prompt Size | P50  | P90  | P99  |
|-------------|------|------|------|
| Short (50t) | XXms | XXms | XXms |
| Med (200t)  | XXms | XXms | XXms |
| Long (500t) | XXms | XXms | XXms |

## Streaming Smoothness
- Average token interval: XXms
- Jitter (std dev): XXms
- Visual assessment: Smooth / Choppy / Acceptable

## Memory & Performance
- Memory delta after 10 responses: +XX MB
- Main thread FPS during streaming: XX fps
- Scroll jank detected: Yes / No

## Error Handling
[Results for timeout, truncation, tab switching]

## Recommendation
✅ PRODUCTION-READY / ⚠️ NEEDS OPTIMIZATION / ❌ BLOCKER FOUND
```

---

## Execution Strategy

### Parallel Execution

Both tasks are fully independent and can run simultaneously:

```
┌──────────────────────────────────────────┐
│ Agent 1: Vector Recall (2-3h)           │
│ - Generate 1000 real embeddings          │
│ - Benchmark recall@10 and recall@50      │
│ - Test edge cases + memory scaling       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Agent 2: WebLLM Streaming (1-2h)        │
│ - Measure first-token latency            │
│ - Test streaming smoothness + jitter     │
│ - Validate UI responsiveness             │
└──────────────────────────────────────────┘
```

**Total Wall Time**: ~3 hours (both agents in parallel)

### Integration

After both agents complete:
1. Review validation reports for any unexpected findings
2. If blockers found, escalate to Epic 9 planning
3. If validations pass, proceed with E09-S03 and E09-S04 implementation
4. Archive reports in `docs/research/`

---

## Success Criteria

**Vector Recall Validation**:
- ✅ Recall@10 ≥95%
- ✅ Recall@50 ≥98%
- ✅ Memory usage within ±10% of estimate
- ✅ Edge cases handled

**WebLLM Streaming Performance**:
- ✅ First-token latency <500ms (P90)
- ✅ Token jitter <50ms
- ✅ Zero memory leaks
- ✅ Main thread FPS ≥30

**Overall**:
- [ ] Both reports delivered
- [ ] No blockers identified
- [ ] E09-S03 and E09-S04 ready to implement

---

## Notes

- These validations are **non-blocking** — Epic 9 can proceed without them
- Reports inform implementation decisions (parameter tuning, error handling)
- If blockers found, they surface early in Epic 9 implementation (S03/S04)
- Minimal context overhead — each agent works independently

---

*Generated 2026-03-10*
