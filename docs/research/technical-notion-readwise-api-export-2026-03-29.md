---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'Notion API and Readwise API for PKM export integration with Knowlune'
research_goals: 'Understand authentication flows, API capabilities, rate limits, error handling, and data modeling for syncing notes/flashcards/highlights to Notion and Readwise'
user_name: 'Pedro'
date: '2026-03-29'
web_research_enabled: true
source_verification: true
---

# PKM Export Integration: Notion API & Readwise API Technical Research

**Date:** 2026-03-29
**Author:** Pedro
**Research Type:** Technical
**Confidence Level:** High — based on official API documentation and verified community sources

---

## Research Overview

This research investigates the Notion REST API v1 and Readwise API v2/v3 for integrating Knowlune's PKM export pipeline. Knowlune already has local Markdown/JSON export (E53-S01) and Anki APKG export (E53-S02). This research targets a future epic that would add cloud sync to Notion (notes, flashcards as database items) and Readwise (highlights, bookmarks). The research covers authentication flows, API capabilities, data modeling strategies, rate limits, error handling, and architectural recommendations specific to Knowlune's React/TypeScript/Supabase stack. For the full executive summary, see Section 8 below.

---

## Table of Contents

1. [Technical Research Scope](#1-technical-research-scope)
2. [Notion API Deep Dive](#2-notion-api-deep-dive)
3. [Readwise API Deep Dive](#3-readwise-api-deep-dive)
4. [Authentication Architecture](#4-authentication-architecture)
5. [Data Modeling: Knowlune to Notion](#5-data-modeling-knowlune-to-notion)
6. [Data Modeling: Knowlune to Readwise](#6-data-modeling-knowlune-to-readwise)
7. [Error Handling and Resilience Patterns](#7-error-handling-and-resilience-patterns)
8. [Strategic Recommendations](#8-strategic-recommendations)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Risk Assessment](#10-risk-assessment)
11. [Source Documentation](#11-source-documentation)

---

## 1. Technical Research Scope

**Research Topic:** Notion API and Readwise API for PKM export integration with Knowlune

**Research Goals:**
- Understand OAuth 2.0 and token-based authentication flows for both APIs
- Map Knowlune data types (notes, flashcards, bookmarks, highlights) to API capabilities
- Identify rate limits, payload constraints, and error handling patterns
- Recommend data structures (Notion databases vs pages, Readwise highlight grouping)
- Assess feasibility for a future epic beyond E53

**Knowlune Context:**
- E53 (PKM Export Phase 1): Markdown/JSON export, Anki APKG export, batch export settings UI
- E3: Smart note system with rich text, tags, course associations
- E11: Knowledge retention with flashcards (SM-2 spaced repetition), bookmarks, highlights
- Uses Supabase for auth (Epic 19), IndexedDB for local data
- React 19 + TypeScript + Vite stack

---

## 2. Notion API Deep Dive

### 2.1 API Overview

The Notion REST API v1 provides programmatic access to Notion workspaces. Base URL: `https://api.notion.com/v1/`. All requests require `Notion-Version` header (current: `2022-06-28` — still the latest stable version as of 2026).

_Source: [Notion API Authorization Docs](https://developers.notion.com/docs/authorization)_

### 2.2 Authentication: Internal vs Public Integrations

**Internal Integrations** (simpler, single-workspace):
- Use a static **Internal Integration Token** (secret) generated from the integration settings page
- Token never expires (but can be regenerated)
- The workspace owner creates the integration and manually shares pages/databases with it
- Best for: personal tools, single-user apps, prototyping
- No OAuth flow needed — just pass the token in `Authorization: Bearer {secret}`

**Public Integrations** (multi-user, OAuth 2.0):
- Full OAuth 2.0 authorization code flow
- Users choose which pages/databases to share during the consent screen
- Tokens are per-workspace, per-user
- Requires `client_id`, `client_secret`, and a redirect URI
- Token endpoint: `POST https://api.notion.com/v1/oauth/token`
- Basic Auth header with `client_id:client_secret` (base64 encoded)

**OAuth 2.0 Flow (Public Integration):**
1. Redirect user to `https://api.notion.com/v1/oauth/authorize?client_id={id}&redirect_uri={uri}&response_type=code`
2. User grants access and selects pages/databases
3. Notion redirects back with `?code={auth_code}`
4. Exchange code for tokens: `POST /v1/oauth/token` with `grant_type=authorization_code`
5. Response includes `access_token`, `refresh_token`, `workspace_id`, `bot_id`

**Token Refresh:**
- Access tokens expire after approximately 1-2 days
- Refresh via `POST /v1/oauth/token` with `grant_type=refresh_token`
- The refresh token itself rotates on each use (save the new one)
- Community reports indicate tokens expire roughly 3+ times per week, requiring robust refresh logic

_Source: [Notion Authorization Guide](https://developers.notion.com/guides/get-started/authorization), [Notion OAuth Community Discussion](https://github.com/makenotion/notion-mcp-server/issues/225)_

### 2.3 Core API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/pages` | POST | Create a page (with content blocks) |
| `/v1/pages/{id}` | PATCH | Update page properties |
| `/v1/databases` | POST | Create a database |
| `/v1/databases/{id}/query` | POST | Query database items |
| `/v1/blocks/{id}/children` | PATCH | Append blocks to a page |
| `/v1/blocks/{id}/children` | GET | Retrieve block children |
| `/v1/search` | POST | Search pages/databases by title |

### 2.4 Block Types (Content Model)

Notion content is a tree of typed blocks. Each block has a `type` and type-specific properties. Relevant block types for Knowlune export:

| Block Type | Use Case in Knowlune |
|-----------|---------------------|
| `paragraph` | Note body text, bookmark descriptions |
| `heading_1`, `heading_2`, `heading_3` | Section headers, course/lesson names |
| `bulleted_list_item` | Tag lists, bookmark collections |
| `numbered_list_item` | Ordered steps, flashcard sequences |
| `callout` | Flashcard Q/A display, important highlights |
| `code` | Code snippets in notes |
| `toggle` | Flashcard front/back (front visible, back hidden) |
| `divider` | Section separators |
| `quote` | Highlight text |
| `table_of_contents` | Auto-generated TOC for long notes |
| `bookmark` | External URL references |

**Block Nesting:** Maximum 2 levels of nested children per API request. Deeper nesting requires multiple requests.

_Source: [Notion Block Reference](https://developers.notion.com/reference/block), [Working with Page Content](https://developers.notion.com/docs/working-with-page-content)_

### 2.5 Rate Limits and Payload Constraints

| Constraint | Limit |
|-----------|-------|
| Request rate | Average 3 requests/second per integration |
| Burst allowance | Some bursts above 3 req/s permitted |
| Rate limit response | HTTP 429 with `Retry-After` header (seconds) |
| Max blocks per page creation | 1,000 total |
| Max blocks per array | 100 elements |
| Max nesting depth per request | 2 levels |
| Max payload size | 500 KB |

**Implications for Knowlune:**
- A large note with 100+ paragraphs fits within limits
- Flashcard bulk export (e.g., 500 cards) needs batching: ~167 API calls at 3 cards/call, taking ~56 seconds at rate limit
- Batch operations should use a request queue with exponential backoff

_Source: [Notion Request Limits](https://developers.notion.com/reference/request-limits), [Rate Limit Best Practices](https://thomasjfrank.com/how-to-handle-notion-api-request-limits/)_

### 2.6 Error Codes

| HTTP Status | Error Code | Meaning | Retry? |
|------------|-----------|---------|--------|
| 400 | `validation_error` | Invalid request body | No — fix payload |
| 401 | `unauthorized` | Bad/expired token | No — refresh token first |
| 403 | `restricted_resource` | No access to resource | No — user must share |
| 404 | `object_not_found` | Page/DB deleted or not shared | No — prompt user |
| 409 | `conflict_error` | Concurrent modification | Yes — retry with fresh data |
| 429 | `rate_limited` | Too many requests | Yes — respect `Retry-After` |
| 500 | `internal_server_error` | Notion server error | Yes — exponential backoff |
| 503 | `service_unavailable` | Notion is down | Yes — backoff, show user status |

_Source: [Notion Status Codes](https://developers.notion.com/reference/status-codes), [notion-sdk-js errors.ts](https://github.com/makenotion/notion-sdk-js/blob/main/src/errors.ts)_

---

## 3. Readwise API Deep Dive

### 3.1 API Overview

Readwise provides two APIs:
1. **Readwise API v2** (`https://readwise.io/api/v2/`) — manages highlights, books, tags
2. **Reader API v3** (`https://readwise.io/api/v3/`) — manages documents in Reader (save URLs, create highlights within Reader)

Both use token-based authentication. No OAuth 2.0 flow — users generate a personal access token from `https://readwise.io/access_token`.

_Source: [Readwise API Documentation](https://readwise.io/api_deets), [Reader API Documentation](https://readwise.io/reader_api)_

### 3.2 Authentication

**Token-Based (Primary Method):**
- User obtains token from `https://readwise.io/access_token`
- All requests include header: `Authorization: Token {access_token}`
- Tokens do not expire (persist until revoked)
- No refresh mechanism needed

**OAuth (For Third-Party Integrations):**
- Readwise does support OAuth for registered integrations
- Requires OAuth credentials, HTTPS-enabled environment
- Less commonly used than the direct token approach

**Recommendation for Knowlune:** Use the direct token approach. User pastes their Readwise access token in Knowlune Settings. Simpler, no server-side OAuth infrastructure needed.

_Source: [Readwise API Details](https://readwise.io/api_deets)_

### 3.3 Core API v2 Endpoints (Highlights)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/highlights/` | GET | List all highlights |
| `/api/v2/highlights/` | POST | Create highlights (batch) |
| `/api/v2/highlights/{id}/` | GET | Get single highlight |
| `/api/v2/highlights/{id}/tags/` | POST | Add tag to highlight |
| `/api/v2/books/` | GET | List all books/sources |
| `/api/v2/books/{id}/tags/` | POST | Add tag to book |
| `/api/v2/export/` | GET | Export highlights (with `updatedAfter` filter) |
| `/api/v2/auth/` | GET | Verify token validity |

### 3.4 Highlight Creation Payload

```typescript
// POST /api/v2/highlights/
{
  "highlights": [
    {
      "text": "The actual highlight text",           // required
      "title": "Source Book/Article Title",           // required (creates/matches book)
      "author": "Author Name",                       // optional
      "source_url": "https://...",                    // optional
      "source_type": "article",                       // optional
      "category": "books" | "articles" | "tweets" | "podcasts",
      "note": "User's note about this highlight",    // optional
      "location": 42,                                 // optional (position in source)
      "location_type": "order",                       // optional
      "highlighted_at": "2026-03-29T12:00:00Z",     // optional (ISO 8601)
      "highlight_url": "https://..."                  // optional (deep link)
    }
  ]
}
```

**Response:** Includes `modified_highlights` array with IDs of created/updated highlights.

**Tags:** Not a direct field in highlight creation. Must be added separately via `POST /api/v2/highlights/{id}/tags/` with `{ "name": "tag-name" }`.

_Source: [Readwise API Details](https://readwise.io/api_deets)_

### 3.5 Reader API v3 Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v3/save/` | POST | Save a URL/document to Reader |
| `/api/v3/list/` | GET | List documents with filters |

**Save Document Payload:**
```typescript
// POST /api/v3/save/
{
  "url": "https://example.com/article",
  "tags": ["knowlune", "course-name"],
  "location": "later",                    // "new", "later", "archive"
  "title": "Custom Title",                // optional override
  "author": "Author Name",                // optional
  "summary": "Brief summary",             // optional
  "html": "<p>Full HTML content</p>"       // optional (for non-URL content)
}
```

_Source: [Reader API Documentation](https://readwise.io/reader_api)_

### 3.6 Rate Limits

| API | Endpoint | Limit |
|-----|---------|-------|
| Readwise v2 | General | 240 requests/minute per token |
| Readwise v2 | Highlight LIST, Book LIST | 20 requests/minute per token |
| Reader v3 | General | 20 requests/minute |
| Reader v3 | Create/Update | 50 requests/minute |
| All | Rate exceeded response | HTTP 429 with `Retry-After` header |

**Implications for Knowlune:**
- Highlight creation at 240 req/min is generous — 500 highlights could be created in ~2 minutes (batching multiple per request)
- Tag addition is the bottleneck: one request per tag per highlight at 240 req/min
- Pre-batch tags by grouping highlights, or accept eventual tag sync

_Source: [Readwise API Rate Limits](https://readwise.io/api_deets), [Reader API Rate Limits](https://readwise.io/reader_api)_

---

## 4. Authentication Architecture

### 4.1 Recommendation: Hybrid Approach

| Service | Auth Method | Why |
|---------|------------|-----|
| **Notion** | Public Integration (OAuth 2.0) | Users need to select which pages/databases to share; internal token requires manual page sharing which is poor UX |
| **Readwise** | Direct Token | Simple paste-and-go; tokens don't expire; no server infrastructure needed |

### 4.2 Notion OAuth Implementation

**Required Infrastructure:**
- Supabase Edge Function as OAuth callback handler (Knowlune already uses Supabase for auth)
- Token storage in Supabase `user_settings` table (encrypted)
- Client-side token refresh with retry logic

**Flow:**
1. User clicks "Connect Notion" in Knowlune Settings
2. Redirect to Notion OAuth consent screen
3. User selects workspace and pages to share
4. Notion redirects to Supabase Edge Function with auth code
5. Edge Function exchanges code for tokens, stores in DB
6. Client receives success callback, shows connected state

**Token Refresh Strategy:**
```typescript
async function notionRequest(endpoint: string, options: RequestInit) {
  let response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Notion-Version': '2022-06-28' }
  });

  if (response.status === 401) {
    const newTokens = await refreshNotionToken(refreshToken);
    // Save new tokens (both access AND refresh — refresh rotates)
    response = await fetch(/* retry with new token */);
  }

  return response;
}
```

### 4.3 Readwise Token Implementation

**Flow:**
1. User clicks "Connect Readwise" in Knowlune Settings
2. Modal with instructions: "Get your token from readwise.io/access_token"
3. User pastes token
4. Validate via `GET /api/v2/auth/` (returns 204 if valid)
5. Store token in Supabase `user_settings` (encrypted) or IndexedDB (local-only mode)

### 4.4 Disconnection and Revocation

Both services should support:
- "Disconnect" button in Settings that clears stored tokens
- Graceful handling when tokens are revoked externally (Notion: 401, Readwise: 401)
- Clear user messaging: "Your Notion connection has expired. Please reconnect."

---

## 5. Data Modeling: Knowlune to Notion

### 5.1 Recommendation: One Database per Data Type

After analyzing Notion's API constraints and best practices, the recommended approach is **one Notion database per Knowlune data type**, not one database per course.

| Knowlune Data Type | Notion Structure | Why |
|--------------------|-----------------|----|
| **Notes** | Database: "Knowlune Notes" | Queryable by course, tags; structured properties |
| **Flashcards** | Database: "Knowlune Flashcards" | SM-2 metadata as properties; toggle blocks for Q/A |
| **Bookmarks** | Database: "Knowlune Bookmarks" | Timestamp, course, lesson as properties |
| **Highlights** | Database: "Knowlune Highlights" | Source text, note, position as properties |

**Why not one page per note?** Standalone pages lack structured queryability. Database items (which are pages with properties) give users filtering, sorting, grouping, and relation capabilities in Notion.

**Why not one database per course?** Creates database sprawl (20 courses = 80 databases). A single database with a "Course" property is cleaner and lets users create Notion views per course.

_Source: [Working with Databases](https://developers.notion.com/docs/working-with-databases), [Pages vs Databases Best Practice](https://slowisbetter.medium.com/understand-the-difference-between-notion-pages-and-databases-613ac7406853)_

### 5.2 Notes Database Schema

**Database Properties:**
| Property | Type | Maps To |
|----------|------|---------|
| `Title` | title | Note title |
| `Course` | select | Course name |
| `Tags` | multi_select | Note tags array |
| `Created` | date | Note creation date |
| `Updated` | date | Note last modified |
| `Knowlune ID` | rich_text | Note UUID (for sync dedup) |
| `Source` | url | Link back to Knowlune |

**Page Content (Blocks):**
- `heading_2` — Section headers within the note
- `paragraph` — Body text
- `bulleted_list_item` — Lists
- `code` — Code snippets
- `callout` — Key takeaways (icon: lightbulb)
- `quote` — Referenced highlights

### 5.3 Flashcards Database Schema

**Database Properties:**
| Property | Type | Maps To |
|----------|------|---------|
| `Title` | title | Flashcard front (question) |
| `Course` | select | Course name |
| `Deck` | select | Deck/topic grouping |
| `Tags` | multi_select | Derived tags |
| `Interval` | number | SM-2 interval (days) |
| `Ease Factor` | number | SM-2 ease factor |
| `Review Count` | number | Total reviews |
| `Next Review` | date | Next scheduled review |
| `Knowlune ID` | rich_text | Flashcard UUID |

**Page Content:**
- `callout` (blue, icon: question mark) — Front / Question
- `divider`
- `callout` (green, icon: check) — Back / Answer
- `paragraph` — Additional context or note

### 5.4 Sync Strategy

**Initial Export:** Create database (if not exists) + create all items. Use `Knowlune ID` property to track which items have been synced.

**Incremental Sync:** Query Notion database for items with matching `Knowlune ID`, compare `Updated` timestamps, update only changed items.

**Conflict Resolution:** Knowlune is the source of truth. Notion edits are overwritten on next sync (one-way sync for v1).

---

## 6. Data Modeling: Knowlune to Readwise

### 6.1 Mapping Strategy

| Knowlune Data | Readwise Concept | API Endpoint |
|---------------|-----------------|-------------|
| **Highlights** (from videos/courses) | Highlights within a "Book" | `POST /api/v2/highlights/` |
| **Bookmarks** (timestamped) | Highlights with location | `POST /api/v2/highlights/` |
| **Notes** | Not ideal for Readwise | Consider skipping or as Reader documents |
| **Flashcards** | Not ideal for Readwise | Consider skipping |

**Recommendation:** Export highlights and bookmarks to Readwise. Notes and flashcards are better suited for Notion.

### 6.2 Highlight Mapping

```typescript
// Knowlune highlight → Readwise highlight
{
  text: highlight.selectedText,
  title: course.title,                    // groups under one "book"
  author: course.instructor,
  source_url: `https://knowlune.app/courses/${course.id}`,
  category: "articles",                   // closest fit for course content
  note: highlight.userNote || "",
  location: highlight.position,
  location_type: "order",
  highlighted_at: highlight.createdAt
}
```

### 6.3 Bookmark Mapping

```typescript
// Knowlune bookmark → Readwise highlight
{
  text: `[${formatTimestamp(bookmark.timestamp)}] ${bookmark.label || "Bookmark"}`,
  title: `${course.title} - ${lesson.title}`,
  author: course.instructor,
  source_url: `https://knowlune.app/courses/${course.id}/lessons/${lesson.id}`,
  category: "articles",
  note: bookmark.note || "",
  location: bookmark.timestamp,           // seconds as location
  location_type: "time_offset",
  highlighted_at: bookmark.createdAt
}
```

### 6.4 Tag Sync

Tags must be added after highlight creation (separate API calls):

```typescript
// After creating highlights, add tags
for (const highlight of createdHighlights) {
  for (const tag of deriveTags(highlight)) {
    await fetch(`https://readwise.io/api/v2/highlights/${highlight.id}/tags/`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` },
      body: JSON.stringify({ name: tag })
    });
  }
}
```

**Tag derivation:** Course name (kebab-cased) + source tags + "knowlune" meta-tag.

---

## 7. Error Handling and Resilience Patterns

### 7.1 Retry Strategy (Both APIs)

```typescript
async function apiRequestWithRetry(
  requestFn: () => Promise<Response>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await requestFn();

    if (response.ok) return response;

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (response.status >= 500 && attempt < maxRetries) {
      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 500;
      await sleep(delay);
      continue;
    }

    // Non-retryable error
    throw new ApiError(response.status, await response.json());
  }
  throw new MaxRetriesError();
}
```

### 7.2 Offline and API Down Handling

**Strategy:** Queue-based export with IndexedDB persistence.

1. User triggers "Sync to Notion" / "Sync to Readwise"
2. Export jobs are written to an IndexedDB `sync_queue` table
3. A background sync worker processes the queue
4. If API is down (5xx), jobs remain in queue with backoff timestamps
5. UI shows sync status: "3 items pending", "Last synced: 2 minutes ago"
6. On reconnection, queue drains automatically

### 7.3 Notion-Specific Error Handling

| Scenario | Detection | Response |
|----------|-----------|----------|
| Token expired | 401 `unauthorized` | Auto-refresh token, retry |
| Page deleted by user | 404 `object_not_found` | Remove from sync mapping, notify user |
| Database schema changed | 400 `validation_error` | Re-validate schema, prompt user |
| Concurrent edit | 409 `conflict_error` | Retry with fresh data |
| Rate limited | 429 `rate_limited` | Respect `Retry-After` header |

### 7.4 Readwise-Specific Error Handling

| Scenario | Detection | Response |
|----------|-----------|----------|
| Invalid token | 401 | Prompt user to re-enter token |
| Rate limited | 429 | Respect `Retry-After`, batch more aggressively |
| Duplicate highlight | 200 (returns existing) | No-op, update `modified_highlights` mapping |
| Service unavailable | 5xx | Queue for retry with backoff |

---

## 8. Strategic Recommendations

### 8.1 Key Technical Findings

1. **Notion OAuth adds complexity** but is necessary for good UX — internal tokens require manual page sharing
2. **Readwise token auth is trivial** — paste-and-go, no expiration, no refresh needed
3. **Rate limits are manageable** — Notion at 3 req/s and Readwise at 240 req/min support reasonable batch sizes
4. **Notion's 1,000 block limit per page** creation is generous for individual notes/flashcards
5. **Readwise tags require separate API calls** — this is the main performance bottleneck
6. **One-way sync (Knowlune → external)** is the right v1 approach — bidirectional sync is significantly more complex

### 8.2 Technology Recommendations

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Notion auth | Public Integration (OAuth 2.0) via Supabase Edge Function | Best UX, users select what to share |
| Readwise auth | Direct token paste | Simplest, tokens don't expire |
| Notion data model | One database per data type (Notes, Flashcards, Bookmarks, Highlights) | Queryable, filterable, clean |
| Readwise data model | Highlights + Bookmarks only | Notes/flashcards don't map well to Readwise's model |
| Sync direction | One-way (Knowlune → external) for v1 | Bidirectional sync deferred to future epic |
| Sync mechanism | Queue-based with IndexedDB persistence | Handles offline, API downtime, partial failures |
| Notion SDK | `@notionhq/client` (official JS SDK) | Auto-retry, typed responses, maintained by Notion |
| Rate limit handling | Exponential backoff with jitter | Industry standard, both APIs support `Retry-After` |

### 8.3 What to Build vs What to Defer

**Build now (future epic beyond E53):**
- Notion OAuth flow via Supabase Edge Function
- Readwise token management in Settings
- Note export to Notion database
- Flashcard export to Notion database
- Highlight export to Readwise
- Bookmark export to Readwise
- Sync queue with retry logic
- Progress UI with status indicators

**Defer to later:**
- Bidirectional sync (Notion/Readwise → Knowlune)
- Real-time sync (webhooks)
- Notion template selection
- Readwise Reader document creation (vs highlights)
- Conflict resolution for bidirectional sync
- Bulk initial import from Notion/Readwise

---

## 9. Implementation Roadmap

### Phase 1: Foundation (1 story)
- Notion OAuth flow implementation (Supabase Edge Function)
- Readwise token management
- Settings UI: "Connected Services" panel
- Token validation and connection status

### Phase 2: Notion Export (2 stories)
- Create Notion databases (Notes, Flashcards) with proper schemas
- Note → Notion page with rich block content
- Flashcard → Notion database item with SM-2 properties
- Sync queue infrastructure with IndexedDB persistence
- Progress indicators and error toasts

### Phase 3: Readwise Export (1 story)
- Highlight → Readwise highlight creation (batch)
- Bookmark → Readwise highlight creation
- Tag sync (batched, with rate limit awareness)
- Dedup logic using `Knowlune ID` tracking

### Phase 4: Polish (1 story)
- Incremental sync (only changed items)
- Sync history and status dashboard
- Error recovery UI
- "Last synced" timestamps per service

**Estimated total: 5 stories across 1 epic**

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Notion token expires frequently (1-2 days) | High | Medium | Robust auto-refresh, clear re-auth UX |
| Readwise API changes (v2 → v4) | Low | High | Abstract behind service interface, version pin |
| Rate limit bottleneck on tag sync | Medium | Low | Batch tag creation, accept eventual consistency |
| Notion database schema drift (user edits) | Medium | Medium | Schema validation before sync, graceful degradation |
| OAuth callback complexity with Supabase | Medium | Medium | Follow Supabase Auth Hooks pattern, test thoroughly |
| User deletes Notion database | Low | High | Detect 404, offer to recreate, warn user |

---

## 11. Source Documentation

### Primary Sources (Official Documentation)
- [Notion API Authorization](https://developers.notion.com/docs/authorization)
- [Notion Authorization Guide](https://developers.notion.com/guides/get-started/authorization)
- [Notion Block Reference](https://developers.notion.com/reference/block)
- [Notion Request Limits](https://developers.notion.com/reference/request-limits)
- [Notion Status Codes](https://developers.notion.com/reference/status-codes)
- [Notion Working with Page Content](https://developers.notion.com/docs/working-with-page-content)
- [Notion Working with Databases](https://developers.notion.com/docs/working-with-databases)
- [Notion Best Practices for API Keys](https://developers.notion.com/docs/best-practices-for-handling-api-keys)
- [Readwise API Documentation](https://readwise.io/api_deets)
- [Readwise Reader API](https://readwise.io/reader_api)
- [Readwise Highlights, Tags, and Notes](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes)

### Secondary Sources (Community & Analysis)
- [Notion Rate Limit Best Practices — Thomas Frank](https://thomasjfrank.com/how-to-handle-notion-api-request-limits/)
- [Understanding Notion API Rate Limits 2025 — Oreate AI](https://www.oreateai.com/blog/understanding-notion-api-rate-limits-in-2025-what-you-need-to-know/50d89b885182f65117ff8af2609b34c2)
- [Notion OAuth Token Expiration Issue — GitHub](https://github.com/makenotion/notion-mcp-server/issues/225)
- [Pages vs Databases — Medium](https://slowisbetter.medium.com/understand-the-difference-between-notion-pages-and-databases-613ac7406853)
- [notion-sdk-js Error Types — GitHub](https://github.com/makenotion/notion-sdk-js/blob/main/src/errors.ts)
- [Readwise Reader API CLI — GitHub](https://github.com/Scarvy/readwise-reader-api)
- [Readwise Rate Limit Issue — GitHub](https://github.com/fedragon/readwise-s3/issues/4)
- [Public Notion Integration Guide — Norah Sakal](https://norahsakal.com/blog/create-public-notion-integration/)

### Web Search Queries Used
1. "Notion API REST v1 authentication OAuth 2.0 internal integration 2025 2026"
2. "Notion API page creation database item block types rate limits 2025"
3. "Readwise API highlights export OAuth authentication endpoint 2025 2026"
4. "Readwise Reader API highlight creation tag mapping rate limits"
5. "Notion API block types list paragraph heading bulleted_list callout code toggle 2025"
6. "Readwise API v2 highlights create POST endpoint fields source_url note tags"
7. "Notion API error handling retry strategy token refresh best practices"
8. "Readwise Reader API v3 document creation save URL highlight creation 2025"
9. "Notion API OAuth token refresh access_token expiration public integration flow 2025"
10. "Notion API structure notes as pages vs database items best practice learning app"
11. "Readwise API v2 highlight tags highlight_tags endpoint add tags books"
12. "Notion API error codes conflict_error validation_error object_not_found handling"

---

**Technical Research Completion Date:** 2026-03-29
**Research Period:** Current comprehensive technical analysis
**Source Verification:** All technical facts cited with current sources
**Technical Confidence Level:** High — based on official API documentation and verified community sources

_This research document provides the technical foundation for a future Knowlune epic implementing cloud PKM export to Notion and Readwise, building on E53's local export infrastructure._
