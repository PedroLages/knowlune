---
date: 2026-05-07
topic: offline-book-downloads
---

# Offline Book & Audiobook Downloads

## Problem Frame

Knowlune users currently need an internet connection to read or listen to any book sourced from OPDS catalogs or Audiobookshelf servers. Locally imported files are already stored in OPFS and work offline, but remote-sourced content is stream-only or transiently cached (10-book LRU Cache API for EPUBs, stream-only for audiobooks). Users on planes, subways, or with spotty connections cannot access their library.

The app already has all the infrastructure pieces — OPFS storage, BookContentService for fetching remote content, a complete audiobook player, and Supabase Storage sync — but there is no user-facing action to proactively download content for offline use.

## Requirements

**Core Download**
- R1. Users can download any remote book (EPUB, PDF, or audiobook) for offline access within Knowlune by tapping a Download button on the book detail page or selecting Download from the book context menu
- R2. Downloaded content is stored in OPFS and is read by the existing reader/player exactly like locally imported files — no new playback path needed
- R3. The download fetches the complete file (full audiobook, not per-chapter), shows progress, and supports resume via HTTP Range requests when interrupted
- R4. Downloads use streaming writes (`createWritable()` + `pipeTo`) to avoid buffering large files in memory — critical for audiobooks that can be 500MB+

**Offline Visibility**
- R5. Book cards and the book detail page show a download status indicator: not downloaded, downloading (with progress), or downloaded (available offline)
- R6. The library has a filter/shelf to show only downloaded (offline-available) books

**Export to Device**
- R7. Users can export a downloaded book file to their device filesystem (Downloads folder, Files app) via a "Save to device" action, separate from the primary Download-for-offline action
- R8. Exported files are standard formats (.epub, .pdf, .m4b, .mp3) usable by other apps

**Storage Management**
- R9. A storage indicator shows total OPFS space used by downloaded books, with per-book sizes visible
- R10. Users can remove individual downloads (frees OPFS space, book reverts to remote/streaming source) via the same trigger used to download
- R11. Removing a download does not delete the book from the library — it just removes the local OPFS copy
- R12. Quota warnings appear at 70%, 85%, and 95% of available OPFS storage, using `navigator.storage.estimate()`

**Platform Reliability**
- R13. The app requests persistent storage via `navigator.storage.persist()` on first download attempt to reduce eviction risk, especially on iOS
- R14. Downloads are foreground-managed (no dependency on Background Fetch API, which is effectively dead). If the user backgrounds the app, the download may pause and resumes when the app returns to foreground
- R15. Installed PWA mode is encouraged for better storage retention on iOS (Add to Home Screen prompt when relevant)

## Success Criteria
- A user on a plane can open Knowlune, navigate to their library, and read/listen to any previously downloaded book without internet
- Download progress is visible and the user understands when a book is ready for offline use
- Exported files open correctly in Apple Books, Google Play Books, VLC, or any standard reader/player
- A 500MB audiobook downloads without crashing the browser (streaming write, no in-memory buffering)
- Interrupted downloads resume from where they left off rather than restarting

## Scope Boundaries
- **Out of scope**: DRM, encryption, or license enforcement on downloaded files
- **Out of scope**: Auto-downloading content (no background pre-fetching without user action)
- **Out of scope**: Downloading books the user doesn't already have in their library
- **Out of scope**: Peer-to-peer or torrent-based distribution
- **Out of scope**: Downloading entire ABS libraries or OPDS catalogs in bulk
- **Out of scope**: Background downloads while app is closed (web platform limitation — even Spotify doesn't solve this)

## Key Decisions
- **OPFS for offline storage (not Cache API)**: Cache API is evictable by the browser at any time. OPFS is persistent and the reader/player already reads from it. Research confirms OPFS is viable on all platforms including iOS (500MB-2GB conservative, 10GB+ possible). The old "300MB iOS cap" is outdated.
- **Export as separate action from download-for-offline**: Download-to-OPFS is for in-app offline use. Export-to-device is for using with other apps. Combining them creates confusion about where the file goes and doubles the wait time.
- **Full audiobook download (not per-chapter)**: Simpler UX. Most M4B files are a single file already. Users expect "download this audiobook" to mean the whole thing, like Audible.
- **All platforms, mobile-first UX**: Desktop has larger OPFS quotas and better API support. Mobile gets the primary design attention since offline use is more common there.
- **Foreground-managed streaming downloads**: Research confirms Background Fetch API is effectively dead. The standard modern approach is foreground fetch → OPFS `createWritable()` streaming. Resumability via HTTP Range requests.
- **Own resumable downloader, not ABS client logic**: ABS supports full-file download and likely supports Range requests, but its download reliability in mobile apps is reportedly weak. Implement resumable download management in Knowlune rather than depending on ABS client behavior.

## Dependencies / Assumptions
- **Audiobookshelf must return full media files with Content-Length and Accept-Ranges headers** for resumable downloads. Research indicates this is very likely (Node.js/Express static file serving), but must be verified against the user's actual ABS instance with `curl -I` + `Range` header tests.
- **OPFS quotas on iOS Safari/PWA are sufficient for audiobooks**. Research shows 500MB-2GB is conservatively safe, 10GB+ is possible. The risk is eviction, not hard quota. Mitigated by `navigator.storage.persist()` and installed PWA mode.
- **Existing `OpfsStorageService.writeBookFile()` and `BookContentService.getEpubContent()`** are assumed to be sufficient building blocks. The download feature would extend these rather than replace them.
- **No server-side changes needed** — all download logic runs in the browser PWA context (consistent with Cloudflare Pages static hosting).

## Research Findings (Resolved)

### OPFS Quotas (Prompt 1)
- Chrome desktop: 10GB+ safe. Chrome Android: 2-5GB safe.
- Safari macOS: 1-5GB. iOS PWA: 500MB-2GB conservative, 10GB+ documented by real users.
- Old "300MB iOS cap" is outdated. Modern iOS WebKit uses dynamic quotas.
- `navigator.storage.persist()` significantly reduces eviction risk.
- OPFS + streaming writes is the standard architecture for large offline media.

### ABS Full-File Download (Prompt 2)
- ABS supports downloading original M4B/MP3 files (not just HLS streaming).
- Use `/api/items/{id}?expanded=1` to discover media file URLs and metadata.
- Range requests and Content-Length are very likely (Node.js/Express-based server).
- ABS mobile apps support offline downloads, confirming full-file access exists.
- Recommendation: implement own resumable downloader; treat ABS as a media origin, not a download manager.

### Background Downloads (Prompt 3)
- Background Fetch API is effectively dead — not cross-browser, not reliable.
- Service Worker cannot reliably survive backgrounding on mobile (especially iOS).
- Best architecture: foreground fetch + OPFS `createWritable()` streaming + HTTP Range resume.
- Even Spotify and Audible don't solve true background downloads on web — they push native apps.
- The web platform solved large-file storage (OPFS), but NOT native-grade background downloading.

### Resumable Downloads (Prompt 4)
- OPFS supports append/resume via `createWritable({ keepExistingData: true })` + `seek(existingBytes)`.
- Recommended pattern: write to `.partial` temp file, store checkpoint (byte offset + ETag) in IndexedDB, rename to final filename on completion.
- Stream directly from fetch to OPFS: `response.body.pipeTo(writable)` — near-constant memory regardless of file size.
- HTTP Range requests with `If-Range` + `ETag` prevent corrupted resumes if the server file changes.
- Chunk sizing: 1-4MB on mobile, 4-16MB on desktop.
- Verification: check file size + duration metadata on completion. Don't fully hash 1GB files on mobile.
- Cache API is a poor fit for large resumable media (no append, no partial mutation, aggressive eviction).
- IndexedDB blob chunk storage is also inferior to OPFS (fragmentation, memory spikes, Safari instability).
- The downloader needs journaling: queue, pause/resume, retry with exponential backoff, stale partial cleanup.
- Downloads WILL be interrupted (especially on mobile) — resumability is mandatory, not optional.

## Outstanding Questions

### Resolve Before Planning
- None. Research resolved all blocking technical questions.

### Deferred to Planning
- [Affects R1][Technical] For ABS-sourced content: what is the exact URL pattern for fetching the raw media file? Needs verification against the user's ABS instance. Expect pattern like `/api/items/{id}/file/{fileId}` or similar.
- [Affects R5][Technical] Should download status be a new field on the Book type (`downloadStatus: 'remote' | 'downloading' | 'downloaded'`), derived from source type, or tracked in a separate Dexie table?
- [Affects R3][Technical] Resumable download state management: store byte offset + ETag in IndexedDB? Or use OPFS file size as the resume checkpoint?
- [Affects R2][Technical] When a book is downloaded, should `book.source` be mutated from `{type:'remote', url:...}` to `{type:'local', opfsPath:...}`, or should a separate `downloadState` field track this while preserving the original source for re-download?
- [Affects R9][Technical] Where does the storage indicator live in the UI? Settings page? Library toolbar? Both?

## Next Steps
-> `/ce:plan` for structured implementation planning
