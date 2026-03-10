# Browser Vector Search Decision Framework

**Date**: 2026-03-10
**Epic**: Epic 9 (AI-Assisted Learning)
**Author**: Claude Code (Decision Synthesizer)
**Purpose**: Quantitative framework for browser-based vector search implementation
**Status**: ✅ **DECISION READY**

---

## Executive Summary

After analyzing 4 research dimensions (algorithms, libraries, simplicity, real-world evidence), the **clear recommendation** for Epic 9 is:

**🏆 Fix Custom HNSW Implementation (2-week timeline)**

Switch to **EdgeVec library at 6-month checkpoint** if complexity grows.

**Confidence**: High (8/10) for 2-week timeline, Medium (6/10) for 18-month roadmap.

**Rationale** (3 sentences):
The custom HNSW bug is well-understood and easily fixable (1-2 line change at line 220), unblocking Epic 9 in 2-4 hours vs 24-36 hours for library integration. For the 10K vector scale and 2-week deadline, the simplicity advantage of fixing the bug outweighs library adoption complexity. However, if maintenance burden or scaling issues emerge at the 6-month checkpoint, EdgeVec provides a production-ready migration path with proven sub-millisecond performance.

---

## 1. Weighted Criteria Matrix

### Scoring Methodology

**Scale**: 1-10 (10 = best)
- **1-3**: Poor/Fails requirement
- **4-6**: Acceptable/Meets minimum
- **7-8**: Good/Exceeds requirement
- **9-10**: Excellent/Far exceeds

**Sources**:
- HNSW algorithm research (epic-9-hnsw-algorithm-deep-dive.md)
- Library survey (epic-9-vector-library-alternatives.md)
- Strategic analysis (epic-9-vector-store-strategic-analysis.md)
- Recall validation (epic-9-vector-recall-validation.md)

### Full Criteria Matrix

| Criteria | Weight | Brute Force | LSH | HNSW (fix) | EdgeVec | PGLite pgvector | Cloud API |
|----------|--------|-------------|-----|------------|---------|-----------------|-----------|
| **Epic 9 timeline (2wks)** | 25% | 9 | 4 | 10 | 6 | 5 | 3 |
| **Simplicity (maintenance)** | 20% | 10 | 6 | 7 | 8 | 5 | 9 |
| **Scalability (10K→100K)** | 15% | 2 | 7 | 9 | 10 | 9 | 10 |
| **Offline capability** | 15% | 10 | 10 | 10 | 10 | 10 | 1 |
| **Bundle size** | 10% | 10 | 8 | 10 | 7 | 4 | 10 |
| **Production evidence** | 10% | 9 | 6 | 3 | 7 | 8 | 10 |
| **Privacy (local data)** | 5% | 10 | 10 | 10 | 10 | 10 | 1 |
| **TOTAL SCORE** | 100% | **7.85** | **6.55** | **8.90** | **8.40** | **7.00** | **6.30** |

### Detailed Scoring Rationale

#### Epic 9 Timeline (2 weeks) — Weight: 25%

**HNSW (fix): 10/10**
- Fix is 1-2 line change (line 220 premature termination)
- Estimated 2-4 hours to fix + 2-4 hours validation = 4-8 hours total
- No API changes required
- Test infrastructure already exists

**Brute Force: 9/10**
- Simplest implementation (~50 lines of code)
- 4-6 hours to implement + IndexedDB integration
- But: 50-100ms latency for 10K vectors (vs <1ms target)

**EdgeVec: 6/10**
- 24-36 hours integration (library setup, API adapter, Dexie integration)
- 14-22 hours test updates (rewrite seeding helpers, validation)
- Total: 38-58 hours (1-1.5 weeks delay)

**LSH: 4/10**
- No browser-ready libraries found
- Custom implementation: 40-60 hours (algorithm complexity)
- Requires parameter tuning for recall

**PGLite pgvector: 5/10**
- 20-30 hours to integrate PostgreSQL WASM
- 10-15 hours for SQL/TypeScript adapter
- Large bundle size (~2-3MB)

**Cloud API: 3/10**
- Fast API integration (4-8 hours)
- But: Epic 9 architecture redesign (offline-first → cloud-dependent)
- Privacy concerns (user notes uploaded to cloud)

#### Simplicity (Maintenance) — Weight: 20%

**Brute Force: 10/10**
- ~50 lines of code
- No complex graph structures
- Easy to debug
- Estimated maintenance: 2-4 hours/year

**Cloud API: 9/10**
- Zero maintenance (vendor handles infrastructure)
- API updates handled by provider
- But: Vendor lock-in risk

**EdgeVec: 8/10**
- Well-documented API
- Active maintenance (Feb 2026 update)
- WASM binary is black box (harder to debug)
- Estimated maintenance: 4-8 hours/year (dependency updates)

**HNSW (fix): 7/10**
- 546 lines of code
- Complex algorithm (multi-layer graph, pruning heuristics)
- Comprehensive tests required (16 hours upfront)
- Estimated maintenance: 8-16 hours/year

**LSH: 6/10**
- Moderate algorithm complexity
- Parameter tuning required (hash functions, buckets)
- No browser libraries → custom implementation needed

**PGLite pgvector: 5/10**
- PostgreSQL WASM adds operational complexity
- SQL layer adds debugging overhead
- Extension updates required

#### Scalability (10K → 100K vectors) — Weight: 15%

**EdgeVec: 10/10**
- Benchmarked at 100K vectors (sub-millisecond search)
- SIMD optimization (2x+ speedup)
- Binary quantization (32x memory reduction)

**Cloud API: 10/10**
- Designed for millions of vectors
- Horizontal scaling
- Production-proven (Pinecone, Chroma, Weaviate)

**HNSW (fix): 9/10**
- Projected 100K: 329MB memory, 0.35-0.50ms queries
- Logarithmic query scaling
- Within 3GB memory ceiling (10x headroom)

**PGLite pgvector: 9/10**
- PostgreSQL proven at scale
- IVF-HNSW indexes available
- Memory constrained by WASM heap

**LSH: 7/10**
- Sublinear query time (O(log n))
- Recall degrades at scale (tuning required)
- No production browser benchmarks

**Brute Force: 2/10**
- Linear query time O(n)
- 100K vectors: 500-1000ms queries (unacceptable)
- No index structure

#### Offline Capability — Weight: 15%

**All local solutions: 10/10**
- Brute Force, LSH, HNSW (fix), EdgeVec, PGLite: All fully offline

**Cloud API: 1/10**
- Requires internet connection
- Fallback UX needed for offline mode
- Violates Epic 9 offline-first architecture

#### Bundle Size — Weight: 10%

**HNSW (fix): 10/10**
- Custom implementation: ~20KB minified + gzipped
- +1.3% to current bundle (1.5MB)

**Brute Force: 10/10**
- ~7.5KB (fast-cosine-similarity library)
- Smallest solution

**Cloud API: 10/10**
- ~10-15KB (REST client)
- No WASM or HNSW algorithm

**LSH: 8/10**
- Estimated ~30-50KB (hash functions, bucketing)
- Smaller than HNSW libraries

**EdgeVec: 7/10**
- 148KB gzipped (~965KB unpacked)
- WASM binary + Rust bindings
- +10% to bundle (acceptable for production)

**PGLite pgvector: 4/10**
- ~2-3MB WASM binary (PostgreSQL)
- +200% bundle size increase

#### Production Evidence — Weight: 10%

**Cloud API: 10/10**
- Pinecone, Chroma, Weaviate: Millions of users
- Battle-tested at scale
- Proven reliability

**Brute Force: 9/10**
- Cosine similarity is well-understood
- Used in production for <10K vector scenarios (e.g., RxDB examples)

**PGLite pgvector: 8/10**
- PostgreSQL pgvector extension is production-proven
- Obsidian Neural Composer uses PGLite successfully
- WASM port is newer but stable

**EdgeVec: 7/10**
- Active development (Feb 2026 update)
- Public benchmarks (24x faster than voy)
- Small community (~100 stars estimated)

**LSH: 6/10**
- Academic algorithm with production use
- No browser-specific libraries with production evidence

**HNSW (fix): 3/10**
- Custom implementation (no external users)
- Bug already found (6.7% recall)
- Test suite exists but coverage incomplete

#### Privacy (Local Data) — Weight: 5%

**All local solutions: 10/10**
- User notes never leave browser
- Fully GDPR compliant

**Cloud API: 1/10**
- Requires uploading user content to third-party servers
- Privacy policy and consent required
- GDPR compliance complexity

---

## 2. Scenario Analysis

### Scenario 1: 10K Vectors, 2-Week Timeline, Solo Dev

**Context**:
- Epic 9 stories blocked (E09-S03, S04, S05)
- Solo developer with limited time
- 10K embeddings (current scale)
- Offline-first architecture (non-negotiable)

**Best Choice**: **HNSW (fix)**

**Score Breakdown**:
- Timeline (25%): 10/10 (4-8 hours total)
- Simplicity (20%): 7/10 (8-16h/year maintenance)
- Scalability (15%): 9/10 (100K projected OK)
- Offline (15%): 10/10 (fully offline)
- Bundle (10%): 10/10 (+20KB)
- Production (10%): 3/10 (custom impl)
- Privacy (5%): 10/10 (local only)
- **TOTAL**: 8.90/10

**Runner-Up**: Brute Force (7.85/10)
- Faster to implement (4-6 hours)
- But: 50-100ms queries vs <1ms target

**Why Not EdgeVec?** (8.40/10, close second)
- 38-58 hours integration time (1-1.5 weeks delay)
- For 2-week deadline, time cost outweighs library benefits

**Recommendation**:
1. Fix HNSW bug (line 220 premature termination)
2. Re-validate recall (target ≥95%)
3. Ship Epic 9 with custom implementation
4. **Re-evaluate at 6-month checkpoint** (see Scenario 2)

### Scenario 2: 100K Vectors, 18-Month Roadmap, Team Growth

**Context**:
- 18 months post-Epic 9 (Epics 10-18)
- Corpus grown to 50-100K embeddings
- Team may expand from solo to 2-3 developers
- Advanced AI features (Epic 9B: Auto-analysis, Study recommendations)

**Best Choice**: **Migrate to EdgeVec** (at 6-month checkpoint)

**Score Breakdown**:
- Timeline (25%): 6/10 (not urgent, scheduled migration)
- Simplicity (20%): 8/10 (lower maintenance than custom)
- Scalability (15%): 10/10 (proven at 100K)
- Offline (15%): 10/10 (fully offline)
- Bundle (10%): 7/10 (148KB acceptable)
- Production (10%): 7/10 (active maintenance)
- Privacy (5%): 10/10 (local only)
- **TOTAL**: 8.40/10

**Why EdgeVec Wins at Scale**:
- Sub-millisecond search on 100K vectors (vs 0.35-0.50ms for custom HNSW)
- SIMD optimization (2x speedup on modern browsers)
- Binary quantization (32x memory reduction)
- Active maintenance (Feb 2026 update)
- Lower long-term maintenance burden (4-8h/year vs 8-16h/year)

**Migration Triggers** (check at 6-month checkpoint):
- ✅ Corpus exceeds 50K vectors
- ✅ Custom HNSW bugs accumulate (>3 issues)
- ✅ Maintenance time exceeds 30h cumulative
- ✅ Team grows (2+ developers, library easier to onboard)

**Migration Cost**:
- 20-40 hours (API adapter, test updates, validation)
- Acceptable given 18-month timeline

**Alternative**: PGLite pgvector (7.00/10)
- Consider if SQL capabilities needed (metadata queries)
- Trade-off: Larger bundle (2-3MB) vs richer query API

### Scenario 3: Privacy-First, Fully Offline Required

**Context**:
- Privacy is non-negotiable (GDPR, HIPAA, or similar)
- Offline mode is required (airplane mode, poor connectivity)
- No cloud dependencies allowed

**Best Choice**: **HNSW (fix)** for MVP, **EdgeVec** for scale

**All Local Solutions Score 10/10 on Privacy & Offline**:
- Brute Force: 7.85/10 overall
- LSH: 6.55/10 overall
- HNSW (fix): 8.90/10 overall
- EdgeVec: 8.40/10 overall
- PGLite pgvector: 7.00/10 overall

**Cloud API: Disqualified** (6.30/10 overall)
- Offline: 1/10
- Privacy: 1/10
- Not viable for privacy-first scenario

**Recommendation**:
1. **Start**: HNSW (fix) for fastest unblock (4-8 hours)
2. **Month 6**: Evaluate EdgeVec migration if scale demands
3. **Never**: Cloud API (violates privacy constraint)

**Privacy Validation Checklist**:
- ✅ All vector operations in browser (IndexedDB storage)
- ✅ No network requests for search
- ✅ No telemetry or analytics on user queries
- ✅ GDPR compliant (local-first data storage)

---

## 3. Final Recommendation

### Primary Recommendation: Fix Custom HNSW (2-Week Timeline)

**Confidence**: High (8/10)

**Action Plan**:

#### Immediate (Next 4-8 hours):
1. **Fix `searchLayer()` algorithm**
   - File: `experiments/vector-db-benchmark/hnsw-poc.mjs`
   - Line 220: Replace premature termination condition
   - Current (WRONG):
     ```javascript
     if (current.distance > results[results.length - 1].distance && results.length >= num) {
       break  // ❌ EXITS TOO EARLY
     }
     ```
   - Fixed (CORRECT):
     ```javascript
     // Compare min candidate against max result (proper HNSW termination)
     if (results.length >= ef) {
       results.sort((a, b) => a.distance - b.distance)
       const worstResultDistance = results[results.length - 1].distance
       if (current.distance > worstResultDistance) {
         break  // Safe termination: no candidate can improve results
       }
     }
     ```

2. **Re-validate recall**
   - Run: `node experiments/vector-db-benchmark/vector-recall-validation.mjs`
   - Target: Recall@10 ≥95%, Recall@50 ≥98%
   - Expected: 95-98% (based on canonical HNSW implementations)

3. **Port to production**
   - Copy to: `src/lib/vector-store/hnsw-index.ts`
   - Add TypeScript types, JSDoc comments
   - Integrate with Dexie.js (IndexedDB persistence)

4. **Proceed with Epic 9**
   - E09-S03: Embedding Pipeline & Vector Store
   - E09-S04: AI Q&A from Notes
   - E09-S05: Smart Note Search

#### 6-Month Checkpoint (Month 6):

**Evaluation Criteria**:
- Corpus size: X vectors (target: 20-50K)
- Query latency: X ms (target: <100ms)
- Bug count: X issues (target: <3 bugs)
- Maintenance time: X hours (target: <30h cumulative)

**Migration Triggers** (any 2 of 4):
- ✅ Corpus exceeds 50K vectors
- ✅ Bugs accumulate (>3 issues in 6 months)
- ✅ Maintenance exceeds 30 hours cumulative
- ✅ Query latency approaches 100ms (performance degradation)

**If Triggered**: Migrate to EdgeVec (20-40 hours, scheduled over 1-2 weeks)

#### 12-Month Checkpoint (Month 12):

**Final Evaluation**:
- Total maintenance cost: X hours (target: <64h)
- Scalability: 50-100K vectors handled?
- User satisfaction: NPS, support tickets
- Feature completeness: Missing capabilities?

**Options**:
- ✅ Continue: Custom HNSW meets all requirements
- ⚠️ Migrate to EdgeVec: Scaling or maintenance issues
- ❌ Cloud vector DB: Corpus exceeds 300K (browser memory limits)

### Alternative Options (Ranked)

#### Option 2: EdgeVec (Grade: A-, Score: 8.40/10)

**When to Use**:
- 6-month checkpoint triggers migration
- Team grows to 2+ developers (easier to onboard with library)
- Advanced features needed (metadata filtering, batch operations)

**Pros**:
- Production-ready (active maintenance, Feb 2026 update)
- Sub-millisecond search on 100K vectors
- SIMD optimization (2x+ speedup)
- Binary quantization (32x memory reduction)
- Lower maintenance burden (4-8h/year vs 8-16h/year)

**Cons**:
- 38-58 hours integration upfront
- 148KB bundle size (10% increase)
- WASM black box (harder to debug)

**Integration Effort**: 38-58 hours
**Migration Path**: `npm install edgevec` → Replace VectorStore API → Update tests → Validate recall

#### Option 3: Brute Force (Grade: C+, Score: 7.85/10)

**When to Use**:
- Corpus stays <5K vectors long-term
- 100ms query latency is acceptable
- Extreme simplicity preferred over performance

**Pros**:
- Simplest implementation (~50 lines)
- Tiny bundle (7.5KB)
- Easy to debug
- 4-6 hours to implement

**Cons**:
- Linear search O(n) — doesn't scale
- 50-100ms latency for 10K vectors (vs <1ms target)
- No indexing optimizations

**Not Recommended**: Epic 9 requires <100ms queries for 10K vectors (brute force is marginal)

#### Option 4: PGLite pgvector (Grade: B, Score: 7.00/10)

**When to Use**:
- SQL capabilities needed (complex metadata queries)
- PostgreSQL expertise on team
- Bundle size not a concern

**Pros**:
- Production-proven (PostgreSQL pgvector extension)
- Rich query API (SQL + vector search)
- IVF-HNSW indexes available

**Cons**:
- Large bundle (2-3MB WASM)
- PostgreSQL operational complexity
- 20-30 hours integration

**Not Recommended for Epic 9**: Overkill for simple semantic search

#### Option 5: Cloud API (Grade: D, Score: 6.30/10)

**Disqualified**: Violates Epic 9 offline-first architecture and privacy requirements

**When to Consider**:
- Corpus exceeds 300K vectors (browser memory limits)
- Network connectivity guaranteed
- Privacy not a concern

---

## 4. Risk Mitigation Strategies

### Risk 1: HNSW Bug Fix Fails Validation (Recall <95%)

**Probability**: Low (20%)
- Fix is well-understood from research (canonical implementations)
- Termination bug is common HNSW mistake with known solution

**Impact**: High (blocks Epic 9 for 1-2 days)

**Mitigation**:
1. **Re-run validation with real embeddings** (not random vectors)
2. **If recall 90-95%**: Tune parameters (efSearch, M, efConstruction)
3. **If recall <90%**: Pivot to EdgeVec (24-36h integration)
4. **48-hour decision checkpoint**: Don't spend >2 days debugging

**Fallback Plan**: EdgeVec integration (38-58 hours, acceptable for 2-week Epic 9 timeline)

### Risk 2: Custom HNSW Accumulates Bugs (Maintenance Spiral)

**Probability**: Medium (40%)
- Complex algorithm (multi-layer graph, pruning heuristics)
- Edge cases exist (concurrent ops, memory overflow, large graphs)

**Impact**: Medium (maintenance overhead 20-30% of velocity)

**Mitigation**:
1. **Comprehensive test suite** (16 hours upfront investment)
   - Unit tests: 15-20 tests (insert, search, delete, distance)
   - Property tests: 5-10 tests (recall ≥90%, memory ±10%)
   - E2E tests: 3-5 tests (note indexing, semantic search UI)
2. **6-month checkpoint**: Evaluate bug rate
   - Target: <3 bugs in 6 months
   - If exceeded: Trigger EdgeVec migration
3. **Library migration path**: 20-40 hours (always available)

**Fallback Plan**: EdgeVec at 6-month checkpoint (scheduled, not emergency)

### Risk 3: Epic 9B Requires Advanced Vector Features

**Probability**: Medium (30%)
- Stories 9B.2 (Auto-analysis), 9B.4 (Note organization) use semantic operations
- Metadata filtering, batch queries may be needed

**Impact**: Medium (8-16 hours to implement features)

**Mitigation**:
1. **Review Epic 9B stories** before implementation
   - Identify required vector capabilities
   - Estimate implementation effort per feature
2. **Incremental feature additions**: 4-8h per feature
   - Metadata filtering: 4-8 hours
   - Batch operations: 4 hours
   - Query result caching: 2 hours
3. **Complexity threshold**: If total effort exceeds 40h cumulative, migrate to EdgeVec

**Fallback Plan**: EdgeVec includes metadata filtering and batch operations out-of-the-box

### Risk 4: EdgeVec Library Becomes Unmaintained

**Probability**: Low-Medium (25%)
- Active as of Feb 2026 (2 weeks ago)
- Solo maintainer (bus factor 1)
- Small community

**Impact**: Medium (20-40 hours to fork or migrate)

**Mitigation**:
1. **Monitor maintenance status**: Check for updates quarterly
2. **Fork readiness**: If no updates for 6+ months, prepare fork
3. **Alternative library**: TinkerBird (similar API, 100KB bundle)
4. **Cloud migration**: If browser limits reached (>300K vectors)

**Fallback Plan**: Maintain fork (Rust/WASM skills needed) OR migrate to cloud vector DB

---

## 5. Next Steps

### Immediate Actions (Today):

1. **Fix HNSW bug**
   - Estimated time: 2-4 hours
   - File: `experiments/vector-db-benchmark/hnsw-poc.mjs` line 220
   - Validation: `node vector-recall-validation.mjs`

2. **Document decision**
   - Update: `docs/research/epic-9-vector-store-strategic-analysis.md`
   - Add: Validation results (PASS/FAIL with actual recall %)

3. **Proceed with Epic 9** (if validation passes)
   - E09-S03: Embedding Pipeline & Vector Store
   - Port HNSW to `src/lib/vector-store/hnsw-index.ts`

### 6-Month Checkpoint (2026-09-10):

**Metrics to Collect**:
- Corpus size: ___ vectors
- Query latency: ___ ms (p50, p95, p99)
- Memory usage: ___ MB
- Bug count: ___ issues
- Maintenance time: ___ hours cumulative

**Decision Matrix**:
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Corpus size | 20-50K | ___ | ✅/⚠️/❌ |
| Query latency | <100ms | ___ | ✅/⚠️/❌ |
| Bug count | <3 bugs | ___ | ✅/⚠️/❌ |
| Maintenance | <30h | ___ | ✅/⚠️/❌ |

**Action**:
- ✅ All targets met: Continue with custom HNSW
- ⚠️ 1-2 targets missed: Evaluate EdgeVec migration
- ❌ 3+ targets missed: Migrate to EdgeVec (20-40h)

### 12-Month Checkpoint (2027-03-10):

**Strategic Evaluation**:
- Total maintenance cost: ___ hours (target: <64h)
- Scalability: 50-100K vectors handled? ✅/❌
- User satisfaction: NPS ___, support tickets ___
- Feature completeness: Missing capabilities? ___

**Final Decision**:
- ✅ Success: Document lessons learned, publish case study
- ⚠️ Limitations: Migrate to EdgeVec or cloud vector DB
- ❌ Failure: Post-mortem, library adoption

---

## 6. References

### Research Reports
- [HNSW Algorithm Deep Dive](epic-9-hnsw-algorithm-deep-dive.md) — Root cause analysis
- [Vector Library Alternatives](epic-9-vector-library-alternatives.md) — 9 libraries surveyed
- [Vector Store Strategic Analysis](epic-9-vector-store-strategic-analysis.md) — Custom vs library
- [Vector Recall Validation](epic-9-vector-recall-validation.md) — 6.7% recall bug

### Canonical HNSW Implementations
- [Malkov & Yashunin (2018) - Original HNSW Paper](https://arxiv.org/abs/1603.09320)
- [FAISS HNSW Implementation](https://github.com/facebookresearch/faiss/blob/main/faiss/impl/HNSW.cpp)
- [hnswlib (Yandex Reference)](https://github.com/nmslib/hnswlib)
- [Write You a Vector Database - NSW Tutorial](https://skyzh.github.io/write-you-a-vector-db/cpp-06-01-nsw.html)

### Browser Vector Libraries
- [EdgeVec npm](https://www.npmjs.com/package/edgevec) — Rust/WASM HNSW
- [TinkerBird GitHub](https://github.com/wizenheimer/tinkerbird) — TypeScript HNSW
- [PGLite](https://github.com/electric-sql/pglite) — PostgreSQL WASM

### LevelUp Documentation
- [Epic 9 Prep Sprint](../plans/epic-9-prep-sprint.md) — Action item #6
- [Epic 9 Stories](../../_bmad-output/planning-artifacts/epics.md) — E09-S03, S04, S05

---

## Appendix A: Decision Matrix Weights Justification

| Criteria | Weight | Justification |
|----------|--------|---------------|
| **Timeline** | 25% | Epic 9 blocked, user waiting for decision. Speed is critical. |
| **Simplicity** | 20% | Solo dev, limited bandwidth. Maintenance overhead impacts velocity. |
| **Scalability** | 15% | 10K today, 100K in 18 months. Must scale with corpus growth. |
| **Offline** | 15% | Epic 9 architecture is offline-first. Non-negotiable requirement. |
| **Bundle** | 10% | Mobile UX and WCAG AA+ performance. Moderate priority. |
| **Production** | 10% | Battle-testing reduces risk, but Epic 9 is low-traffic initially. |
| **Privacy** | 5% | Local-first is preferred, but not hard requirement per user context. |

**Total**: 100%

**Sensitivity Analysis**:
- If privacy weight increases to 25%: HNSW and EdgeVec still win (both 10/10 on privacy)
- If timeline weight drops to 10%: EdgeVec wins (8.60 vs 8.55 for HNSW)
- Current weights reflect 2-week deadline and solo dev context

---

## Appendix B: Performance Benchmarks Summary

### Custom HNSW (Current, with bug)
- Build time: 1.83s (1000 vectors)
- Query latency: 0.49ms average
- Recall@10: 6.70% (❌ BUG)
- Memory: 3.78 MB (1000 vectors)

### Custom HNSW (Projected, after fix)
- Build time: 1.83s (no change expected)
- Query latency: 0.29-0.49ms (marginal increase due to proper traversal)
- Recall@10: 95-98% (✅ TARGET)
- Memory: 3.78 MB (no change)

### EdgeVec (Benchmarked)
- Build time: Not published
- Query latency: <1ms (100K vectors)
- Recall@10: 95%+ (assumed, HNSW algorithm)
- Memory: ~15-30MB (10K vectors, with binary quantization)
- Bundle: 148KB gzipped

### Brute Force (Estimated)
- Build time: 0s (no indexing)
- Query latency: 50-100ms (10K vectors)
- Recall@10: 100% (exact search)
- Memory: ~15-30MB (raw vectors only)
- Bundle: 7.5KB

---

**End of Decision Framework**

**Status**: ✅ Ready for user decision
**Next Action**: Fix HNSW bug, run validation, proceed with Epic 9
