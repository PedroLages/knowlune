# Browser-Based Vector Search Architecture Comparison (2026)

**Research Date:** March 10, 2026
**Use Case:** 10K-100K embeddings @ 384 dimensions
**Target:** LevelUp learning platform (offline-capable study session recall)

---

## Executive Summary

This research evaluates 5 architectures for implementing semantic search in a browser-based learning platform. The analysis focuses on offline capability, scalability, setup friction, cost, privacy, bundle size, and production readiness.

**Key Finding:** For LevelUp's use case (10K-100K vectors, privacy-first, offline-capable), **Architecture 1 (Pure Client-Side WASM)** using EdgeVec + Transformers.js + IndexedDB is the recommended approach.

---

## Architecture Comparison Matrix

| Architecture | Offline | Scale Ceiling | Setup Friction | Cost | Privacy | Bundle Size | Production Examples |
|-------------|---------|---------------|----------------|------|---------|-------------|---------------------|
| **1. Pure Client-Side** | ✅ Full | 100K (384d)<br>1M w/ quantization | 🟢 0-click | 🟢 Free | 🟢 100% local | 148 KB (EdgeVec)<br>+30 MB (embeddings) | LangChain.js, RxDB |
| **2. Hybrid Client-Server** | ⚠️ Degraded | Unlimited | 🟡 Account signup | 🔴 $45-81/mo @ 10M | 🔴 Vectors on server | Minimal (API) | Netflix, Spotify, Pinterest |
| **3. Local Server (Docker)** | ✅ Full | 1M+ | 🔴 Docker install | 🟢 Free | 🟢 100% local | Minimal (API) | Enterprise self-hosted |
| **4. Edge/Durable Objects** | ❌ None | 10M vectors | 🟡 CF account | 🟡 $0.33/GB + ops | 🟡 Edge storage | Minimal (API) | Cursor, Notion, Linear |
| **5. Browser SQLite + pgvector** | ✅ Full | ~50K practical | 🟢 0-click | 🟢 Free | 🟢 100% local | 3 MB (PGlite)<br>+21 KB (pgvector) | Electric SQL demos |

---

## Detailed Architecture Analysis

### 1. Pure Client-Side (EdgeVec/hnswlib-wasm + Transformers.js)

**How It Works:**
- WASM vector index (HNSW algorithm) runs in browser
- Embeddings generated locally via Transformers.js
- Vector storage in IndexedDB with persistence
- Three-tier memory management: WASM cache → JS memory → IndexedDB

**Technical Specs:**
- **EdgeVec:** 148 KB gzipped, sub-millisecond search @ 100K vectors (768d), 24x faster than voy
- **hnswlib-wasm:** C++ HNSW compiled to WASM, battle-tested but larger bundle
- **Transformers.js:** 30 MB for Xenova/all-MiniLM-L6-v2 (384d embeddings)
- **Memory:** ~1 GB browser limit; binary quantization achieves 32x reduction (1M vectors in 125 MB)

**Scalability Ceiling:**
- **10K vectors:** ✅ Excellent performance (<1ms search)
- **100K vectors:** ✅ Viable with SQ8 quantization (832 MB → fits in 1GB limit)
- **1M vectors:** ⚠️ Requires binary quantization (125 MB) + aggressive caching

**Setup Friction:** 🟢 **Zero-click**
```bash
npm install edgevec transformers-js
# No accounts, no servers, works immediately
```

**Cost:** 🟢 **$0/month**

**Privacy:** 🟢 **Perfect** - all vectors stay in browser's IndexedDB

**Bundle Size Impact:**
- EdgeVec: 148 KB gzipped
- Transformers.js: 30 MB (loaded on-demand via CDN)
- Total first-load: ~30.15 MB (embeddings model cached after first use)

**Production Examples:**
- [LangChain.js Voy integration](https://js.langchain.com/docs/integrations/vectorstores/voy/) - WASM vector search
- [RxDB JavaScript Vector Database](https://rxdb.info/articles/javascript-vector-database.html) - Offline-first architecture
- [client-vector-search](https://github.com/yusufhilmi/client-vector-search) - 100K vectors in <100ms

**Pros:**
- ✅ Works completely offline
- ✅ Zero ongoing costs
- ✅ Perfect privacy (data never leaves device)
- ✅ Sub-millisecond search latency
- ✅ No account signup or configuration

**Cons:**
- ❌ Initial 30 MB model download (one-time)
- ❌ Browser memory ceiling (~1GB practical limit)
- ❌ Quantization required beyond 100K vectors
- ❌ No multi-device sync without custom solution

**Best For:** Privacy-first apps, offline-capable tools, prototyping, <100K vectors

---

### 2. Hybrid Client-Server (Pinecone/Chroma/Qdrant)

**How It Works:**
- Embeddings generated client-side OR server-side
- Vectors stored in managed cloud vector database
- Client queries API with search vectors
- Typical cutoff: Client for <5K, server for >5K (per [hybrid search guides](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview))

**Technical Specs:**
- **Pinecone:** 2GB free tier (~300K @ 1536d), serverless pricing $0.33/GB
- **Qdrant:** Cloud $45/mo @ 10M vectors, linear CPU/memory-based pricing
- **Chroma:** $81 @ 1M vectors, not production-ready >50M vectors

**Scalability Ceiling:** ♾️ **Unlimited** (Pinecone supports billions)

**Setup Friction:** 🟡 **Account signup + API keys**
```bash
# 1. Sign up for Pinecone/Qdrant
# 2. Create project and get API key
# 3. Initialize client
npm install @pinecone-database/pinecone
```

**Cost (10M vectors @ 1536d):**
- Pinecone: ~$70/mo (storage + per-query fees)
- Qdrant: ~$45/mo (fixed cluster pricing)
- Chroma: ~$81/mo (not recommended at scale)

**Privacy:** 🔴 **Vectors sent to third-party servers**
- Some providers offer self-hosted options (Qdrant, Chroma)

**Bundle Size Impact:** 🟢 **Minimal** (5-10 KB for API client)

**Production Examples:**
- **Netflix:** Viewing habit recommendations via vector search
- **Spotify:** Music recommendations using audio embeddings
- **Pinterest:** Image similarity search (visual embeddings)
- **Google Search:** BERT vector models for query understanding

**Pros:**
- ✅ Unlimited scalability (billions of vectors)
- ✅ Enterprise features (RBAC, analytics, monitoring)
- ✅ Managed infrastructure (no DevOps)
- ✅ Multi-user concurrent access

**Cons:**
- ❌ Requires internet connection (no offline mode)
- ❌ Monthly costs ($45-81 @ 10M vectors)
- ❌ Privacy concerns (data on third-party servers)
- ❌ Vendor lock-in
- ❌ Per-query costs can spike with metadata filtering (5-10x)

**Best For:** Multi-user SaaS, >1M vectors, production apps with budget, teams okay with cloud dependencies

---

### 3. Local Server (ChromaDB/Qdrant via Docker)

**How It Works:**
- Vector database runs as Docker container on localhost
- App connects to localhost:6333 (Qdrant) or localhost:8000 (Chroma)
- Mirrors production architecture in development
- Data persisted to local disk volumes

**Technical Specs:**
- **Qdrant:** Rust-based, 6333 port, production-optimized
- **Chroma:** Python-based, developer-friendly, simpler API

**Scalability Ceiling:** 🟢 **1M+ vectors** (limited by local disk/RAM)

**Setup Friction:** 🔴 **Docker install required**
```bash
# User must install Docker Desktop first
docker run -p 6333:6333 -v $(pwd)/data:/qdrant/storage qdrant/qdrant
```

**Cost:** 🟢 **$0/month** (runs on user's hardware)

**Privacy:** 🟢 **100% local** (never leaves localhost)

**Bundle Size Impact:** 🟢 **Minimal** (HTTP client only)

**Production Examples:**
- Enterprise self-hosted deployments (NVIDIA, IBM, Salesforce use Qdrant)
- Developer workstations mirroring production

**Pros:**
- ✅ Production-parity in development
- ✅ Scales to millions of vectors
- ✅ Perfect privacy (data stays local)
- ✅ No ongoing costs
- ✅ Full feature set (filtering, analytics, RBAC)

**Cons:**
- ❌ Requires Docker (barrier for non-technical users)
- ❌ Not truly "offline" (needs localhost server running)
- ❌ 200-500 MB Docker image download
- ❌ Multi-step setup process
- ❌ Won't work in Chromebook/locked-down environments

**Best For:** Developer tools, enterprise self-hosted, production-mirroring, teams with Docker expertise

---

### 4. Edge/Durable Objects (Cloudflare Vectorize)

**How It Works:**
- Vectors stored in Cloudflare's distributed edge network
- Queries routed to nearest edge location
- Write-ahead log uses SQLite in Durable Objects
- R2 storage for vector payloads

**Technical Specs:**
- **Capacity:** 10M vectors per index (doubled from 5M in Jan 2026)
- **Metadata:** Up to 10 KiB per vector
- **API:** RESTful similarity search with k-nearest neighbors
- **Latency:** Global edge distribution (sub-100ms worldwide)

**Scalability Ceiling:** 🟡 **10M vectors/index** (can shard across multiple indexes)

**Setup Friction:** 🟡 **Cloudflare account + Wrangler CLI**
```bash
# 1. Sign up for Cloudflare Workers
# 2. Install Wrangler CLI
npm install -g wrangler
wrangler vectorize create my-index
```

**Cost (10M vectors):**
- Storage: $0.33/GB (~$13/mo @ 10M × 1536d × 4 bytes = ~40 GB)
- Read units: $8.25 per 1M queries (~$8.25/mo @ 1M queries)
- Write units: $2 per 1M writes (~$2/mo @ 1M inserts)
- **Total:** ~$23/mo @ 10M vectors + 1M queries/mo

**Privacy:** 🟡 **Vectors on Cloudflare edge** (not third-party, but not local)

**Bundle Size Impact:** 🟢 **Minimal** (Workers API client)

**Production Examples:**
- **Cursor:** Code editor with semantic search
- **Notion:** Workspace search with Vectorize
- **Linear:** Issue search via Turbopuffer (edge vector DB)

**Pros:**
- ✅ Global edge distribution (low latency worldwide)
- ✅ Scales to 10M vectors easily
- ✅ Serverless (no infrastructure management)
- ✅ Predictable costs (no per-query surprises)
- ✅ Integrated with Workers ecosystem

**Cons:**
- ❌ No offline mode (requires internet)
- ❌ Vendor lock-in (Cloudflare-specific)
- ❌ 10M vector ceiling (requires sharding beyond)
- ❌ Still in evolution (doubled capacity in Jan 2026, API may change)

**Best For:** Global apps, serverless architectures, Cloudflare ecosystem users, 1M-10M vectors

---

### 5. Browser SQLite + pgvector (PGLite WASM)

**How It Works:**
- Full Postgres compiled to WASM (PGLite)
- pgvector extension for vector similarity search
- IndexedDB persistence for browser storage
- SQL-based vector queries with L2/cosine distance

**Technical Specs:**
- **PGLite:** 3 MB gzipped (complete Postgres)
- **pgvector extension:** 21.3 KB
- **Total bundle:** ~3.02 MB gzipped
- **Storage:** IndexedDB (50GB+ per origin in modern browsers)

**Scalability Ceiling:** ⚠️ **~50K vectors practical**
- IndexedDB performance degrades with sequential ops
- Bulk operations fast, but vector search requires sequential distance calculations
- No HNSW index in pgvector WASM build (brute-force only)

**Setup Friction:** 🟢 **Zero-click**
```bash
npm install @electric-sql/pglite
# Works immediately, no config needed
```

**Cost:** 🟢 **$0/month**

**Privacy:** 🟢 **100% local** (IndexedDB in browser)

**Bundle Size Impact:** 🟡 **3 MB gzipped** (larger than EdgeVec but includes full SQL engine)

**Production Examples:**
- [Electric SQL demos](https://electric-sql.com/products/pglite) - Offline-first apps
- Showcased on [Hacker News](https://news.ycombinator.com/item?id=41224689) - WASM Postgres with pgvector
- Early adoption phase (released 2024, gaining traction 2025-2026)

**Pros:**
- ✅ Full SQL capabilities (not just vectors)
- ✅ Works offline with IndexedDB persistence
- ✅ Familiar Postgres API
- ✅ Zero configuration
- ✅ Electric SQL live sync available

**Cons:**
- ❌ Performance degrades >50K vectors (no HNSW index)
- ❌ 3 MB bundle (10x larger than EdgeVec)
- ❌ Brute-force search only (no approximate nearest neighbor)
- ❌ Still early-stage (stability concerns for production)

**Best For:** Apps needing SQL + vectors, <50K vectors, Postgres familiarity, offline-first with relational data

---

## WASM Vector Library Shootout

### EdgeVec vs hnswlib-wasm vs Voy vs Vectra

| Library | Bundle Size | Performance | Algorithm | Browser Support | Production Maturity |
|---------|-------------|-------------|-----------|-----------------|---------------------|
| **EdgeVec** | 148 KB gzip | 24x faster than voy<br>Sub-ms @ 100K (768d) | HNSW + Binary Quantization | ✅ Chrome, Firefox, Safari | 🟡 v0.4.0 (2025, active dev) |
| **hnswlib-wasm** | ~500 KB | Slower than EdgeVec but proven | HNSW (C++ port) | ✅ Chrome, Firefox, Safari | 🟢 Battle-tested (C++ lib since 2016) |
| **voy** | 75 KB gzip | Baseline (EdgeVec 24x faster) | k-d tree | ✅ Chrome, Firefox, Safari | 🟡 v0.6.3 (2 years old, stale) |
| **Vectra** | N/A (Node.js) | <1ms (in-memory) | Brute-force | ❌ Node.js only | 🟢 Stable (file-backed local DB) |

**Recommendation:**
- **EdgeVec** for production (best performance, active development, binary quantization)
- **hnswlib-wasm** if EdgeVec stability concerns (older, proven C++ library)
- **voy** for minimal bundle size (75 KB but significantly slower)
- **Vectra** for Node.js server-side only

**Battle-Tested Evidence:**
- EdgeVec: [Competitive benchmark suite](https://github.com/matte1782/edgevec) against hnswlib-wasm, voy, usearch-wasm, vectra
- hnswlib: [Original C++ library](https://github.com/nmslib/hnswlib) used in production since 2016 (Facebook AI, etc.)
- voy: LangChain.js integration ([official docs](https://js.langchain.com/docs/integrations/vectorstores/voy/))

---

## Hybrid Architecture Cutoff Analysis

### When to Switch from Client to Server?

Based on [hybrid search architecture research](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview):

| Vector Count | Recommended Architecture | Reasoning |
|--------------|--------------------------|-----------|
| <5K | 🟢 Pure client-side | Sub-millisecond search, minimal memory (<20 MB) |
| 5K-50K | 🟡 Client-side with quantization | SQ8 quantization keeps memory <200 MB |
| 50K-100K | 🟡 Client-side (EdgeVec + binary quant) OR hybrid | Binary quantization = 125 MB @ 1M vectors (scales down) |
| 100K-1M | 🔴 Hybrid or server-only | Client memory limits hit (~1 GB practical ceiling) |
| >1M | 🔴 Server-only | Pinecone/Qdrant required |

**Typical Hybrid Pattern:**
1. Embed documents server-side during ingest
2. Store vectors in Pinecone/Qdrant
3. Client sends search query → server embeds → queries vector DB → returns results
4. **Fallback:** Cache frequently searched vectors client-side for offline mode

**LevelUp Specific:** 10K-100K study sessions @ 384d
- **Fits comfortably in client-side** with SQ8 quantization
- 100K × 384d × 1 byte (SQ8) = ~37 MB (well under 1 GB limit)
- No need for hybrid until 500K+ sessions

---

## Technology Deep Dive

### Transformers.js Embedding Models (Local Generation)

| Model | Dimensions | Bundle Size | Speed | Quality |
|-------|------------|-------------|-------|---------|
| Xenova/all-MiniLM-L6-v2 | 384 | 30 MB | Fast | Good (recommended) |
| Xenova/bge-small-en-v1.5 | 384 | 32 MB | Fast | Better |
| nomic-ai/nomic-embed-text-v1.5 | 768 | 45 MB | Medium | Best |

**Usage:**
```typescript
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const output = await embedder('Study session on React hooks', { pooling: 'mean', normalize: true });
const embedding = Array.from(output.data); // [0.123, -0.456, ...] (384d)
```

**Production Deployment:**
- Models auto-download from HuggingFace CDN
- Cached in browser after first use
- Runs on CPU via WASM (no GPU needed)
- ~1-2s for first embedding, ~50-100ms after warmup

---

## IndexedDB Performance Characteristics

### 100K Vector Storage Benchmarks

From [IndexedDB vector storage research](https://medium.com/@tomkob99_89317/proposing-browser-based-rag-for-session-level-knowledge-a-case-for-indexeddb-vector-storage-45f2c2135365):

| Operation | 10K Vectors | 100K Vectors | Notes |
|-----------|-------------|--------------|-------|
| **Bulk insert** | ~200ms | ~2s | Fast (batched transactions) |
| **Sequential get** | ~700ms | ~7s | SLOW (use HNSW instead) |
| **Indexed range query** | ~100ms | ~500ms | Fast (proper index design) |
| **HNSW search (EdgeVec)** | <1ms | <5ms | Fastest (approximate) |

**Key Insights:**
- ❌ Avoid sequential `get()` for vector search (scales poorly)
- ✅ Use WASM HNSW index in memory, IndexedDB for persistence only
- ✅ Leverage IndexedDB for storing raw vectors + metadata
- ✅ Load index into HNSW on page load for fast queries

**Architecture Pattern:**
```
User Query → EdgeVec HNSW (in-memory) → Top K IDs → IndexedDB fetch (metadata) → Results
               ↑                                           ↑
               Loaded from IndexedDB on startup        Cheap key lookups
```

---

## Quantization for Scale

### Memory Reduction Techniques

| Quantization | Memory @ 1M vectors (768d) | Quality Loss | EdgeVec Support |
|--------------|----------------------------|--------------|-----------------|
| **None (FP32)** | 3.03 GB | None | ✅ Default |
| **SQ8 (8-bit)** | 832 MB | ~2% recall drop | ✅ Supported |
| **Binary** | 125 MB (32x reduction) | ~5-10% recall drop | ✅ Supported |

**EdgeVec Binary Quantization:**
- Converts 32-bit floats to 1-bit per dimension
- 384d vector: 1536 bytes → 48 bytes (32x smaller)
- Enables 1M vectors in browser memory
- Trade-off: Slight accuracy loss acceptable for most use cases

**LevelUp Use Case (100K @ 384d):**
- FP32: 100K × 384 × 4 bytes = **147 MB** (fits easily)
- SQ8: 100K × 384 × 1 byte = **37 MB** (use this for safety margin)
- Binary: 100K × 48 bytes = **4.8 MB** (overkill unless scaling to 1M)

**Recommendation:** Use SQ8 quantization for 100K vectors to stay well under browser memory limits.

---

## Production Readiness Checklist

### Architecture Selection Decision Tree

```
START: How many vectors?
  ↓
  <5K → Pure Client-Side (EdgeVec) ✅
  ↓
  5K-100K → Is offline mode required?
    ↓ YES → Pure Client-Side (EdgeVec + SQ8) ✅
    ↓ NO → Budget for cloud?
      ↓ YES → Hybrid (Pinecone/Qdrant) ✅
      ↓ NO → Pure Client-Side ✅
  ↓
  100K-1M → Is privacy critical?
    ↓ YES → Pure Client-Side (binary quantization) ⚠️
    ↓ NO → Hybrid or Edge (Cloudflare) ✅
  ↓
  >1M → Server-Only (Pinecone/Qdrant) ✅
```

### Privacy vs Scale Trade-offs

| Requirement | Best Architecture | Rationale |
|-------------|-------------------|-----------|
| **100% private + offline** | Pure Client-Side | Data never leaves device |
| **100% private + <1M vectors** | Local Server (Docker) | localhost-only, full features |
| **Privacy OK + unlimited scale** | Hybrid (self-hosted Qdrant) | Control hosting location |
| **Privacy secondary + <10M** | Edge (Cloudflare) | Fast, global, serverless |
| **Multi-user + >10M** | Cloud (Pinecone) | Enterprise features, unlimited scale |

---

## LevelUp Recommendation

### Architecture: **Pure Client-Side (EdgeVec + Transformers.js + IndexedDB)**

**Rationale:**
1. **Scale:** 10K-100K vectors @ 384d fits comfortably with SQ8 (37 MB)
2. **Privacy:** Study sessions never leave user's device
3. **Offline:** Works without internet (critical for study continuity)
4. **Cost:** $0/month (vs $45-81/mo for cloud)
5. **Setup:** Zero-click (no Docker, no accounts)
6. **Performance:** Sub-5ms search @ 100K vectors

**Implementation Plan:**

```typescript
// 1. Install dependencies
npm install edgevec @xenova/transformers

// 2. Initialize embedding model (one-time 30 MB download)
import { pipeline } from '@xenova/transformers';
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// 3. Initialize EdgeVec index
import { Index } from 'edgevec';
const index = new Index({ dimensions: 384, quantization: 'sq8' });

// 4. Add study session vectors
const sessions = await loadSessionsFromIndexedDB();
for (const session of sessions) {
  const embedding = await embedder(session.notes, { pooling: 'mean', normalize: true });
  await index.add(session.id, Array.from(embedding.data));
}

// 5. Search for similar sessions
const queryEmbedding = await embedder('React hooks useEffect', { pooling: 'mean', normalize: true });
const results = await index.search(Array.from(queryEmbedding.data), 10); // top 10
// results: [{ id: 'session-123', distance: 0.12 }, ...]

// 6. Persist index to IndexedDB
await index.save('levelup-session-index');
```

**Migration Path (if scaling beyond 100K):**
1. **100K-500K:** Switch to binary quantization (4.8 MB → 24 MB)
2. **500K-1M:** Hybrid approach (client for recent sessions, server for archive)
3. **>1M:** Full server migration to Qdrant/Pinecone

---

## Cost Projection (5-Year Horizon)

| Users | Vectors/User | Total Vectors | Architecture | Monthly Cost | Annual Cost |
|-------|--------------|---------------|--------------|--------------|-------------|
| 1K | 100 | 100K | Client-Side | $0 | $0 |
| 10K | 100 | 1M | Client-Side (binary) | $0 | $0 |
| 50K | 100 | 5M | Hybrid (Qdrant) | $45 | $540 |
| 100K | 100 | 10M | Cloud (Qdrant) | $70 | $840 |
| 500K | 100 | 50M | Cloud (Pinecone) | $350 | $4,200 |

**Key Insight:** Client-side architecture saves $540-4,200/year at scale while maintaining perfect privacy.

---

## Sources

### Pure Client-Side Architecture
- [EdgeVec GitHub](https://github.com/matte1782/edgevec) - High-performance WASM vector search
- [Building Production-Ready Vector Search with Rust/WASM](https://dev.to/matteo_panzeri_2c5930e196/building-production-ready-vector-search-for-the-browser-with-rust-and-webassembly-2mhi)
- [client-vector-search](https://github.com/yusufhilmi/client-vector-search) - 100K vectors <100ms
- [RxDB JavaScript Vector Database](https://rxdb.info/articles/javascript-vector-database.html)

### Browser SQLite + pgvector
- [PGlite Official Docs](https://pglite.dev/)
- [Electric SQL PGlite](https://electric-sql.com/products/pglite)
- [Show HN: PGlite WASM Postgres](https://news.ycombinator.com/item?id=41224689)

### WASM Library Comparison
- [hnswlib-wasm npm](https://www.npmjs.com/package/hnswlib-wasm)
- [voy-search npm](https://www.npmjs.com/package/voy-search)
- [Vectra GitHub](https://github.com/Stevenic/vectra)
- [LangChain.js Voy Integration](https://js.langchain.com/docs/integrations/vectorstores/voy/)

### Hybrid Architecture
- [Azure Hybrid Search Overview](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview)
- [Elastic Hybrid Search Guide](https://www.elastic.co/what-is/hybrid-search)
- [Optimizing RAG with Hybrid Search](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)

### Cloud Vector Databases
- [Pinecone vs Qdrant Comparison](https://particula.tech/blog/pinecone-vs-qdrant-comparison)
- [Vector Database Pricing Comparison](https://liquidmetal.ai/casesAndBlogs/vector-comparison/)
- [Qdrant vs Pinecone Blog](https://qdrant.tech/blog/comparing-qdrant-vs-pinecone-vector-databases/)

### Edge/Durable Objects
- [Cloudflare Vectorize Docs](https://developers.cloudflare.com/vectorize/)
- [Building Vectorize Blog](https://blog.cloudflare.com/building-vectorize-a-distributed-vector-database-on-cloudflare-developer-platform/)
- [Vectorize 10M Vector Update](https://developers.cloudflare.com/changelog/post/2026-01-23-increased-index-capacity/)

### Local Server (Docker)
- [Qdrant Docker Hub](https://hub.docker.com/r/qdrant/qdrant)
- [ChromaDB in Docker Guide](https://oneuptime.com/blog/post/2026-02-08-how-to-run-chromadb-in-docker-for-embeddings/view)
- [Chroma vs Qdrant Local Development](https://zenvanriel.nl/ai-engineer-blog/chroma-vs-qdrant-local-development/)

### Transformers.js
- [Transformers.js Official Docs](https://huggingface.co/docs/transformers.js/en/index)
- [Product-Ready Embeddings on the Edge](https://mike.dev/blog/transformersjs-embeddings-lab/)
- [Vector Storage with Transformers.js](https://github.com/yowmamasita/vector-storage-transformers-js)

### IndexedDB Performance
- [IndexedDB as Vector Database](https://paul.kinlan.me/idb-as-a-vector-database/)
- [Browser-Based RAG with IndexedDB](https://medium.com/@tomkob99_89317/proposing-browser-based-rag-for-session-level-knowledge-a-case-for-indexeddb-vector-storage-45f2c2135365)
- [Maximum IndexedDB Performance](https://developer.chrome.com/blog/maximum-idb-performance-with-storage-buckets)
- [Offline-First AI Web Apps](https://markaicode.com/offline-first-ai-web-app-indexeddb/)

### Memory Limits & Quantization
- [WebANNS: Fast Vector Search in Browsers](https://arxiv.org/html/2507.00521)
- [EdgeVec Memory Optimization](https://docs.rs/edgevec/latest/edgevec/)

### Production Examples
- [What is Vector Search? Complete Guide](https://www.meilisearch.com/blog/what-is-vector-search)
- [Top 6 Vector Databases 2026](https://appwrite.io/blog/post/top-6-vector-databases-2025)
- [Best Vector Databases 2026](https://www.firecrawl.dev/blog/best-vector-databases)

---

## Appendix: Anti-Patterns to Avoid

### ❌ Don't: Use brute-force IndexedDB sequential queries
```typescript
// SLOW: 7s @ 100K vectors
for (const vector of vectors) {
  const distance = cosineSimilarity(query, vector);
  // ...
}
```

### ✅ Do: Use WASM HNSW index
```typescript
// FAST: <5ms @ 100K vectors
const results = await edgevecIndex.search(queryVector, 10);
```

### ❌ Don't: Store unquantized vectors beyond 50K
```typescript
// 100K × 384d × 4 bytes = 147 MB (risky near 1GB limit)
const vector = new Float32Array(384);
```

### ✅ Do: Apply SQ8 quantization
```typescript
// 100K × 384d × 1 byte = 37 MB (safe margin)
const index = new Index({ dimensions: 384, quantization: 'sq8' });
```

### ❌ Don't: Pay for cloud when client-side works
```typescript
// Unnecessary $45/mo for 100K vectors
await pinecone.query({ vector, topK: 10 });
```

### ✅ Do: Keep it local and free
```typescript
// $0/mo, offline-capable, private
const results = await edgevecIndex.search(vector, 10);
```

---

**Next Steps for LevelUp:**
1. ✅ Prototype EdgeVec + Transformers.js integration
2. ✅ Benchmark 10K/50K/100K study session search
3. ✅ Implement IndexedDB persistence layer
4. ✅ Add SQ8 quantization at 50K+ sessions
5. ⏭️ Monitor memory usage in production
6. ⏭️ Re-evaluate if scaling beyond 100K sessions
