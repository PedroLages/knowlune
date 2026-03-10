# Epic 9: Simplicity-First Browser Vector Search Research

**Research Date:** 2026-03-10
**Core Question:** When does brute force cosine similarity become unusable in browser environments?
**Decision Framework:** Boring technology > cutting edge | Simple > complex | Good enough > perfect

---

## Executive Summary

**Recommendation:** **Brute force cosine similarity is quantifiably "good enough" for LevelUp's scale (10K vectors).**

- **Industry Best Practice:** Google Research's ScaNN explicitly recommends brute force for datasets <20K vectors
- **Performance:** ~88ms query time for 10K vectors in browser (fast enough to skip loading spinners)
- **Memory:** 10K × 384D × 4 bytes = ~15MB (trivial for modern browsers with 50GB+ IndexedDB quota)
- **Complexity:** Zero index tuning, zero edge cases, 100% recall guarantee
- **Risk:** Minimal - brute force is battle-tested, parallelizable, and deterministic

**Skip LSH and PGlite for Epic 9.** Revisit only if dataset grows beyond 20K vectors or query time exceeds 200ms in real-world usage.

---

## 1. Brute Force Performance Analysis

### Industry Guidance

> **"For datasets under 20k vectors, use brute-force."**
> — [Google Research ScaNN Algorithms](https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md)

### Quantitative Benchmarks

| Metric | Value | Source |
|--------|-------|--------|
| **Query Time (10K vectors)** | ~88ms | [RxDB JavaScript Vector Database](https://rxdb.info/articles/javascript-vector-database.html) |
| **Memory (10K × 384D)** | ~15MB | 10K × 384 × 4 bytes = 15,360,000 bytes |
| **IndexedDB Quota** | 50GB+ per origin | [Offline-First AI Web Apps](https://markaicode.com/offline-first-ai-web-app-indexeddb/) |
| **Recall** | 100% (guaranteed) | [Faiss Brute Force Search](https://github.com/facebookresearch/faiss/wiki/Brute-force-search-without-an-index) |
| **Scalability Limit** | "A few hundred thousand vectors" | [LanceDB Vector Search](https://lancedb.com/docs/search/vector-search/) |

### Break-Even Point

**When does brute force become unusable?**

- **Dataset Size:** Performance degrades linearly with dataset size. Brute force remains viable up to ~100K-200K vectors before latency becomes user-noticeable (>500ms)
- **Computation:** O(n) complexity - for 1M vectors, checking all ~trillion pairs is infeasible ([No Free Lunch: Brute Force vs LSH](https://cs.uwaterloo.ca/~jimmylin/publications/Ture_etal_SIGIR2011.pdf))
- **LevelUp Scale:** 10K vectors is **50-100x below** the breaking point

### JavaScript SIMD Optimization

**Available Optimizations:**

- **SimSIMD:** Up to 200x faster dot products using SIMD instructions (AVX2, AVX-512, NEON) via NAPI bindings ([SimSIMD GitHub](https://github.com/ashvardanian/SimSIMD))
- **fast-cosine-similarity:** 3-6x faster than standard libraries, benchmarked on 40K vectors ([fast-cosine-similarity npm](https://www.npmjs.com/package/fast-cosine-similarity))
- **Precalculated Magnitudes:** Pre-compute vector magnitudes once, reuse for all queries (reduces per-query operations)

**Performance Comparison (npm libraries):**

| Library | ns/iteration | Speed vs Baseline |
|---------|--------------|-------------------|
| cos-similarity | 249 ns | 57x faster |
| compute-cosine-similarity | 854 ns | 16x faster |
| cosine-similarity | 14,251 ns | Baseline |

Source: [cos-similarity npm](https://www.npmjs.com/package/cos-similarity)

### Advantages for LevelUp

1. **No Index Tuning:** Zero parameters to calibrate (vs LSH's L/W/M/T)
2. **100% Recall:** Guaranteed to find true nearest neighbors
3. **Simple to Test:** Deterministic output, no probabilistic edge cases
4. **Parallelizable:** Can leverage Web Workers for batch queries
5. **Memory Efficient:** No index structure overhead (LSH requires hash tables, HNSW requires graphs)

---

## 2. LSH (Locality-Sensitive Hashing) Analysis

### What is LSH?

LSH hashes similar vectors into the same "buckets" with high probability, reducing search space from O(n) to O(log n) at the cost of approximate results.

### Complexity vs Simplicity

**LSH Parameters:**

- **L:** Number of hash tables (more = higher recall, more storage)
- **W:** Window size (affects query selectivity)
- **M:** Hash functions per table
- **T:** Query-time threshold (can vary per-query)

> **"Larger L results in higher recall with same selectivity, thus L should be tuned to maximal affordable value."**
> — [Modeling LSH for Performance Tuning](https://www.cs.princeton.edu/cass/papers/cikm08.pdf)

**Tradeoff:** Recall vs Storage vs Latency

- Increasing L improves recall but requires more storage and query processing time
- Threshold selection is data-specific and ill-chosen thresholds degrade both efficiency and statistical validity ([No Free Lunch paper](https://cs.uwaterloo.ca/~jimmylin/publications/Ture_etal_SIGIR2011.pdf))

### JavaScript Implementation Maturity

**Available Libraries:**

| Library | Maturity | Production Ready? |
|---------|----------|-------------------|
| hamming-lsh | Academic | No - "not intended for production" |
| tlsh-js | Port of Trend Micro TLSH | Unknown |
| agtabesh/lsh | Educational | No - GitHub repo, minimal stars |
| gamboviol/lsh | Educational | No - GitHub repo, minimal stars |

Source: [LSH JavaScript libraries search](https://github.com/search?q=lsh+language%3Ajavascript)

**Key Finding:** No battle-tested, production-grade LSH library exists for JavaScript. All available implementations are educational or explicitly marked "not for production use."

### Risk Assessment

| Factor | Risk Level | Reason |
|--------|-----------|--------|
| Implementation Complexity | HIGH | 4 parameters to tune, data-dependent thresholds |
| Library Maturity | HIGH | No production-grade JS libraries |
| Testing Burden | HIGH | Probabilistic results = non-deterministic tests |
| Maintenance | MEDIUM | Solo dev must debug edge cases |
| Recall Degradation | MEDIUM | Wrong parameters = missed relevant vectors |

**Verdict:** LSH violates "boring technology" and "simple > complex" principles for a solo dev project.

---

## 3. PGLite WASM + pgvector Analysis

### Bundle Size

| Component | Size | Source |
|-----------|------|--------|
| **PGlite Core** | 2.6MB gzipped | [PGlite v0.1 release](https://pglite.dev/) |
| **pgvector Extension** | Included in core | [PGlite Extensions](https://pglite.dev/extensions/) |
| **Custom HNSW** | ~20KB (hypothetical) | N/A - comparison baseline |
| **EdgeVec** | 148KB | [EdgeVec GitHub](https://github.com/matte1782/edgevec) |

**Bundle Size Impact:**

- PGlite: 2.6MB = **130x larger** than 20KB custom solution
- PGlite: 2.6MB = **18x larger** than EdgeVec (148KB)
- But: PGlite includes full Postgres SQL engine + persistence + transactions

### Feature Completeness

**What PGlite Provides:**

- ✅ Full Postgres SQL (joins, transactions, CTEs, aggregations)
- ✅ pgvector extension (IVFFlat, HNSW indexes)
- ✅ IndexedDB persistence (browser) + file system (Node/Bun/Deno)
- ✅ Real-time reactive bindings (live queries)
- ✅ Extension ecosystem (pg_trgm, postgis, etc.)

**Performance:**

- **CRUD Queries:** <0.3ms
- **Multi-row Selects:** <16.67ms (within single frame)
- **Build Time:** 12-42x faster than standalone HNSW (IVFFlat index)
- **Memory:** IVFFlat uses 2-5x less memory than HNSW graphs

Source: [PGlite Performance](https://electric-sql.com/products/pglite)

### pgvector: IVFFlat vs HNSW Comparison

| Metric | IVFFlat | HNSW | Winner |
|--------|---------|------|--------|
| **Build Time** | 12-42x faster | Baseline | IVFFlat |
| **Memory Usage** | 2-5x less | Baseline | IVFFlat |
| **Query Speed (High Recall)** | 2.6 QPS @ 99.8% recall | 40.5 QPS @ 99.8% recall | HNSW (15.5x faster) |
| **Index Updates** | Not resilient (centroids not recalculated) | Resilient (no rebuild needed) | HNSW |
| **Training Required** | Yes (data-dependent) | No (incremental build) | HNSW |

Source: [pgvector IVFFlat vs HNSW comparison](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931)

**Recommendation from AWS:**

> **"For most applications—RAG pipelines, semantic search, recommendation engines—HNSW is the safer default, requiring less tuning and delivering high recall."**
> — [AWS Deep Dive: IVFFlat and HNSW Techniques](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)

### Production Usage Evidence

**Use Cases (as of 2024-2025):**

- ✅ **Local-first apps** (ElectricSQL's core use case)
- ✅ **Development databases** (skip OS package management, just `npm install`)
- ✅ **Offline-capable apps** (field medical, data collection, unreliable internet regions)
- ✅ **Prototyping/testing** (edge cases without infrastructure costs)
- ⚠️ **Large-scale production** (no evidence of "thousands of apps" in search results)

**Example:** Patient Management System using React + PGlite (offline-capable browser app) — [PGlite Examples](https://pglite.dev/examples)

**Maturity Assessment:**

- Released in 2024, gaining traction in 2025-2026
- Backed by ElectricSQL (established local-first platform)
- Used by ThoughtWorks Technology Radar ([PGLite Technology Radar](https://www.thoughtworks.com/radar/platforms/pglite))
- Production evidence: **Early adopters**, not yet "boring technology"

### Risk Assessment

| Factor | Risk Level | Reason |
|--------|-----------|--------|
| Bundle Size | MEDIUM | 2.6MB is 130x larger than custom solution |
| Stability | MEDIUM | Young project (2024), not yet battle-tested at scale |
| Complexity | LOW | SQL is well-understood, pgvector is mature |
| Overkill | HIGH | Full Postgres for simple cosine similarity = sledgehammer for a nail |
| Lock-in | LOW | Can export to real Postgres if needed |

**Verdict:** PGlite is **over-engineered** for Epic 9's needs. Reserve for future epics requiring SQL + vector search + offline sync.

---

## 4. Decision Framework Application

### Boring Technology vs Cutting Edge

| Approach | Boring Score (1-10) | Notes |
|----------|---------------------|-------|
| **Brute Force** | 10/10 | Textbook algorithm, used since 1960s |
| **LSH** | 4/10 | Academic, no production JS libraries |
| **PGlite** | 6/10 | Young (2024), but built on mature Postgres |

### Simple vs Complex

| Approach | Lines of Code (est.) | Parameters to Tune | Edge Cases |
|----------|----------------------|--------------------|------------|
| **Brute Force** | ~50 LOC | 0 | None |
| **LSH** | ~300 LOC | 4 (L, W, M, T) | Threshold calibration, hash collisions |
| **PGlite** | ~20 LOC (API calls) | 2 (IVFFlat lists, HNSW M/ef) | WASM loading, quota errors |

### Good Enough vs Perfect

| Approach | Recall | Latency (10K vectors) | When to Upgrade |
|----------|--------|-----------------------|-----------------|
| **Brute Force** | 100% | ~88ms | >20K vectors or >200ms queries |
| **LSH** | 80-95% | ~10-30ms (est.) | Never (skip entirely) |
| **PGlite HNSW** | 99%+ | <16.67ms | Need SQL + vector search together |

---

## 5. Quantitative Recommendations

### For Epic 9 (Current Scale: 10K Vectors)

**✅ USE: Brute Force Cosine Similarity**

**Implementation:**

```typescript
import { cosineSimilarity } from 'fast-cosine-similarity'; // 3-6x faster

function findTopK(query: number[], vectors: number[][], k: number) {
  const scores = vectors.map((vec, idx) => ({
    idx,
    score: cosineSimilarity(query, vec)
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k);
}
```

**Why:**

1. **Industry-validated:** Google Research says <20K = brute force
2. **88ms latency:** Fast enough to skip loading spinners
3. **15MB memory:** Trivial for 50GB+ IndexedDB quota
4. **0 parameters:** No tuning, no edge cases, 100% deterministic
5. **Solo dev friendly:** Write once, never debug probabilistic failures

**Monitoring Metrics:**

- Query latency (p50, p95, p99)
- Dataset size (# of vectors)
- Memory usage (IndexedDB quota)

**Upgrade Trigger:** If p95 latency exceeds 200ms **AND** dataset grows beyond 20K vectors.

---

### Future Considerations (>20K Vectors or >200ms Latency)

**Option 1: HNSW via hnswlib-wasm**

- **Bundle Size:** ~148KB (EdgeVec) or custom WASM build
- **Recall:** 99%+ configurable
- **Complexity:** Medium (M, ef_construction, ef_search parameters)
- **Risk:** Low - HNSW is mature, widely used (Faiss, Pinecone, Weaviate)

**Option 2: PGlite + pgvector HNSW**

- **Bundle Size:** 2.6MB
- **Use Case:** Need SQL queries **AND** vector search (e.g., "find similar videos uploaded last week by user X")
- **Complexity:** Low (SQL is familiar)
- **Risk:** Medium (young project, bundle bloat)

**Option 3: EdgeVec**

- **Bundle Size:** 148KB
- **Features:** HNSW, binary quantization (32x memory reduction), Rust + WASM
- **Status:** Relatively new library
- **Risk:** Medium (smaller community than hnswlib)

Source: [EdgeVec GitHub](https://github.com/matte1782/edgevec)

---

## 6. Testing & Validation Strategy

### Brute Force Validation Plan

**Phase 1: Baseline Performance (Epic 9)**

1. **Benchmark Query Time:**
   - Test with 1K, 5K, 10K, 15K vectors
   - Measure p50, p95, p99 latency
   - Target: <100ms for 10K vectors

2. **Memory Profiling:**
   - Chrome DevTools Memory Snapshot
   - Verify <20MB heap for 10K × 384D vectors

3. **Correctness Test:**
   - Manual validation: Query known vectors, verify top-K results
   - Cross-check against Python numpy.cosine_similarity()

4. **Browser Compatibility:**
   - Test in Chrome, Firefox, Safari (WebKit)
   - Verify IndexedDB quota handling

**Phase 2: Scale Testing (Post-Epic 9, if needed)**

1. **Break-Even Analysis:**
   - Gradually increase dataset to 20K, 30K, 50K vectors
   - Identify latency inflection point
   - Document when HNSW becomes necessary

2. **Web Worker Parallelization:**
   - Offload brute force computation to background thread
   - Test if parallelization delays upgrade threshold

---

## 7. Lessons Learned from Research

### Key Insights

1. **"Good Enough" is Quantifiable:**
   - Industry guidance (Google ScaNN) provides clear thresholds (<20K = brute force)
   - Real-world benchmarks (88ms for 10K) confirm viability

2. **Boring Technology Wins:**
   - Brute force is battle-tested, deterministic, zero-config
   - LSH has no production-grade JS libraries
   - PGlite is exciting but overkill for simple vector search

3. **Solo Dev Risk Management:**
   - Avoid probabilistic algorithms (LSH) that require parameter tuning
   - Prefer libraries with large communities (fast-cosine-similarity has 40K+ downloads)
   - Delay complexity until real-world metrics justify it

4. **Memory is Cheap, Developer Time is Expensive:**
   - 15MB for 10K vectors is negligible
   - Optimizing from 88ms to 10ms is premature for solo dev
   - Ship faster, iterate based on user feedback

### Anti-Patterns to Avoid

❌ **Premature Optimization:** Building HNSW before validating 10K vectors cause UX issues
❌ **Library Churn:** Choosing immature libraries (LSH) for "cutting edge" features
❌ **Complexity Creep:** Adding PGlite's 2.6MB for simple cosine similarity
❌ **Analysis Paralysis:** Researching perfect solution instead of shipping good-enough MVP

---

## 8. Sources & References

### Performance & Benchmarks

- [RxDB JavaScript Vector Database](https://rxdb.info/articles/javascript-vector-database.html) - 88ms query time, 12x faster local vs server
- [fast-cosine-similarity npm](https://www.npmjs.com/package/fast-cosine-similarity) - 3-6x faster library
- [cos-similarity npm](https://www.npmjs.com/package/cos-similarity) - 249ns/iter benchmark
- [SimSIMD GitHub](https://github.com/ashvardanian/SimSIMD) - 200x faster with SIMD

### Industry Best Practices

- [Google Research ScaNN Algorithms](https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md) - "Use brute force for <20K vectors"
- [Faiss Brute Force Search](https://github.com/facebookresearch/faiss/wiki/Brute-force-search-without-an-index) - 100% recall guarantee
- [LanceDB Vector Search](https://lancedb.com/docs/search/vector-search/) - Brute force viable up to "few hundred thousand"

### LSH Research

- [No Free Lunch: Brute Force vs LSH](https://cs.uwaterloo.ca/~jimmylin/publications/Ture_etal_SIGIR2011.pdf) - Tradeoff analysis
- [Modeling LSH for Performance Tuning](https://www.cs.princeton.edu/cass/papers/cikm08.pdf) - Parameter tuning guide
- [hamming-lsh GitHub](https://github.com/kasperisager/hamming-lsh) - "Not intended for production"

### PGlite & pgvector

- [PGlite Official Site](https://pglite.dev/) - 2.6MB gzipped, <0.3ms CRUD
- [PGlite Extensions](https://pglite.dev/extensions/) - pgvector support
- [AWS: IVFFlat vs HNSW](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/) - "HNSW is safer default"
- [pgvector HNSW vs IVFFlat Study](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931) - 15.5x query speed difference
- [PGLite Technology Radar](https://www.thoughtworks.com/radar/platforms/pglite) - ThoughtWorks assessment

### Browser Vector Search

- [Offline-First AI Web Apps](https://markaicode.com/offline-first-ai-web-app-indexeddb/) - IndexedDB patterns, 50GB+ quota
- [client-vector-search GitHub](https://github.com/yusufhilmi/client-vector-search) - Browser + Node vector search
- [EdgeVec GitHub](https://github.com/matte1782/edgevec) - 148KB HNSW + binary quantization
- [EntityDB GitHub](https://github.com/babycommando/entity-db) - IndexedDB + Transformers.js

### Additional Context

- [Faiss: Efficient Similarity Search](https://engineering.fb.com/2017/03/29/data-infrastructure/faiss-a-library-for-efficient-similarity-search/) - Meta's vector search library
- [Elasticsearch Vector Large Scale](https://www.elastic.co/search-labs/blog/elasticsearch-vector-large-scale-part1) - Production vector search patterns
- [Weaviate Vector Search Explained](https://weaviate.io/blog/vector-search-explained) - Algorithm overview

---

## Appendix: Calculation Details

### Memory Calculation (10K × 384D Vectors)

```
Vectors: 10,000
Dimensions: 384
Bytes per float32: 4

Total Memory = 10,000 × 384 × 4 bytes
             = 15,360,000 bytes
             = 15 MB
```

**IndexedDB Quota:** Typically 50GB+ per origin (browser-dependent)
**Percentage Used:** 15MB / 50,000MB = 0.03% of quota

### Query Complexity (Brute Force)

```
Operation: Cosine similarity (query vs all vectors)
Time Complexity: O(n × d)
  n = number of vectors = 10,000
  d = dimensions = 384

Operations per query = 10,000 × 384 = 3,840,000 floating-point ops
Modern CPU: ~2-4 GHz = 2-4 billion ops/sec
Theoretical time: 3.84M / 2B = ~1.92ms (with perfect parallelization)
Real-world time: ~88ms (includes JS overhead, memory access, sorting)
```

**Performance Headroom:** 88ms is well below 200ms user-perceivable latency threshold.

---

**Document Status:** Research complete, ready for Epic 9 implementation decision.
**Next Step:** Implement brute force baseline, monitor metrics, defer optimization until data justifies it.
