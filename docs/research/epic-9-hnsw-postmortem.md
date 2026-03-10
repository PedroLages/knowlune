# HNSW Implementation Postmortem

**Date**: 2026-03-10
**Status**: ❌ ABANDONED after 4 fix attempts
**Time Invested**: 3 hours (parallel agents)
**Final Recall**: 6.2% (Target: ≥95%)

## Executive Summary

Custom HNSW implementation for Epic 9 vector search failed to achieve acceptable recall after 4 targeted bug fixes. Decision: Pivot to brute force k-NN for MVP.

## Timeline of Fix Attempts

### Attempt 1: Modify Termination Check (Agent ID: aeeef25)
- **Change**: Modified searchLayer() termination from `results[results.length - 1]` to `results[Math.min(results.length - 1, num - 1)]`
- **Hypothesis**: Wrong array index causing premature termination
- **Result**: 6.40% recall ❌ (was 6.70%)
- **Conclusion**: Marginal regression, not the root cause

### Attempt 2: Remove Early Termination (Agent ID: a0470f9)
- **Change**: Removed distance-based termination check entirely
- **Hypothesis**: Early stopping prevents full graph exploration
- **Result**: 4.60% recall ❌ (WORSE than before)
- **Conclusion**: Early termination wasn't the problem; removal made it worse

### Attempt 3: Add All Neighbors to Candidates (Agent ID: aa8bf32)
- **Change**: Removed conditional `if (dist < results[...].distance)`, add ALL neighbors
- **Hypothesis**: Filtering neighbors prevents graph traversal
- **Result**: 6.20% recall ❌ (slight improvement but still failed)
- **Conclusion**: Closer to original but still 89% below target

### Attempt 4: Root Cause Analysis
- **Method**: Comprehensive code review of 540-line implementation
- **Findings**:
  - Sorts candidates+results arrays on EVERY neighbor addition (O(N²log N))
  - No proper heap data structures (min-heap/max-heap)
  - selectNeighbors() too simplistic (just slices first M)
  - Potentially poor graph connectivity during construction
  - Unknown additional bugs (likely multiple interacting)

## Root Causes Identified

### 1. Algorithmic Complexity Issues
**Location**: `hnsw-poc.mjs` lines 235-236

```javascript
// Inside searchLayer() neighbor loop - called 30+ times per node
candidates.sort((a, b) => a.distance - b.distance)  // O(N log N) per addition!
results.sort((a, b) => a.distance - b.distance)      // O(N log N) per addition!
```

**Impact**: O(N²log N) instead of O(N log N) using proper heaps

### 2. Lack of Proper Data Structures
- Candidates should be min-heap (best at top for greedy selection)
- Results should be max-heap (worst at top for easy pruning)
- Current: Sorts entire arrays repeatedly

### 3. Simplistic Neighbor Selection
**Location**: `hnsw-poc.mjs` lines 251-254

```javascript
selectNeighbors(candidates, M) {
  return candidates.slice(0, M)  // Just takes first M, no diversity heuristic
}
```

**Impact**: May create poor graph connectivity

### 4. Validation Against Canonical Implementations

Compared against:
- FAISS (Facebook AI Similarity Search)
- hnswlib (Yury Malkov's C++ implementation)
- HNSW paper (Malkov & Yashunin 2016)

**Finding**: Our implementation missing critical optimizations

## Lessons Learned

### 1. Boring Technology Principle
Custom implementations of complex algorithms (HNSW = 700+ lines in production libs) are HIGH RISK.

**Evidence**:
- 4 fix attempts, 0 success
- Unknown bug count (could be 1, could be 5+)
- 3 hours invested, no progress

**Lesson**: Use battle-tested libraries (EdgeVec, hnswlib) for complex data structures

### 2. Premature Optimization
Built custom HNSW before validating brute force was insufficient.

**Timeline**:
- Epic 9 prep sprint: "Let's build HNSW for sub-millisecond search!"
- Reality: 10K vectors = 50-100ms brute force (ACCEPTABLE for MVP)

**Lesson**: Measure first, optimize later

### 3. Sunk Cost Fallacy Awareness
After 3 hours of failed fixes, continuing would be "throwing good money after bad."

**Calculation**:
- Already spent: 3 hours
- To fix properly: 12-20 MORE hours (instrument, debug, validate)
- Risk: HIGH (unknown bugs)
- Alternative (brute force): 4-6 hours, ZERO risk

**Decision**: Cut losses, pivot to brute force

### 4. Research Validation Importance
The prep sprint research correctly identified EdgeVec as fallback (8.40/10 score), but we pursued custom HNSW (8.90/10) first.

**Lesson**: When research shows <5% score difference, choose LOWER RISK option

## Impact on Epic 9

### Timeline
- **Time lost**: 3 hours (parallel agents, so minimal wall-clock impact)
- **Time gained**: Avoided 12-20 more hours of debugging
- **Net impact**: -3 hours from prep sprint, but E09-S03 still on track

### Technical Debt
- **Avoided**: Maintaining buggy custom HNSW implementation
- **Accepted**: Brute force O(N) search (acceptable for 10K-50K vectors)
- **Future**: EdgeVec migration at 6-month checkpoint (if needed)

## Decision: Brute Force for MVP

**Rationale** (5 points):
1. Epic 9 timeline: Unblocks E09-S03 in 4-6 hours
2. 10K vector scale: 50-100ms latency (acceptable)
3. Simplicity: Zero bugs, works immediately
4. Defer complexity: Migrate to EdgeVec at 6-month checkpoint (if needed)
5. Risk elimination: No custom algorithm maintenance

**Migration trigger** (at production checkpoint):
- User library >50K vectors, OR
- Latency >200ms p95, OR
- User complaints about search speed

## Artifacts Archived

**Location**: `experiments/vector-db-benchmark/archive/`

**Files**:
- `hnsw-poc-failed.mjs` - Broken implementation (6.2% recall)
- `vector-recall-validation.mjs` - Validation script showing failure
- `README-archive.md` - Why these files are archived

**Status**: Kept for historical reference, NOT for production use

## References

**Research Documents**:
- `epic-9-vector-recall-validation.md` - Original validation showing 6.7% recall
- `epic-9-hnsw-algorithm-deep-dive.md` - Bug analysis (wrong conclusions)
- `epic-9-vector-library-alternatives.md` - EdgeVec evaluation
- `epic-9-vector-store-strategic-analysis.md` - Decision matrix

**Canonical HNSW Sources**:
- Malkov & Yashunin (2016): "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs"
- FAISS implementation: https://github.com/facebookresearch/faiss
- hnswlib: https://github.com/nmslib/hnswlib

---

*Postmortem completed: 2026-03-10*
*Lessons integrated into project memory*
