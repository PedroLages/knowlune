# Plan: Add Books & Audiobooks Library to Product Roadmap

## Context

Knowlune currently handles video courses, PDFs, and YouTube playlists as learning content. Adding books and audiobooks as a first-class content type would make it a comprehensive personal learning library — video + text + audio all in one place, with unified progress tracking, notes, flashcards, and spaced repetition.

The user wants a **full library manager** (import, read, listen, annotate, track progress, manage shelves) — not just metadata tracking. Content sources to be explored.

## Action

1. Save exploration document to `docs/plans/2026-03-28-books-audiobooks-exploration.md`
2. Add as Section 19 in the product roadmap (renumber Dependencies → 20, Sequencing → 21)
3. Reference the saved plan from the roadmap section

## Exploration Document Content

### Section: Books & Audiobooks Library

#### Current State — What Knowlune Already Has

| Capability | Existing | Reusable For Books/Audiobooks? |
|-----------|----------|-------------------------------|
| PDF viewer | ✅ Lesson Player handles PDFs | ✅ Works for PDF ebooks as-is |
| Video/audio playback | ✅ HTML5 video player | ⚠️ Needs audio-only mode for audiobooks |
| Progress tracking | ✅ contentProgress per lesson | ✅ Map chapters → lessons |
| Note-taking (Tiptap) | ✅ Per-lesson notes | ✅ Per-chapter book notes |
| Flashcards | ✅ Per-course flashcards | ✅ Per-book flashcards |
| Spaced repetition | ✅ SM-2 on flashcards | ✅ Review book concepts |
| Import wizard | ✅ Folder/YouTube/bulk import | ⚠️ Needs book-aware import (EPUB, M4B) |
| Search (vector) | ✅ Embeddings + semantic search | ✅ Search across book highlights |
| Export | ✅ JSON/CSV/MD | ✅ Export book notes to Obsidian |
| Thumbnails | ✅ Course thumbnails in IDB | ✅ Book cover images |
| AI features | ✅ Summarization, Q&A, RAG | ✅ Summarize chapters, Q&A on book content |

#### What's New (Not Reusable)

| Feature | Description | Complexity |
|---------|-------------|------------|
| **EPUB reader** | In-browser EPUB rendering with pagination, font control, themes | Large — needs epub.js or similar |
| **Audiobook player** | Audio-only player with chapter nav, speed control, sleep timer, bookmarks | Medium — extend existing player |
| **Highlight/annotation** | Inline text selection → highlight + annotate inside EPUB reader | Large — EPUB annotation spec (W3C) |
| **Reading position sync** | Track exact page/scroll position, resume where you left off | Medium — similar to video position |
| **Library shelves** | "Currently Reading", "Want to Read", "Finished", custom shelves | Small — status field + UI |
| **Book metadata** | Author, ISBN, cover, genre, page count, publication date | Small — new Dexie table |
| **Chapter extraction** | Parse EPUB/M4B chapter structure into lesson-like items | Medium — format-specific parsing |
| **Sleep timer** | For audiobooks — stop playback after N minutes | Small — timer utility |
| **Playback speed** | 0.5x to 3x for audiobooks | Small — HTML5 audio playbackRate |
| **Whispersync-like** | Switch between reading and listening at same position | Large — position mapping between formats |

#### Content Source Options

**A. Local Files (EPUB, PDF, M4B, MP3)**
- User imports from disk (same pattern as course import)
- Supports: EPUB (ebooks), PDF (already works), M4B (audiobooks), MP3 chapters
- Pros: Privacy, offline, no API dependencies, self-hosted ethos
- Cons: User must own/source files, no automatic metadata enrichment

**B. Open Library / Google Books API (metadata only)**
- Fetch book metadata (cover, author, ISBN, description) from free APIs
- User still provides the content files
- Pros: Rich metadata without manual entry, cover images
- Cons: API dependency, metadata may not match user's edition

**C. Audible Integration**
- Import Audible library metadata + listening position
- Would require reverse-engineering Audible API or using unofficial tools (audible-cli)
- Pros: Most audiobook users have Audible
- Cons: No official API, DRM issues, fragile integration, legal gray area

**D. Kindle/Readwise Integration**
- Import Kindle highlights + reading progress via Readwise API
- Pros: Well-documented API, existing PKM ecosystem integration
- Cons: Readwise is paid, only highlights (not the book content itself)

**E. Calibre Integration**
- Import from Calibre library (the de facto ebook manager)
- Read Calibre's SQLite database or calibredb CLI
- Pros: Power users already use Calibre, rich metadata, format conversion built-in
- Cons: Desktop-only (Calibre doesn't run in browser), requires file system access

**F. OPDS Catalog (self-hosted)**
- OPDS is a standard feed format for ebook catalogs (like RSS for books)
- Calibre-Web, Kavita, Komga all serve OPDS feeds
- Pros: Self-hosted friendly (matches Knowlune/Unraid ethos), standard protocol
- Cons: Niche, setup complexity

**Recommended approach:** Start with **A (local files)** + **B (metadata enrichment)**. Add **E (Calibre)** and **F (OPDS)** for self-hosted power users. Defer **C (Audible)** and **D (Readwise)** until demand is clear.

#### Data Model

```
books (new Dexie table)
  id: string (UUID)
  title: string
  author: string
  isbn?: string
  coverUrl?: string
  description?: string
  genre?: string
  pageCount?: number
  format: 'epub' | 'pdf' | 'audiobook'
  fileHandle?: FileSystemFileHandle (for local files)
  chapters: BookChapter[]
  status: 'want-to-read' | 'reading' | 'finished' | 'abandoned'
  shelf?: string (custom shelf name)
  importedAt: string
  startedAt?: string
  finishedAt?: string
  rating?: number (1-5)

bookChapters (new Dexie table)
  id: string
  bookId: string
  title: string
  orderIndex: number
  startPosition: number (page for EPUB, seconds for audiobook)
  endPosition: number

bookProgress (new Dexie table — mirrors contentProgress pattern)
  bookId: string
  chapterId: string
  status: 'not-started' | 'in-progress' | 'completed'
  position: number (exact page/scroll/audio position)
  updatedAt: string

bookHighlights (new Dexie table)
  id: string
  bookId: string
  chapterId: string
  text: string (highlighted text)
  note?: string (annotation)
  color: string (highlight color)
  position: { start: number, end: number } (character offsets or CFI for EPUB)
  createdAt: string

bookSessions (new Dexie table — mirrors studySessions pattern)
  id: string
  bookId: string
  chapterId: string
  startTime: string
  endTime?: string
  duration: number (seconds of active reading/listening)
  pagesRead?: number
  sessionType: 'reading' | 'listening'
```

#### Technology Choices

| Need | Library | Size | Notes |
|------|---------|------|-------|
| EPUB rendering | `epub.js` | ~100KB | Most mature, handles pagination, search, CFI positions |
| EPUB parsing | `epubjs` (same) | — | Parses OPF, NCX, spine, TOC |
| Audiobook chapters | `music-metadata` | ~200KB | Parses M4B/MP3 chapter markers |
| Book metadata API | Google Books API | 0 (API) | Free, no auth required for basic lookups |
| Cover image fallback | Open Library Covers API | 0 (API) | `covers.openlibrary.org/b/isbn/{isbn}-L.jpg` |
| Highlight persistence | Custom (Dexie) | 0 | EPUB CFI positions + text ranges |
| Audio playback | Native HTML5 `<audio>` | 0 | playbackRate, currentTime, chapters via TimeRanges |

#### How This Integrates with Existing Features

| Feature | Integration |
|---------|------------|
| **Overview dashboard** | "Currently Reading" widget alongside "Continue Learning" |
| **Notes** | Book notes appear in Notes page, tagged with book title |
| **Flashcards** | Create flashcards from book highlights (highlight → front, note → back) |
| **Knowledge Map** | Book topics feed into knowledge score (Section 13) |
| **AI Tutoring** | "Ask about this book" — RAG over book highlights/notes |
| **Spaced Repetition** | Review book-derived flashcards alongside course flashcards |
| **Reports** | Reading time in study analytics, books completed |
| **Calendar** | "Read for 30 min" study blocks in iCal feed |
| **Data Sync** | Book progress syncs via same sync engine (Section 1) |
| **PKM Export** | Book highlights → Obsidian/Readwise format |

#### Phased Approach

| Phase | What | Effort | Wave |
|-------|------|--------|------|
| 1 | **Book metadata + library UI** — import books (EPUB/PDF), cover display, shelves (reading/finished/want), basic library grid | Medium (1 epic) | Wave 2-3 |
| 2 | **EPUB reader** — in-browser reader with pagination, font control, dark mode, chapter nav, reading position | Large (1-2 epics) | Wave 3 |
| 3 | **Audiobook player** — audio playback with chapter nav, speed control, sleep timer, position tracking | Medium (1 epic) | Wave 3 |
| 4 | **Highlights & annotations** — inline text selection in EPUB reader, highlight colors, annotation notes | Large (1 epic) | Wave 3-4 |
| 5 | **Integration with study tools** — flashcards from highlights, book notes in Notes page, book progress in Reports | Medium (1 epic) | Wave 4 |
| 6 | **Metadata enrichment** — Google Books/Open Library API lookup, cover fetching, ISBN scanning | Small (3-4 stories) | Wave 3 |
| 7 | **Calibre/OPDS integration** — import from Calibre library or OPDS catalog | Medium (1 epic) | Wave 4-5 |
| 8 | **Whispersync-like** — switch between EPUB and audiobook at same position | Large (1 epic) | Wave 5 |

#### Effort: Large (5-8 epics total across Waves 2-5)

#### Decision Gates

| Before Phase | Ask |
|-------------|-----|
| Phase 1 | "Do I actually read/listen to enough books to justify this?" |
| Phase 2 | "Is the PDF viewer sufficient for ebooks, or do I need EPUB specifically?" |
| Phase 3 | "Do I use audiobooks regularly enough to build a dedicated player?" |
| Phase 4 | "Are my highlights worth persisting, or do I just take notes?" |
| Phase 7 | "Am I using Calibre or an OPDS server?" |

#### Open Questions

1. Should books share the `importedCourses` table (treating a book as a "course" with chapters as "lessons") or have a completely separate data model?
2. Should audiobook playback reuse the Lesson Player component or have a dedicated Audio Player page?
3. Is Whisper integration relevant? (auto-transcribe audiobooks for search/AI features)
4. How does this interact with the desktop app (Section 3)? File access for local EPUB/M4B is easier with Tauri.

## Critical Files

| File | Relevance |
|------|-----------|
| `src/app/pages/LessonPlayer.tsx` | Video/PDF player — reuse patterns for book reader |
| `src/app/pages/Courses.tsx` | Course grid — reuse for book library grid |
| `src/app/pages/CourseDetail.tsx` | Course detail — reuse for book detail |
| `src/data/types.ts` | Add Book, BookChapter, BookProgress, BookHighlight interfaces |
| `src/db/schema.ts` | Add book tables |
| `src/stores/useContentProgressStore.ts` | Reuse pattern for book progress |
| `src/lib/exportService.ts` | Add book highlights to export |

## Verification

After adding to roadmap:
- Section appears in TOC with correct numbering
- Summary table has row for Books & Audiobooks
- Wave checklists reference book phases where appropriate
- No numbering conflicts with existing sections
