# API / Plugin System — Exploration

> **Date:** 2026-03-28
> **Status:** Future Exploration (Wave 4-5)
> **Priority:** Low — explore after core features and sync are stable

---

## Vision

Expose Knowlune's data and functionality through a public REST API, and enable third-party extensions via a plugin architecture. This transforms Knowlune from a standalone app into a platform.

## REST API

### Use Cases

| Use Case | Consumer | Value |
|----------|----------|-------|
| External dashboards | Notion, custom tools | Display study stats outside Knowlune |
| Automation | Shortcuts, Zapier, n8n | "When I finish a course, add to my reading list" |
| Mobile app backend | React Native / Capacitor | Read/write data for native mobile app |
| CLI tools | Terminal | Import courses, check progress from command line |
| Third-party analytics | Grafana, custom | Study habit analysis beyond built-in Reports |

### Approach

- Build on existing Express proxy (`server/index.ts`)
- Auth via Supabase JWT (already implemented)
- RESTful endpoints for core resources: courses, progress, notes, flashcards, sessions, paths
- OpenAPI/Swagger spec for documentation
- Rate limiting (already have `rate-limiter-flexible`)
- CORS configuration (already have `ALLOWED_ORIGINS`)

### Endpoint Design (draft)

```
GET    /api/v1/courses                    # List courses
GET    /api/v1/courses/:id                # Course detail
GET    /api/v1/courses/:id/progress       # Course progress
GET    /api/v1/notes                      # List notes
GET    /api/v1/flashcards                 # List flashcards
GET    /api/v1/sessions                   # Study sessions
GET    /api/v1/stats/streaks              # Streak data
GET    /api/v1/stats/knowledge            # Knowledge scores
POST   /api/v1/courses/import             # Import course
POST   /api/v1/notes                      # Create note
POST   /api/v1/flashcards                 # Create flashcard
```

### Dependencies

- **Data Sync (Section 1):** API reads from Supabase Postgres, not IndexedDB. Without sync, API can only serve data from the Express server's perspective — which has none (local-first architecture).
- **Alternative:** API could serve from a server-side Dexie/SQLite instance, but this contradicts the local-first design. Better to wait for sync.

## Plugin Architecture

### Plugin Types

| Type | What It Does | Example |
|------|-------------|---------|
| **Content Importer** | Import from new sources | Coursera importer, Udemy importer, podcast RSS |
| **Export Format** | Export to new formats | Readwise, Notion, custom CSV schema |
| **UI Widget** | Add widgets to dashboard | Custom study timer, habit tracker, Pomodoro variants |
| **AI Provider** | Connect new LLM providers | Claude, Gemini, local models beyond Ollama |
| **Theme** | Custom visual themes | Community-created color schemes, fonts |
| **Study Method** | New learning techniques | Cornell notes template, mind mapping, concept mapping |

### Plugin Manifest (draft)

```json
{
  "name": "knowlune-plugin-coursera-import",
  "version": "1.0.0",
  "knowlune": {
    "minVersion": "2.0.0",
    "type": "content-importer",
    "entryPoint": "index.ts",
    "permissions": ["courses:write", "ui:settings"],
    "settings": {
      "courseraApiKey": { "type": "string", "required": true }
    }
  }
}
```

### Plugin API Surface

Plugins would get access to:
- **Store hooks:** Read/write to Zustand stores (courses, notes, flashcards)
- **DB access:** Scoped Dexie table access (own tables + read-only access to core)
- **UI slots:** Register widgets for Overview dashboard, Settings sections, course detail tabs
- **Events:** Subscribe to app events (lesson completed, quiz taken, session ended)
- **AI proxy:** Send requests through the existing AI proxy (respects entitlements)

### Security Considerations

- Plugins run in the browser — no sandboxing by default
- Permission model: plugins declare required permissions, user approves on install
- Code review: for a plugin marketplace, require review before listing
- Data isolation: plugins get their own Dexie tables, can't write to core tables without permission

## Phased Approach

| Phase | What | Effort | Wave |
|-------|------|--------|------|
| 1 | Internal REST API — Express endpoints for read access (courses, progress, stats) | Medium (1 epic) | Wave 4 |
| 2 | Write API + OpenAPI spec — create/update endpoints, Swagger documentation | Medium (1 epic) | Wave 4 |
| 3 | Plugin manifest + loader — JSON schema, dynamic import, permission model | Large (1-2 epics) | Wave 5 |
| 4 | Plugin marketplace — discovery, installation, updates, review process | Large (1-2 epics) | Wave 5+ |

## Decision Gates

| Gate | Question |
|------|----------|
| Before Phase 1 | "Is there a concrete consumer for the API? (mobile app, automation, external tool)" |
| Before Phase 3 | "Is there community demand for plugins? Are contributors requesting extensibility?" |
| Before Phase 4 | "Are there enough plugins to justify a marketplace vs. just npm packages?" |

## Effort: Large (3-5 epics total across Waves 4-5)
