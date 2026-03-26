---
story_id: E28-S03
story_name: "YouTube Data API v3 Client with Rate Limiting"
status: in-progress
started: 2026-03-26
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 23.3: YouTube Data API v3 Client with Rate Limiting

## Story

As a learner,
I want the app to fetch video metadata and playlist contents from YouTube efficiently,
So that I can preview videos before creating a course without hitting API quota limits.

## Acceptance Criteria

**Given** a valid YouTube API key is configured
**When** requesting metadata for a single video ID
**Then** the client returns title, duration, thumbnail URL, description, chapter markers, channel ID, channel name, and published date
**And** the response is cached in `youtubeVideoCache` with the configured TTL (default 7 days)

**Given** a valid YouTube API key is configured
**When** requesting metadata for multiple video IDs (e.g., 25 videos)
**Then** the client batches requests into groups of up to 50 video IDs per API call (1 quota unit per batch)
**And** the total response completes within 3 seconds per video (NFR70)

**Given** a valid YouTube API key is configured
**When** requesting a playlist's contents
**Then** the client paginates through all pages (50 items per page, 1 quota unit per page)
**And** videos are returned in playlist order
**And** the total response completes within 5 seconds for playlists of up to 200 videos (NFR70)

**Given** the rate limiter is active
**When** multiple API calls are made in rapid succession
**Then** the client-side token bucket limits requests to 3 per second
**And** excess requests queue and execute when tokens become available
**And** 429 responses trigger exponential backoff

**Given** the quota tracker
**When** API calls are made throughout the day
**Then** daily quota usage is tracked in localStorage with midnight PT reset
**And** a warning is surfaced when usage exceeds 400 of the 500-unit daily target (NFR69)

**Given** the API quota is exhausted or the API key is invalid
**When** a metadata request is made
**Then** the client falls back to YouTube oEmbed (`youtube.com/oembed?url=...`) for basic metadata (title, author, thumbnail)
**And** a toast notification warns: "YouTube API quota exceeded — showing limited metadata"

**Given** video metadata was previously cached
**When** requesting the same video within the TTL period
**Then** the cached data is returned without making an API call

**Given** video metadata was previously cached
**When** the TTL has expired
**Then** the client fetches fresh metadata from the API
**And** updates the cache with the new data

## Tasks / Subtasks

- [x] Task 1: Create `src/lib/youtubeRateLimiter.ts` — token bucket rate limiter (AC: rate limiter)
- [x] Task 2: Create `src/lib/youtubeQuotaTracker.ts` — daily quota tracking with localStorage (AC: quota tracker)
- [x] Task 3: Create `src/lib/youtubeApi.ts` — YouTube Data API v3 client (AC: all)
- [x] Task 4: Add YouTube API domains to CSP connect-src in index.html
- [x] Task 5: Unit tests for all three modules

## Implementation Notes

- YouTube API calls go direct from browser (CORS supported per technical notes) — not proxied
- Token bucket rate limiter: 3 requests/second, queue excess
- Quota tracking: localStorage with midnight PT reset, 500 units/day target, warning at 400
- Cache in IndexedDB via `youtubeVideoCache` table (Dexie v26 schema from E28-S01)
- oEmbed fallback when quota exhausted or API key invalid
- CSP: Added `https://www.googleapis.com` and `https://www.youtube.com` (oEmbed) to connect-src

## Testing Notes

Unit tests cover rate limiter, quota tracker, and API client with mocked fetch.

## Pre-Review Checklist

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions
- [x] No optimistic UI updates before persistence
- [x] Type guards on all dynamic lookups
- [x] If story calls external APIs: CSP allowlist configured

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[To be populated after implementation]
