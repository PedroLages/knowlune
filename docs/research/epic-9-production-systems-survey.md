# Production Browser-Based Semantic Search: Architecture Survey

**Research Date:** 2026-03-10
**Epic:** Epic 9 (AI Infrastructure & Learning Features)
**Research Goal:** Identify consensus approaches for browser-based semantic search by analyzing real-world production systems

---

## Executive Summary

After analyzing real-world production systems, a **clear consensus architecture** has emerged for browser-based semantic search in 2026:

**Consensus Stack:**
- **Embeddings**: Transformers.js (ONNX models) running locally via WebAssembly
- **Vector Search**: HNSW via Rust/WASM libraries (EdgeVec, Voy) OR brute-force for <10k vectors
- **Storage**: IndexedDB for persistence
- **Hybrid Approach**: Vector similarity + BM25/keyword search fusion
- **Scale Target**: 1k-10k documents (personal knowledge base scale)

**Key Insight**: Most indie/solo developer tools use **client-side** approaches to eliminate server costs and maximize privacy, with cloud APIs (Pinecone) reserved for enterprise/VC-backed products.

---

## System-by-System Analysis

### 1. Obsidian Semantic Search Plugins

**Multiple Competing Implementations** (fragmented ecosystem):

#### bbawj/obsidian-semantic-search
- **Embeddings**: OpenAI API (cloud-based, not local)
- **Algorithm**: Brute-force cosine similarity
- **Storage**: CSV files for sections, then API embeddings
- **Architecture**: TypeScript + Rust/WASM for text parsing
- **Scale**: Designed for typical vaults (hundreds-thousands of notes)
- **Evidence**: [GitHub - bbawj/obsidian-semantic-search](https://github.com/bbawj/obsidian-semantic-search)

#### Smart Connections (most popular, 50k+ users)
- **Embeddings**: BGE-micro (local model, ships with plugin) via Transformers.js
- **Algorithm**: Not disclosed in docs (likely brute-force)
- **Storage**: `.smart-env` folder in vault (custom format)
- **Architecture**: Local-first with optional cloud providers
- **Scale**: "Hundreds or thousands of notes"
- **Key Design**: Minimal dependencies, privacy-first, file modification tracking
- **Evidence**: [Smart Connections for Obsidian](https://smartconnections.app/smart-connections/)

#### Neural Composer Plugin
- **Embeddings**: Ollama/Gemini APIs
- **Algorithm**: Not specified
- **Storage**: PGLite (PostgreSQL in WASM) with pgvector extension
- **Unique Approach**: Full SQL database in browser
- **Evidence**: [DeepWiki - Neural Composer](https://deepwiki.com/oscampo/obsidian-neural-composer/5.2-vector-database-and-embeddings)

**Pattern**: Obsidian ecosystem favors **API-based embeddings** (cloud dependency) but **local storage**, likely due to plugin size constraints.

---

### 2. Notion AI

**Architecture**: **100% Server-Side** (enterprise cloud infrastructure)

- **Embeddings**: OpenAI zero-retention embeddings API (server-side)
- **Vector Database**: Turbopuffer (dedicated vector DB service)
- **Algorithm**: Not disclosed (likely HNSW given scale)
- **Scale**: Multi-million workspace deployment
- **Performance**: 50-70ms query latency at 15x growth scale
- **Cost Evolution**: Migrated from dedicated pods to serverless, achieving 90% cost reduction
- **Key Innovation**: Intelligent page state caching to avoid redundant embeddings

**Evidence**: [Notion: Two years of vector search](https://www.notion.com/blog/two-years-of-vector-search-at-notion)

**Why Server-Side?**
- Workspace-wide search across millions of users
- Integration with external tools (Slack, Google Drive)
- VC-backed company with infrastructure budget

**Takeaway**: Notion's approach is **NOT applicable to indie/solo developers** - it's enterprise architecture with dedicated infrastructure teams.

---

### 3. Readwise Reader

**Architecture**: **Hybrid** (server-side with client-side optimizations)

- **Embeddings**: Server-side (API not disclosed)
- **Search**: Keyword + semantic search (highlights + metadata)
- **Performance**: "Instant search" after optimization (~70-100ms initial load)
- **Scale**: Personal libraries (thousands of highlights per user)
- **Community Extension**: readwise-vector-db (self-hosted semantic layer)

**Evidence**: [Readwise Instant Search](https://readwise.io/changelog/instant-search)

**Pattern**: Readwise uses **server-side** for official app (SaaS business model) but community builds **client-side** semantic layers for power users.

---

### 4. Personal Knowledge Tools (Mem.ai, Reflect, etc.)

**Mem0 Architecture** (open-source memory layer):

- **Embeddings**: User-configurable (OpenAI, local models)
- **Vector DB**: Pinecone, Qdrant, Weaviate, Chroma, pgvector
- **Algorithm**: Semantic + graph-based hybrid retrieval
- **Architecture**: Five pillars (LLM fact extraction, vector storage, graph storage, hybrid retrieval, production infra)
- **Scale**: Production-grade with AWS ElastiCache + Neptune Analytics

**Evidence**: [GitHub - mem0ai/mem0](https://github.com/mem0ai/mem0)

**Pattern**: These tools target **enterprise/developer audiences** with flexible cloud infrastructure (not browser-based).

---

### 5. Browser Extensions (ChatGPT, Perplexity History)

#### Personal AI Memory Extension (marswangyang)

**🏆 Most Relevant to LevelUp's Use Case** - exemplary indie developer architecture:

- **Embeddings**: `paraphrase-multilingual-MiniLM-L12-v2` via Transformers.js (ONNX in browser)
- **Algorithm**: **Brute-force vector similarity** with time-decay weighting
- **Hybrid Search**: Vector (semantic) + BM25 (keyword) via MiniSearch
- **Fusion**: Reciprocal Rank Fusion (RRF, k=60)
- **Storage**: IndexedDB via Dexie.js
- **Architecture**: Chrome MV3 extension (Plasmo framework)
- **Stack**: React 18 + TypeScript + WASM
- **Scale**: Personal chat history (hundreds to low thousands of conversations)
- **Time-Decay**: `exp(-0.01 × daysOld)` with ~69 day half-life

**Evidence**: [GitHub - personal-ai-memory](https://github.com/marswangyang/personal-ai-memory)

**Why Brute-Force?**
- Simplicity for indie developer (no HNSW complexity)
- Scale is manageable (<10k vectors)
- Hybrid search compensates for any accuracy loss
- 100% privacy (no cloud dependency)

**Key Insight**: This is the **gold standard architecture for indie/solo developers** building browser-based semantic search.

---

## Vector Search Libraries: Technical Deep Dive

### Client-Side WASM Libraries (Rust-compiled)

| Library | Algorithm | Bundle Size | Performance | Status |
|---------|-----------|-------------|-------------|--------|
| **EdgeVec** | HNSW + FlatIndex | 217 KB gzip | 938 µs (10k vectors) | Production-ready |
| **Voy** | k-d tree | 75 KB gzip | <5 ms | Production-ready |
| **hnswlib-wasm** | HNSW | Not specified | Not disclosed | Experimental |

#### EdgeVec (Recommended for Scale)
- **Performance**: Sub-millisecond search (938 µs for 10k vectors)
- **Distance Calc**: 374 ns for 768D dot product
- **Binary Quantization**: 32x memory reduction (300MB → 10MB)
- **SIMD**: Accelerated on modern browsers (Chrome 91+, Firefox 89+, Safari 16.4+)
- **Evidence**: [GitHub - edgevec](https://github.com/matte1782/edgevec)
- **Claim**: "24x faster than Voy"

#### Voy (Recommended for Simplicity)
- **Algorithm**: k-d tree (not HNSW despite documentation claims)
- **Size**: 75 KB gzipped (smallest bundle)
- **Serialization**: Portable index format for CDN deployment
- **Evidence**: [GitHub - tantaraio/voy](https://github.com/tantaraio/voy)
- **Used By**: Browser-based RAG systems in production

#### Brute-Force (Recommended for <10k Vectors)
- **Library**: None needed - plain JavaScript cosine similarity
- **Performance**: 88 ms for moderate datasets (per benchmarks)
- **Advantage**: Zero dependencies, simple debugging
- **Evidence**: [Client-Side RAG with GitNexus](https://www.sitepoint.com/client-side-rag-building-knowledge-graphs-in-the-browser-with-gitnexus/)

---

### Embedding Models: Transformers.js Dominance

**Transformers.js v4** (February 2026 release):

- **Performance**: 4x faster embeddings (BERT), 3-10x speedup via WebGPU
- **Models**: 500+ Hugging Face models natively in browser
- **Bundle Size**: 10-53% smaller than v3 (esbuild migration)
- **Latency**: 20-60 tokens/sec for language models
- **WebGPU**: 64x speedup over WASM on supported devices
- **Evidence**: [Transformers.js v4 Released](https://www.adwaitx.com/transformers-js-v4-webgpu-browser-ai/)

**Recommended Models**:
- `paraphrase-multilingual-MiniLM-L12-v2` (used by Personal AI Memory)
- `gte-small` (~30MB, used by client-vector-search)
- `BGE-micro` (used by Smart Connections)

**Key Decision**: Local embeddings via Transformers.js are now **fast enough for production** (4x improvement in 2026).

---

## Architectural Patterns: Consensus Approaches

### Pattern 1: Client-Side Pure (Indie/Solo Developers)

**Use Case**: Personal knowledge tools, browser extensions, privacy-first apps

**Stack**:
```typescript
// Embeddings: Transformers.js (ONNX/WebGPU)
import { pipeline } from '@xenova/transformers'
const embedder = await pipeline('feature-extraction', 'Xenova/gte-small')

// Vector Search: Brute-force (<5k) OR EdgeVec/Voy (>5k)
import { EdgeVec } from 'edgevec'
const index = new EdgeVec({ dimension: 384 })

// Storage: IndexedDB
import Dexie from 'dexie'
const db = new Dexie('VectorDB')

// Hybrid Search: Vector + BM25 (MiniSearch)
import MiniSearch from 'minisearch'
const keywordSearch = new MiniSearch({ fields: ['content', 'title'] })
```

**Examples**: Personal AI Memory, Smart Connections, browser RAG systems

**Advantages**:
- Zero server costs
- 100% privacy (no data leaves device)
- Works offline
- Simple deployment (static hosting)

**Limitations**:
- Scale caps at ~10k-50k vectors (browser memory ~1GB practical limit)
- Initial model download (30-100MB)
- CPU-bound (slower than server-side on older devices)

---

### Pattern 2: Server-Side Pure (SaaS/Enterprise)

**Use Case**: Multi-user platforms, workspace tools, enterprise search

**Stack**:
```typescript
// Embeddings: OpenAI API (cloud)
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text
})

// Vector Search: Pinecone/Qdrant/Weaviate (dedicated DB)
await pinecone.upsert({ vectors: [{ id, values, metadata }] })
const results = await pinecone.query({ vector: queryEmbedding, topK: 10 })

// Storage: Cloud vector database
// Algorithm: HNSW (provider-managed)
```

**Examples**: Notion AI, Readwise Reader, Mem.ai (enterprise tier)

**Advantages**:
- Unlimited scale (billions of vectors)
- Faster queries (dedicated hardware)
- Cross-device sync
- Richer features (workspace search, integrations)

**Limitations**:
- Ongoing server costs
- Privacy concerns (data in cloud)
- API dependencies (vendor lock-in)
- Requires backend infrastructure

---

### Pattern 3: Hybrid (Best of Both Worlds)

**Use Case**: Progressive web apps, freemium products

**Stack**:
```typescript
// Embeddings: Local (Transformers.js) with optional cloud fallback
const embedder = isOnline
  ? await fetchCloudEmbedding(text)
  : await localEmbedder(text)

// Vector Search: Client-side by default, server-side for heavy queries
const results = vectors.length < 5000
  ? bruteForceSearch(query, vectors)
  : await fetchServerSearch(query)

// Storage: IndexedDB with cloud backup/sync
await syncToCloud(localVectors)
```

**Examples**: Obsidian plugins (local + API options), PWA knowledge tools

**Advantages**:
- Privacy by default, power when needed
- Offline-first with sync
- Cost-effective (most users stay local)

**Limitations**:
- Complexity (two codepaths)
- Sync conflicts
- Harder to debug

---

## Consensus Recommendations by Use Case

### For LevelUp (Study Session Vector Recall)

**Recommended Architecture**: **Client-Side Pure (Pattern 1)**

**Rationale**:
- Target scale: 500-2000 study sessions (well within brute-force range)
- Privacy-first (student data stays local)
- No server costs (indie project)
- Offline-capable (study anywhere)
- Existing IndexedDB infrastructure

**Specific Stack**:
```typescript
// Embeddings
import { pipeline } from '@xenova/transformers'
const embedder = await pipeline('feature-extraction', 'Xenova/gte-small')

// Vector Search
// Option A: Brute-force (<2k sessions)
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  return dotProduct / (magA * magB)
}

// Option B: EdgeVec/Voy (future-proofing >5k sessions)
import { Voy } from 'voy-search'
const index = new Voy({ embeddings: 384 })

// Hybrid Search
import MiniSearch from 'minisearch'
const keywordSearch = new MiniSearch({ fields: ['notes', 'summary'] })

// Storage
import Dexie from 'dexie'
db.studySessions.bulkPut(sessions)
```

**Performance Expectations**:
- Embedding generation: ~100-200ms per session (one-time)
- Vector search: <50ms for 2000 sessions (brute-force)
- Hybrid fusion: <10ms
- Total query latency: <300ms (acceptable for "recall validation" use case)

---

### For Indie Developers (General)

**Scale-Based Recommendations**:

| Vector Count | Approach | Library | Expected Latency |
|--------------|----------|---------|------------------|
| <1,000 | Brute-force | None (vanilla JS) | <50ms |
| 1k-5k | Brute-force or Voy | Voy (75KB) | <100ms |
| 5k-50k | HNSW | EdgeVec (217KB) | <5ms |
| >50k | Server-side | Pinecone/Qdrant | Variable |

**Decision Tree**:
```
Do you need offline support?
  YES → Client-side (Transformers.js + Voy/EdgeVec)
  NO → Can you afford $20-50/month?
    YES → Server-side (Supabase pgvector or Pinecone)
    NO → Client-side (Transformers.js + brute-force)
```

---

## Surprising Architectural Choices

### 1. Brute-Force at Scale (Personal AI Memory)

**Surprise**: A production Chrome extension with thousands of users uses **brute-force cosine similarity** instead of HNSW.

**Reasoning**:
- Scale is bounded (personal chat history)
- Hybrid search compensates for any recall loss
- Simplicity = fewer bugs for solo developer
- Time-decay weighting makes recent items fast

**Lesson**: Don't prematurely optimize. Brute-force is **production-ready** for <10k vectors in 2026 browsers.

---

### 2. Obsidian Plugins Use Cloud APIs for Embeddings

**Surprise**: Privacy-focused note-taking app plugins use **OpenAI API** for embeddings instead of local models.

**Reasoning**:
- Plugin size limits (can't ship 100MB model)
- Obsidian users already trust cloud sync
- Embedding quality > privacy for search use case

**Exception**: Smart Connections ships local BGE-micro model (shows it's possible but rare).

**Lesson**: Community values **search quality** over absolute privacy for semantic search.

---

### 3. Notion Achieved 90% Cost Reduction AFTER Scale

**Surprise**: Notion's vector search got **cheaper at scale** by switching from dedicated pods to serverless.

**Insight**: Modern vector databases (Turbopuffer) offer serverless tiers that are cost-effective even at enterprise scale.

**Lesson**: Server-side isn't inherently expensive if architected well (but still requires expertise).

---

## Technology Stack Summary

### Embeddings (Local)
1. **Transformers.js v4** (recommended) - 4x faster, WebGPU support
2. **Models**: gte-small (30MB), BGE-micro (smallest), MiniLM-L12 (multilingual)

### Vector Search Algorithms
1. **Brute-force** - <10k vectors, zero dependencies
2. **EdgeVec** (HNSW) - 5k-50k vectors, 217KB bundle, sub-millisecond
3. **Voy** (k-d tree) - 1k-10k vectors, 75KB bundle, <5ms

### Storage
- **IndexedDB** (universal) - 50GB+ per origin, persistent
- **Wrappers**: Dexie.js (recommended), idb-keyval (minimal)

### Hybrid Search
- **MiniSearch** - BM25 implementation, 6.4KB gzipped
- **Fusion**: Reciprocal Rank Fusion (RRF) - simple, effective

### Cloud Alternatives (Server-Side)
1. **Supabase + pgvector** - SQL + vector search, free tier
2. **Pinecone** - Dedicated vector DB, $70/month+
3. **Qdrant Cloud** - Open-source option, $25/month+

---

## Final Consensus: The Indie Developer Stack

**For 95% of indie/solo developer use cases:**

```
✅ Embeddings: Transformers.js (local, privacy-first)
✅ Algorithm: Brute-force (<5k) → EdgeVec (>5k)
✅ Storage: IndexedDB (Dexie.js)
✅ Hybrid: Vector + BM25 (MiniSearch) + RRF
✅ Scale: 1k-10k vectors (personal knowledge base)
✅ Cost: $0/month (no servers)
✅ Privacy: 100% (no cloud)
```

**Avoid unless you have specific needs**:
- Cloud vector DBs (Pinecone) - only if >50k vectors or multi-user
- Custom HNSW implementations - use EdgeVec/Voy instead
- Server-side embeddings - slower and costlier than local in 2026

**The Winner**: **Personal AI Memory's architecture** is the **blueprint for indie developers** - proven in production, simple to implement, privacy-first, zero cost.

---

## Sources

**Obsidian Semantic Search:**
- [Semantic Search Plugin - Obsidian Forum](https://forum.obsidian.md/t/semantic-search-plugin/58407)
- [GitHub - bbawj/obsidian-semantic-search](https://github.com/bbawj/obsidian-semantic-search)
- [Smart Connections for Obsidian](https://smartconnections.app/smart-connections/)
- [GitHub - brianpetro/obsidian-smart-connections](https://github.com/brianpetro/obsidian-smart-connections)
- [DeepWiki - Neural Composer Vector Database](https://deepwiki.com/oscampo/obsidian-neural-composer/5.2-vector-database-and-embeddings)

**Notion AI:**
- [Two years of vector search at Notion](https://www.notion.com/blog/two-years-of-vector-search-at-notion)
- [Make Notion search great again: Vector Database](https://dev.to/brainhubeu/make-notion-search-great-again-vector-database-2gnm)
- [Notion Vector Search: 10x Scale at 1/10th the Cost](https://www.gend.co/blog/notion-vector-search-10x-90-cost)

**Readwise Reader:**
- [Instantly search your highlights](https://readwise.io/changelog/instant-search)
- [GitHub - readwise-vector-db](https://github.com/leonardsellem/readwise-vector-db)

**Mem0 & Personal Knowledge Tools:**
- [GitHub - mem0ai/mem0](https://github.com/mem0ai/mem0)
- [Demystifying the brilliant architecture of mem0](https://medium.com/@parthshr370/from-chat-history-to-ai-memory-a-better-way-to-build-intelligent-agents-f30116b0c124)

**Browser Extensions:**
- [GitHub - personal-ai-memory](https://github.com/marswangyang/personal-ai-memory)
- [UnifyChats - Navigate Your AI Conversations](https://unifychats.app/)

**Vector Search Libraries:**
- [Client-Side RAG: Building Knowledge Graphs in the Browser](https://www.sitepoint.com/client-side-rag-building-knowledge-graphs-in-the-browser-with-gitnexus/)
- [Building Production-Ready Vector Search with Rust and WebAssembly](https://dev.to/matteo_panzeri_2c5930e196/building-production-ready-vector-search-for-the-browser-with-rust-and-webassembly-2mhi)
- [GitHub - tantaraio/voy](https://github.com/tantaraio/voy)
- [GitHub - matte1782/edgevec](https://github.com/matte1782/edgevec)
- [GitHub - yusufhilmi/client-vector-search](https://github.com/yusufhilmi/client-vector-search)

**Transformers.js:**
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js/en/index)
- [Transformers.js v4 Released](https://www.adwaitx.com/transformers-js-v4-webgpu-browser-ai/)
- [Transformers.js v4 is faster than AWS inference](https://ucstrategies.com/news/transformers-js-v4-is-faster-than-aws-inference-and-it-runs-in-your-browser/)

**Browser Vector Storage:**
- [Local JavaScript Vector Database | RxDB](https://rxdb.info/articles/javascript-vector-database.html)
- [IndexedDB as a Vector Database](https://paul.kinlan.me/idb-as-a-vector-database/)
- [Proposing Browser-Based RAG for IndexedDB Vector Storage](https://medium.com/@tomkob99_89317/proposing-browser-based-rag-for-session-level-knowledge-a-case-for-indexeddb-vector-storage-45f2c2135365)
- [Browser-based vector search: fast, private, no backend required](https://nearform.com/digital-community/browser-based-vector-search-fast-private-and-no-backend-required/)

**Indie Developer Tools:**
- [Independent Development Tech Stack 2025](https://guangzhengli.com/blog/en/indie-hacker-tech-stack-2024)
- [Best Developer Tools for 2026 Tech Stack](https://www.buildmvpfast.com/blog/best-developer-tools-2026-tech-stack)
