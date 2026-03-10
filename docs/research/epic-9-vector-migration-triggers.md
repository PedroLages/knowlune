# Vector Store Migration Decision Framework

**Date**: 2026-03-10
**Current Implementation**: Brute force k-NN (`BruteForceVectorStore`)
**Migration Options**: EdgeVec (HNSW), hnswlib-wasm, or custom HNSW (if fixed)
**Status**: Migration NOT needed for Epic 9 MVP

---

## Executive Summary

Brute force vector search exceeds Epic 9 MVP requirements (10.27ms latency @ 10K vectors vs 100ms target). Migration to approximate nearest neighbor (ANN) algorithms like HNSW is deferred to **6-month production checkpoint** if trigger conditions are met.

**Key Metrics** (current brute force):
- **Performance**: 10.27ms p50, 11.11ms p95 @ 10K vectors
- **Recall**: 100% (exact search)
- **Memory**: 14.65MB @ 10K vectors
- **Scalability**: Acceptable up to 50K vectors (est. 50-100ms)

**When to migrate**: See trigger conditions below.

---

## Trigger Conditions (Evaluate at 6-Month Checkpoint)

Migrate from brute force to HNSW/EdgeVec if **ANY** of these conditions are met:

### 1. Scale Trigger: >50,000 Vectors

**Rationale**: Brute force latency scales linearly (O(N)). At 50K vectors:
- Estimated latency: 50-100ms (still acceptable)
- At 100K vectors: 100-200ms (borderline)
- At 200K+ vectors: >200ms (unacceptable)

**Measurement**:
```sql
-- Count total embeddings in IndexedDB
SELECT COUNT(*) FROM vectorEmbeddings;
```

**Action**: If count >50K, proceed to migration planning

### 2. Performance Trigger: p95 Latency >200ms

**Rationale**: Users perceive >200ms as "slow" for interactive search

**Measurement**:
- Instrument `BruteForceVectorStore.search()` with performance markers
- Log p50/p95/p99 latencies to analytics
- Track 7-day rolling average

**Threshold**: If p95 latency >200ms for 3+ consecutive days → migrate

**Example Analytics Query**:
```typescript
// In vector search wrapper
const start = performance.now()
const results = vectorStore.search(query, k)
const latency = performance.now() - start

analytics.track('vector_search_latency', {
  latency_ms: latency,
  vector_count: vectorStore.size,
  k: k
})
```

### 3. User Experience Trigger: Complaints About Search Speed

**Signals**:
- Support tickets mentioning "slow search"
- User surveys citing search performance as pain point
- Analytics showing search abandonment (user starts search, navigates away before results)

**Measurement**:
- Track search-to-click-through rate (users who search and click result)
- Monitor session recordings for search UX frustration
- Survey 10+ active users about search experience

**Threshold**: If 3+ user complaints in one week OR <70% search CTR → investigate and consider migration

### 4. Memory Trigger: >500MB Vector Store

**Rationale**: Browser memory limits, especially on mobile devices

**Measurement**:
```typescript
const stats = vectorStore.getStats()
// stats.memoryMB

// Browser memory API (if available)
if (performance.memory) {
  const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024)
  console.log(`Total JS heap: ${usedMB}MB`)
}
```

**Threshold**: If `vectorStore.getStats().memoryMB > 500` → migrate

**Note**: EdgeVec uses more efficient memory layout (HNSW graph overhead offset by better compression)

---

## Migration Options (Ranked)

### Option 1: EdgeVec (Rust/WASM) — Score: 9.2/10 ⭐ RECOMMENDED

**Pros**:
- Battle-tested HNSW implementation (Rust port, active maintenance)
- WASM bundle: +148KB (acceptable for production)
- Proven recall: ≥95% in production systems
- Sub-millisecond search (<5ms @ 100K vectors)
- Active GitHub: 28 stars, maintained by vector search experts

**Cons**:
- Larger bundle size than custom implementation
- WASM compilation adds ~500ms initial load time
- Learning curve for WASM interop

**Integration Effort**: 24-36 hours
- 8-10h: EdgeVec setup, WASM bundling, API wrapper
- 8-12h: IndexedDB integration, migration script
- 6-10h: Testing (unit, E2E, recall validation)
- 2-4h: Performance tuning (efSearch, M parameters)

**Code Example**:
```typescript
import { EdgeVecStore } from '@edgevec/wasm'

export class EdgeVecVectorStore {
  private store: EdgeVecStore

  constructor(dimensions: number = 384) {
    this.store = new EdgeVecStore({
      dimensions,
      M: 16,
      efConstruction: 200,
      efSearch: 100
    })
  }

  // Same interface as BruteForceVectorStore
  insert(id: string, vector: number[]): void {
    this.store.insert(id, vector)
  }

  search(query: number[], k: number): SearchResult[] {
    return this.store.search(query, k)
  }
}
```

### Option 2: hnswlib-wasm — Score: 8.5/10

**Pros**:
- Official hnswlib C++ port to WASM
- Highest recall (≥98%, matches C++ implementation)
- Mature codebase (hnswlib has 4K+ GitHub stars)

**Cons**:
- Larger bundle: +200KB
- Less active maintenance (last update 6 months ago)
- More complex WASM interop than EdgeVec

**Integration Effort**: 20-30 hours

### Option 3: Custom HNSW (Fix Bugs) — Score: 5.5/10 ❌ NOT RECOMMENDED

**Pros**:
- No bundle size increase (already in codebase)
- Full control over implementation

**Cons**:
- Already failed 4 fix attempts (3 hours, 0 progress)
- Unknown bug count (likely multiple interacting)
- Estimated 12-20 more hours with HIGH risk
- No production validation

**Integration Effort**: 12-20 hours (debugging) + unknown time to fix all bugs

**Verdict**: Only consider if EdgeVec and hnswlib are unavailable

---

## Pre-Migration Checklist

Before migrating, complete these steps:

### 1. Data Collection (2 weeks before migration)

- [ ] Instrument brute force search with latency metrics
- [ ] Collect p50/p95/p99 latencies across all users
- [ ] Measure actual vector store size (production data)
- [ ] Survey 10+ active users about search experience
- [ ] Review support tickets for search-related complaints

### 2. Proof of Concept (1 week before migration)

- [ ] Benchmark EdgeVec with PRODUCTION data (not synthetic)
- [ ] Validate recall ≥95% on real course content embeddings
- [ ] Measure actual bundle size increase
- [ ] Test WASM load time on 3G connection (mobile users)
- [ ] Verify browser compatibility (Safari, Firefox, Chrome)

### 3. Migration Planning (before starting)

- [ ] Estimate actual integration effort (adjust 24-36h based on codebase)
- [ ] Get PM/stakeholder approval for 1-1.5 week sprint
- [ ] Create rollback plan (feature flag for brute force fallback)
- [ ] Define success metrics (latency reduction, no recall regression)
- [ ] Schedule migration during low-traffic period

### 4. Implementation Checklist

- [ ] Install EdgeVec WASM package
- [ ] Create `EdgeVecVectorStore` wrapper with same interface as `BruteForceVectorStore`
- [ ] Add feature flag: `USE_EDGE_VEC` (default: false)
- [ ] Implement migration script: load from IndexedDB → rebuild EdgeVec index
- [ ] Create recall validation test (compare EdgeVec vs brute force)
- [ ] Add E2E tests for vector search with EdgeVec
- [ ] Update documentation (CLAUDE.md, vector search docs)
- [ ] Monitor latency metrics for 1 week post-migration

---

## Rollback Strategy

If migration causes issues, rollback via feature flag:

```typescript
// src/lib/vectorStoreLoader.ts
import { BruteForceVectorStore } from './vectorSearch'
import { EdgeVecVectorStore } from './edgeVecSearch'
import { FEATURE_FLAGS } from './featureFlags'

export async function initializeVectorStore() {
  const StoreClass = FEATURE_FLAGS.USE_EDGE_VEC
    ? EdgeVecVectorStore
    : BruteForceVectorStore

  const store = new StoreClass(384)

  // Load embeddings from IndexedDB
  const embeddings = await db.vectorEmbeddings.toArray()
  for (const emb of embeddings) {
    store.insert(emb.id, emb.embedding)
  }

  return store
}
```

**Rollback triggers**:
- Recall drops below 90% (validate with A/B test)
- Latency INCREASES (WASM overhead exceeds brute force)
- Browser crashes or WASM loading errors
- User complaints spike

**Rollback procedure**:
1. Set `FEATURE_FLAGS.USE_EDGE_VEC = false`
2. Clear IndexedDB vector cache (force rebuild)
3. Monitor metrics for 24 hours
4. Investigate root cause before re-attempting

---

## Cost-Benefit Analysis (6-Month Checkpoint)

| Metric | Brute Force (current) | EdgeVec (estimated) | Delta |
|--------|----------------------|---------------------|-------|
| Latency @ 50K (p50) | ~50ms | ~3ms | -47ms ✅ |
| Latency @ 100K (p50) | ~100ms | ~5ms | -95ms ✅ |
| Recall | 100% | 95-98% | -2-5% ⚠️ |
| Bundle size | 0KB | +148KB | +148KB ⚠️ |
| Memory @ 100K | ~150MB | ~180MB | +30MB ⚠️ |
| Maintenance | Low | Low | = |
| Integration time | 0h (done) | 24-36h | +36h ⚠️ |

**Break-even calculation**:
- Migration cost: 36 hours
- Latency improvement: 47-95ms (@ 50K-100K vectors)
- User impact: Depends on vector count growth rate

**Decision criteria**:
- If growing to 50K vectors within 3 months → migrate NOW (avoid future pain)
- If staying <50K vectors for 1+ year → defer migration (no urgency)

---

## Success Metrics (Post-Migration)

After migrating to EdgeVec, track these metrics for 2 weeks:

**Performance**:
- [ ] p50 latency <10ms (vs ~50ms brute force @ 50K)
- [ ] p95 latency <20ms (vs ~100ms brute force)
- [ ] p99 latency <50ms

**Accuracy**:
- [ ] Recall ≥95% (vs 100% brute force)
- [ ] No user-visible search quality degradation

**Reliability**:
- [ ] Zero browser crashes related to WASM
- [ ] WASM load time <1s on 3G connection
- [ ] Search success rate >99% (no errors)

**User Experience**:
- [ ] Search-to-click-through rate unchanged or improved
- [ ] Zero support tickets about "search stopped working"
- [ ] User survey: search speed rated 4+/5

---

## Timeline Example

**Month 0** (Epic 9 MVP launch): Brute force, 10K vectors, 10ms latency ✅

**Month 3**: 25K vectors, 25ms latency (still acceptable) ✅

**Month 6** (production checkpoint):
- 55K vectors, 55ms latency
- Trigger: >50K vectors ⚠️
- **Decision**: Migrate to EdgeVec

**Month 7** (migration sprint):
- Week 1: PoC with production data, EdgeVec setup
- Week 2: Implementation, testing, gradual rollout
- Week 3: Monitor metrics, rollback if issues

**Month 8+**: EdgeVec in production, <10ms latency @ 55K+ vectors ✅

---

## References

**Current Implementation**:
- `src/lib/vectorSearch.ts` - BruteForceVectorStore
- `experiments/vector-db-benchmark/brute-force-validation.mjs` - Validation

**Research**:
- `docs/research/epic-9-hnsw-postmortem.md` - Why custom HNSW failed
- `docs/research/epic-9-vector-library-alternatives.md` - EdgeVec evaluation
- `docs/research/epic-9-vector-decision-framework.md` - Original decision matrix

**Migration Plan**:
- `docs/plans/epic-9-pivot-to-brute-force-vector-search.md` - Current plan

**External**:
- EdgeVec: https://github.com/edgevec/edgevec
- hnswlib: https://github.com/nmslib/hnswlib
- HNSW paper: https://arxiv.org/abs/1603.09320

---

*Document created: 2026-03-10*
*Review at: 6-month production checkpoint (2026-09-10)*
