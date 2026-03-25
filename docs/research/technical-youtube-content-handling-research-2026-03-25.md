---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - docs/research/market-youtube-content-handling-research-2026-03-25.md
  - docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'YouTube content handling — API quotas, yt-dlp integration, transcript extraction, storage'
research_goals: 'Technical feasibility analysis to inform Epic 23 (YouTube Course Builder) architecture decisions'
user_name: 'Pedro'
date: '2026-03-25'
web_research_enabled: true
source_verification: true
---

# YouTube Content Handling: Technical Feasibility Research

**Date:** 2026-03-25
**Author:** Pedro
**Research Type:** Technical Feasibility
**Purpose:** Inform Epic 23 (YouTube Course Builder) architecture — API selection, transcript pipeline, storage strategy

---

## Executive Summary

This research evaluates four technical pillars for Knowlune's YouTube Course Builder feature: YouTube Data API v3 quotas, yt-dlp integration patterns, transcript extraction approaches, and storage implications. The findings support a **hybrid architecture** that combines official APIs for metadata with unofficial libraries for transcripts, and a tiered Whisper fallback for videos without captions.

**Key Findings:**

- **YouTube Data API v3** gives 10,000 quota units/day free. Metadata is cheap (1 unit/call for `videos.list`), but **caption download is blocked for third-party videos** (requires OAuth + content ownership). Search is expensive (100 units/call).
- **yt-dlp** is the dominant content extraction tool. The `youtube-dl-exec` npm package is the best-maintained Node.js wrapper. Metadata + subtitle extraction is reliable and takes 2-5 seconds per video.
- **Transcript extraction** has a clear winner: the `youtube-transcript` npm package for fast, pure-JS caption fetching. It covers ~90% of educational videos. For the remaining ~10%, self-hosted **faster-whisper** on Pedro's Unraid server provides high-quality transcription at zero API cost.
- **Ollama cannot run Whisper** — it only supports text LLMs. Self-hosted transcription requires a separate faster-whisper Docker container.
- **Storage** is modest: ~50-100KB per video transcript, ~5KB metadata. A 1,000-video library fits comfortably in IndexedDB (~100MB).

**Critical Decision: Caption Access**

The official YouTube API **cannot** download captions for videos you don't own. This is the single most important technical constraint. Every learning platform that shows transcripts (Readwise, Glasp, Open WebUI) uses unofficial scraping — there is no compliant alternative for third-party caption access.

**Recommended Architecture:**

```
User pastes YouTube URL/playlist
  → YouTube Data API v3: fetch metadata (title, duration, chapters, thumbnail)
  → youtube-transcript (npm): fetch captions (fast, free, ~90% coverage)
  → If no captions: queue for faster-whisper on Unraid (audio download via yt-dlp)
  → Store in IndexedDB (Dexie) with 30-day refresh timestamps
  → Ollama: AI-powered course structuring from metadata + transcripts
```

---

## Table of Contents

1. [YouTube Data API v3 — Quotas and Limits](#1-youtube-data-api-v3--quotas-and-limits)
2. [yt-dlp Integration Patterns](#2-yt-dlp-integration-patterns)
3. [Transcript Extraction Approaches](#3-transcript-extraction-approaches)
4. [Storage Implications](#4-storage-implications)
5. [Recommended Architecture](#5-recommended-architecture)
6. [Risk Assessment](#6-risk-assessment)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Sources](#8-sources)

---

## 1. YouTube Data API v3 — Quotas and Limits

### 1.1 Quota System

**Default daily quota: 10,000 units per project per day.** Resets at midnight Pacific Time.

| Operation | Cost (units) | Knowlune Use Case |
|-----------|-------------|-------------------|
| `search.list` | **100** | Searching for educational videos (expensive — avoid) |
| `videos.list` | **1** | Fetch title, duration, chapters, thumbnail (up to 50 IDs/call) |
| `channels.list` | **1** | Fetch channel/author info |
| `playlistItems.list` | **1** | Fetch all videos in a playlist |
| `captions.list` | **50** | List available caption tracks |
| `captions.download` | **200** | Download caption text (**blocked for third-party videos**) |

**Budget for Knowlune's use case (daily):**

| Activity | Units/call | Calls/day | Total |
|----------|-----------|-----------|-------|
| Playlist imports | 1 | 50 | 50 |
| Video metadata | 1 | 200 | 200 |
| Channel info | 1 | 50 | 50 |
| **Total** | | | **300 units** |

With transcripts handled via unofficial libraries (see Section 3), Knowlune uses only ~3% of the daily quota for metadata. This leaves massive headroom.

### 1.2 The Caption Download Problem

**Critical constraint:** `captions.download` requires OAuth 2.0 and the authenticated user must be the **video owner** or have the owner's authorization. This means:

- You **cannot** download captions of third-party educational videos via the official API
- `captions.list` (50 units) tells you what caption tracks exist, but downloading them (200 units) is blocked
- This restriction has been in place since 2024 and is enforced

**Impact:** The official API is useful for metadata but **useless for transcripts** of content you don't own. This is why every tool in the competitive analysis (Readwise, Glasp, Open WebUI, Obsidian plugins) uses unofficial transcript scraping.

### 1.3 Rate Limits (Beyond Quotas)

- No officially published per-second rate limit (Google keeps this undocumented)
- In practice: throttling occurs at ~5-10 requests/second
- Error codes: `403 rateLimitExceeded` (per-project) or `userRateLimitExceeded` (per-user)
- **Recommendation:** Client-side rate limiter at 3-5 req/s with exponential backoff

### 1.4 Quota Increase Process

- Request via: https://support.google.com/youtube/contact/yt_api_form
- Response time: 1-4 weeks, manual review
- Typical approvals: 50,000-1,000,000 units/day
- Educational/non-commercial projects fare better
- **Not needed initially** — Knowlune's metadata-only usage (~300 units/day) is well within the free tier
- Apply at ~500 DAU (as noted in the office hours doc)

### 1.5 API-Free Alternatives

| Method | What It Provides | Auth Required | Rate Limits |
|--------|-----------------|---------------|-------------|
| **oEmbed** (`youtube.com/oembed?url=...`) | Title, author, thumbnail, embed HTML | None | Standard HTTP |
| **RSS feeds** (`youtube.com/feeds/videos.xml?channel_id=...`) | Last ~15 videos with basic metadata | None | None |
| **Invidious API** (self-hosted) | Full metadata, search, **captions** | None | Self-managed |
| **Piped API** (self-hosted) | Full metadata, search, **captions** | None | Self-managed |

**oEmbed** is a useful fallback for basic metadata when API quota runs low. **Invidious/Piped** provide caption access without API keys but have reliability concerns (YouTube actively blocks instances). Self-hosting on Unraid is possible but requires ongoing maintenance.

### 1.6 Terms of Service Key Points

| Rule | Implication for Knowlune |
|------|-------------------------|
| **No content downloading** | Embed YouTube player — don't host video files |
| **30-day cache refresh** | Metadata must be refreshed every 30 days (add `last_refreshed_at` to schema) |
| **Attribution required** | Display YouTube branding when showing metadata |
| **Embedding allowed** | YouTube IFrame Player API for playback is compliant |

---

## 2. yt-dlp Integration Patterns

### 2.1 What yt-dlp Is

yt-dlp is a Python CLI tool (fork of youtube-dl) for extracting media and metadata from YouTube and 1,000+ other sites. It has no native Node.js bindings — all JS integrations spawn it as a child process.

**For Knowlune, yt-dlp serves two purposes:**
1. **Metadata extraction** (fallback/supplement to YouTube API)
2. **Audio extraction** (only needed for Whisper transcription of videos without captions)

### 2.2 Node.js Wrappers

| Package | Status | Weekly Downloads | Recommendation |
|---------|--------|-----------------|----------------|
| **youtube-dl-exec** | Active, well-maintained | High (~800+ stars) | **Use this** |
| **yt-dlp-wrap** | Maintained | Moderate | Alternative (TypeScript-first) |
| ytdl-core | **Dead** | Declining | Do not use |
| @distube/ytdl-core | Semi-active | Moderate | Fragile, avoid |

**`youtube-dl-exec`** by microlinkhq is the clear winner. It auto-downloads the yt-dlp binary, supports all yt-dlp flags, and is the most widely adopted.

```typescript
import youtubedl from 'youtube-dl-exec';

// Metadata extraction (no download, 1-3 seconds)
const metadata = await youtubedl('https://youtube.com/watch?v=VIDEO_ID', {
  dumpSingleJson: true,
  noDownload: true,
});
// Returns: title, description, duration, thumbnails, chapters,
// subtitles, automatic_captions, formats, uploader, upload_date
```

### 2.3 Capabilities Relevant to Knowlune

| Capability | Command/Flag | Time | Use Case |
|-----------|-------------|------|----------|
| Metadata (JSON) | `--dump-single-json --no-download` | 1-3s | Supplement YouTube API metadata |
| Subtitle download | `--write-auto-subs --sub-langs en --skip-download` | 2-5s | Fallback transcript extraction |
| Audio extraction | `-x --audio-format m4a` | 10-120s | Feed to Whisper for transcription |
| Chapter data | Included in JSON metadata | 0s | Extract chapter timestamps |
| Available subs | `--list-subs` | 1-2s | Check what languages are available |

**Chapter extraction** is particularly valuable — educational videos often have chapters that Knowlune can use as course sections:

```json
{
  "chapters": [
    {"start_time": 0, "end_time": 120, "title": "Introduction"},
    {"start_time": 120, "end_time": 360, "title": "Core Concepts"}
  ]
}
```

### 2.4 Reliability (2025-2026)

- **Metadata extraction:** Very reliable. Uses the same endpoints as the YouTube web client.
- **Subtitle extraction:** Very reliable. Subtitles use a separate, stable API.
- **Audio/video download:** Mostly reliable but occasionally breaks. yt-dlp updates weekly.
- **Anti-bot measures:** YouTube has increased anti-bot enforcement since 2023. For metadata/subtitles only (Knowlune's primary use), reliability is high and cookies are usually unnecessary.
- **Recommendation:** Pin a known-good yt-dlp version with an automated update mechanism.

### 2.5 Server-Side Architecture

yt-dlp cannot run in the browser. It must run server-side.

**For Knowlune's architecture:**

```
Browser (React/Vite)
    │
    ▼
Vite Dev Server Middleware (or API route)
    │
    ├── youtube-dl-exec → yt-dlp binary (metadata, subtitles)
    └── youtube-transcript (npm) → YouTube InnerTube API (transcripts)
```

Given Knowlune already has an **Ollama proxy embedded in the Vite dev server** (commit `c4393e66`), the same middleware pattern can be used for yt-dlp:

```typescript
// Similar pattern to existing Ollama proxy in vite.config.ts
server: {
  // Add /api/youtube/* routes for metadata and transcript fetching
}
```

**Production considerations:**
- Docker: Install yt-dlp in the container (~40MB binary)
- Unraid: yt-dlp already available or easily installable
- Vercel: Possible via serverless functions with custom layer, but yt-dlp binary size (40MB) is a concern. Consider a separate API service on Unraid for heavy extraction.

---

## 3. Transcript Extraction Approaches

### 3.1 Decision Matrix

| Method | Cost | Speed | Coverage | Accuracy (English) | Auth | Reliability |
|--------|------|-------|----------|-------------------|------|-------------|
| **youtube-transcript (npm)** | Free | <1s | ~90% of videos | 8-12% WER (YouTube ASR) | None | Can break with YouTube changes |
| **yt-dlp --write-auto-subs** | Free | 2-5s | ~90% of videos | 8-12% WER (YouTube ASR) | None | Very reliable |
| **YouTube Data API captions** | Free (but costly quota) | <1s | ~90% | Same as above | OAuth + owner only | **Blocked for 3rd-party** |
| **OpenAI Whisper API** | $0.006/min | ~30s per 30min video | 100% (if audio exists) | 2-3% WER | API key | 99.9% SLA |
| **Self-hosted faster-whisper** | ~$0.02 electricity | ~5min per 30min (GPU) | 100% | 2-3% WER | None | Self-managed |
| **Groq Whisper API** | $0.0006/min | ~10s per 30min video | 100% | 2-3% WER | API key | Newer service |

### 3.2 Recommended: Tiered Approach

```
Tier 1: youtube-transcript (npm)
  → Fast (<1s), free, pure JS, no binary dependency
  → Covers ~90% of educational videos
  → Falls back to Tier 2 on failure

Tier 2: yt-dlp subtitle extraction
  → Slightly slower (2-5s), requires yt-dlp binary
  → Different extraction path — catches cases Tier 1 misses
  → Falls back to Tier 3 if no captions exist

Tier 3: Self-hosted faster-whisper on Unraid
  → Downloads audio via yt-dlp, transcribes locally
  → Covers the remaining ~10% without captions
  → Higher quality (2-3% WER vs 8-12% for YouTube ASR)
  → Zero API cost
```

### 3.3 youtube-transcript npm Package

```typescript
import { YoutubeTranscript } from 'youtube-transcript';

const transcript = await YoutubeTranscript.fetchTranscript('VIDEO_ID');
// Returns: [{ text: "Hello everyone", duration: 5000, offset: 0 }, ...]
```

- **How it works:** Scrapes YouTube's InnerTube API (same as the web player uses)
- **No API key needed**, no quota
- **Actively maintained** (~500K weekly npm downloads)
- **Risk:** Can break when YouTube changes their internal API (happened in late 2024, patched within days)

### 3.4 Whisper via Ollama — Not Possible

**Ollama does NOT support Whisper or any audio transcription models.** Ollama's architecture is built for text-generation LLMs and multimodal vision models. It has no audio input pipeline.

**Self-hosted Whisper alternatives for Unraid:**

| Option | Setup | GPU Support | Recommendation |
|--------|-------|-------------|----------------|
| **faster-whisper** (Docker) | `docker pull linto-ai/faster-whisper` | NVIDIA CUDA | **Best option** — 4x faster than original Whisper |
| **whisper.cpp** | Compile or Docker | CUDA, Metal, CPU-optimized | Good for CPU-only setups |
| **OpenAI Whisper** (Docker) | `pip install openai-whisper` | NVIDIA CUDA | Official but slower |

**faster-whisper performance:**

| Model | VRAM Required | Speed (GPU) | English WER |
|-------|--------------|-------------|-------------|
| `large-v3` | ~5 GB (int8) | ~5min per 30min audio | 2-3% |
| `large-v3-turbo` | ~3 GB (int8) | ~3min per 30min audio | 2.5-4% |
| `medium` | ~2 GB | ~2min per 30min audio | 3-5% |

### 3.5 Transcript Quality Comparison

| Source | Clean Lecture | Noisy Workshop | Technical Terms | Accented English |
|--------|-------------|----------------|-----------------|-----------------|
| YouTube Auto-Captions | 8-12% WER | 15-25% WER | 20-30% WER | 15-25% WER |
| Whisper large-v3 | 2-3% WER | 5-8% WER | 8-15% WER | 5-12% WER |
| Manual captions | 1-2% WER | 2-4% WER | 2-5% WER | 2-4% WER |

**For educational content:** YouTube auto-captions are "good enough" for well-produced content (Khan Academy, 3Blue1Brown). Whisper large-v3 is significantly better for university lectures with technical terminology or accented speakers.

### 3.6 Transcript Cleanup via Ollama

YouTube auto-captions have poor punctuation, no paragraph breaks, and no speaker identification. Readwise uses cloud GPT for "enhanced transcript" cleanup — Knowlune can use **Ollama** (already integrated via Vite proxy) for the same purpose:

```
Raw YouTube caption → Ollama (llama3, mistral, etc.) → Cleaned transcript
  - Add proper punctuation and capitalization
  - Insert paragraph breaks at topic transitions
  - Fix common ASR errors in technical vocabulary
  - Add chapter headers (using chapter data from metadata)
```

This aligns with the competitive analysis finding that **transcript quality is a key differentiator** — Readwise is the only competitor that does cleanup, and they use cloud GPT. Knowlune doing this via local Ollama is a self-hosted advantage.

### 3.7 Multi-Language Support

| Feature | YouTube Auto-Captions | Whisper |
|---------|----------------------|---------|
| Languages with ASR | ~15-20 (major languages) | 99 languages |
| Language auto-detection | Yes | Yes |
| Built-in translation | Yes (machine translated) | English translation built-in |
| Portuguese support | Yes (good quality) | Yes (good quality) |

Both approaches handle Portuguese well, relevant for Pedro's context.

---

## 4. Storage Implications

### 4.1 Per-Video Storage Estimates

| Data Type | Size | Storage Location | Refresh Needed |
|-----------|------|-----------------|----------------|
| Metadata (title, duration, chapters, etc.) | ~2-5 KB | IndexedDB (Dexie) | Every 30 days (YouTube ToS) |
| Thumbnail URL | ~100 bytes (URL only) | IndexedDB | Every 30 days |
| Transcript (raw, 30min video) | ~30-50 KB | IndexedDB | Once (rarely changes) |
| Transcript (cleaned, 30min video) | ~40-70 KB | IndexedDB | Once |
| Chapter data | ~500 bytes - 2 KB | IndexedDB | Every 30 days |
| User notes/highlights | ~1-10 KB | IndexedDB | Never (user data) |
| **Total per video** | **~75-140 KB** | | |

### 4.2 Scale Projections

| Library Size | Total Storage | IndexedDB Feasibility |
|-------------|---------------|----------------------|
| 100 videos | ~10-14 MB | Easily feasible |
| 500 videos | ~50-70 MB | Feasible |
| 1,000 videos | ~100-140 MB | Feasible (browsers allow 100MB+ for IndexedDB) |
| 5,000 videos | ~500-700 MB | Pushing limits — consider pagination/lazy loading |
| 10,000 videos | ~1-1.4 GB | Needs Supabase backend storage |

**IndexedDB limits:** Browsers typically allow 50-80% of available disk space for a single origin. On a desktop with 100GB+ free, this is more than sufficient. On mobile, tighter limits apply (~50-100MB practical).

### 4.3 Audio Files (Whisper Pipeline Only)

Audio files are only needed temporarily for Whisper transcription:

| Audio Quality | Size per 30min | When Needed |
|--------------|---------------|-------------|
| 128kbps M4A | ~30 MB | Only for Whisper transcription |
| 64kbps M4A | ~15 MB | Lower quality, faster download |

**Storage strategy:** Download audio to Unraid server → transcribe → delete audio file. No persistent audio storage needed. The transcript (50-70KB) is the only thing stored long-term.

### 4.4 Database Schema Considerations

Key fields for the YouTube video record in Dexie:

```typescript
interface YouTubeVideo {
  // Metadata (refresh every 30 days)
  videoId: string;           // YouTube video ID (primary key)
  title: string;
  channelId: string;
  channelTitle: string;
  duration: number;          // seconds
  thumbnailUrl: string;
  description: string;
  publishedAt: string;
  chapters: Chapter[];       // { startTime, endTime, title }
  lastRefreshedAt: string;   // ISO date — must refresh within 30 days

  // Transcript (fetch once, clean once)
  transcriptRaw: TranscriptSegment[];    // { text, offset, duration }
  transcriptCleaned: string | null;      // Ollama-cleaned text
  transcriptSource: 'youtube-captions' | 'whisper' | null;
  transcriptLanguage: string;
  transcriptFetchedAt: string;

  // Learning data (user-generated, never expires)
  courseId: string;           // FK to course
  lessonOrder: number;
  watchProgress: number;      // 0-1
  bookmarks: Bookmark[];     // { timestamp, note }
  highlights: Highlight[];   // { startOffset, endOffset, note }
  completedAt: string | null;
}
```

---

## 5. Recommended Architecture

### 5.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React/Vite)                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ YouTube       │  │ Course       │  │ Transcript       │  │
│  │ IFrame Player │  │ Builder UI   │  │ Reader/Search    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         │                  │                  │              │
│  ┌──────┴──────────────────┴──────────────────┴───────────┐ │
│  │                  IndexedDB (Dexie)                       │ │
│  │  Videos, Courses, Transcripts, Progress, Notes          │ │
│  └─────────────────────────┬───────────────────────────────┘ │
└────────────────────────────┼─────────────────────────────────┘
                             │ API calls
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Server Middleware (Vite dev / Vercel API / Unraid)          │
│                                                              │
│  ┌────────────────┐  ┌───────────────┐  ┌────────────────┐ │
│  │ YouTube Data    │  │ youtube-      │  │ youtube-dl-    │ │
│  │ API v3 (metadata)│  │ transcript   │  │ exec (yt-dlp)  │ │
│  │ (1 unit/call)   │  │ (npm, free)  │  │ (fallback)     │ │
│  └────────────────┘  └───────────────┘  └────────────────┘ │
│                                                              │
│  ┌────────────────┐  ┌───────────────┐                      │
│  │ Ollama         │  │ faster-whisper│  (Unraid only)       │
│  │ (transcript    │  │ (transcription│                      │
│  │  cleanup + AI) │  │  fallback)   │                      │
│  └────────────────┘  └───────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow: "Paste a Playlist URL"

```
1. User pastes playlist URL
   → playlistItems.list (1 quota unit) → get all video IDs

2. For each video (batched, up to 50/call):
   → videos.list (1 quota unit) → metadata + chapters
   → youtube-transcript.fetchTranscript() → captions (free, <1s)
   → If no captions: flag for Whisper processing

3. AI course structuring (Ollama):
   → Send titles + descriptions + chapter data
   → LLM proposes chapter groupings
   → User reviews/edits → save course structure

4. Background: transcript cleanup (Ollama):
   → Raw captions → cleaned text with paragraphs and punctuation
   → Store cleaned version alongside raw

5. Background: Whisper queue (Unraid, for videos without captions):
   → yt-dlp downloads audio → faster-whisper transcribes → store transcript
```

### 5.3 Deployment Considerations

| Environment | Metadata | Transcripts | Whisper | Ollama |
|-------------|----------|-------------|---------|--------|
| **Local dev** (Vite) | YouTube API via middleware | youtube-transcript via middleware | Unraid Docker container | Unraid (existing) |
| **Vercel** (production) | Vercel API route | Vercel API route | Not available (no GPU) | Not available |
| **Unraid** (self-hosted) | API route | API route | Docker container (GPU) | Docker container (existing) |

**Key tension:** Vercel cannot run yt-dlp (binary size) or Whisper (no GPU). Options:
1. **Vercel + Unraid API:** Vercel frontend calls Pedro's Unraid server for heavy extraction tasks
2. **Vercel-only (limited):** Use youtube-transcript (pure JS, runs in serverless) for transcripts. No Whisper fallback. Good enough for 90% of videos.
3. **Self-hosted only:** Deploy entirely on Unraid via Docker. Full capability but no Vercel CDN.

**Recommendation:** Start with option 2 (Vercel-only with youtube-transcript). Add Unraid API for Whisper fallback in a later iteration. This matches the Phase 1/Phase 2 strategy from the office hours doc.

---

## 6. Risk Assessment

### 6.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **youtube-transcript breaks** (YouTube API change) | Medium (happens ~2x/year) | High — no transcripts | Fallback to yt-dlp subtitles; pin known-good version; monitor upstream issues |
| **YouTube API quota exhaustion** | Low (using ~3% of quota) | Medium — no new imports | oEmbed fallback for metadata; aggressive caching |
| **yt-dlp blocked by YouTube** | Low for metadata/subs | Medium | Keep yt-dlp updated; only use for Whisper audio pipeline |
| **Whisper processing bottleneck** | Low (only ~10% of videos) | Low — degraded, not broken | Queue system; skip if user doesn't need transcript |
| **IndexedDB storage limit on mobile** | Medium | Low — affects power users only | Lazy-load transcripts; pagination; future Supabase sync |

### 6.2 Legal/Compliance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **youtube-transcript violates YouTube ToS** (scraping) | Certain (by definition) | Low — contractual, not criminal | Same approach as Readwise, Glasp, Open WebUI. No alternative exists. Document educational purpose. |
| **30-day cache refresh violation** | Medium (easy to forget) | Low — ToS violation | Automated refresh job; `lastRefreshedAt` field in schema |
| **Displaying YouTube data without branding** | Low | Low | Include YouTube attribution in UI |

### 6.3 Dependency Risks

| Dependency | Maintainer | Bus Factor | Alternative |
|-----------|-----------|------------|-------------|
| `youtube-transcript` (npm) | Community | Low (1-2 maintainers) | yt-dlp subtitle extraction |
| `youtube-dl-exec` (npm) | microlinkhq | Medium | yt-dlp-wrap |
| YouTube Data API v3 | Google | No risk | oEmbed, RSS feeds |
| faster-whisper | SYSTRAN | Medium | whisper.cpp, OpenAI Whisper |

---

## 7. Implementation Roadmap

Aligned with the office hours doc Phase 2 (weeks 7-10):

### 7.1 Phase 2a: Core YouTube Import (Week 7-8)

**Scope:** Paste URL → fetch metadata + transcript → create course

| Task | Dependencies | Estimate |
|------|-------------|----------|
| Vite middleware for YouTube API proxy | YouTube API key | 1 day |
| youtube-transcript integration | npm install | 0.5 day |
| Video metadata fetching + caching in Dexie | Schema design | 1 day |
| Playlist import flow (paste URL → fetch all videos) | Metadata fetching | 1 day |
| Basic course builder UI (review/edit structure) | Metadata + Ollama | 2 days |
| YouTube IFrame Player integration | React component | 1 day |
| Chapter-level progress tracking | Player events | 1 day |

### 7.2 Phase 2b: Transcript Features (Week 9)

| Task | Dependencies | Estimate |
|------|-------------|----------|
| Transcript display with time-sync | youtube-transcript | 1.5 days |
| Transcript search across courses | Dexie full-text search | 1 day |
| In-video bookmarks with notes | Player + Dexie | 1 day |
| Transcript cleanup via Ollama | Ollama proxy | 1 day |

### 7.3 Phase 2c: Polish + Fallbacks (Week 10)

| Task | Dependencies | Estimate |
|------|-------------|----------|
| yt-dlp fallback for transcript extraction | youtube-dl-exec | 1 day |
| 30-day metadata refresh automation | Background worker | 0.5 day |
| Error handling + loading states | All features | 1 day |
| E2E tests for YouTube import flow | Playwright | 1 day |

### 7.4 Future: Whisper Pipeline (Post-Launch)

| Task | Dependencies | Estimate |
|------|-------------|----------|
| faster-whisper Docker container on Unraid | GPU passthrough | 1 day |
| Audio download queue (yt-dlp) | Server-side | 1 day |
| Whisper transcription API endpoint | faster-whisper container | 1 day |
| Frontend: "transcribing..." status indicator | Queue integration | 0.5 day |

---

## 8. Sources

### YouTube Data API v3
- Quota costs: https://developers.google.com/youtube/v3/determine_quota_cost
- API Terms of Service: https://developers.google.com/youtube/terms/api-terms-of-service
- Quota increase form: https://support.google.com/youtube/contact/yt_api_form
- Compliance audits: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits

### yt-dlp
- GitHub: https://github.com/yt-dlp/yt-dlp
- youtube-dl-exec (npm): https://github.com/microlinkhq/youtube-dl-exec
- yt-dlp-wrap (npm): https://github.com/foxesdocode/yt-dlp-wrap

### Transcript Extraction
- youtube-transcript (npm): https://www.npmjs.com/package/youtube-transcript
- youtube-transcript-api (Python): https://github.com/jdepoix/youtube-transcript-api

### Whisper
- OpenAI Whisper: https://github.com/openai/whisper
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- whisper.cpp: https://github.com/ggerganov/whisper.cpp

### Unofficial YouTube Alternatives
- Invidious API: https://docs.invidious.io/api/
- Piped API: https://docs.piped.video/docs/api-documentation/

### Related Knowlune Documents
- [Competitive Analysis](../../docs/research/market-youtube-content-handling-research-2026-03-25.md)
- [Office Hours Design](../../docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md)
