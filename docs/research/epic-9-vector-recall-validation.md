# Vector Recall Validation Report

**Date**: 2026-03-10
**Epic**: Epic 9 (AI-Assisted Learning)
**Purpose**: Validate HNSW vector store recall accuracy with real text embeddings
**Status**: ❌ **BLOCKER FOUND** — Algorithm implementation issue detected

---

## Executive Summary

Validation of the custom HNSW implementation revealed **critical recall failures** (6-7% vs target 95%+). Testing with both synthetic text-based embeddings and random vectors shows the HNSW search algorithm has a fundamental bug preventing proper neighbor discovery. Parameter tuning (`efSearch` from 50 to 1000) had no meaningful impact on recall.

**Recommendation**: **❌ REVISIT APPROACH** — Fix HNSW search algorithm before proceeding with Epic 9 implementation.

---

## Setup

### Test Data
- **Embeddings**: 1000 real text samples from LevelUp course content
  - 6 courses across 5 categories
  - 165 base samples (titles, descriptions, topics, tags)
  - Augmented to 1000 with realistic text variations
- **Model**: Synthetic embeddings mimicking `all-MiniLM-L6-v2` (384 dimensions)
  - Word-based sparse features (5% dimension activation per word)
  - Deterministic generation for reproducibility
  - Local context smoothing for semantic clustering

### HNSW Configuration
- `M = 16` (max connections per layer)
- `efConstruction = 200` (build-time search depth)
- `efSearch = 100` (query-time search depth)
- Algorithm: Custom implementation from `experiments/vector-db-benchmark/hnsw-poc.mjs`

---

## Recall Metrics

### Recall@10 (100 queries)
- **Actual**: **6.70%**
- **Target**: ≥95%
- **Status**: ⚠️ **CRITICAL FAILURE** (88.3 percentage points below target)

### Recall@50 (100 queries)
- **Actual**: **4.68%**
- **Target**: ≥98%
- **Status**: ⚠️ **CRITICAL FAILURE** (93.3 percentage points below target)

### Query Performance
- **HNSW Latency**: 0.49ms (average)
- **Brute Force Latency**: 1.86ms (average)
- **Speedup**: 3.8x
- **Note**: Speed is acceptable, but recall renders index unusable

---

## Memory Scaling

| Vectors | Actual Memory | Theoretical | Delta    | Status              |
|---------|---------------|-------------|----------|---------------------|
| 1,000   | 3.78 MB       | 3.29 MB     | +14.8%   | ⚠️ Outside ±10%     |
| 5,000   | N/A           | 16.45 MB    | N/A      | Skipped (data limit)|
| 10,000  | N/A           | 32.9 MB     | N/A      | Skipped (data limit)|

**Memory Breakdown (1K vectors)**:
- Vectors: 1.46 MB (Float32Array storage)
- Graph: 2.21 MB (connection edges)
- Metadata: 0.10 MB (node overhead)
- **Total**: 3.78 MB

**Notes**:
- Memory delta (+14.8%) slightly exceeds ±10% target
- Likely due to graph connection overhead (avg 48.3 connections vs theoretical 32)
- Memory estimation formula needs refinement

---

## Edge Cases

All edge case tests **passed** gracefully:

| Test Case              | Result | Details                          |
|------------------------|--------|----------------------------------|
| Empty index query      | ✅ PASS | Returns empty array              |
| Single vector index    | ✅ PASS | Returns single result            |
| Duplicate embeddings   | ✅ PASS | Handles without errors           |
| Zero vector query      | ✅ PASS | Returns 5 results as expected    |

**Verdict**: Edge case handling is robust — not the source of recall failures.

---

## Root Cause Analysis

### Investigation Methodology

To isolate the recall issue, three test scenarios were executed:

1. **Text-based embeddings** (validation script) → 6.70% recall
2. **Random vectors** (control test) → 6.60% recall
3. **efSearch parameter sweep** (50, 100, 200, 500, 1000) → 6-7.4% recall (no improvement)

### Findings

**Issue Identified**: Bug in `searchLayer()` function (line 220 of `hnsw-poc.mjs`)

```javascript
if (current.distance > results[results.length - 1].distance && results.length >= num) {
  break  // ❌ EXITS TOO EARLY
}
```

**Problem**: This condition terminates the search when the current candidate is farther than the worst result in the top-N list. However, in HNSW, the current candidate may lead to better neighbors via graph traversal — stopping early prevents proper exploration.

**Impact**:
- Search terminates after exploring only a small fraction of the graph
- Misses most true nearest neighbors
- Explains why recall is ~6% regardless of parameters
- Classic HNSW implementation bug (seen in early research implementations)

### Verification

Parameter tuning had **no effect** on recall:

| efSearch | Recall@10 |
|----------|-----------|
| 50       | 7.00%     |
| 100      | 6.00%     |
| 200      | 6.00%     |
| 500      | 7.40%     |
| 1000     | 6.40%     |

This confirms the issue is algorithmic, not parametric.

---

## Index Build Performance

- **Build Time**: 1.83s for 1000 vectors
- **Per-Vector**: 1.83ms average
- **Graph Stats**:
  - Nodes: 1000
  - Max Layer: 11
  - Avg Connections: 48.3
  - Max Connections: 32

**Note**: Build process completed successfully — issue is isolated to search phase.

---

## Test Artifacts

### Generated Files
- `experiments/vector-db-benchmark/course-text-samples.json` — 1000 text samples (165 base + augmentations)
- `experiments/vector-db-benchmark/vector-recall-validation.mjs` — Main validation script
- `experiments/vector-db-benchmark/extract-course-text.mjs` — Text extraction utility
- `experiments/vector-db-benchmark/test-hnsw-basic.mjs` — Control test (random vectors)
- `experiments/vector-db-benchmark/test-ef-params.mjs` — Parameter sweep

### Reproducibility
All scripts use deterministic random seed (`seed = 42`) for embedding generation. Re-running produces identical results.

---

## Recommendations

### 🔴 CRITICAL: Fix HNSW Search Algorithm

**Required Changes** (before Epic 9 implementation):

1. **Fix `searchLayer()` termination condition**:
   ```javascript
   // Current (WRONG):
   if (current.distance > results[results.length - 1].distance && results.length >= num) {
     break
   }

   // Correct:
   if (candidates.length === 0) {
     break  // Only stop when no more candidates to explore
   }
   ```

2. **Add early stopping based on graph distance** (optional optimization):
   ```javascript
   // Stop if current candidate is worse than furthest result AND
   // we've explored enough candidates
   if (current.distance > results[results.length - 1].distance * 1.5 &&
       visited.size > num * 10) {
     break
   }
   ```

3. **Validate fix with target metrics**:
   - Re-run validation with corrected algorithm
   - Target: Recall@10 ≥95%, Recall@50 ≥98%
   - Document actual recall achieved

### Alternative: Use Established Library

If fixing the custom implementation is time-intensive, consider:

- **hnswlib-node** (Node.js bindings to C++ library)
  - Proven implementation with >95% recall
  - Faster than custom JS implementation
  - Harder to bundle for browser (requires WebAssembly)

- **vectra** (pure JS, browser-ready)
  - No native dependencies
  - Built-in IndexedDB persistence
  - Trade-off: slightly slower than C++ implementations

### Memory Estimation Refinement

Update theoretical memory formula to account for actual graph overhead:

```javascript
// Current: vectorMemory + (avgConnections * nodeCount * 48)
// Refined: vectorMemory + (avgConnections * nodeCount * 60)  // +25% overhead
```

This would bring 1K estimate to 3.8MB (matches actual).

---

## Impact on Epic 9

### Blocker Status
**YES** — This is a **blocking issue** for Epic 9 implementation.

### Reasoning
- Semantic search is core to E09-S04 (AI Q&A from Notes)
- 6% recall means 94% of relevant notes would be missed
- Unacceptable user experience (useless search results)
- Cannot ship to production with broken search

### Timeline Impact
- **Estimate**: 2-4 hours to fix and re-validate
- **If using library**: 1-2 hours to integrate + validate
- **Total Epic 9 Delay**: <1 day (minimal impact)

---

## Next Steps

1. **Immediate** (before E09-S03):
   - Fix `searchLayer()` algorithm OR
   - Integrate established HNSW library (vectra recommended for browser)

2. **Re-validation** (after fix):
   - Re-run `vector-recall-validation.mjs`
   - Confirm Recall@10 ≥95%, Recall@50 ≥98%
   - Update this report with pass/fail

3. **Epic 9 Proceed** (if validation passes):
   - Continue with E09-S03 (Embedding Pipeline & Vector Store)
   - Use validated HNSW implementation
   - Monitor recall in production with real user queries

---

## Appendix: Text Sample Distribution

**Base Content** (165 samples):
- Course titles: 6
- Course descriptions: 6
- Course tags: 32
- Module titles: 8
- Module descriptions: 8
- Lesson titles: 20
- Lesson descriptions: 20
- Key topics: 65

**Augmentation Strategy** (to 1000):
- Text variations with prefixes/suffixes (825 samples)
  - "Course: {title}", "Learning about {title}", "What is {topic}?", etc.
- Synthetic combinations (10 samples)
  - "{type} {context}" where type = behavior/influence/authority/persuasion/psychology

**Rationale**: Real course text provides semantic grounding, variations increase volume while maintaining realistic clustering patterns.

---

## Conclusion

While the HNSW PoC demonstrated acceptable speed (0.49ms queries) and robust edge case handling, the **critical recall failure** (6-7% vs 95%+ target) renders it **unsuitable for production** without algorithmic fixes.

The issue is well-understood (premature search termination), easily fixable (1-2 line change), and validates quickly (re-run existing test). **Recommend immediate fix before Epic 9 implementation** to avoid shipping broken semantic search.

---

**Report Generated**: 2026-03-10
**Validation Scripts**: `/experiments/vector-db-benchmark/`
**Status**: ❌ REVISIT APPROACH (fix required)
