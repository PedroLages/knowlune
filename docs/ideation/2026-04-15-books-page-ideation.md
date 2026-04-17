---
date: 2026-04-15
topic: books-page-next-features
focus: what we should build on the library page for audiobooks and ebooks
---

# Ideation: Library Page — What to Build Next

## Codebase Context

Knowlune's books/library feature is already extensive — 13 epics completed (E83-E115) spanning 71+ components across library (42), reader (15), and audiobook (14) directories.

**What already exists:**
- Full EPUB reader (epub.js) with themes, bookmarks (audio only — EPUB shows "coming soon"), highlights, vocabulary tracking, TTS
- Library page with grid/list views, filters, collections, reading queue, smart shelves
- Audiobook player with chapter nav, speed control, sleep timer, skip silence, audio clips
- Audiobookshelf integration (server connect, browse, stream, progress sync, Socket.IO, format switching/Whispersync)
- OPDS catalog browsing and streaming
- Highlight/annotation system with vocabulary builder, cross-book search, PKM export
- Reading analytics (speed, ETA, time-of-day patterns, genre distribution)
- Star ratings and reviews (1-5 with half-star support, markdown review text), reading challenges
- Reading accessibility features, keyboard shortcuts

**Known pain points:**
- EPUB reader blank screen bugs (being fixed on current branch)
- epub.js callbacks unreliable (need timeout fallbacks)
- BookReader.tsx is a 904-line monolith (20 useState, 15 useEffect)
- EPUB bookmarks stub (`B` shortcut shows "coming soon" toast)
- Reading sessions don't feed study streaks or achievements
- Highlights are write-only — made during reading, never systematically revisited
- Books and courses are completely separate experiences despite being the same activity
- No integration with external book tracking platforms (Goodreads, etc.)
- No way to import highlights from Kindle or other readers

**Key infrastructure available for leverage:**
- FSRS spaced repetition engine (flashcards)
- AI tutor with RAG pipeline and "Quiz Me" mode (26 quiz components)
- BruteForceVectorStore for semantic similarity (notes system)
- Knowledge map with topic scoring, urgency, and action suggestions
- Learning paths, study streaks, achievement/challenge system
- TipTap rich text editor, appEventBus event system
- ABS integration pattern (store → sync hook → progress sync → settings dialog → Express proxy) — battle-tested template for new remote service integrations
- Express backend proxy with SSRF protection, rate limiting, cover caching
- Pedro's self-hosted infrastructure: Ollama (LLM), Speaches/Whisper (transcription), Audiobookshelf, planned Supabase

## Research Findings

### Kindle Data Access (for Highlight Import)

Amazon has **no public API** for Kindle data. Available methods:

| Method | Reliability | Data | Self-Hosted | Notes |
| --- | --- | --- | --- | --- |
| **My Clippings.txt** | High | Highlights, notes, bookmarks, timestamps | Yes | USB from physical device. No reading progress. Best for self-hosted |
| kindle-api (Node.js) | Medium | Full (highlights, progress, metadata) | Partial | Reverse-engineered private API. Requires TLS proxy for fingerprinting. Fragile |
| Readwise API | High | Full + cloud sync | No | $10/month subscription. Cloud-dependent. Webhooks for real-time sync |
| Cloud Reader scraping | Low | Limited by 5-10% copy limits | No | Puppeteer/Playwright-based. DRM restrictions block bulk extraction |

**Decision:** My Clippings.txt parser with drag-drop import. Pedro uses a physical Kindle device — direct USB file access is the most reliable path. No external dependencies, no fragile API wrappers.

**Key parser libraries:** kindle-clippings (Python), kindle-my-clippings-parser (Go), kindle-clippings-manager (Python, with dedup).

### Goodreads API Status

**Goodreads deprecated their public API in December 2020.** No new API keys issued. Existing keys throttled after 30 days of inactivity. RSS feeds still work but capped at 100 books per shelf. No write access whatsoever.

**Conclusion:** Goodreads is export-only via CSV download from the web UI. Not viable for live sync.

### Hardcover.app — The Goodreads Replacement

Hardcover.app has a **free GraphQL API** with full bidirectional sync capabilities:

- **Endpoint:** `https://api.hardcover.app/v1/graphql`
- **Auth:** Bearer token (get from hardcover.app/account/api, valid ~1 year)
- **Rate limit:** 60 requests/minute, 30s query timeout
- **Read capabilities:** Shelves, book metadata (ISBN, cover, description, page count), reading history, ratings, tags, search
- **Write capabilities:** Push ratings, reading status (Want to Read / Currently Reading / Read / Did Not Finish), reading progress (by page number, auto-calculates percentage), journal entries, list management
- **Metadata enrichment:** Cover URLs, ISBN-13/10, publisher, page count, publication date, ratings distribution, tags — richer than Open Library
- **Proven integrations:** KOReader e-reader plugin, hardcover-data-sync backup tool, Raycast extension, Softcover iOS app
- **Goodreads migration:** Hardcover itself accepts Goodreads CSV import — historical data migrates through them
- **Schema:** Full GraphQL schema available at github.com/hardcoverapp/hardcover-docs

### Architecture Pattern Reuse

The ABS integration is the exact template for Hardcover:

| ABS Component | Hardcover Equivalent |
| --- | --- |
| `useAudiobookshelfStore` | `useHardcoverStore` (account config + auth) |
| `useAudiobookshelfSync` | `useHardcoverSync` (shelf/library pull) |
| `useAudiobookshelfProgressSync` | `useHardcoverProgressSync` (bidirectional) |
| `AudiobookshelfSettings.tsx` | `HardcoverSettings.tsx` (connection dialog) |
| `/api/abs/proxy/*` | `/api/hardcover/proxy/*` (Express proxy) |

Key difference: ABS uses REST + Bearer token; Hardcover uses GraphQL + Bearer token. Auth is simpler (no OAuth — just paste the token).

## Ranked Ideas

### 1. Post-Session Reflection Prompts (The 2-Minute Debrief)

**Description:** When a reading/listening session ends (detected via `reading:session-ended` or `listening:session-ended`), surface a brief reflection modal: "What's one takeaway?" with quick-select options for focus level (scattered / okay / deep flow) and an optional text field. Responses attach to the book's timeline. Focus ratings feed into the knowledge map's topic scoring.

**Rationale:** Reading without reflection has poor retention. A 30-second prompt at session end captures insights when memory is freshest. The event bus already fires at the right moment (`appEventBus` emits `reading:session-ended`). Star ratings prove the data model supports per-book annotations. Knowledge map integration means reflections compound into learning insights.

**Downsides:** Could feel intrusive if the user just wants to close the book. Needs a "skip always" or "ask me only for long sessions" setting. Quick-select options (1-tap mood/focus) are better than text input for reducing friction.

**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 2. Kindle My Clippings.txt Importer

**Description:** Parse and import Kindle's `My Clippings.txt` file (drag-drop in the Library page) to pull highlights, notes, and bookmarks into the existing annotation system. Fuzzy-match clippings to books already in the library by title+author, or create metadata-only stub entries for unmatched titles. After import, highlights are immediately searchable, exportable via PKM, and eligible for spaced resurfacing.

**Rationale:** Kindle is the most common ebook ecosystem. Users switching to EPUB reading lose years of accumulated highlights. `My Clippings.txt` is a well-documented, stable text format. The highlight system, cross-book search, and PKM export pipeline mean imported highlights immediately gain superpowers they never had in Kindle. Pedro uses a physical Kindle device — USB file access is direct.

**Downsides:** Kindle clippings don't include positional data (CFI) — highlights can't link back to exact EPUB positions. Fuzzy title matching will have false positives/negatives. Only handles Kindle format, not Kobo/Apple Books. Append-only format means editing highlights in Kindle creates duplicates.

**Confidence:** 83%
**Complexity:** Low
**Status:** Unexplored

### 3. Goodreads CSV Historical Import

**Description:** Accept a Goodreads (or StoryGraph) CSV export to import shelf data, star ratings (1-5 maps directly to Knowlune's BookReview.rating), read-dates, and review text. Map imported books to existing library entries by ISBN or create metadata-only placeholders marked "read elsewhere." Import shelves (read, currently-reading, to-read, custom) into Knowlune's shelf system.

**Rationale:** A library that only knows about books imported this month gives a distorted picture. Importing 5 years of Goodreads history makes the yearly goal bar, genre distribution, and reading analytics instantly meaningful. The CSV format is documented and stable. Star ratings and reviews already exist in the data model (BookReview supports 1-5 with half-stars). Goodreads `My Rating = 0` means "not rated" — skip review creation for these.

**Downsides:** CSV parsing edge cases (commas in titles, unicode). "Read elsewhere" books need a visual distinction in the grid (badge/indicator) so they don't clutter alongside actionable EPUBs. One-time import, not live sync.

**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 4. Hardcover.app Bidirectional Sync + Metadata Enrichment

**Description:** Full bidirectional integration with Hardcover.app via their GraphQL API, following the ABS sync pattern. Pull: reading history, shelves, book metadata. Push: ratings, reading status changes, reading progress (page number). Also use Hardcover as a metadata enrichment source — when importing a local EPUB or Kindle book, auto-fetch cover art, ISBN, description, and page count from Hardcover's API (richer than current Open Library lookups). User connects via Bearer token (paste from hardcover.app/account/api).

**Rationale:** Goodreads API is dead (deprecated Dec 2020). Hardcover.app is the developer-friendly successor with a free GraphQL API, proven by the KOReader plugin and other integrations. Bidirectional sync means reading a book in Knowlune automatically updates Hardcover, and vice versa. The ABS integration pattern (store → sync hook → progress sync → settings dialog → Express proxy) is directly reusable. Hardcover also accepts Goodreads CSV import on their end — so historical data migrates through them.

**Downsides:** External service dependency (Hardcover is a startup). API is in beta — tokens reset annually, may change without notice. 60 req/min rate limit requires careful batching for large libraries. Bearer token auth is simple but tokens expire after ~1 year.

**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 5. Unified Learning Activity Timeline

**Description:** A new Library view mode (alongside grid/list/series) that displays a reverse-chronological activity feed combining: reading sessions, listening sessions, highlights created, vocabulary saved, quizzes completed, flashcard reviews, and course lesson completions. Each entry is a typed, color-coded card that deep-links to the source (reader position, player timestamp, quiz result). Smart grouping collapses sequences (e.g., "Highlighted 5 passages in Deep Work").

**Rationale:** Current views are static collection snapshots. A timeline surfaces engagement patterns and bridges the book/course separation — the user sees "you learned 47 minutes today" regardless of whether it was reading, watching, or quizzing. All raw data exists: event bus emits `book:imported`, `book:finished`, `highlight:created`, `reading:session-ended`, `listening:session-ended`. StudySession records have timestamps. The only new code is the presentation layer and a shared `LearningEvent` query.

**Downsides:** Could be noisy for active users. Needs smart grouping and filtering. Loading historical data efficiently requires careful Dexie querying with date-based indices. Interleaving events from different stores (books, courses, flashcards) needs a unified query.

**Confidence:** 82%
**Complexity:** Medium
**Status:** Unexplored

### 6. Forgetting Curve Overlay on Library Shelves

**Description:** Visually indicate knowledge decay on book covers in the grid/list view. Finished books that haven't been reviewed show a subtle visual treatment — a "memory strength" ring around the cover or an amber urgency dot. Tapping the indicator shows which concepts from that book are decaying in the FSRS system and offers a 2-minute review session (highlights, vocabulary, or quiz). The overlay only activates for books with sufficient review material (5+ highlights threshold).

**Rationale:** Finishing a book feels like completion, but retention decays invisibly. Making forgetting *visible* on the shelf — right where the user browses — creates a persistent, low-pressure nudge. FSRS already calculates decay and urgency per topic. The flashcard, vocabulary, and highlight systems provide ready-made review material. The knowledge map has topic scoring with urgency levels.

**Downsides:** Only works for books with highlights/vocabulary/flashcards — empty for books read without annotation. Could feel anxiety-inducing if many books show decay. Visual treatment must be subtle enough not to make the grid feel cluttered.

**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored (Pedro still considering)

### 7. Universal Library Search (Full-Text Across EPUBs + Transcribed Audiobooks)

**Description:** Extend library search to search *inside* books, not just metadata. For EPUBs, index full text from `book.spine` content. For audiobooks, batch-transcribe via the Whisper/Speaches server on Unraid and index the transcripts. Results show matching passages with surrounding context; tapping a result opens the reader/player at that exact position (CFI for EPUB, timestamp for audio). Use the existing vector store infrastructure (all-MiniLM-L6-v2, 384-dim) for semantic search in addition to keyword matching.

**Rationale:** "Which book mentioned second-order thinking?" is currently unanswerable. This eliminates the biggest disadvantage of both formats — text buried in files and audio that's unsearchable. The vector store and embedding pipeline already exist for the notes system. Whisper on Unraid makes audiobook transcription a batch job (overnight), not a real-time dependency. Pairs EPUB search with audiobook search for a unified experience.

**Downsides:** EPUB text extraction depends on epub.js reliability (known issues with callbacks, need timeout fallbacks). Audiobook transcription is compute-heavy (batch overnight on Unraid). Index storage grows with library size. Semantic search quality depends on embedding model. Initial indexing requires processing the entire library.

**Confidence:** 78%
**Complexity:** High
**Status:** Unexplored

### Deferred: Voice-Annotated Audio Clips

**Description:** When saving an audio clip during audiobook playback, record a voice memo instead of typing. Transcribe via Whisper (Speaches on Unraid) and store as searchable text alongside the clip.

**Status:** Confirmed for future — not current priority. Uniquely enabled by Pedro's Whisper infrastructure. Solves real friction (typing while listening breaks flow).

## Implementation Tiers

| Tier | Ideas | Complexity | Compound Value |
| --- | --- | --- | --- |
| **Quick wins** | #1 Reflection Prompts, #2 Kindle Import, #3 Goodreads CSV | Low | High — immediate value, data bootstrap |
| **Medium bets** | #4 Hardcover Sync, #5 Activity Timeline, #6 Forgetting Curve | Medium | High — novel UX, compounds with existing systems |
| **Bold bet** | #7 Universal Library Search | High | Transformative — makes entire library searchable |

## Rejection Summary

| # | Idea | Reason Rejected |
| --- | --- | --- |
| 1 | Mood-Based Book Picker | Gimmicky; filter sidebar already narrows choices effectively |
| 2 | Parallel Reading Tracker | Too small — a layout tweak on the reading queue, not a feature |
| 3 | Smart Collection Suggestions | Netflix-style carousels don't improve learning, just browsing |
| 4 | Reading Pace Predictor | Narrow widget; better as part of a broader analytics view |
| 5 | Book Comparison Side-by-Side | Niche; no clear learning outcome from comparing two books |
| 6 | Vocabulary Heat Zones on Covers | Unreadable on tiny covers; belongs on a detail page chart |
| 7 | Library Lending Shelf | Single-user app; no audience until multi-user ships |
| 8 | Listening Pace Analytics | Duplicate of Reading Pace Predictor for audio |
| 9 | Audio Clip Mixtapes | Fun but niche; insufficient clip volume for most users |
| 10 | Ambient Listening Mode | Always-on mic; privacy/complexity too high |
| 11 | Chapter Difficulty Heatmap | ABS doesn't expose rewind/pause granularity |
| 12 | Dual-Track AI Summaries | TTS pipeline for arbitrary content is unreliable dependency chain |
| 13 | A/B Narrator Comparison | Requires multiple narrations of same book (rare) |
| 14 | Post-Session Fatigue Check-In | Self-reported fatigue data is unreliable |
| 15 | Narration Mood Tags | Audio classifiers don't exist in the stack |
| 16 | Unified Streak (books count) | Already explored in prior ideation round |
| 17 | Reading Momentum Meter | Too small — a sparkline widget |
| 18 | Social Proof Reading Queue | Fake social proof in single-user app is dishonest UX |
| 19 | Chapter-Level Commitments | Heavy implementation (notifications, deadlines) for uncertain adoption |
| 20 | Adaptive Reading Prescription | Single recommendation being wrong 50% of the time is worse than choice |
| 21 | Reading Ritual Builder | Too abstract; ceremony without clear value |
| 22 | OPDS One-Click Download | UX improvement to existing flow, not a new feature |
| 23 | ABS Bidirectional Sync | Already in Supabase sync design — engineering, not ideation |
| 24 | Library Export JSON/OPDS | Defensive (backup); doesn't improve learning |
| 25 | Ollama Book Recommendations | LLM recommendations are hit-or-miss without massive data |
| 26 | Calibre Library Bridge | OPDS already bridges to Calibre-Web; incremental |
| 27 | Annotation Import (Readwise/Kobo) | Duplicates Kindle import in spirit; do one format first |
| 28 | Reading Data Webhook/API | No external consumers yet; build when needed |
| 29 | ISBN Barcode Scan for Physical Books | Physical book tracking is a separate product direction |
| 30 | Book vs. Course Convergence Dashboard | Subsumed by #5 (Activity Timeline) which is more actionable |

## Session Log

- 2026-04-15 (Round 1): Initial ideation — 38 candidates generated across 4 frames (user pain, inversion/removal, assumption-breaking, leverage/compounding), 28 after dedup, 7 survived adversarial filtering
- 2026-04-15 (Round 2): Fresh ideation with new frames (UX/Discovery, Audio-Specific, Learning/Gamification, Data/Ecosystem). 37 new candidates, 7 survived + 1 deferred. Deep research on Kindle access methods and Goodreads alternatives. Discovered Hardcover.app as Goodreads replacement with free bidirectional GraphQL API. Pedro confirmed: two separate ideas for CSV import vs live sync, Hardcover as metadata enrichment source, physical Kindle device (My Clippings.txt is best), Voice Clips deferred to future.
